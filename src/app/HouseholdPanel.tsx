"use client";

import { useState, type FormEvent } from "react";
import { cloud, type Household } from "@/lib/cloud";

export default function HouseholdPanel({
  houses, activeId, inviteCode, busy, error, language, isAdmin, onOpenAdmin, onClose, onSwitch, onInvite, onJoin, onSignOut,
}: {
  houses: Household[];
  activeId: string;
  inviteCode: string;
  busy: boolean;
  error: string;
  language: "th" | "en";
  isAdmin: boolean;
  onOpenAdmin: () => void;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onInvite: () => void;
  onJoin: (code: string) => void;
  onSignOut: () => void;
}) {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const en = language === "en";
  const active = houses.find((house) => house.id === activeId);
  const canInvite = active?.role === "owner" || active?.role === "admin";

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cloud) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage(en ? "Passwords do not match." : "รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setPasswordBusy(true);
    const { error: authError } = await cloud.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    setPasswordMessage(authError ? authError.message : (en ? "Password saved." : "บันทึกรหัสผ่านแล้ว"));
    if (!authError) { setNewPassword(""); setConfirmPassword(""); }
  };

  return <div className="modal-backdrop household-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="household-panel" role="dialog" aria-modal="true" aria-label={en ? "Household and account" : "จัดการบ้านและบัญชี"}>
      <div className="household-panel-heading"><div><span>{en ? "Family space" : "พื้นที่ครอบครัว"}</span><h2>{en ? "Household and account" : "จัดการบ้านและบัญชี"}</h2></div><button type="button" onClick={onClose} aria-label={en ? "Close" : "ปิด"}>×</button></div>

      <section className="household-panel-section"><h3>{en ? "Your households" : "บ้านที่คุณเป็นสมาชิก"}</h3><div className="household-list">{houses.map((house) => <button type="button" key={house.id} className={house.id === activeId ? "selected" : ""} disabled={busy} onClick={() => onSwitch(house.id)}><span>⌂</span><strong>{house.name}</strong><small>{house.role === "owner" ? (en ? "Owner" : "เจ้าของ") : house.role === "admin" ? (en ? "Admin" : "ผู้ดูแล") : (en ? "Member" : "สมาชิก")}</small>{house.id === activeId && <b>✓</b>}</button>)}</div></section>

      {canInvite && <section className="household-panel-section"><h3>{en ? "Invite family" : "เชิญคนในครอบครัว"}</h3><p>{en ? "Create a single-use code that expires in 7 days. Share it only with someone you trust." : "สร้างรหัสใช้ได้ครั้งเดียว หมดอายุใน 7 วัน ส่งให้เฉพาะคนที่ต้องการให้เห็นข้อมูลบ้านนี้"}</p><button type="button" className="primary-button" disabled={busy} onClick={onInvite}>{busy ? "..." : (en ? "Create invite code" : "สร้างรหัสเชิญ")}</button>{inviteCode && <><div className="household-invite-code"><code>{inviteCode}</code><button type="button" onClick={() => void navigator.clipboard.writeText(inviteCode).then(() => setCopyMessage(en ? "Copied" : "คัดลอกแล้ว")).catch(() => setCopyMessage(en ? "Select and copy the code" : "กรุณาเลือกและคัดลอกรหัส"))}>{en ? "Copy" : "คัดลอก"}</button></div>{copyMessage && <p role="status">{copyMessage}</p>}</>}</section>}

      <section className="household-panel-section"><h3>{en ? "Join a household" : "เข้าร่วมบ้าน"}</h3><p>{en ? "Sign in to your own account, then enter the code shared by the owner." : "เข้าสู่ระบบด้วยบัญชีของตัวเอง แล้วกรอกรหัสที่เจ้าของบ้านส่งให้"}</p><form className="household-join-form" onSubmit={(event) => { event.preventDefault(); onJoin(code); }}><input required value={code} onChange={(event) => setCode(event.target.value)} placeholder={en ? "Invite code" : "รหัสเชิญ"} autoCapitalize="none" autoComplete="off"/><button type="submit" className="primary-button" disabled={busy || !code.trim()}>{en ? "Join" : "เข้าร่วม"}</button></form></section>

      <section className="household-panel-section"><h3>{en ? "Password" : "รหัสผ่าน"}</h3><p>{en ? "If you previously signed in with an email link, set a password here for future sign-ins." : "หากเคยเข้าใช้ด้วยลิงก์อีเมล ตั้งรหัสผ่านที่นี่เพื่อใช้เข้าสู่ระบบครั้งต่อไป"}</p><form className="household-password-form" onSubmit={changePassword}><input type="password" minLength={8} required autoComplete="new-password" placeholder={en ? "New password (8+ characters)" : "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><input type="password" minLength={8} required autoComplete="new-password" placeholder={en ? "Confirm password" : "ยืนยันรหัสผ่าน"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/><button type="submit" className="secondary-button" disabled={passwordBusy}>{en ? "Save password" : "บันทึกรหัสผ่าน"}</button></form>{passwordMessage && <p role="status">{passwordMessage}</p>}</section>

      {isAdmin && <section className="household-panel-section"><h3>{en ? "App administration" : "ผู้ดูแลระบบ"}</h3><p>{en ? "Manage who can register for a new account." : "จัดการการเปิดรับสมัครสมาชิกใหม่"}</p><button type="button" className="admin-open-button" onClick={onOpenAdmin}>{en ? "Open admin settings" : "เปิดหน้าจัดการระบบ"} <span aria-hidden="true">›</span></button></section>}

      {error && <p className="household-panel-error" role="alert">{error}</p>}
      <button type="button" className="household-signout" onClick={onSignOut}>{en ? "Sign out" : "ออกจากระบบ"}</button>
    </section>
  </div>;
}
