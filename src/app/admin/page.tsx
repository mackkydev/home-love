"use client";
import { useCallback, useEffect, useState } from "react";
import { cloud, isAppAdmin } from "@/lib/cloud";
import AdminPanel from "../AdminPanel";
import CloudAuth from "../CloudAuth";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function AdminPage(){
 const router=useRouter();
 const [state,setState]=useState<"loading"|"login"|"admin"|"denied">("loading");
 const [error,setError]=useState("");
 const check=useCallback(async()=>{
  if(!cloud){setError("หน้านี้ต้องเชื่อมต่อ Supabase");setState("denied");return;}
  try{const {data}=await cloud.auth.getSession();setState(!data.session?"login":await isAppAdmin()?"admin":"denied");}
  catch{setError("ตรวจสอบสิทธิ์ไม่สำเร็จ");setState("denied");}
 },[]);
 useEffect(()=>{let disposed=false;const requestCheck=()=>{if(!disposed)void check();};const initial=setTimeout(requestCheck,0);const sub=cloud?.auth.onAuthStateChange(()=>{setTimeout(requestCheck,0);});return()=>{disposed=true;clearTimeout(initial);sub?.data.subscription.unsubscribe();};},[check]);
 if(state==="admin")return <AdminPanel language="th" onClose={()=>router.push("/")}/>;
 if(state==="denied")return <section className="account-disabled"><h1>เฉพาะผู้ดูแลระบบ</h1><p>{error||"บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้"}</p><Link href="/">กลับหน้าหลัก</Link></section>;
 return <CloudAuth checking={state==="loading"} recoveryMode={false} language="th" cloudError={error} onRetry={()=>void check()} onRecoveryComplete={()=>void check()}/>;
}
