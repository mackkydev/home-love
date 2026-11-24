export function pinError(cause: unknown, language: "th" | "en"): string {
  const en = language === "en";
  const details = typeof cause === "object" && cause !== null ? cause as Record<string, unknown> : {};
  const message = typeof details.message === "string" ? details.message : typeof cause === "string" ? cause : "";
  const code = typeof details.code === "string" ? details.code : "";
  if (["PGRST202", "42P01", "42883"].includes(code) || /schema cache|function .*does not exist|relation .*does not exist/i.test(message)) {
    return en ? "The PIN service needs a database update. Please contact the administrator, then retry."
      : "ระบบ PIN ยังไม่พร้อม กรุณาให้ผู้ดูแลอัปเดตฐานข้อมูล PIN แล้วกดลองอีกครั้ง";
  }
  if (/temporarily locked/i.test(message)) return en ? "PIN temporarily locked. Try again in 15 minutes." : "PIN ถูกพักชั่วคราว กรุณาลองใหม่ใน 15 นาที";
  if (code === "23505") return en ? "This PIN is already in use. Please choose another code." : "PIN นี้ถูกใช้แล้ว กรุณาเลือกรหัสอื่น";
  return message && message !== "[object Object]" ? message
    : en ? "Could not use the PIN service. Please try again." : "ใช้งานระบบ PIN ไม่สำเร็จ กรุณาลองอีกครั้ง";
}
