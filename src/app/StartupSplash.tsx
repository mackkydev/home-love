"use client";

import { useEffect, useState } from "react";

export default function StartupSplash({ language = "th", durationMs = 3000, startedAt = 0, updating = false, updateReady = false, updateError = false, onUpdate, onContinue }: {
  language?: "th" | "en"; durationMs?: number; startedAt?: number; updating?: boolean; updateReady?: boolean; updateError?: boolean; onUpdate?: () => void; onContinue?: () => void;
}) {
  const en = language === "en";
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = startedAt || Date.now();
    const timer = setInterval(() => {
      const next = Math.min(100, (Date.now() - start) / durationMs * 100);
      setProgress(next);
      if (next >= 100) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [durationMs, startedAt]);
  return <main className="startup-splash" role="status" aria-busy="true" aria-live="polite">
    <div className="startup-splash-copy">
      <span className="startup-splash-eyebrow">HOME LOVE</span>
      <h1>{en ? "Welcome home" : "ยินดีต้อนรับสู่บ้านของเรา"}</h1>
      <p>{en ? "Everything your family needs, in one place" : "จัดการเรื่องสำคัญของครอบครัวในที่เดียว"}</p>
      <span className="startup-progress" role="progressbar" aria-label={en ? "Preparing the app" : "กำลังเตรียมแอป"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{ width: `${progress}%` }}/></span>
      <small>{updating ? (en ? "Updating the app…" : "กำลังอัปเดตแอป…") : updateReady ? (en ? "A new version is ready" : "มีแอปเวอร์ชันใหม่พร้อมอัปเดต") : (en ? "Preparing your home…" : "กำลังเตรียมบ้านของคุณ…")}</small>
      {updateError && <p className="startup-update-error" role="alert">{en ? "Update could not finish. Please try again or continue first." : "อัปเดตยังไม่สำเร็จ กรุณาลองอีกครั้ง หรือเข้าแอปก่อน"}</p>}
      {updateReady && !updating && <div className="startup-update-actions"><button type="button" onClick={onUpdate}>{en ? "Update now" : "อัปเดตตอนนี้"}</button><button type="button" onClick={onContinue}>{en ? "Continue for now" : "เข้าแอปก่อน"}</button></div>}
    </div>
  </main>;
}
