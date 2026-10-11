"use client";

import { useCallback, useEffect, useState } from "react";
import { cloud } from "@/lib/cloud";

type Usage = { databaseBytes: number; storageBytes: number; storageObjects: number; entries: number; users: number; measuredAt: string };

function bytes(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GB` : `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export default function UsagePage({ language }: { language: "th" | "en" }) {
  const en = language === "en";
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!cloud) { setError(en ? "Supabase is not connected." : "ยังไม่ได้เชื่อม Supabase"); setBusy(false); return; }
    setBusy(true); setError("");
    const { data, error: queryError } = await cloud.rpc("get_app_resource_usage");
    if (queryError) setError(queryError.message);
    else setUsage(data as Usage);
    setBusy(false);
  }, [en]);
  useEffect(() => { void refresh(); }, [refresh]);

  return <div className="settings-sections usage-page">
    <section className="settings-card"><div className="usage-card-head"><div><h2>Supabase</h2><p>{en ? "Project measurements, not billing-cycle totals" : "ค่าที่วัดจากโปรเจกต์ ไม่ใช่ยอดรวมรอบบิล"}</p></div><button type="button" className="secondary-button" disabled={busy} onClick={() => void refresh()}>{busy ? (en ? "Loading…" : "กำลังโหลด…") : (en ? "Refresh" : "อัปเดต")}</button></div>
      {error && <p className="household-panel-error" role="alert">{en ? "Could not load usage: " : "โหลดข้อมูลการใช้งานไม่สำเร็จ: "}{error}</p>}
      {usage && <><div className="usage-grid"><div><span>{en ? "Database size" : "ขนาดฐานข้อมูล"}</span><strong>{bytes(usage.databaseBytes)}</strong></div><div><span>{en ? "Stored files (estimate)" : "ขนาดไฟล์ (โดยประมาณ)"}</span><strong>{bytes(usage.storageBytes)}</strong></div><div><span>{en ? "Files" : "จำนวนไฟล์"}</span><strong>{usage.storageObjects.toLocaleString()}</strong></div><div><span>{en ? "Records" : "จำนวนบันทึก"}</span><strong>{usage.entries.toLocaleString()}</strong></div><div><span>{en ? "Accounts" : "จำนวนบัญชี"}</span><strong>{usage.users.toLocaleString()}</strong></div></div><p className="usage-updated">{en ? "Measured" : "วัดข้อมูลเมื่อ"} {new Date(usage.measuredAt).toLocaleString(en ? "en-GB" : "th-TH", { dateStyle: "medium", timeStyle: "short" })}</p></>}
      <p>{en ? "The remaining free allowance and monthly transfer are tracked at the organization level. Open Supabase Usage for the exact balance." : "โควตาที่เหลือและปริมาณรับส่งข้อมูลคิดในระดับองค์กรและตามรอบบิล จึงดูยอดคงเหลือที่ถูกต้องได้จากหน้า Usage ของ Supabase"}</p><a className="usage-dashboard-link" href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noopener noreferrer">{en ? "Open Supabase Usage ↗" : "เปิด Supabase Usage ↗"}</a>
    </section>
    <section className="settings-card"><h2>Vercel</h2><p>{en ? "This project uses the Hobby plan. Vercel does not expose a complete Hobby usage and remaining-quota API for an embedded dashboard." : "โปรเจกต์นี้ใช้แผน Hobby ซึ่งไม่มี API ยอดใช้และโควตาคงเหลือที่ครบถ้วนสำหรับนำมาแสดงในแอป"}</p><p>{en ? "Open Usage to see requests, data transfer, and function consumption for the current billing cycle." : "เปิดหน้า Usage เพื่อดูจำนวนคำขอ ปริมาณรับส่งข้อมูล และการใช้ Functions ตามรอบบิลปัจจุบัน"}</p><a className="usage-dashboard-link" href="https://vercel.com/mackkydev/~/usage" target="_blank" rel="noopener noreferrer">{en ? "Open Vercel Usage ↗" : "เปิด Vercel Usage ↗"}</a></section>
  </div>;
}
