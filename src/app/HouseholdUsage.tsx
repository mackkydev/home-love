"use client";
import { useEffect, useState } from "react";
import { getHouseholdEntitlements } from "@/lib/cloud";
import { mb, usageError, type HouseholdEntitlements } from "@/lib/usage-limits";
export default function HouseholdUsage({id}:{id:string}){
 const [usage,setUsage]=useState<HouseholdEntitlements|null>(null);const [error,setError]=useState("");
 useEffect(()=>{let active=true;void getHouseholdEntitlements(id).then(value=>{if(active){setUsage(value);setError("");}}).catch(e=>{if(active)setError(usageError(e));});return()=>{active=false;};},[id]);
 return <section className="settings-card"><h2>แพ็กเกจและการใช้งาน</h2>{error?<p role="alert">{error}</p>:usage?<><p>{usage.plan_key} · {usage.writable?"ใช้งานได้":"อ่านอย่างเดียว"}{usage.expires_at&&" · ถึง "+new Date(usage.expires_at).toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok"})}</p><div className="admin-meter-grid"><div><small>พื้นที่ไฟล์</small><strong>{mb(usage.storage_bytes)} / {mb(usage.max_storage_bytes)} MB</strong></div><div><small>รายการ</small><strong>{usage.entry_count} / {usage.max_entries}</strong></div><div><small>สมาชิก</small><strong>{usage.member_count} / {usage.max_members}</strong></div></div><p>{usage.uploads_enabled?"ไฟล์ละไม่เกิน "+mb(usage.max_file_bytes)+" MB":"ปิดการอัปโหลดไฟล์"} · ลบรูปที่ไม่ได้ใช้เพื่อคืนพื้นที่ได้</p></>:<p>กำลังโหลด…</p>}</section>;
}
