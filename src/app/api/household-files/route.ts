import { createClient } from "@supabase/supabase-js";
import { MAX_UPLOAD_BYTES, usageError, validateUpload } from "@/lib/usage-limits";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !secret) return json({ error: "ยังไม่ได้ตั้งค่าบริการอัปโหลดฝั่งเซิร์ฟเวอร์" }, 503);
 const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if (!token) return json({ error: "กรุณาเข้าสู่ระบบ" }, 401);
 const server = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
 const { data: auth, error: authError } = await server.auth.getUser(token);
 if (authError || !auth.user) return json({ error: "กรุณาเข้าสู่ระบบใหม่" }, 401);
 // Bound the actual body, not just the caller-controlled Content-Length.
 const cap = MAX_UPLOAD_BYTES + 128 * 1024;
 if (Number(request.headers.get("content-length")) > cap) return json({ error: "ไฟล์ใหญ่เกินกำหนด" }, 413);
 let form: FormData;
 try {
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "ไม่มีไฟล์" }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
   const part = await reader.read(); if (part.done) break;
   size += part.value.byteLength;
   if (size > cap) { await reader.cancel(); return json({ error: "ไฟล์ใหญ่เกินกำหนด" }, 413); }
   chunks.push(part.value);
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
 } catch { return json({ error: "รูปแบบไฟล์ไม่ถูกต้อง" }, 400); }
 const householdId = String(form.get("householdId") ?? "");
 const entryId = String(form.get("entryId") ?? "");
 const file = form.get("file");
 if (!uuid.test(householdId) || !uuid.test(entryId) || !(file instanceof File)) return json({ error: "ข้อมูลอัปโหลดไม่ถูกต้อง" }, 400);
 const invalid = validateUpload(file.size, file.type);
 if (invalid) return json({ error: usageError(invalid) }, 400);
 const suffix = ({ "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[file.type] ?? "jpg";
 const path = householdId + "/" + entryId + "/" + crypto.randomUUID() + "." + suffix;
 const { data: reservation, error: reserveError } = await server.rpc("reserve_household_upload", { actor: auth.user.id, target_household: householdId, object_path: path, file_bytes: file.size });
 if (reserveError || !reservation) return json({ error: usageError(reserveError ?? "จองพื้นที่ไม่สำเร็จ") }, 403);
 const { error: uploadError } = await server.storage.from("household-files").upload(path, file, { contentType: file.type, upsert: false });
 if (uploadError) {
  // An uncertain upload may have written an object. Confirm removal before releasing its reservation.
  const cleanup = await server.storage.from("household-files").remove([path]);
  if (!cleanup.error) await server.rpc("release_household_upload", { reservation_id: reservation });
  return json({ error: "อัปโหลดไม่สำเร็จ กรุณาลองใหม่" }, 502);
 }
 // If this fails, the reservation does not double-count an object already present in Storage.
 await server.rpc("release_household_upload", { reservation_id: reservation });
 return json({ path });
}
