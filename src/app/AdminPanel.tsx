"use client";

import { useEffect, useState } from "react";
import { getSignupOpen, setSignupOpen } from "@/lib/cloud";

export default function AdminPanel({ language, onClose }: { language: "th" | "en"; onClose: () => void }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = language === "en";

  useEffect(() => {
    let active = true;
    void getSignupOpen().then((value) => { if (active) setOpen(value); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, []);

  const changeSignup = async () => {
    if (open === null || busy) return;
    setBusy(true);
    setError("");
    try { setOpen(await setSignupOpen(!open)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop household-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="household-panel admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-panel-title">
      <div className="household-panel-heading"><div><span>{en ? "System settings" : "ตั้งค่าระบบ"}</span><h2 id="admin-panel-title">{en ? "Admin management" : "หน้าจัดการผู้ดูแล"}</h2></div><button type="button" onClick={onClose} aria-label={en ? "Close" : "ปิด"}>×</button></div>
      <div className="admin-setting-card"><div className="admin-setting-copy"><strong>{en ? "Allow new registrations" : "เปิดรับสมัครสมาชิกใหม่"}</strong><p>{en ? "Turn this off to prevent new accounts from being created. Existing members can still sign in." : "ปิดเพื่อหยุดการสร้างบัญชีใหม่ สมาชิกเดิมยังเข้าสู่ระบบได้ตามปกติ"}</p><span className={`admin-status ${open ? "is-open" : "is-closed"}`}>{open === null ? (en ? "Loading…" : "กำลังโหลด…") : open ? (en ? "Registration open" : "เปิดรับสมัคร") : (en ? "Registration closed" : "ปิดรับสมัคร")}</span></div><button type="button" role="switch" aria-label={en ? "Allow new registrations" : "เปิดรับสมัครสมาชิกใหม่"} aria-checked={open === true} disabled={open === null || busy} className={`admin-switch ${open ? "on" : ""}`} onClick={() => void changeSignup()}><span/></button></div>
      {error && <p className="household-panel-error" role="alert">{error}</p>}
      <p className="admin-panel-note">{en ? "The Supabase Before User Created hook must be enabled for this setting to block direct API registrations." : "ต้องเปิด Before User Created hook ใน Supabase เพื่อให้การปิดรับสมัครมีผลกับการเรียก API โดยตรงด้วย"}</p>
    </section>
  </div>;
}
