"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { cloud, hasDevicePin, replaceProfilePhoto, setDevicePin, verifyDevicePin, type Household } from "@/lib/cloud";
import UsagePage from "./UsagePage";

type Section = "menu" | "account" | "home" | "pin" | "display" | "usage";

async function prepareProfilePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the photo");
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 512, 512);
    for (const quality of [0.86, 0.7, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= 1024 * 1024) return blob;
    }
    throw new Error("Photo is too large after resizing");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SettingsPage({ houses, activeId, defaultHouseholdId, inviteCode, busy, error, language, userId, isAdmin, profilePhotoUrl, displaySettings, onPhotoChanged, onMediaPickerStart, onMediaPickerEnd, onOpenAdmin, onOpenHistory, onSwitch, onMakeDefault, onRename, onInvite, onJoin, onSignOut }: {
  houses: Household[];
  activeId: string;
  defaultHouseholdId: string;
  inviteCode: string;
  busy: boolean;
  error: string;
  language: "th" | "en";
  userId: string;
  isAdmin: boolean;
  profilePhotoUrl: string;
  displaySettings: ReactNode;
  onPhotoChanged: (url: string) => void;
  onMediaPickerStart: () => void;
  onMediaPickerEnd: () => void;
  onOpenAdmin: () => void;
  onOpenHistory: () => void;
  onSwitch: (id: string) => void;
  onMakeDefault: (id: string) => void;
  onRename: (id: string, name: string) => Promise<boolean>;
  onInvite: () => void;
  onJoin: (code: string) => void;
  onSignOut: () => void;
}) {
  const en = language === "en";
  const [section, setSection] = useState<Section>("menu");
  const [code, setCode] = useState("");
  const [editingHouseId, setEditingHouseId] = useState("");
  const [editingHouseName, setEditingHouseName] = useState("");
  const [copied, setCopied] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState("");
  const pinKey = `baanjai-pin-device-${userId}`;
  const active = houses.find((house) => house.id === activeId);
  const canInvite = active?.role === "owner" || active?.role === "admin";


  useEffect(() => {
    setPinEnabled(localStorage.getItem(pinKey) === "enabled");
    let mounted = true;
    void hasDevicePin().then((exists) => { if (mounted) setPinExists(exists); }).catch((cause) => { if (mounted) setPinMessage(cause instanceof Error ? cause.message : String(cause)); });
    return () => { mounted = false; };
  }, [pinKey]);

  useEffect(() => {
    const clear = () => onMediaPickerEnd();
    const inputs = [galleryRef.current, cameraRef.current];
    for (const input of inputs) input?.addEventListener("cancel", clear);
    return () => { for (const input of inputs) input?.removeEventListener("cancel", clear); };
  }, [onMediaPickerEnd]);

  const photoChanged = async (event: ChangeEvent<HTMLInputElement>) => {
    onMediaPickerEnd();
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !userId) return;
    setPhotoBusy(true); setPhotoMessage("");
    try {
      const blob = await prepareProfilePhoto(file);
      const url = await replaceProfilePhoto(userId, blob);
      onPhotoChanged(url);
      setPhotoMessage(en ? "Profile photo updated." : "เปลี่ยนรูปโปรไฟล์แล้ว");
    } catch (cause) {
      setPhotoMessage(cause instanceof Error ? cause.message : (en ? "Could not update photo." : "เปลี่ยนรูปไม่สำเร็จ"));
    } finally { setPhotoBusy(false); }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setPasswordMessage(en ? "Passwords do not match." : "รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    if (!cloud) return;
    setPasswordBusy(true);
    const { error: authError } = await cloud.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    setPasswordMessage(authError ? authError.message : (en ? "Password saved." : "บันทึกรหัสผ่านแล้ว"));
    if (!authError) { setNewPassword(""); setConfirmPassword(""); }
  };

  const savePin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPin !== confirmPin) { setPinMessage(en ? "PINs do not match." : "รหัส 6 หลักทั้งสองช่องไม่ตรงกัน"); return; }
    setPinBusy(true); setPinMessage("");
    try {
      if (!pinExists) {
        const { data: userData, error: userError } = await cloud!.auth.getUser();
        if (userError || !userData.user?.email) throw userError ?? new Error(en ? "Account email is unavailable." : "ไม่พบอีเมลของบัญชี");
        const { error: signInError } = await cloud!.auth.signInWithPassword({ email: userData.user.email, password: accountPassword });
        if (signInError) throw new Error(en ? "Enter your account password to set a PIN." : "กรุณาใส่รหัสผ่านบัญชีให้ถูกต้องก่อนตั้ง PIN");
      }
      const changed = await setDevicePin(newPin, pinExists ? currentPin : undefined);
      if (!changed) throw new Error(en ? "This PIN cannot be used. Check your old PIN or choose another code." : "ใช้รหัสนี้ไม่ได้ ตรวจรหัสเดิมหรือเลือกรหัสใหม่ที่ไม่ซ้ำกับบัญชีอื่น");
      if (!pinExists) { localStorage.setItem(pinKey, "enabled"); setPinEnabled(true); }
      setPinExists(true);
      setCurrentPin(""); setNewPin(""); setConfirmPin(""); setAccountPassword("");
      setPinMessage(en ? "PIN saved." : "บันทึก PIN แล้ว");
    } catch (cause) { setPinMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setPinBusy(false); }
  };

  const togglePin = async () => {
    if (pinEnabled) {
      localStorage.removeItem(pinKey);
      setPinEnabled(false);
      setPinMessage(en ? "PIN at app opening is off on this device." : "ปิดการถาม PIN ตอนเปิดแอปบนเครื่องนี้แล้ว");
      return;
    }
    if (!pinExists) { setPinMessage(en ? "Set a PIN below first." : "ตั้ง PIN ด้านล่างก่อน"); return; }
    if (currentPin.length !== 6) { setPinMessage(en ? "Enter your current six-digit PIN to turn it on." : "ใส่ PIN เดิม 6 หลักเพื่อเปิดใช้งาน"); return; }
    setPinBusy(true); setPinMessage("");
    try {
      if (!await verifyDevicePin(currentPin)) throw new Error(en ? "Incorrect PIN or temporarily locked." : "PIN ไม่ถูกต้องหรือถูกพักการลองชั่วคราว");
      localStorage.setItem(pinKey, "enabled");
      setPinEnabled(true);
      setPinMessage(en ? "PIN at app opening is on." : "เปิดการถาม PIN ตอนเปิดแอปแล้ว");
    } catch (cause) { setPinMessage(cause instanceof Error ? cause.message : String(cause)); }
    finally { setCurrentPin(""); setPinBusy(false); }
  };

  const title = section === "account" ? (en ? "Account" : "บัญชีของฉัน") : section === "home" ? (en ? "Family home" : "บ้านและครอบครัว") : section === "pin" ? (en ? "App PIN" : "PIN เข้าแอป") : section === "display" ? (en ? "Display" : "การแสดงผล") : section === "usage" ? (en ? "System usage" : "การใช้งานระบบ") : (en ? "Settings" : "ตั้งค่า");

  return <div className="settings-page">
    <header className="settings-page-head">{section !== "menu" && <button type="button" className="settings-back" onClick={() => setSection("menu")} aria-label={en ? "Back" : "ย้อนกลับ"}>‹</button>}<div><span>{en ? "Our Home" : "บ้านของเรา"}</span><h1>{title}</h1></div></header>
    {section === "menu" && <div className="settings-menu">
      {userId && <button type="button" onClick={() => setSection("account")}><span className="settings-menu-icon">◉</span><span><strong>{en ? "Account" : "จัดการบัญชี"}</strong><small>{en ? "Password and profile photo" : "รหัสผ่านและรูปโปรไฟล์"}</small></span><b>›</b></button>}
      {userId && <button type="button" onClick={() => setSection("home")}><span className="settings-menu-icon">⌂</span><span><strong>{en ? "Family home" : "บ้านและครอบครัว"}</strong><small>{en ? "Switch, invite, or join a home" : "สลับบ้าน เชิญ และเข้าร่วมบ้าน"}</small></span><b>›</b></button>}
      {userId && <button type="button" onClick={() => setSection("pin")}><span className="settings-menu-icon">⌑</span><span><strong>{en ? "App PIN" : "PIN เข้าแอป"}</strong><small>{en ? "Ask for six digits when opening" : "ถามรหัส 6 หลักเมื่อเปิดแอป"}</small></span><b>›</b></button>}
      <button type="button" onClick={() => setSection("display")}><span className="settings-menu-icon">◐</span><span><strong>{en ? "Display" : "การแสดงผล"}</strong><small>{en ? "Theme, colors, backup" : "ธีม สี และสำรองข้อมูล"}</small></span><b>›</b></button>
      <button type="button" onClick={onOpenHistory}><span className="settings-menu-icon">◷</span><span><strong>{en ? "History" : "ประวัติ"}</strong><small>{en ? "Browse all records" : "ดูรายการย้อนหลังทั้งหมด"}</small></span><b>›</b></button>
      {isAdmin && <button type="button" onClick={onOpenAdmin}><span className="settings-menu-icon">⚙</span><span><strong>{en ? "App administration" : "จัดการระบบ"}</strong><small>{en ? "Registration settings" : "ตั้งค่าการสมัครสมาชิก"}</small></span><b>›</b></button>}
      {isAdmin && <button type="button" onClick={() => setSection("usage")}><span className="settings-menu-icon">▤</span><span><strong>{en ? "System usage" : "การใช้งานระบบ"}</strong><small>{en ? "Supabase and Vercel" : "Supabase และ Vercel"}</small></span><b>›</b></button>}
      {userId && <button type="button" className="settings-signout" onClick={onSignOut}><span className="settings-menu-icon">↪</span><span><strong>{en ? "Sign out" : "ออกจากระบบ"}</strong></span><b>›</b></button>}
    </div>}
    {section === "account" && <div className="settings-sections">
      <section className="settings-card"><h2>{en ? "Profile photo" : "รูปโปรไฟล์"}</h2><div className="settings-profile-photo"><span className="settings-avatar">{profilePhotoUrl ? <img src={profilePhotoUrl} alt={en ? "Profile" : "รูปโปรไฟล์"}/> : "ค"}</span><div><strong>{en ? "Your photo" : "รูปของคุณ"}</strong><p>{en ? "Photos are cropped and reduced to under 1 MB." : "รูปจะถูกตัดและย่อให้น้อยกว่า 1 MB"}</p></div></div><div className="settings-button-row"><button type="button" className="secondary-button" disabled={photoBusy} onClick={() => { onMediaPickerStart(); galleryRef.current?.click(); }}>{en ? "Choose photo" : "เลือกรูป"}</button><button type="button" className="secondary-button" disabled={photoBusy} onClick={() => { onMediaPickerStart(); cameraRef.current?.click(); }}>{en ? "Take photo" : "ถ่ายรูป"}</button></div><input ref={galleryRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => void photoChanged(event)}/><input ref={cameraRef} className="visually-hidden" type="file" accept="image/*" capture="user" onChange={(event) => void photoChanged(event)}/>{photoMessage && <p role="status">{photoMessage}</p>}</section>
      <section className="settings-card"><h2>{en ? "Set or change password" : "ตั้งหรือเปลี่ยนรหัสผ่าน"}</h2><p>{en ? "Use this password to sign in with email." : "ใช้รหัสผ่านนี้เพื่อเข้าสู่ระบบด้วยอีเมล"}</p><form className="household-password-form" onSubmit={(event) => void changePassword(event)}><input type="password" minLength={8} required autoComplete="new-password" placeholder={en ? "New password (8+ characters)" : "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><input type="password" minLength={8} required autoComplete="new-password" placeholder={en ? "Confirm password" : "ยืนยันรหัสผ่าน"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/><button type="submit" className="primary-button" disabled={passwordBusy}>{en ? "Save password" : "บันทึกรหัสผ่าน"}</button></form>{passwordMessage && <p role="status">{passwordMessage}</p>}</section>
    </div>}
    {section === "home" && <div className="settings-sections">
      <section className="settings-card">
        <h2>{en ? "Your homes" : "บ้านที่เป็นสมาชิก"}</h2>
        {error && <p className="household-panel-error" role="alert">{error}</p>}
        <div className="household-list">{houses.map((house) => {
          const canRename = house.role === "owner" || house.role === "admin";
          const duplicateName = houses.some((other) => other.id !== house.id && other.name === house.name);
          return <div className="household-row" key={house.id}>
            <div className="household-row-top">
              <button type="button" className={`household-select ${house.id === activeId ? "selected" : ""}`} disabled={busy} onClick={() => onSwitch(house.id)}><span className="household-icon">⌂</span><span className="household-label"><strong>{house.name}{duplicateName ? ` · ${house.id.slice(0, 6).toUpperCase()}` : ""}</strong><small>{house.role === "owner" ? (en ? "Owner" : "เจ้าของ") : house.role === "admin" ? (en ? "Admin" : "ผู้ดูแล") : (en ? "Member" : "สมาชิก")}</small></span>{house.id === activeId && <b>✓</b>}</button>
              {canRename && <button type="button" className="household-edit" disabled={busy} aria-label={en ? `Rename ${house.name}` : `แก้ชื่อ ${house.name}`} onClick={() => { setEditingHouseId(house.id); setEditingHouseName(house.name); }}>✎</button>}
            </div>
            {editingHouseId === house.id ? <form className="household-inline-edit" onSubmit={(event) => { event.preventDefault(); void onRename(house.id, editingHouseName).then((saved) => { if (saved) setEditingHouseId(""); }); }}><input autoFocus value={editingHouseName} onChange={(event) => setEditingHouseName(event.target.value)} maxLength={60} required aria-label={en ? "Home name" : "ชื่อบ้าน"}/><button type="submit" className="primary-button" disabled={busy || !editingHouseName.trim() || editingHouseName.trim() === house.name}>{en ? "Save" : "บันทึก"}</button><button type="button" className="secondary-button" onClick={() => setEditingHouseId("")}>{en ? "Cancel" : "ยกเลิก"}</button></form> : <div className="household-row-bottom">{house.id === defaultHouseholdId ? <span className="household-default-label">★ {en ? "Default home" : "บ้านหลัก"}</span> : <button type="button" disabled={busy} onClick={() => onMakeDefault(house.id)}>☆ {en ? "Set as default" : "ตั้งเป็นบ้านหลัก"}</button>}</div>}
          </div>;
        })}</div>
      </section>
      {canInvite && <section className="settings-card"><h2>{en ? "Invite family" : "เชิญเข้าร่วมบ้าน"}</h2><p>{en ? "The single-use code expires in 7 days." : "รหัสใช้ได้ครั้งเดียวและหมดอายุใน 7 วัน"}</p><button type="button" className="primary-button" disabled={busy} onClick={onInvite}>{en ? "Create invite code" : "สร้างรหัสเชิญ"}</button>{inviteCode && <div className="household-invite-code"><code>{inviteCode}</code><button type="button" onClick={() => void navigator.clipboard.writeText(inviteCode).then(() => setCopied(true))}>{copied ? (en ? "Copied" : "คัดลอกแล้ว") : (en ? "Copy" : "คัดลอก")}</button></div>}</section>}
      <section className="settings-card"><h2>{en ? "Join a home" : "เข้าร่วมบ้าน"}</h2><p>{en ? "Enter an invite code shared by the home owner." : "กรอกรหัสเชิญที่เจ้าของบ้านส่งให้"}</p><form className="household-join-form" onSubmit={(event) => { event.preventDefault(); onJoin(code); }}><input required value={code} onChange={(event) => setCode(event.target.value)} placeholder={en ? "Invite code" : "รหัสเชิญ"} autoCapitalize="none" autoComplete="off"/><button type="submit" className="primary-button" disabled={busy || !code.trim()}>{busy ? (en ? "Please wait..." : "กรุณารอสักครู่...") : (en ? "Join" : "เข้าร่วม")}</button></form></section>
    </div>}
    {section === "pin" && <div className="settings-sections"><section className="settings-card"><h2>{en ? "Ask for PIN when opening the app" : "ถาม PIN เมื่อเปิดแอป"}</h2><p>{en ? "This applies to this signed-in device. Email sign-in remains available." : "ใช้กับเครื่องนี้ที่เข้าสู่ระบบแล้ว ยังเข้าใช้ด้วยอีเมลได้ตามปกติ"}</p><div className="settings-toggle-row"><span>{pinEnabled ? (en ? "On" : "เปิดอยู่") : (en ? "Off" : "ปิดอยู่")}</span><button type="button" className={`settings-switch ${pinEnabled ? "on" : ""}`} role="switch" aria-checked={pinEnabled} aria-label={en ? "Ask for PIN when opening the app" : "ถาม PIN เมื่อเปิดแอป"} disabled={pinBusy || pinExists === null} onClick={() => void togglePin()}><i/></button></div>{pinExists && !pinEnabled && <input className="settings-pin-input" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" placeholder={en ? "Current PIN to turn on" : "PIN เดิมเพื่อเปิดใช้งาน"} value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))}/>}</section><section className="settings-card"><h2>{pinExists ? (en ? "Change six-digit PIN" : "เปลี่ยน PIN 6 หลัก") : (en ? "Set six-digit PIN" : "ตั้ง PIN 6 หลัก")}</h2><p>{en ? "Choose a code that has not been used by another account." : "เลือกรหัสที่ไม่ซ้ำกับบัญชีอื่น"}</p>{pinExists === null ? <p>{en ? "Loading..." : "กำลังโหลด..."}</p> : <form className="household-password-form" onSubmit={(event) => void savePin(event)}>{!pinExists && <input type="password" minLength={8} required autoComplete="current-password" placeholder={en ? "Account password" : "รหัสผ่านบัญชี"} value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)}/>} {pinExists && <input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" placeholder={en ? "Current PIN" : "PIN เดิม"} value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))}/>}<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" placeholder={en ? "New six-digit PIN" : "PIN ใหม่ 6 หลัก"} value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))}/><input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="off" placeholder={en ? "Confirm new PIN" : "ยืนยัน PIN ใหม่"} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}/><button type="submit" className="primary-button" disabled={pinBusy}>{pinExists ? (en ? "Change PIN" : "เปลี่ยน PIN") : (en ? "Set PIN" : "ตั้ง PIN")}</button></form>}{pinMessage && <p role="status">{pinMessage}</p>}</section></div>}
    {section === "display" && <div className="settings-sections"><section className="settings-card">{displaySettings}</section></div>}
    {section === "usage" && isAdmin && <UsagePage language={language}/>}
  </div>;
}
