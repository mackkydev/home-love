export default function StartupSplash({ language = "th" }: { language?: "th" | "en" }) {
  const en = language === "en";
  return <main className="startup-splash" role="status" aria-busy="true" aria-live="polite">
    <div className="startup-splash-copy">
      <span className="startup-splash-eyebrow">HOME LOVE</span>
      <h1>{en ? "Welcome home" : "ยินดีต้อนรับสู่บ้านของเรา"}</h1>
      <p>{en ? "Everything your family needs, in one place" : "จัดการเรื่องสำคัญของครอบครัวในที่เดียว"}</p>
      <span className="startup-progress" aria-hidden="true"><i/></span>
      <small>{en ? "Preparing your home…" : "กำลังเตรียมบ้านของคุณ…"}</small>
    </div>
  </main>;
}
