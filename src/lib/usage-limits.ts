export const MB = 1024 * 1024;
export const MAX_UPLOAD_BYTES = 3 * MB;
export const uploadMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const messages: Record<string, string> = {
 ADMIN_REQUIRED: "เฉพาะผู้ดูแลระบบเท่านั้น", ACCOUNT_DISABLED: "บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแล",
 HOUSEHOLD_ACCESS_DENIED: "ไม่มีสิทธิ์เข้าถึงบ้านนี้", HOUSEHOLD_READ_ONLY: "บ้านนี้ถูกระงับหรือแพ็กเกจหมดอายุ ยังอ่านข้อมูลเดิมได้",
 ENTRY_LIMIT_REACHED: "จำนวนรายการครบโควตาแล้ว กรุณาลบรายการหรือให้แอดมินเพิ่มโควตา",
 MEMBER_LIMIT_REACHED: "จำนวนสมาชิกครบโควตาของบ้านแล้ว", HOUSEHOLD_LIMIT_REACHED: "จำนวนบ้านที่เป็นเจ้าของครบโควตาแล้ว",
 FILE_LIMIT_REACHED: "ไฟล์ใหญ่เกินขนาดที่บ้านนี้อนุญาต", STORAGE_LIMIT_REACHED: "พื้นที่จัดเก็บของบ้านไม่เพียงพอ",
 UPLOADS_DISABLED: "บ้านนี้ปิดการอัปโหลดไฟล์", CANNOT_DISABLE_SELF: "ไม่สามารถปิดบัญชีแอดมินที่กำลังใช้งาน",
 LAST_ADMIN_REQUIRED: "ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อยหนึ่งคน", LAST_OWNER_REQUIRED: "เพิ่มเจ้าของคนใหม่ก่อนเปลี่ยนหรือนำเจ้าของคนสุดท้ายออก",
 INLINE_UPLOAD_NOT_ALLOWED: "กรุณาอัปโหลดรูปและไฟล์ผ่านแอป", RECORD_TOO_LARGE: "ข้อมูลในรายการมีขนาดใหญ่เกินไป",
};
export function usageError(cause: unknown): string {
 const message = cause instanceof Error ? cause.message : typeof cause === "object" && cause && "message" in cause ? String(cause.message) : String(cause);
 return Object.entries(messages).find(([key]) => message.includes(key))?.[1] ?? message;
}
export type HouseholdEntitlements = {
 household_id: string; name: string; enabled: boolean; plan_key: string;
 subscription_status: "free" | "trial" | "active" | "past_due" | "canceled";
 expires_at: string | null; uploads_enabled: boolean; max_storage_bytes: number; max_file_bytes: number;
 max_entries: number; max_members: number; entry_count: number; member_count: number;
 storage_bytes: number; reserved_bytes: number; writable: boolean;
};
export function mb(value: number) { return (value / MB).toLocaleString("th-TH", { maximumFractionDigits: 2 }); }
export function validateUpload(size: number, type: string): string | null {
 if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_UPLOAD_BYTES) return "FILE_LIMIT_REACHED";
 if (!uploadMimeTypes.includes(type)) return "รองรับเฉพาะรูป JPEG, PNG, WebP และ PDF";
 return null;
}
