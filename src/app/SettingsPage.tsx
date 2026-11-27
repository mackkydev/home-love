"use client";
import PasswordInput from "./PasswordInput";
import ConfirmationPopup from "./ConfirmationPopup";
import PinSettings from "./PinSettings";
import { useToast } from "./ToastProvider";
import { compressPhoto } from "@/lib/image-upload";
import HouseholdUsage from "./HouseholdUsage";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cloud, listHouseholdPeople, manageHouseholdPerson, replaceProfilePhoto, type Household, type HouseholdPerson } from "@/lib/cloud";
import UsagePage from "./UsagePage";

type Section = "menu" | "account" | "home" | "pin" | "display" | "usage";

async function prepareProfilePhoto(file: File): Promise<Blob> {
  return (await fetch(await compressPhoto(file, 1024 * 1024, { maxWidth: 512, aspect: 1 }))).blob();
}

export default function SettingsPage({ houses, activeId, defaultHouseholdId, inviteCode, busy, error, language, userId, userEmail, isAdmin, profilePhotoUrl, userDisplayName, onDisplayNameChange, displaySettings, notificationPreferences, onNotificationPreferenceChange, onPhotoChanged, onMediaPickerStart, onMediaPickerEnd, onOpenAdmin, onOpenHistory, onSwitch, onMakeDefault, onRename, onInvite, onJoin, onSignOut }: {
  houses: Household[];
  activeId: string;
  defaultHouseholdId: string;
  inviteCode: string;
  busy: boolean;
  error: string;
  language: "th" | "en";
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  profilePhotoUrl: string;
  userDisplayName: string;
  onDisplayNameChange: (name: string) => Promise<boolean>;
  displaySettings: ReactNode;
  notificationPreferences: Record<string, boolean>;
  onNotificationPreferenceChange: (name: string, enabled: boolean) => void;
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
  const notify = useToast();
  const [section, setSection] = useState<Section>("menu");
  const [code, setCode] = useState("");
  const [profileName, setProfileName] = useState(userDisplayName);
  const [profileNameBusy, setProfileNameBusy] = useState(false);
  const [profileNameMessage, setProfileNameMessage] = useState("");
  useEffect(() => { setProfileName(userDisplayName); }, [userDisplayName]);
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
  const [people, setPeople] = useState<HouseholdPerson[]>([]);
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [peopleError, setPeopleError] = useState("");
  const [peopleRevision, setPeopleRevision] = useState(0);
  const [pendingMemberAction, setPendingMemberAction] = useState<{ person: HouseholdPerson; role: "admin" | "member" | "remove" } | null>(null);
  const active = houses.find((house) => house.id === activeId);
  const canInvite = active?.role === "owner" || active?.role === "admin";

  useEffect(() => { setPeople([]); }, [activeId]);
  useEffect(() => {
    if (section !== "home") return;
    const timer = setInterval(() => setPeopleRevision((revision) => revision + 1), 45_000);
    return () => clearInterval(timer);
  }, [section]);

  useEffect(() => {
    if (section !== "home" || !activeId || !userId) return;
    let current = true;
    setPeopleBusy(true);
    listHouseholdPeople(activeId).then((items) => { if (current) { setPeople(items); setPeopleError(""); } }).catch((cause) => { if (current) { setPeople([]); setPeopleError(cause instanceof Error ? cause.message : String(cause)); } }).finally(() => { if (current) setPeopleBusy(false); });
    return () => { current = false; };
  }, [section, activeId, userId, houses.length, peopleRevision]);

  const confirmMemberAction = async () => {
    if (!pendingMemberAction) return;
    setPeopleBusy(true);
    try {
      await manageHouseholdPerson(activeId, pendingMemberAction.person.user_id, pendingMemberAction.role);
      setPeopleRevision((revision) => revision + 1);
      setPeopleError("");
      notify(en ? "Member updated" : "บันทึกข้อมูลสมาชิกแล้ว", "success");
    } catch (cause) { setPeopleError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setPendingMemberAction(null); setPeopleBusy(false); }
  };




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
      notify(en ? "Profile photo updated" : "เปลี่ยนรูปโปรไฟล์แล้ว", "success");
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
    if (!authError) { setNewPassword(""); setConfirmPassword(""); notify(en ? "Password saved" : "บันทึกรหัสผ่านแล้ว", "success"); }
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
      {isAdmin && <button type="button" onClick={onOpenAdmin}><span className="settings-menu-icon">⚙</span><span><strong>{en ? "App administration" : "จัดการระบบ"}</strong><small>{en ? "Users, homes and usage limits" : "ผู้ใช้ บ้าน และโควตาการใช้งาน"}</small></span><b>›</b></button>}
      {isAdmin && <button type="button" onClick={() => setSection("usage")}><span className="settings-menu-icon">▤</span><span><strong>{en ? "System usage" : "การใช้งานระบบ"}</strong><small>{en ? "Supabase and Vercel" : "Supabase และ Vercel"}</small></span><b>›</b></button>}
      {userId && <button type="button" className="settings-signout" onClick={onSignOut}><span className="settings-menu-icon">↪</span><span><strong>{en ? "Sign out" : "ออกจากระบบ"}</strong></span><b>›</b></button>}
    </div>}
    {section === "account" && <div className="settings-sections">
      <section className="settings-card"><h2>{en ? "Account email" : "อีเมลบัญชี"}</h2><p>{en ? "The email currently used to sign in." : "อีเมลที่ใช้เข้าสู่ระบบในปัจจุบัน"}</p><input className="settings-account-email" type="email" value={userEmail} readOnly aria-label={en ? "Account email" : "อีเมลบัญชี"}/></section>
      <section className="settings-card"><h2>{en ? "Display name" : "ชื่อที่แสดง"}</h2><p>{en ? "Shown in your greeting and family profile." : "แสดงบนหน้าแรกและข้อมูลสมาชิกในบ้าน"}</p><form className="household-join-form" onSubmit={(event) => { event.preventDefault(); setProfileNameBusy(true); void onDisplayNameChange(profileName.trim()).then((saved) => { setProfileNameMessage(saved ? (en ? "Name saved" : "บันทึกชื่อแล้ว") : (en ? "Could not save name" : "บันทึกชื่อไม่สำเร็จ")); if (saved) notify(en ? "Name saved" : "บันทึกชื่อแล้ว", "success"); }).finally(() => setProfileNameBusy(false)); }}><input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={60} required/><button type="submit" className="primary-button" disabled={profileNameBusy || !profileName.trim()}>{en ? "Save" : "บันทึก"}</button></form>{profileNameMessage && <p role="status">{profileNameMessage}</p>}</section>
      <section className="settings-card"><h2>{en ? "Profile photo" : "รูปโปรไฟล์"}</h2><div className="settings-profile-photo"><span className="settings-avatar">{profilePhotoUrl ? <img src={profilePhotoUrl} alt={en ? "Profile" : "รูปโปรไฟล์"}/> : "ค"}</span><div><strong>{en ? "Your photo" : "รูปของคุณ"}</strong><p>{en ? "Photos are cropped and reduced to under 1 MB." : "รูปจะถูกตัดและย่อให้น้อยกว่า 1 MB"}</p></div></div><div className="settings-button-row"><button type="button" className="secondary-button" disabled={photoBusy} onClick={() => { onMediaPickerStart(); galleryRef.current?.click(); }}>{en ? "Choose photo" : "เลือกรูป"}</button><button type="button" className="secondary-button" disabled={photoBusy} onClick={() => { onMediaPickerStart(); cameraRef.current?.click(); }}>{en ? "Take photo" : "ถ่ายรูป"}</button></div><input ref={galleryRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => void photoChanged(event)}/><input ref={cameraRef} className="visually-hidden" type="file" accept="image/*" capture="user" onChange={(event) => void photoChanged(event)}/>{photoMessage && <p role="status">{photoMessage}</p>}</section>
      <section className="settings-card"><h2>{en ? "Set or change password" : "ตั้งหรือเปลี่ยนรหัสผ่าน"}</h2><p>{en ? "Use this password to sign in with email." : "ใช้รหัสผ่านนี้เพื่อเข้าสู่ระบบด้วยอีเมล"}</p><form className="household-password-form" onSubmit={(event) => void changePassword(event)}><PasswordInput language={language} minLength={8} required autoComplete="new-password" placeholder={en ? "New password (8+ characters)" : "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><PasswordInput language={language} minLength={8} required autoComplete="new-password" placeholder={en ? "Confirm password" : "ยืนยันรหัสผ่าน"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/><button type="submit" className="primary-button" disabled={passwordBusy}>{en ? "Save password" : "บันทึกรหัสผ่าน"}</button></form>{passwordMessage && <p role="status">{passwordMessage}</p>}</section>
    </div>}
    {section === "home" && <div className="settings-sections">{activeId && <HouseholdUsage key={activeId} id={activeId}/>}
      <section className="settings-card"><h2>{en ? "Record notifications" : "การแจ้งเตือนตามหมวดหมู่"}</h2><p>{en ? "Choose which household records can notify you. Calendar reminders have their own settings." : "เลือกหมวดที่ให้แจ้งเตือนจากยา ของใช้ และรายการที่ต้องซื้อ การแจ้งเตือนปฏิทินตั้งค่าแยกในแต่ละนัดหมาย"}</p>{["ยาและสุขภาพ", "ของใช้ในบ้าน", "รายการที่ต้องซื้อ", "บริการ", "เอกสาร", "การเงิน"].map((name) => <div className="settings-toggle-row" key={name}><span>{en ? ({ "ยาและสุขภาพ": "Health and medicine", "ของใช้ในบ้าน": "Household items", "รายการที่ต้องซื้อ": "Shopping list", "บริการ": "Services", "เอกสาร": "Documents", "การเงิน": "Finance" } as Record<string, string>)[name] : name}</span><button type="button" className={`settings-switch ${notificationPreferences[name] !== false ? "on" : ""}`} role="switch" aria-checked={notificationPreferences[name] !== false} aria-label={name} onClick={() => onNotificationPreferenceChange(name, notificationPreferences[name] === false)}><i/></button></div>)}</section>
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
      <section className="settings-card"><div className="household-people-heading"><div><h2>{en ? "Family members" : "สมาชิกในบ้าน"}</h2><p>{active?.name}</p></div><button type="button" className="secondary-button" disabled={peopleBusy} onClick={() => setPeopleRevision((revision) => revision + 1)}>{en ? "Refresh" : "รีเฟรช"}</button></div>
        {peopleError && <p className="household-panel-error" role="alert">{peopleError}</p>}
        {peopleBusy && !people.length && <p>{en ? "Loading members..." : "กำลังโหลดสมาชิก..."}</p>}
        <div className="household-people-list">{people.map((person) => <div className="household-person" key={person.user_id}><span className="household-person-avatar">{(person.display_name || person.email || "?").slice(0, 1).toUpperCase()}</span><div className="household-person-copy"><strong>{person.display_name || person.email}</strong><small>{person.email}{person.user_id === userId ? (en ? " · You" : " · คุณ") : ""}</small></div><span className="household-person-role">{person.role === "owner" ? (en ? "Owner" : "เจ้าบ้าน") : person.role === "admin" ? (en ? "Admin" : "ผู้ดูแล") : (en ? "Member" : "สมาชิก")}</span>{active?.role === "owner" && person.role !== "owner" && person.user_id !== userId && <div className="household-person-actions"><select aria-label={en ? `Role for ${person.display_name}` : `บทบาทของ ${person.display_name}`} value={person.role} disabled={peopleBusy} onChange={(event) => setPendingMemberAction({ person, role: event.target.value as "admin" | "member" })}><option value="member">{en ? "Member" : "สมาชิก"}</option><option value="admin">{en ? "Admin" : "ผู้ดูแล"}</option></select><button type="button" className="household-person-remove" disabled={peopleBusy} onClick={() => setPendingMemberAction({ person, role: "remove" })}>{en ? "Remove" : "นำออก"}</button></div>}</div>)}</div>
      </section>
      {canInvite && <section className="settings-card"><h2>{en ? "Invite family" : "เชิญเข้าร่วมบ้าน"}</h2><p>{en ? "The single-use code expires in 7 days." : "รหัสใช้ได้ครั้งเดียวและหมดอายุใน 7 วัน"}</p><button type="button" className="primary-button" disabled={busy} onClick={onInvite}>{en ? "Create invite code" : "สร้างรหัสเชิญ"}</button>{inviteCode && <div className="household-invite-code"><code>{inviteCode}</code><button type="button" onClick={() => void navigator.clipboard.writeText(inviteCode).then(() => setCopied(true))}>{copied ? (en ? "Copied" : "คัดลอกแล้ว") : (en ? "Copy" : "คัดลอก")}</button></div>}</section>}
      <section className="settings-card"><h2>{en ? "Join a home" : "เข้าร่วมบ้าน"}</h2><p>{en ? "Enter an invite code shared by the home owner." : "กรอกรหัสเชิญที่เจ้าของบ้านส่งให้"}</p><form className="household-join-form" onSubmit={(event) => { event.preventDefault(); onJoin(code); }}><input required value={code} onChange={(event) => setCode(event.target.value)} placeholder={en ? "Invite code" : "รหัสเชิญ"} autoCapitalize="none" autoComplete="off"/><button type="submit" className="primary-button" disabled={busy || !code.trim()}>{busy ? (en ? "Please wait..." : "กรุณารอสักครู่...") : (en ? "Join" : "เข้าร่วม")}</button></form></section>
    </div>}
    {section === "pin" && <PinSettings key={userId} userId={userId} language={language}/>}
    {section === "display" && <div className="settings-sections"><section className="settings-card">{displaySettings}</section></div>}
    {section === "usage" && isAdmin && <UsagePage language={language}/>}
    {pendingMemberAction && typeof document !== "undefined" && createPortal(<ConfirmationPopup labelledBy="member-action-title" onCancel={() => { if (!peopleBusy) setPendingMemberAction(null); }}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="member-action-title"><h2 id="member-action-title">{pendingMemberAction.role === "remove" ? (en ? "Remove this member?" : "นำสมาชิกออกจากบ้าน?") : (en ? "Change member role?" : "เปลี่ยนบทบาทสมาชิก?")}</h2><p><strong>{pendingMemberAction.person.display_name || pendingMemberAction.person.email}</strong> · {pendingMemberAction.role === "remove" ? (en ? "They will no longer see this home's data." : "สมาชิกจะเข้าถึงข้อมูลบ้านนี้ไม่ได้อีก") : pendingMemberAction.role === "admin" ? (en ? "Grant home administration access" : "ให้สิทธิ์ผู้ดูแลบ้าน") : (en ? "Set as a regular member" : "เปลี่ยนเป็นสมาชิกทั่วไป")}</p><div className="confirm-actions"><button type="button" className="secondary-button" onClick={() => setPendingMemberAction(null)}>{en ? "Cancel" : "ยกเลิก"}</button><button type="button" className={pendingMemberAction.role === "remove" ? "danger-button" : "primary-button"} disabled={peopleBusy} onClick={() => void confirmMemberAction()}>{en ? "Confirm" : "ยืนยัน"}</button></div></section></ConfirmationPopup>, document.body)}
  </div>;
}
