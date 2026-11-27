"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cloud, hasDevicePin, setDevicePin, verifyDevicePin } from "@/lib/cloud";
import { pinError } from "@/lib/pin-errors";
import { isCompletePin } from "@/lib/pin-input";
import PinPad from "./PinPad";
import PasswordInput from "./PasswordInput";
import Icon from "./Icon";
import { useToast } from "./ToastProvider";

function PinSetupDialog({ exists, mode, language, onSave, onEnable, onClose }: {
  exists: boolean; mode: "setup" | "enable"; language: "th" | "en";
  onSave: (pin: string, currentPin: string, password: string) => Promise<void>;
  onEnable: (pin: string) => Promise<void>; onClose: () => void;
}) {
  const en = language === "en";
  const [stage, setStage] = useState<"current" | "new" | "confirm" | "enable">(mode === "enable" ? "enable" : exists ? "current" : "new");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const value = stage === "current" || stage === "enable" ? currentPin : stage === "new" ? newPin : confirmation;
  const title = stage === "current" || stage === "enable" ? (en ? "Enter your current PIN" : "ใส่ PIN ปัจจุบัน") : stage === "new" ? (en ? "Set a new PIN" : "ตั้ง PIN ใหม่") : (en ? "Confirm your new PIN" : "ยืนยัน PIN ใหม่");
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const changePin = (pin: string) => {
    setError("");
    if (stage === "current" || stage === "enable") setCurrentPin(pin);
    else if (stage === "new") setNewPin(pin);
    else setConfirmation(pin);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !isCompletePin(value)) return;
    setError("");
    if (stage === "current") { setStage("new"); return; }
    if (stage === "new") { setConfirmation(""); setStage("confirm"); return; }
    if (stage === "confirm" && newPin !== confirmation) { setConfirmation(""); setError(en ? "The PINs do not match. Try again." : "PIN ยืนยันไม่ตรงกัน กรุณากดใหม่อีกครั้ง"); return; }
    setBusy(true);
    try {
      if (stage === "enable") await onEnable(currentPin);
      else await onSave(newPin, currentPin, password);
      onClose();
    } catch (cause) { setError(pinError(cause, language)); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="pin-setup-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form className="pin-setup-form" onSubmit={(event) => void submit(event)}>
      <div className="modal-top"><span className="pin-setup-brand"><Icon name="lock" size={22}/></span><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label={en ? "Close" : "ปิด"}><Icon name="close"/></button></div>
      <h2 id={titleId}>{title}</h2>
      <p className="pin-setup-description">{stage === "confirm" ? (en ? "Enter the same six digits again." : "กดรหัส 6 หลักเดิมอีกครั้ง") : stage === "current" || stage === "enable" ? (en ? "Use the six-digit PIN for this account." : "ใช้รหัส PIN 6 หลักของบัญชีนี้") : (en ? "Choose a six-digit code for opening the app." : "เลือกรหัสตัวเลข 6 หลักสำหรับเข้าแอป")}</p>
      {!exists && stage === "new" && <label className="form-label pin-account-password">{en ? "Account password" : "รหัสผ่านบัญชี"}<PasswordInput language={language} minLength={8} required autoComplete="current-password" value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)}/><small>{en ? "Confirm your identity before creating a PIN." : "ยืนยันตัวตนก่อนตั้ง PIN ครั้งแรก"}</small></label>}
      <PinPad key={stage} value={value} onChange={changePin} label={en ? "Six-digit PIN" : "PIN 6 หลัก"} language={language} disabled={busy} autoFocus/>
      {error && <p className="form-field-error pin-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button pin-primary-action" disabled={busy || !isCompletePin(value) || (!exists && stage === "new" && !password)}><Icon name={stage === "confirm" ? "check" : "arrow"} size={17}/>{busy ? (en ? "Saving…" : "กำลังดำเนินการ…") : stage === "confirm" ? (en ? "Save PIN" : "ตั้ง PIN") : stage === "enable" ? (en ? "Enable PIN" : "เปิดใช้งาน PIN") : (en ? "Continue" : "ถัดไป")}</button>
      {(stage === "confirm" || stage === "new" && exists) && <button type="button" className="text-button pin-step-back" disabled={busy} onClick={() => { setError(""); setStage(stage === "confirm" ? "new" : "current"); }}>{en ? "Back" : "ย้อนกลับ"}</button>}
    </form>
  </dialog>;
}

export default function PinSettings({ userId, language }: { userId: string; language: "th" | "en" }) {
  const en = language === "en";
  const notify = useToast();
  const [exists, setExists] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<"setup" | "enable" | null>(null);
  const storageKey = `baanjai-pin-device-${userId}`;
  useEffect(() => {
    let active = true;
    void hasDevicePin().then((value) => {
      let local = false;
      try { local = localStorage.getItem(storageKey) === "enabled"; } catch { /* The server PIN can still be managed without browser storage. */ }
      if (active) { setExists(value); setEnabled(value && local); setError(""); }
    }).catch((cause) => { if (active) setError(pinError(cause, language)); });
    return () => { active = false; };
  }, [storageKey, revision, language]);
  const save = async (pin: string, currentPin: string, password: string) => {
    if (exists === null || !cloud || !isCompletePin(pin)) throw new Error(en ? "Please sign in again." : "กรุณาเข้าสู่ระบบใหม่");
    if (!exists) {
      const { data, error } = await cloud.auth.getUser();
      if (error || !data.user?.email) throw error ?? new Error(en ? "Account email is unavailable." : "ไม่พบอีเมลบัญชี");
      const result = await cloud.auth.signInWithPassword({ email: data.user.email, password });
      if (result.error) throw new Error(en ? "Check your account password." : "กรุณาตรวจสอบรหัสผ่านบัญชี");
    }
    if (!await setDevicePin(pin, exists ? currentPin : undefined)) throw new Error(en ? "Check your current PIN or choose a different new PIN." : "ตรวจสอบ PIN เดิม หรือเลือกรหัสใหม่ที่ไม่ซ้ำกับบัญชีอื่น");
    // The PIN has already been saved on the server even if local storage fails.
    setExists(true);
    if (!exists) {
      try { localStorage.setItem(storageKey, "enabled"); setEnabled(true); }
      catch { notify(en ? "PIN saved. Enable it on this device when browser storage is available." : "บันทึก PIN แล้ว กรุณาเปิดใช้งานอีกครั้งเมื่ออุปกรณ์บันทึกข้อมูลได้", "info"); return; }
    }
    notify(en ? "PIN saved" : "บันทึก PIN สำเร็จ", "success");
  };
  const enable = async (pin: string) => {
    if (!isCompletePin(pin) || !await verifyDevicePin(pin)) throw new Error(en ? "Incorrect PIN or temporarily locked." : "PIN ไม่ถูกต้องหรือถูกพักการลองชั่วคราว");
    localStorage.setItem(storageKey, "enabled"); setEnabled(true);
    notify(en ? "PIN at app opening is enabled" : "เปิดใช้งาน PIN เข้าแอปแล้ว", "success");
  };
  const toggle = () => {
    if (exists === null) return;
    if (enabled) {
      try { localStorage.removeItem(storageKey); setEnabled(false); notify(en ? "PIN at app opening is off on this device" : "ปิดการถาม PIN บนเครื่องนี้แล้ว", "success"); }
      catch (cause) { setError(pinError(cause, language)); }
    } else setDialog(exists ? "enable" : "setup");
  };
  return <div className="settings-sections">
    <section className="settings-card"><h2>{en ? "Ask for PIN when opening the app" : "ถาม PIN เมื่อเปิดแอป"}</h2><p>{en ? "This setting applies to this signed-in device." : "ตั้งค่าสำหรับอุปกรณ์นี้ที่เข้าสู่ระบบแล้ว"}</p><div className="settings-toggle-row"><span>{enabled ? (en ? "On" : "เปิดอยู่") : (en ? "Off" : "ปิดอยู่")}</span><button type="button" className={`settings-switch ${enabled ? "on" : ""}`} role="switch" aria-checked={enabled} aria-label={en ? "Ask for PIN when opening the app" : "ถาม PIN เมื่อเปิดแอป"} disabled={exists === null} onClick={toggle}><i/></button></div></section>
    <section className="settings-card"><h2>{exists ? (en ? "Change PIN" : "เปลี่ยน PIN") : (en ? "Set PIN" : "ตั้ง PIN")}</h2><p>{en ? "Use the number pad to choose and confirm six digits." : "ใช้แป้นตัวเลขเลือกและยืนยันรหัส 6 หลัก"}</p>{error && <p className="form-field-error" role="alert">{error}</p>}{exists === null ? error ? <button type="button" className="secondary-button" onClick={() => { setError(""); setRevision((value) => value + 1); }}>{en ? "Try again" : "ลองอีกครั้ง"}</button> : <p role="status">{en ? "Loading…" : "กำลังโหลด…"}</p> : <button type="button" className="primary-button" onClick={() => setDialog("setup")}><Icon name="lock" size={17}/>{exists ? (en ? "Change PIN" : "เปลี่ยน PIN") : (en ? "Set PIN" : "ตั้ง PIN")}</button>}</section>
    {dialog && exists !== null && <PinSetupDialog exists={exists} mode={dialog} language={language} onSave={save} onEnable={enable} onClose={() => setDialog(null)}/>}
  </div>;
}
