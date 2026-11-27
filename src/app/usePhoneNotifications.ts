"use client";

import { useEffect, useRef, useState } from "react";
import { cloud } from "@/lib/cloud";

export type PhonePermission = NotificationPermission | "unsupported";
export type PhoneHint = "ios-install" | "unsupported" | "";

function capability(): PhoneHint {
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  if (ios && !standalone) return "ios-install";
  return !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window) ? "unsupported" : "";
}

function keyBytes(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (letter) => letter.charCodeAt(0));
}

async function workerReady() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Service worker timeout")), 12_000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function usePhoneNotifications(userId: string, ready: boolean, en: boolean, notify: (message: string) => void) {
  const [permission, setPermission] = useState<PhonePermission>("default");
  const [hint, setHint] = useState<PhoneHint>("");
  const [pushReady, setPushReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const generation = useRef({ value: 0 });

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const sequence = generation.current;
    const refresh = async () => {
      const request = ++sequence.value;
      const nextHint = capability();
      const nextPermission = "Notification" in window ? Notification.permission : "unsupported";
      setHint(nextHint); setPermission(nextPermission); setPushReady(false);
      if (nextHint || nextPermission !== "granted" || !userId || !cloud) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        const { data, error } = await cloud.from("push_subscriptions").select("endpoint").eq("endpoint", subscription.endpoint).eq("user_id", userId).maybeSingle();
        if (active && request === sequence.value) setPushReady(!error && Boolean(data));
      } catch { /* The enable button remains available to retry registration. */ }
    };
    const visible = () => { if (document.visibilityState === "visible" && !pending.current) void refresh(); };
    void refresh();
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; ++sequence.value; window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, [ready, userId]);

  const enablePush = async () => {
    if (pending.current) return;
    const nextHint = capability();
    setHint(nextHint);
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const fail = (text: string) => { setMessage(text); notify(text); };
    if (nextHint === "ios-install") { fail(en ? "On iPhone, add this app to the Home Screen in Safari, open its icon, then enable notifications." : "บน iPhone ให้เปิดผ่าน Safari เลือกแชร์ > เพิ่มไปยังหน้าจอโฮม แล้วเปิดจากไอคอนแอปก่อนกดยินยอม"); return; }
    if (nextHint) { fail(en ? "This device does not support Web Push. Please update your browser or iOS." : "อุปกรณ์นี้ยังไม่รองรับเว็บพุช กรุณาอัปเดตเบราว์เซอร์หรือ iOS"); return; }
    if (!cloud || !userId) { fail(en ? "Sign in before enabling notifications." : "กรุณาเข้าสู่ระบบก่อนเปิดการแจ้งเตือน"); return; }
    if (!publicKey) { fail(en ? "Push server is not configured yet." : "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าการส่งแจ้งเตือน"); return; }
    if (Notification.permission === "denied") { setPermission("denied"); fail(en ? "Allow notifications in your browser's site settings or your phone's Settings > Notifications, then return here." : "กรุณาเปิดสิทธิ์ในการตั้งค่าเว็บไซต์ หรือ การตั้งค่ามือถือ > การแจ้งเตือน > แอปนี้ แล้วกลับมาที่หน้านี้"); return; }
    pending.current = true; const request = ++generation.current.value; setBusy(true); setMessage("");
    try {
      // Keep the permission request directly in the tap handler for iOS.
      const allowed = await Notification.requestPermission();
      setPermission(allowed);
      if (allowed !== "granted") { fail(en ? "Permission was not granted. Tap again when ready." : "ยังไม่ได้รับอนุญาตแจ้งเตือน สามารถกดตั้งค่าอีกครั้งเมื่อพร้อม"); return; }
      const registration = await workerReady();
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const { data, error: userError } = await cloud.auth.getUser();
      if (userError || data.user?.id !== userId) throw new Error("Account changed");
      if (request !== generation.current.value) return;
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) throw new Error("Missing push keys");
      const { error } = await cloud.from("push_subscriptions").upsert({ endpoint: subscription.endpoint, user_id: userId, p256dh: keys.p256dh, auth_key: keys.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      if (request !== generation.current.value) return;
      setPushReady(true);
      const text = en ? "Phone notifications enabled" : "เปิดแจ้งเตือนบนมือถือและบันทึกอุปกรณ์แล้ว";
      setMessage(text); notify(text);
    } catch { if (request === generation.current.value) { setPushReady(false); fail(en ? "Could not save this device. Check your connection and try again." : "บันทึกอุปกรณ์แจ้งเตือนไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่"); } }
    finally { pending.current = false; setBusy(false); }
  };
  const clearDeviceState = () => { ++generation.current.value; setPushReady(false); setMessage(""); };
  return { permission, hint, pushReady, busy, message, enablePush, clearDeviceState };
}
