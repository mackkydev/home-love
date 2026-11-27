"use client";

import Icon from "./Icon";
import type { PhoneHint, PhonePermission } from "./usePhoneNotifications";

export default function NotificationSettings({ language, permission, hint, enabled, busy, message, onEnable }: {
  language: "th" | "en"; permission: PhonePermission; hint: PhoneHint;
  enabled: boolean; busy: boolean; message: string; onEnable: () => void;
}) {
  const en = language === "en";
  return <section className="settings-card phone-notifications">
    <h2><Icon name="bell" size={20}/>{en ? "Phone notifications" : "การแจ้งเตือนบนมือถือ"}</h2>
    <p>{en ? "Allow this device to receive medicine and appointment reminders even when the app is closed." : "ยินยอมให้อุปกรณ์นี้รับแจ้งเตือนยาและนัดหมาย แม้ไม่ได้เปิดหน้าแอปอยู่"}</p>
    <div className={`phone-notification-status ${enabled ? "is-enabled" : ""}`}><Icon name={enabled ? "check" : "bell"} size={18}/><span>{enabled ? (en ? "This device is registered" : "เปิดสิทธิ์และบันทึกอุปกรณ์แล้ว") : permission === "denied" ? (en ? "Blocked in device settings" : "สิทธิ์แจ้งเตือนถูกปิดอยู่") : permission === "granted" ? (en ? "Permission granted — register this device" : "อนุญาตแล้ว กรุณาบันทึกอุปกรณ์") : (en ? "Not enabled on this device" : "ยังไม่ได้เปิดแจ้งเตือนบนอุปกรณ์นี้")}</span></div>
    <button type="button" className="primary-button" disabled={busy || enabled} onClick={onEnable}><Icon name={enabled ? "check" : "bell"} size={18}/>{busy ? (en ? "Saving…" : "กำลังบันทึก…") : enabled ? (en ? "Notifications enabled" : "เปิดแจ้งเตือนแล้ว") : (en ? "Set up and allow notifications" : "ตั้งค่าและยินยอมให้มือถือแจ้งเตือน")}</button>
    {hint === "ios-install" && <p className="notification-help">{en ? "iPhone: in Safari, tap Share > Add to Home Screen. Open the app icon, then tap the button above (iOS 16.4 or later)." : "iPhone: เปิดใน Safari > แชร์ > เพิ่มไปยังหน้าจอโฮม จากนั้นเปิดจากไอคอนแอปแล้วกดปุ่มด้านบน (iOS 16.4 ขึ้นไป)"}</p>}
    {hint === "unsupported" && <p className="notification-help">{en ? "Update your browser or iOS to a version that supports Web Push." : "กรุณาอัปเดตเบราว์เซอร์หรือ iOS ให้รองรับเว็บพุช"}</p>}
    {permission === "denied" && <p className="notification-help">{en ? "Allow notifications in your browser's site settings. On iPhone, go to Settings > Notifications > this app. Return here after enabling them." : "เปิดสิทธิ์จากการตั้งค่าเว็บไซต์ หรือบน iPhone ไปที่ การตั้งค่า > การแจ้งเตือน > แอปนี้ แล้วกลับมาหน้านี้ ระบบจะตรวจสถานะใหม่"}</p>}
    {message && <p role="status">{message}</p>}
    <p className="notification-help">{en ? "Delivery depends on your connection and phone settings. Turn off Focus or notification summaries for this app if you need prompt reminders." : "ความเร็วขึ้นกับอินเทอร์เน็ตและการตั้งค่ามือถือ หากต้องการรับทันที ให้ปิดโหมดโฟกัสและสรุปแจ้งเตือนตามเวลาสำหรับแอปนี้"}</p>
  </section>;
}
