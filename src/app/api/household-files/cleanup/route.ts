import { createClient } from "@supabase/supabase-js";
import { usageError } from "@/lib/usage-limits";
export async function POST(request: Request) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!url||!key||!secret) return Response.json({error:"ยังไม่ได้ตั้งค่าบริการจัดเก็บ"}, {status:503});
 if(!token) return Response.json({error:"กรุณาเข้าสู่ระบบ"},{status:401});
 const client=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
 const {data:auth,error:authError}=await client.auth.getUser(token);
 if(authError||!auth.user) return Response.json({error:"กรุณาเข้าสู่ระบบใหม่"},{status:401});
 let householdId:string;
 try { householdId=(await request.json()).householdId; } catch { return Response.json({error:"ข้อมูลไม่ถูกต้อง"},{status:400}); }
 const {data:paths,error}=await client.rpc("admin_orphan_files",{target_household:householdId});
 if(error) return Response.json({error:usageError(error)},{status:403});
 const server=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 if(paths?.length) {
  const {error:removeError}=await server.storage.from("household-files").remove(paths);
  if(removeError) return Response.json({error:"ลบไฟล์ค้างไม่สำเร็จ กรุณาลองใหม่"},{status:502});
  const {error:finishError}=await server.rpc("finish_orphan_cleanup",{actor:auth.user.id,target_household:householdId,removed_paths:paths});
  if(finishError) return Response.json({error:"ลบไฟล์แล้ว แต่คืนการจองพื้นที่ไม่สำเร็จ กรุณาลองใหม่"},{status:502});
 }
 return Response.json({removed:paths?.length??0},{headers:{"Cache-Control":"no-store"}});
}
