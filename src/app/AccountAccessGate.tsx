"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cloud, cloudEnabled, getMyAccess } from "@/lib/cloud";
import { usageError } from "@/lib/usage-limits";
export default function AccountAccessGate({children}:{children:React.ReactNode}) {
 const [state,setState]=useState<"checking"|"ready"|"disabled"|"error">(cloudEnabled?"checking":"ready");
 const [message,setMessage]=useState("");
 const sequence=useRef(0);
 const check=useCallback(async()=>{
  if(!cloud)return;
  const id=++sequence.current;
  try {
   const {data,error}=await cloud.auth.getSession();
   if(error)throw error;
   const access=data.session?await getMyAccess():{enabled:true,reason:""};
   if(id===sequence.current){setMessage(access.reason);setState(access.enabled?"ready":"disabled");}
  }catch(e){if(id===sequence.current){setMessage(usageError(e));setState("error");}}
 },[]);
 useEffect(()=>{
  if(!cloud)return;
  let disposed=false;
  const requestCheck=()=>{if(!disposed)void check();};
  const initial=setTimeout(requestCheck,0);
  const {data}=cloud.auth.onAuthStateChange(()=>{setTimeout(requestCheck,0);});
  const timer=setInterval(()=>void check(),30_000);
  const visible=()=>{if(!document.hidden)void check();};
  document.addEventListener("visibilitychange",visible);
  return()=>{disposed=true;clearTimeout(initial);data.subscription.unsubscribe();clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
 },[check]);
 if(state==="ready")return children;
 return <section className="account-disabled" role="status"><h1>{state==="checking"?"กำลังตรวจบัญชี…":state==="disabled"?"บัญชีถูกปิดการใช้งาน":"ตรวจสอบสิทธิ์ไม่สำเร็จ"}</h1>{message&&<p>{message}</p>}{state!=="checking"&&<div className="feature-actions"><button type="button" className="primary-button" onClick={()=>void check()}>ตรวจสอบอีกครั้ง</button><button type="button" className="secondary-button" onClick={()=>void cloud?.auth.signOut()}>ออกจากระบบ</button></div>}</section>;
}
