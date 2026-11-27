"use client";
import Icon from "./Icon";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSignupMethods, getSignupOpen, setSignupMethods, setSignupOpen, type SignupMethods } from "@/lib/cloud";
import { adminRpc, listAdminHouses, listAdminUsers, type AdminHouse, type AdminUser, type Audit } from "@/lib/admin-api";
import { MB, mb, usageError } from "@/lib/usage-limits";
import { useToast } from "./ToastProvider";

function SignupSettings({ language }: { language: "th" | "en" }) {
  const [open, setOpen] = useState<boolean | null>(null);
  const [methods, setMethods] = useState<SignupMethods | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const en = language === "en";
  const notify = useToast();

  useEffect(() => {
    let active = true;
    void getSignupOpen().then((value) => { if (active) setOpen(value); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    void getSignupMethods().then((value) => { if (active) setMethods(value); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { active = false; };
  }, []);

  const changeSignup = async () => {
    if (open === null || busy) return;
    setBusy(true);
    setError("");
    try { setOpen(await setSignupOpen(!open)); notify(en ? "Registration settings saved" : "บันทึกการตั้งค่าสมัครสมาชิกแล้ว", "success"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  const changeMethods = async (next: SignupMethods) => {
    if (busy || methods === null || methods === next) return;
    setBusy(true);
    setError("");
    try { setMethods(await setSignupMethods(next)); notify(en ? "Registration settings saved" : "บันทึกวิธีสมัครสมาชิกแล้ว", "success"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <div>
    <section className="admin-signup-settings">
      <div className="admin-setting-card"><div className="admin-setting-copy"><strong>{en ? "Allow new registrations" : "เปิดรับสมัครสมาชิกใหม่"}</strong><p>{en ? "Turn this off to prevent new accounts from being created. Existing members can still sign in." : "ปิดเพื่อหยุดการสร้างบัญชีใหม่ สมาชิกเดิมยังเข้าสู่ระบบได้ตามปกติ"}</p><span className={`admin-status ${open ? "is-open" : "is-closed"}`}>{open === null ? (en ? "Loading…" : "กำลังโหลด…") : open ? (en ? "Registration open" : "เปิดรับสมัคร") : (en ? "Registration closed" : "ปิดรับสมัคร")}</span></div><button type="button" role="switch" aria-label={en ? "Allow new registrations" : "เปิดรับสมัครสมาชิกใหม่"} aria-checked={open === true} disabled={open === null || busy} className={`admin-switch ${open ? "on" : ""}`} onClick={() => void changeSignup()}><span/></button></div>
      <div className="admin-methods-card"><strong>{en ? "Registration options" : "วิธีสมัครสมาชิก"}</strong><p>{en ? "Choose which registration buttons new members see." : "เลือกปุ่มสมัครที่สมาชิกใหม่จะเห็น"}</p><div className="admin-methods-options">{(["both", "password", "email_link"] as const).map((option) => <button key={option} type="button" aria-pressed={methods === option} className={methods === option ? "selected" : ""} disabled={methods === null || busy} onClick={() => void changeMethods(option)}>{option === "both" ? (en ? "Both" : "ทั้งสองแบบ") : option === "password" ? (en ? "Password only" : "รหัสผ่านเท่านั้น") : (en ? "Email link only" : "ลิงก์อีเมลเท่านั้น")}</button>)}</div></div>
      {error && <p className="household-panel-error" role="alert">{error}</p>}
      <p className="admin-panel-note">{en ? "The Supabase Before User Created hook must be enabled for this setting to block direct API registrations." : "ต้องเปิด Before User Created hook ใน Supabase เพื่อให้การปิดรับสมัครมีผลกับการเรียก API โดยตรงด้วย"}</p>
    </section>
  </div>;
}


function UserEditor({ user, busy, onSave, onHouses }: { user: AdminUser; busy: boolean; onSave: (enabled: boolean, limit: number, reason: string) => void; onHouses: () => void }) {
 const [enabled, setEnabled] = useState(user.enabled);
 const [limit, setLimit] = useState(user.max_households);
 const [reason, setReason] = useState(user.reason);
 return <form className="admin-editor" onSubmit={(e) => { e.preventDefault(); onSave(enabled, limit, reason); }}>
  <h3>{user.display_name || user.email}</h3><p>{user.email} {user.is_admin && " · Admin"}</p>
  <label className="admin-check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}/>เปิดใช้งานบัญชี</label>
  <label className="form-label">จำนวนบ้านที่เป็นเจ้าของได้<input type="number" min="0" max="1000" required value={limit} onChange={(e) => setLimit(Number(e.target.value))}/></label>
  <label className="form-label">เหตุผล / หมายเหตุที่ผู้ใช้เห็น<textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}/></label>
  <div className="feature-actions"><button className="primary-button" disabled={busy} type="submit">บันทึกผู้ใช้</button><button type="button" className="secondary-button" disabled={busy} onClick={onHouses}>จัดการบ้านของผู้ใช้ ({user.household_count})</button></div>
 </form>;
}

function HouseEditor({ house, busy, onSave, onMember, onCleanup }: {
 house: AdminHouse; busy: boolean; onSave: (settings: Record<string, unknown>) => void;
 onMember: (id: string, role: string) => void; onCleanup: () => void;
}) {
 const [name, setName] = useState(house.name);
 const [enabled, setEnabled] = useState(house.enabled);
 const [plan, setPlan] = useState(house.plan_key);
 const [status, setStatus] = useState(house.subscription_status);
 const [expires, setExpires] = useState(house.expires_at ? new Date(house.expires_at).toLocaleDateString("en-CA", {timeZone: "Asia/Bangkok"}) : "");
 const [uploads, setUploads] = useState(house.uploads_enabled);
 const [storage, setStorage] = useState(house.max_storage_bytes / MB);
 const [fileSize, setFileSize] = useState(house.max_file_bytes / MB);
 const [entries, setEntries] = useState(house.max_entries);
 const [members, setMembers] = useState(house.max_members);
 const [memberSearch, setMemberSearch] = useState("");
 const [candidates, setCandidates] = useState<AdminUser[]>([]);
 const [memberId, setMemberId] = useState("");
 const [memberRole, setMemberRole] = useState("member");
 const [memberError, setMemberError] = useState("");
 const [searching, setSearching] = useState(false);
 const findUser = async () => {
  setSearching(true); setMemberError("");
  try { setCandidates((await listAdminUsers(memberSearch, 0)).users); }
  catch (e) { setMemberError(usageError(e)); } finally { setSearching(false); }
 };
 return <div className="admin-editor">
  <form onSubmit={(e) => { e.preventDefault(); onSave({ name, enabled, plan_key: plan, subscription_status: status,
   expires_at: expires ? new Date(expires + "T23:59:59.999+07:00").toISOString() : null,
   uploads_enabled: uploads, max_storage_bytes: Math.round(storage * MB), max_file_bytes: Math.round(fileSize * MB), max_entries: entries, max_members: members }); }}>
   <h3>ตั้งค่าบ้าน</h3>
   <label className="form-label">ชื่อบ้าน<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)}/></label>
   <div className="admin-meter-grid"><div><small>พื้นที่ใช้งาน</small><strong>{mb(house.storage_bytes)} / {mb(house.max_storage_bytes)} MB</strong><progress value={house.storage_bytes} max={Math.max(1,house.max_storage_bytes)}/></div><div><small>จำนวนรายการ</small><strong>{house.entry_count} / {house.max_entries}</strong><progress value={house.entry_count} max={Math.max(1,house.max_entries)}/></div><div><small>สมาชิก</small><strong>{house.member_count} / {house.max_members}</strong><progress value={house.member_count} max={house.max_members}/></div></div>
   {house.reserved_bytes>0 && <p className="admin-help">พื้นที่จองอัปโหลด {mb(house.reserved_bytes)} MB</p>}
   <div className="admin-checks"><label className="admin-check"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}/>เปิดใช้งานบ้าน</label><label className="admin-check"><input type="checkbox" checked={uploads} onChange={(e) => setUploads(e.target.checked)}/>อนุญาตอัปโหลดไฟล์</label></div>
   <div className="admin-form-grid">
    <label className="form-label">พื้นที่รวม (MB)<input type="number" min="0" max="1048576" step="0.01" required value={storage} onChange={(e) => setStorage(Number(e.target.value))}/></label>
    <label className="form-label">ขนาดสูงสุดต่อไฟล์ (MB)<input type="number" min="0" max="3" step="0.01" required value={fileSize} onChange={(e) => setFileSize(Number(e.target.value))}/></label>
    <label className="form-label">จำนวนรายการสูงสุด<input type="number" min="0" max="1000000" step="1" required value={entries} onChange={(e) => setEntries(Number(e.target.value))}/></label>
    <label className="form-label">จำนวนสมาชิกสูงสุด<input type="number" min="1" max="10000" step="1" required value={members} onChange={(e) => setMembers(Number(e.target.value))}/></label>
    <label className="form-label">ชื่อแพ็กเกจ<input required maxLength={80} value={plan} onChange={(e) => setPlan(e.target.value)}/></label>
    <label className="form-label">สถานะ subscription<select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="free">ฟรี</option><option value="trial">ทดลองใช้</option><option value="active">ใช้งานอยู่</option><option value="past_due">ค้างชำระ · อ่านอย่างเดียว</option><option value="canceled">ยกเลิก · อ่านอย่างเดียว</option></select></label>
    <label className="form-label">ใช้งานได้ถึง (เวลาไทย)<input type="date" value={expires} onChange={(e) => setExpires(e.target.value)}/><small>เว้นว่างเพื่อไม่กำหนดวันหมดอายุ</small></label>
   </div>
   <p className="admin-help">ลดโควตาได้โดยไม่ลบข้อมูลเดิม เมื่อเต็มจะเพิ่มไม่ได้ ส่วนแพ็กเกจหมดอายุจะอ่านและลบข้อมูลได้ แต่เพิ่มหรือแก้ไขไม่ได้ การเปิด–ปิดบ้านจะจำกัดการเข้าถึงทั้งบ้าน</p>
   <button className="primary-button" type="submit" disabled={busy}>บันทึกบ้านและโควตา</button>
  </form>
  <section className="admin-member-section"><h3>สมาชิกในบ้าน</h3>
   {house.members.map((m) => <div className="admin-member-row" key={m.user_id}><span>{m.email}</span><select aria-label={"สิทธิ์ของ " + m.email} disabled={busy} value={m.role} onChange={(e) => onMember(m.user_id,e.target.value)}><option value="owner">เจ้าของ</option><option value="admin">ผู้ดูแลบ้าน</option><option value="member">สมาชิก</option></select><button type="button" className="secondary-button" disabled={busy} onClick={() => { if (window.confirm("นำ " + m.email + " ออกจากบ้านนี้?")) onMember(m.user_id,"remove"); }}>นำออก</button></div>)}
   <form className="admin-member-add" onSubmit={(e) => {e.preventDefault();void findUser();}}>
    <label className="form-label">ค้นหาผู้ใช้เพื่อเพิ่มสมาชิก<input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="อีเมลหรือชื่อ"/></label><button type="submit" className="secondary-button" disabled={busy || searching}>{searching ? "กำลังค้นหา…" : "ค้นหา"}</button>
   </form>
   {memberError && <p role="alert">{memberError}</p>}
   {candidates.length>0 && <div className="admin-member-row"><select aria-label="เลือกผู้ใช้" value={memberId} onChange={(e) => setMemberId(e.target.value)}><option value="">เลือกผู้ใช้</option>{candidates.filter(u=>!house.members.some(m=>m.user_id===u.id)).map(u=><option value={u.id} key={u.id}>{u.email}</option>)}</select><select aria-label="สิทธิ์สมาชิกใหม่" value={memberRole} onChange={(e)=>setMemberRole(e.target.value)}><option value="member">สมาชิก</option><option value="admin">ผู้ดูแลบ้าน</option><option value="owner">เจ้าของ</option></select><button type="button" className="secondary-button" disabled={busy || !memberId} onClick={()=>onMember(memberId,memberRole)}>เพิ่มสมาชิก</button></div>}
  </section>
  <section className="admin-member-section"><h3>ดูแลพื้นที่จัดเก็บ</h3><p className="admin-help">ลบเฉพาะไฟล์ที่ไม่มีรายการใช้งานและอัปโหลดค้างเกิน 24 ชั่วโมง รูปที่ใช้อยู่จะไม่ถูกลบ</p><button type="button" className="secondary-button" disabled={busy} onClick={onCleanup}>คืนพื้นที่จากไฟล์ค้าง</button></section>
 </div>;
}

export default function AdminPanel({ language, onClose }: { language: "th" | "en"; onClose: () => void }) {
 const notify = useToast();
 const [tab,setTab]=useState<"users"|"houses"|"signup"|"audit">("users");
 const [search,setSearch]=useState(""); const [query,setQuery]=useState(""); const [page,setPage]=useState(0);
 const [users,setUsers]=useState<AdminUser[]>([]); const [houses,setHouses]=useState<AdminHouse[]>([]); const [audit,setAudit]=useState<Audit[]>([]);
 const [total,setTotal]=useState(0); const [selectedUser,setSelectedUser]=useState<AdminUser|null>(null);
 const [selectedHouse,setSelectedHouse]=useState<AdminHouse|null>(null); const [filterUser,setFilterUser]=useState<AdminUser|null>(null);
 const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 const [revision,setRevision]=useState(0); const [newHouse,setNewHouse]=useState("");
 const bodyRef=useRef<HTMLDivElement>(null);
 const editing = tab === "users" ? selectedUser !== null : tab === "houses" && selectedHouse !== null;
 const showDetail = () => bodyRef.current?.scrollTo({top:0});
 const reload=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try {
    if(tab==="users"){const data=await listAdminUsers(query,page);if(active){setUsers(data.users);setTotal(data.total);setSelectedUser(current=>data.users.find(u=>u.id===current?.id)??null);}}
    if(tab==="houses"){const data=await listAdminHouses(query,page,filterUser?.id);if(active){setHouses(data.houses);setTotal(data.total);setSelectedHouse(current=>data.houses.find(h=>h.household_id===current?.household_id)??null);}}
    if(tab==="audit"){const data=await adminRpc<Audit[]>("admin_recent_audit");if(active)setAudit(data);}
   }catch(e){if(active)setError(usageError(e));}finally{if(active)setLoading(false);}
  };void load();return()=>{active=false;};
 },[tab,query,page,filterUser?.id,revision]);
 const mutate=async(task:()=>Promise<unknown>)=>{
  setBusy(true);setError("");setNotice("");
  try{await task();setNotice("บันทึกเรียบร้อย");notify(language === "en" ? "Changes saved" : "บันทึกเรียบร้อย", "success");reload();}catch(e){setError(usageError(e));}finally{setBusy(false);}
 };
 const switchTab=(next:typeof tab)=>{setTab(next);setSearch("");setQuery("");setPage(0);setFilterUser(null);setSelectedUser(null);setSelectedHouse(null);setError("");setNotice("");setLoading(next!=="signup");};
 const userHomes=()=>{setFilterUser(selectedUser);setTab("houses");setQuery("");setSearch("");setPage(0);setSelectedHouse(null);setLoading(true);};
 return <div className="modal-backdrop admin-console-backdrop">
  <section className={`admin-console ${editing ? "is-editing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="admin-console-title">
   <header className="admin-console-header"><button type="button" className="settings-back" onClick={onClose} aria-label={language === "en" ? "Back to settings" : "กลับหน้าตั้งค่า"}><Icon name="back" size={18}/></button><div><small>{language === "en" ? "Our Home · Administration" : "บ้านของเรา · จัดการระบบ"}</small><h2 id="admin-console-title">{language === "en" ? "Members and households" : "จัดการสมาชิกและบ้าน"}</h2></div></header>
   <nav className="admin-console-tabs" aria-label="เมนูผู้ดูแล">{([["users","ผู้ใช้"],["houses","บ้านและโควตา"],["signup","การสมัครสมาชิก"],["audit","ประวัติแอดมิน"]] as const).map(([id,label])=><button type="button" key={id} className={tab===id?"selected":""} aria-pressed={tab===id} onClick={()=>switchTab(id)}>{label}</button>)}</nav>
   <div className="admin-console-body" ref={bodyRef}>
    {editing && <button type="button" className="admin-detail-back secondary-button" onClick={()=>{setSelectedUser(null);setSelectedHouse(null);setNotice("");showDetail();}}><Icon name="back" size={17}/>{language === "en" ? "Back to list" : "กลับไปรายชื่อ"}</button>}
    {error&&<p className="household-panel-error" role="alert">{error}</p>}{notice&&<p className="admin-success" role="status">{notice}</p>}
    {tab==="signup"?<SignupSettings language={language}/>:tab==="audit"?<section>{loading?<p role="status">กำลังโหลด…</p>:audit.length?audit.map(row=><article key={row.id} className="admin-audit-row"><strong>{row.action}</strong><span>{row.actor_email} · {new Date(row.created_at).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</span><small>{JSON.stringify(row.details)}</small></article>):<p>ยังไม่มีประวัติ</p>}</section>:<>
     {filterUser&&<div className="admin-filter-note"><span>บ้านของ {filterUser.email}</span><button type="button" className="text-button" onClick={()=>{setFilterUser(null);setPage(0);setSelectedHouse(null);}}>ดูทุกบ้าน</button></div>}
     <form className="admin-search" onSubmit={e=>{e.preventDefault();setLoading(true);setPage(0);setQuery(search.trim());reload();}}><input aria-label="ค้นหา" placeholder={tab==="users"?"ค้นหาชื่อหรืออีเมล":"ค้นหาชื่อบ้าน"} value={search} onChange={e=>setSearch(e.target.value)}/><button type="submit" className="secondary-button" disabled={busy}>ค้นหา</button></form>
     {filterUser&&<form className="admin-search" onSubmit={e=>{e.preventDefault();void mutate(async()=>{await adminRpc("admin_create_household",{owner_user:filterUser.id,house_name:newHouse});setNewHouse("");});}}><input aria-label="ชื่อบ้านใหม่" placeholder="สร้างบ้านให้ผู้ใช้นี้" maxLength={60} required value={newHouse} onChange={e=>setNewHouse(e.target.value)}/><button type="submit" className="secondary-button" disabled={busy}>สร้างบ้าน</button></form>}
     <div className="admin-console-grid"><section>
      <p className="admin-help">{loading?"กำลังโหลด…":total+" "+(tab==="users"?"ผู้ใช้":"บ้าน")}</p>
      {tab==="users"?users.map(u=><button type="button" key={u.id} className={"admin-list-row "+(selectedUser?.id===u.id?"selected":"")} disabled={busy} onClick={()=>{setSelectedUser(u);setNotice("");showDetail();}}><span><strong>{u.display_name||u.email}</strong><small>{u.email}</small><small>{u.household_count} บ้าน {u.is_admin&&" · Admin"}</small></span><span className={"admin-status "+(u.enabled?"is-open":"is-closed")}>{u.enabled?"ใช้งาน":"ปิดอยู่"}</span></button>)
       :houses.map(h=><button type="button" key={h.household_id} className={"admin-list-row "+(selectedHouse?.household_id===h.household_id?"selected":"")} disabled={busy} onClick={()=>{setSelectedHouse(h);setNotice("");showDetail();}}><span><strong>{h.name}</strong><small>{h.plan_key} · {mb(h.storage_bytes)} / {mb(h.max_storage_bytes)} MB</small><small>{h.entry_count}/{h.max_entries} รายการ · {h.member_count} สมาชิก</small></span><span className={"admin-status "+(h.writable?"is-open":"is-closed")}>{!h.enabled?"ปิดอยู่":h.writable?"ใช้งาน":"อ่านเท่านั้น"}</span></button>)}
      {!loading&&total===0&&<p>ไม่พบข้อมูล</p>}
      <div className="admin-pagination"><button type="button" className="secondary-button" disabled={page===0||loading||busy} onClick={()=>{setLoading(true);setPage(p=>p-1);}}>ก่อนหน้า</button><span>{page+1} / {Math.max(1,Math.ceil(total/25))}</span><button type="button" className="secondary-button" disabled={(page+1)*25>=total||loading||busy} onClick={()=>{setLoading(true);setPage(p=>p+1);}}>ถัดไป</button></div>
     </section>
     <section>{tab==="users"&&selectedUser?<UserEditor key={JSON.stringify(selectedUser)} user={selectedUser} busy={busy} onHouses={userHomes} onSave={(enabled,limit,reason)=>void mutate(()=>adminRpc("admin_set_user_access",{target_user:selectedUser.id,new_enabled:enabled,household_limit:limit,admin_reason:reason}))}/>
       :tab==="houses"&&selectedHouse?<HouseEditor key={JSON.stringify(selectedHouse)} house={selectedHouse} busy={busy} onSave={settings=>void mutate(()=>adminRpc("admin_save_household",{target_household:selectedHouse.household_id,settings}))} onMember={(id,role)=>void mutate(()=>adminRpc("admin_manage_member",{target_household:selectedHouse.household_id,target_user:id,next_role:role}))} onCleanup={()=>void mutate(async()=>{const {cloud}=await import("@/lib/cloud");const {data}=await cloud!.auth.getSession();const response=await fetch("/api/household-files/cleanup",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+data.session?.access_token},body:JSON.stringify({householdId:selectedHouse.household_id})});const result=await response.json();if(!response.ok)throw new Error(result.error);})}/>
       :<p className="admin-empty-detail">เลือกรายการเพื่อจัดการ</p>}</section>
     </div>
    </>}
   </div>
  </section>
 </div>;
}
