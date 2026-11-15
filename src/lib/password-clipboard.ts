// No password is stored in React state, localStorage or the expiry timer.
// Only a SHA-256 fingerprint is retained until the one-minute deadline.
export type ClipboardState = { status: "idle" | "copied" | "cleared" | "changed" | "blocked" | "error"; expiresAt: number };
type ClipboardPort = { writeText(value:string):Promise<void>; readText():Promise<string> };
export function createClipboardLease(port: ClipboardPort, canRead:()=>Promise<boolean>, options: {
 now?:()=>number; schedule?:(fn:()=>void,delay:number)=>ReturnType<typeof setTimeout>;
 cancel?:(timer:ReturnType<typeof setTimeout>)=>void; fingerprint?:(value:string)=>Promise<string>;
} = {}) {
 const now=options.now??Date.now, schedule=options.schedule??setTimeout, cancel=options.cancel??clearTimeout;
 const fingerprint=options.fingerprint??(async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join(""));
 let state:ClipboardState={status:"idle",expiresAt:0};
 let digest:string|null=null, timer:ReturnType<typeof setTimeout>|undefined, generation=0, working=false;
 const listeners=new Set<(state:ClipboardState)=>void>();
 const publish=(value:ClipboardState)=>{state=value;listeners.forEach(listener=>listener(value));};
 const expire=async()=>{
  if(state.status!=="copied"||now()<state.expiresAt)return;
  const version=generation, expected=digest;
  digest=null;
  if(timer)cancel(timer);
  // Mark expired before awaits; an overlapping focus event must not clear twice.
  publish({status:"blocked",expiresAt:0});
  try {
   if(!expected||!await canRead())return;
   const current=await port.readText();
   const matches=await fingerprint(current)===expected;
   if(version!==generation)return;
   if(!matches){publish({status:"changed",expiresAt:0});return;}
   await port.writeText("");
   if(version===generation)publish({status:"cleared",expiresAt:0});
  }catch { /* Keep an explicit manual-clear notice. Browsers can deny background access. */ }
 };
 return {
  getState:()=>state,
  subscribe:(listener:(state:ClipboardState)=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
  async copy(value:string) {
   if(working)return;
   working=true;
   const previousCopy=state.status==="copied" || state.status==="blocked";
   const version=++generation;
   if(timer)cancel(timer);
   digest=null;
   try {
    // Copy inside the user gesture, before asynchronous fingerprint work.
    await port.writeText(value);
    const expiresAt=now()+60_000;
    const next=await fingerprint(value);
    if(version!==generation)return;
    digest=next;
    publish({status:"copied",expiresAt});
    timer=schedule(()=>{void expire();},Math.max(0,expiresAt-now()));
   }catch { if(version===generation)publish({status:previousCopy?"blocked":"error",expiresAt:0}); }
   finally{working=false;}
  },
  expire,
  async clear() {
   generation++;digest=null;if(timer)cancel(timer);
   try{await port.writeText("");publish({status:"cleared",expiresAt:0});}
   catch{publish({status:"blocked",expiresAt:0});}
  }
 };
}
let lease:ReturnType<typeof createClipboardLease>|undefined;
export function passwordClipboard(){
 if(!lease){
  lease=createClipboardLease({
   writeText:value=>navigator.clipboard.writeText(value),
   readText:()=>navigator.clipboard.readText(),
  },async()=>{
   if(!document.hasFocus()||!navigator.permissions)return false;
   try{return (await navigator.permissions.query({name:"clipboard-read" as PermissionName})).state==="granted";}
   catch{return false;}
  });
  const check=()=>{void lease?.expire();};
  window.addEventListener("focus",check);
  document.addEventListener("visibilitychange",check);
 }
 return lease;
}
