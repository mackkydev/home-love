"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createVault, maxVaultFileBytes, maxVaultLogoBytes, readVaultFile, sealVault, unlockVault, type VaultRecord } from "@/lib/password-vault";
import { externalWebUrl } from "@/lib/web-url";
import Icon from "./Icon";
import PhotoCropField from "./PhotoCropField";

type Session = Awaited<ReturnType<typeof unlockVault>>;
const emptyRecord = { id: "", name: "", username: "", password: "", link: "" };
const idleLimit = 2 * 60_000;
const minimumPassphraseLength = 16;
const characterSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function passphraseLength(value: string) {
  const text = value.trim();
  return characterSegmenter ? Array.from(characterSegmenter.segment(text)).length : Array.from(text).length;
}

function PasswordField({ label, value, onChange, autoComplete, maxLength, showCount = false, language }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  maxLength: number;
  showCount?: boolean;
  language: "th" | "en";
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  if (!value && visible) setVisible(false);
  const count = showCount ? passphraseLength(value) : null;
  const toggleLabel = language === "en" ? (visible ? "Hide typed password" : "Show typed password") : (visible ? "ซ่อนรหัสที่พิมพ์" : "แสดงรหัสที่พิมพ์");

  return <div className="form-label">
    <div className="vault-password-label">
      <label htmlFor={id}>{label}</label>
      {count !== null && <span id={id + "-count"} className={`vault-password-count ${count >= minimumPassphraseLength ? "complete" : ""}`}>{count}/{minimumPassphraseLength}</span>}
    </div>
    <div className="vault-password-input">
      <input id={id} type={visible && value ? "text" : "password"} required value={value} maxLength={maxLength} autoComplete={autoComplete}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby={showCount ? id + "-count" : undefined} onChange={(event) => onChange(event.target.value)}/>
      <button type="button" className="vault-password-toggle" aria-label={toggleLabel + " (" + label + ")"} aria-controls={id} disabled={!value}
        onClick={() => setVisible((current) => !current)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/>
          <circle cx="12" cy="12" r="2.5"/>
          {visible && <path d="m3 3 18 18"/>}
        </svg>
      </button>
    </div>
  </div>;
}

export default function PasswordVault({ scope, language }: { scope: string; language: "th" | "en" }) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const storageKey = `home-love-private-vault-v1:${scope}`;
  const [saved, setSaved] = useState<string | null>();
  const [session, setSession] = useState<Session | null>(null);
  const [backup, setBackup] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [draft, setDraft] = useState<VaultRecord | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState(true);
  const revision = useRef(0);

  const lock = useCallback(() => {
    revision.current += 1;
    setSession(null);
    setPassphrase("");
    setConfirmation("");
    setDraft(null);
    setRevealed(null);
    setRemoveId(null);
    setBusy(false);
    setError("");
  }, []);

  useEffect(() => {
    const refresh = () => {
      try {
        setSaved(localStorage.getItem(storageKey));
        setAvailable(Boolean(window.crypto?.subtle));
      } catch {
        setAvailable(false);
        setSaved(null);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) { lock(); refresh(); }
    };
    const onVisibility = () => { if (document.hidden) lock(); };
    refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", lock);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      revision.current += 1;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", lock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [lock, storageKey]);

  useEffect(() => {
    if (!session) return;
    let timeout: ReturnType<typeof setTimeout>;
    const onActivity = () => { clearTimeout(timeout); timeout = setTimeout(lock, idleLimit); };
    onActivity();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [session, lock]);

  const persist = async (encrypted: string, current: number) => {
    const write = () => {
      if (revision.current !== current || document.hidden) return false;
      if (localStorage.getItem(storageKey) !== saved) {
        lock();
        setSaved(localStorage.getItem(storageKey));
        setError(ui("คลังมีการเปลี่ยนแปลงจากอีกแท็บ กรุณาปลดล็อกใหม่", "The vault changed in another tab. Unlock it again."));
        return false;
      }
      localStorage.setItem(storageKey, encrypted);
      setSaved(encrypted);
      return true;
    };
    return navigator.locks ? navigator.locks.request(storageKey, write) : write();
  };

  const open = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !available) return;
    const file = backup || saved;
    if (!file && (passphraseLength(passphrase) < minimumPassphraseLength || passphrase !== confirmation)) {
      setError(ui("ตั้งรหัสหลักอย่างน้อย 16 ตัวอักษรและยืนยันให้ตรงกัน", "Use at least 16 characters and enter the same passphrase twice."));
      return;
    }
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      let opened: Session;
      try {
        opened = file ? await unlockVault(file, passphrase) : { ...await createVault(passphrase), records: [] };
      } catch {
        if (revision.current === current) setError(ui("ปลดล็อกไม่ได้ กรุณาตรวจรหัสหลักและไฟล์", "Could not unlock the vault. Check the passphrase and file."));
        return;
      }
      if (revision.current !== current || document.hidden) return;
      if ((backup || !saved) && !await persist(file || await sealVault(opened.records, opened), current)) return;
      if (revision.current !== current || document.hidden) return;
      setSession(opened);
      setBackup("");
    } catch {
      if (revision.current === current) setError(ui("บันทึกคลังเข้ารหัสในเบราว์เซอร์ไม่สำเร็จ", "Could not save the encrypted vault in this browser."));
    } finally {
      if (revision.current === current) {
        setPassphrase("");
        setConfirmation("");
        setBusy(false);
      }
    }
  };

  const update = async (records: VaultRecord[]) => {
    if (!session || busy) return;
    const current = ++revision.current;
    setBusy(true);
    setError("");
    try {
      if (!await persist(await sealVault(records, session), current) || revision.current !== current) return;
      setSession({ ...session, records });
      setDraft(null);
      setRevealed(null);
      setRemoveId(null);
    } catch {
      if (revision.current === current) setError(ui("บันทึกไม่สำเร็จ คลังอาจเต็มหรือเบราว์เซอร์ปิดการจัดเก็บข้อมูล", "Could not save. The vault may be full or browser storage unavailable."));
    } finally {
      if (revision.current === current) setBusy(false);
    }
  };

  const loadBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    const current = ++revision.current;
    setBusy(true);
    setError("");
    setBackup("");
    try {
      if (file.size > maxVaultFileBytes) throw new Error("File too large");
      const contents = await file.text();
      readVaultFile(contents);
      if (revision.current === current) { setBackup(contents); setPassphrase(""); setConfirmation(""); }
    } catch {
      if (revision.current === current) setError(ui("เลือกไฟล์คลังรหัสผ่านที่ส่งออกจากแอปนี้", "Choose an encrypted vault file exported by this app."));
    } finally {
      if (revision.current === current) setBusy(false);
    }
  };

  const download = () => {
    if (!saved) return;
    const url = URL.createObjectURL(new Blob([saved], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "home-love.vault.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const saveRecord = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft?.name.trim() || !draft.username.trim() || !draft.password || !session) return;
    const record = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), username: draft.username.trim(), link: draft.link.trim() };
    void update(draft.id ? session.records.map((item) => item.id === record.id ? record : item) : [record, ...session.records]);
  };
  const creating = !saved && !backup;
  const title = ui("คลังรหัสผ่าน", "Password vault");

  return <section className="feature-page vault-page">
    <header className="feature-heading">
      <div><h1>{title}</h1><p>{ui("เข้ารหัสและเก็บในเบราว์เซอร์นี้ · สำรองเป็นไฟล์เข้ารหัสได้", "Encrypted in this browser · Export an encrypted backup")}</p></div>
      {session && <button type="button" className="secondary-button" onClick={lock}>{ui("ล็อกคลัง", "Lock vault")}</button>}
    </header>
    {error && <p className="feature-error" role="alert">{error}</p>}
    {saved === undefined ? <p role="status">{ui("กำลังเปิดคลัง…", "Loading vault…")}</p> : !available ? <p role="alert">{ui("ต้องเปิดผ่าน HTTPS และอนุญาตให้เบราว์เซอร์จัดเก็บข้อมูล", "Use HTTPS and allow browser storage to open the vault.")}</p> : !session ? <section className="feature-card vault-lock-card">
      <h2>{backup ? ui("กู้คืนจากไฟล์เข้ารหัส", "Restore an encrypted file") : creating ? ui("ตั้งรหัสหลัก", "Set a master passphrase") : ui("ปลดล็อกคลัง", "Unlock the vault")}</h2>
      <p>{creating ? ui("ตั้งข้อความสำหรับเข้าดูรหัสในคลังอย่างน้อย 16 ตัวอักษร ใช้ภาษาไทย ภาษาอังกฤษ ตัวเลข และเว้นวรรคได้ ถ้าลืมรหัสหลักจะเปิดไฟล์สำรองไม่ได้", "Set a master password of at least 16 characters to open your vault. You can use Thai or English letters, numbers, and spaces. You need it to open your backup.") : ui("คลังจะล็อกเมื่อสลับออกจากแอปหรือไม่มีการใช้งาน 2 นาที", "The vault locks when you leave the app or after two minutes of inactivity.")}</p>
      {backup && saved && <p className="feature-warning">{ui("เมื่อปลดล็อกสำเร็จ ไฟล์ที่เลือกจะแทนที่คลังในเบราว์เซอร์นี้", "A successful unlock will replace the vault in this browser with the selected backup.")}</p>}
      <form onSubmit={(event) => void open(event)} autoComplete="off">
        <PasswordField label={ui("รหัสหลัก", "Master passphrase")} value={passphrase} onChange={setPassphrase} maxLength={1024}
          autoComplete={creating ? "new-password" : "off"} showCount={creating} language={language}/>
        {creating && <PasswordField label={ui("ยืนยันรหัสหลัก", "Confirm master passphrase")} value={confirmation} onChange={setConfirmation}
          maxLength={1024} autoComplete="new-password" showCount language={language}/>}
        <button type="submit" className="primary-button" disabled={busy}>{busy ? ui("กำลังดำเนินการ…", "Working…") : backup && saved ? ui("ปลดล็อกและแทนที่คลัง", "Unlock and replace vault") : creating ? ui("สร้างคลังรหัสผ่าน", "Create vault") : ui("ปลดล็อก", "Unlock")}</button>
      </form>
      <div className="feature-actions vault-file-actions">
        {saved && <button type="button" className="secondary-button" onClick={download}>{ui("ดาวน์โหลดไฟล์สำรอง", "Download backup")}</button>}
        {backup ? <button type="button" className="secondary-button" disabled={busy} onClick={() => { setBackup(""); setPassphrase(""); setError(""); }}>{ui("ยกเลิกการกู้คืน", "Cancel restore")}</button>
          : <label className="secondary-button feature-file-button">{ui("เลือกไฟล์สำรอง", "Choose backup file")}<input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => void loadBackup(event)}/></label>}
      </div>
    </section> : <>
      <div className="feature-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={() => { setDraft(emptyRecord); setRevealed(null); setRemoveId(null); setError(""); }}>{ui("＋ เพิ่มรหัสผ่าน", "＋ Add login")}</button>
        <button type="button" className="secondary-button" onClick={download}>{ui("ดาวน์โหลดไฟล์สำรอง", "Download backup")}</button>
      </div>
      {draft && <form className="feature-card vault-lock-card" onSubmit={saveRecord} autoComplete="off">
        <h2>{draft.id ? ui("แก้ไขรหัสผ่าน", "Edit login") : ui("เพิ่มรหัสผ่าน", "Add login")}</h2>
        <label className="form-label">{ui("ชื่อบริการ", "Service name")}<input required maxLength={160} placeholder="Facebook" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label>
        <label className="form-label">{ui("ชื่อผู้ใช้หรืออีเมล", "Username or email")}<input required maxLength={320} autoComplete="off" autoCapitalize="none" spellCheck={false} value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })}/></label>
        <PasswordField key={draft.id} label={ui("รหัสผ่าน", "Password")} value={draft.password} onChange={(password) => setDraft({ ...draft, password })}
          maxLength={2048} autoComplete="new-password" language={language}/>
        <label className="form-label">{ui("ลิงก์หรือข้อความ (ไม่บังคับ)", "Link or text (optional)")}<input maxLength={2048} value={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.value })}/></label>
        <PhotoCropField value={draft.logo} onChange={(logo) => setDraft((current) => current ? { ...current, logo } : current)}
          label={ui("อัปโหลดโลโก้", "Upload logo")} language={language} aspect={1} maxWidth={128} maxBytes={maxVaultLogoBytes}/>
        <div className="feature-actions"><button type="submit" className="primary-button" disabled={busy}>{ui("บันทึกเข้าคลัง", "Save to vault")}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setDraft(null)}>{ui("ยกเลิก", "Cancel")}</button></div>
      </form>}
      {!session.records.length && !draft && <p className="feature-card">{ui("ยังไม่มีรหัสผ่านในคลัง", "Your vault is empty.")}</p>}
      <ul className="vault-records">
        {session.records.map((item) => {
          const href = externalWebUrl(item.link);
          return <li className="feature-card vault-record" key={item.id}>
            <div className="vault-record-heading">
              <span className="vault-logo">
                {/* eslint-disable-next-line @next/next/no-img-element -- Logo is a locally decrypted data URL. */}
                {item.logo ? <img src={item.logo} alt=""/> : <Icon name="lock" size={20}/>}
              </span>
              <div><h2>{item.name}</h2><p>{item.username}</p>{item.link && (href ? <a href={href} target="_blank" rel="noopener noreferrer">{item.link} ↗</a> : <p>{item.link}</p>)}</div>
            </div>
            <div className="feature-actions">
              <button type="button" className="secondary-button" aria-pressed={revealed === item.id} onClick={() => setRevealed(revealed === item.id ? null : item.id)}>{revealed === item.id ? ui("ซ่อนรหัส", "Hide password") : ui("แสดงรหัส", "Show password")}</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => { setDraft(item); setRevealed(null); setRemoveId(null); }}>{ui("แก้ไข", "Edit")}</button>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => setRemoveId(item.id)}>{ui("ลบ", "Delete")}</button>
            </div>
            {revealed === item.id && <code className="vault-revealed">{item.password}</code>}
            {removeId === item.id && <div className="feature-actions"><span>{ui("ลบรหัสผ่านรายการนี้?", "Delete this login?")}</span><button type="button" className="danger-button" disabled={busy} onClick={() => void update(session.records.filter((record) => record.id !== item.id))}>{ui("ยืนยันลบ", "Confirm deletion")}</button><button type="button" className="secondary-button" onClick={() => setRemoveId(null)}>{ui("ยกเลิก", "Cancel")}</button></div>}
          </li>;
        })}
      </ul>
    </>}
  </section>;
}
