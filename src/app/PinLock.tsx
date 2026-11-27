"use client";
import Icon from "./Icon";
import PinPad from "./PinPad";
import { pinError } from "@/lib/pin-errors";
import { isCompletePin } from "@/lib/pin-input";

import { useState, type FormEvent } from "react";
import { cloud, verifyDevicePin } from "@/lib/cloud";

export default function PinLock({ language, onUnlock }: { language: "th" | "en"; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = language === "en";

  const unlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCompletePin(pin) || busy) return;
    setBusy(true);
    setError("");
    try {
      if (await verifyDevicePin(pin)) onUnlock();
      else setError(en ? "Incorrect PIN or temporarily locked. Try again later." : "รหัสไม่ถูกต้อง หรือถูกพักการลองชั่วคราว กรุณาลองใหม่ภายหลัง");
    } catch (cause) {
      setError(pinError(cause, language));
    } finally {
      setPin("");
      setBusy(false);
    }
  };

  return <main className="cloud-auth-page pin-lock-page"><section className="cloud-auth-card pin-lock-card">
    <span className="brand-mark" aria-hidden="true"><Icon name="home" size={21}/></span>
    <h1>{en ? "Our Home" : "บ้านของเรา"}</h1>
    <h2>{en ? "Unlock this device" : "ปลดล็อกเครื่องนี้"}</h2>
    <p>{en ? "Enter the six-digit PIN set for your account." : "ใส่รหัส 6 หลักที่ตั้งไว้กับบัญชีของคุณ"}</p>
    <form onSubmit={(event) => void unlock(event)}>
      <PinPad value={pin} onChange={(value) => { setPin(value); setError(""); }} label={en ? "Six-digit PIN" : "รหัส 6 หลัก"} language={language} disabled={busy} autoFocus/>
      <button className="primary-button pin-primary-action" type="submit" disabled={busy || pin.length !== 6}>{busy ? (en ? "Checking..." : "กำลังตรวจสอบ...") : (en ? "Unlock" : "ปลดล็อก")}</button>
    </form>
    {error && <p className="cloud-error" role="alert">{error}</p>}
    <button className="pin-lock-signout" type="button" disabled={busy} onClick={() => void cloud?.auth.signOut()}>{en ? "Sign out and use email" : "ออกจากระบบแล้วใช้อีเมล"}</button>
  </section></main>;
}
