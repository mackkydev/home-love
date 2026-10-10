"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "home" | "items" | "services" | "history";
type AppTheme = "light" | "dark" | "system";
type Accent = "blue" | "violet" | "green" | "rose" | "pink" | "gray" | "gold" | "custom";
type PaletteMode = "normal" | "pastel";
type Language = "th" | "en";
type Payment = { paidAt: string; startAt: string; amount: number; quantity: number };
type Attachment = { name: string; data: string; type: string };
type Entry = {
  id: string;
  name: string;
  category: string;
  kind: "item" | "service" | "note";
  transaction?: "income" | "expense";
  price?: number;
  remaining?: number;
  total?: number;
  unit?: string;
  date: string;
  actor: string;
  note?: string;
  store?: string;
  forPerson?: string;
  medicine?: MedicineInstructions;
  photo?: string;
  photos?: string[];
  attachments?: Attachment[];
  progressStyle?: "bar" | "circle";
  stock?: StockInfo;
  paidDate?: string;
  startDate?: string;
  payments?: Payment[];
  events?: { at: string; actor: string; action: string }[];
};
type MedicineInstructions = { meals: string[]; foodTiming: string; frequencyHours: string; dose: string; doseUnit: string; details: string };
type StockInfo = { quantity: number; dailyUse: number; unit: string; alertDays: number; updatedAt?: string; events?: { at: string; amount: number; actor: string }[] };

const initialEntries: Entry[] = [
  { id: "a1", name: "วิตามินซี 1000 มก.", category: "ยาและสุขภาพ", kind: "item", price: 289, date: "2026-10-08", actor: "แม่", forPerson: "แม่", store: "ร้านขายยาใกล้บ้าน" },
  { id: "a2", name: "ซักผ้า 10 ครั้ง", category: "บริการ", kind: "service", price: 450, remaining: 7, total: 10, unit: "ครั้ง", date: "2026-10-02", paidDate: "2026-10-02", startDate: "2026-10-03", payments: [{ paidAt: "2026-10-02", startAt: "2026-10-03", amount: 450, quantity: 10 }], actor: "พ่อ", events: [{ at: "2026-10-08", actor: "แม่", action: "ใช้บริการ 1 ครั้ง" }, { at: "2026-10-06", actor: "พ่อ", action: "ใช้บริการ 1 ครั้ง" }, { at: "2026-10-03", actor: "แม่", action: "ใช้บริการ 1 ครั้ง" }] },
  { id: "a3", name: "น้ำยาล้างจาน", category: "ของใช้ในบ้าน", kind: "item", price: 79, date: "2026-10-01", actor: "แม่", forPerson: "ส่วนกลาง", store: "ซูเปอร์มาร์เก็ต", note: "แพ็กคู่" },
  { id: "a4", name: "ล้างแอร์ 2 เครื่อง", category: "บริการ", kind: "service", price: 1200, remaining: 1, total: 2, unit: "เครื่อง", date: "2026-09-24", paidDate: "2026-09-22", startDate: "2026-09-24", payments: [{ paidAt: "2026-09-22", startAt: "2026-09-24", amount: 1200, quantity: 2 }], actor: "พ่อ", events: [{ at: "2026-10-04", actor: "พ่อ", action: "ใช้บริการ 1 เครื่อง" }] },
  { id: "a5", name: "ประกันเครื่องซักผ้า", category: "เอกสาร", kind: "note", date: "2026-09-20", actor: "พ่อ", note: "หมดอายุ 20 ก.ย. 2570" },
];

const categories = [
  { name: "ทั้งหมด", icon: "grid", color: "blue" },
  { name: "ยาและสุขภาพ", icon: "plus", color: "rose" },
  { name: "ของใช้ในบ้าน", icon: "home", color: "amber" },
  { name: "รายรับ", icon: "wallet", color: "teal" },
  { name: "รายจ่าย", icon: "receipt", color: "rose" },
  { name: "บริการ", icon: "spark", color: "violet" },
  { name: "เอกสาร", icon: "file", color: "teal" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    camera: <><path d="M14 5h-4l-2 3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3l-2-3Z"/><circle cx="12" cy="13" r="3.5"/></>,
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></>, grid: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></>, plus: <><path d="M12 8v8m-4-4h8"/><circle cx="12" cy="12" r="9"/></>, spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></>, file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/></>, bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>, chevron: <path d="m9 18 6-6-6-6"/>, arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m18 6-12 12M6 6l12 12"/>, cart: <><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H5"/></>, user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>, wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-5 5h2"/></>, edit: <><path d="m4 16-.8 4.8L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17"/><path d="m14.5 6.5 3 3"/></>, trash: <><path d="M3 6h18m-2 0-.9 14H5L4 6m4 0V4h8v2m-6 4v6m4-6v6"/></>, download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>, menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>, heart: <path d="M20.8 8.7c0 4.2-8.8 10-8.8 10s-8.8-5.8-8.8-10a4.6 4.6 0 0 1 8.8-1.5 4.6 4.6 0 0 1 8.8 1.5Z"/>, shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>, dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, tag: <><path d="M20 13 13 20 3 10V4h6l11 9Z"/><circle cx="7.5" cy="7.5" r=".8"/></>, receipt: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Z"/><path d="M8 8h8m-8 4h8m-8 4h4"/></>, package: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8m-9 5v9"/></>
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function today() { return new Date().toISOString().slice(0, 10); }
function currency(value = 0) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value); }
function dateLabel(value: string, language: Language = "th") { return new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" }); }
function isMedicineCategory(category: string) { return /ยา|สุขภาพ|อาหารเสริม/.test(category); }
function isMedicineEntry(category: string, name: string) { return isMedicineCategory(category) || /(^|\s)(ยา|วิตามิน|อาหารเสริม)|supplement|medicine/i.test(name); }
function isIncomeEntry(entry: Pick<Entry, "category" | "transaction">) { return entry.transaction === "income" || entry.category === "รายรับ"; }
function categoryLabel(category: string, language: Language) {
  if (language === "th") return category;
  return ({ "ทั้งหมด": "All", "ยาและสุขภาพ": "Health & medicine", "ของใช้ในบ้าน": "Household items", "รายรับ": "Income", "รายจ่าย": "Expenses", "รายจ่ายในครัวเรือน": "Expenses", "บริการ": "Services", "เอกสาร": "Documents", "อื่น ๆ": "Other" } as Record<string, string>)[category] ?? category;
}
function stockRemaining(stock: StockInfo) { const elapsed = stock.updatedAt ? Math.max(0, Math.floor((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${stock.updatedAt}T00:00:00Z`)) / 86400000)) : 0; return Math.max(0, stock.quantity - stock.dailyUse * elapsed); }
function stockDaysLeft(stock?: StockInfo) { return stock && stock.dailyUse > 0 ? Math.ceil(stockRemaining(stock) / stock.dailyUse) : null; }
function stockFromForm(form: { stockQuantity: string; stockDailyUse: string; stockUnit: string; alertDays: string }, events: StockInfo["events"] = []): StockInfo { return { quantity: Math.max(0, Number(form.stockQuantity) || 0), dailyUse: Math.max(0.01, Number(form.stockDailyUse) || 0.01), unit: form.stockUnit, alertDays: Math.max(0, Number(form.alertDays) || 0), updatedAt: today(), events }; }
function stockRunoutLabel(days: number) { if (days === 0) return "หมดแล้ว"; if (days === 1) return "คาดว่าหมดพรุ่งนี้"; return `คาดว่าหมดใน ${days} วัน`; }
function adjustHex(hex: string, amount: number) { const value = hex.replace("#", ""); if (!/^[0-9a-f]{6}$/i.test(value)) return "#244fe0"; const channels = [0, 2, 4].map((index) => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount))); return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`; }
function hasMedicineInstructions(form: { medMeals: string[]; medFoodTiming: string; medFrequencyHours: string; medDose: string; medDetails: string }) { return form.medMeals.length > 0 || Boolean(form.medFoodTiming || form.medFrequencyHours || form.medDose || form.medDetails.trim()); }
function medicineFromForm(form: { medMeals: string[]; medFoodTiming: string; medFrequencyHours: string; medDose: string; medDoseUnit: string; medDetails: string }): MedicineInstructions {
  return { meals: form.medMeals, foodTiming: form.medFoodTiming, frequencyHours: form.medFrequencyHours, dose: form.medDose, doseUnit: form.medDoseUnit, details: form.medDetails.trim() };
}
async function compressPhoto(file: File) {
  const image = await createImageBitmap(file);
  let scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ไม่สามารถอ่านรูปภาพได้");
  let output = "";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    output = canvas.toDataURL("image/jpeg", Math.max(0.48, 0.76 - attempt * 0.06));
    if (output.length * 0.75 <= 1024 * 1024) break;
    scale *= 0.78;
  }
  image.close();
  if (output.length * 0.75 > 1024 * 1024) throw new Error("รูปมีขนาดใหญ่เกิน 1 MB หลังย่อแล้ว");
  return output;
}
async function documentAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith("image/")) return { name: file.name || "photo.jpg", data: await compressPhoto(file), type: "image/jpeg" };
  if (file.size > 1024 * 1024) throw new Error("ไฟล์ใหญ่เกิน 1 MB");
  return { name: file.name, data: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }), type: file.type || "application/octet-stream" };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [ready, setReady] = useState(false);
  const [todayValue, setTodayValue] = useState("2026-10-09");
  const [modal, setModal] = useState<"item" | "service" | "note" | "category" | "edit" | "renew" | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [extraCategories, setExtraCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", category: "ของใช้ในบ้าน", price: "", total: "", unit: "ครั้ง", note: "", store: "", forPerson: "", paidDate: "", startDate: "", medMeals: [] as string[], medFoodTiming: "", medFrequencyHours: "", medDose: "", medDoseUnit: "เม็ด", medDetails: "", photos: [] as string[], attachments: [] as Attachment[], trackStock: false, stockQuantity: "", stockDailyUse: "", stockUnit: "เม็ด", alertDays: "3" });
  const [showAlerts, setShowAlerts] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("light");
  const [systemDark, setSystemDark] = useState(false);
  const [accent, setAccent] = useState<Accent>("blue");
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("normal");
  const [customColor, setCustomColor] = useState("#3565f6");
  const [language, setLanguage] = useState<Language>("th");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setTodayValue(today());
    const saved = localStorage.getItem("baanjai-entries-v1");
    const savedCategories = localStorage.getItem("baanjai-categories-v1");
    const savedTheme = localStorage.getItem("baanjai-theme") as AppTheme | null;
    const savedAccent = localStorage.getItem("baanjai-accent") as Accent | null;
    const savedPalette = localStorage.getItem("baanjai-palette") as PaletteMode | null;
    const savedCustomColor = localStorage.getItem("baanjai-custom-color");
    const savedLanguage = localStorage.getItem("baanjai-language") as Language | null;
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") setTheme(savedTheme);
    if (["blue", "violet", "green", "rose", "pink", "gray", "gold", "custom"].includes(savedAccent ?? "")) setAccent(savedAccent!);
    if (savedPalette === "normal" || savedPalette === "pastel") setPaletteMode(savedPalette);
    if (savedCustomColor && /^#[0-9a-f]{6}$/i.test(savedCustomColor)) setCustomColor(savedCustomColor);
    if (savedLanguage === "th" || savedLanguage === "en") setLanguage(savedLanguage);
    if (savedCategories) { try { setExtraCategories(JSON.parse(savedCategories) as { name: string; icon: string; color: string }[]); } catch { localStorage.removeItem("baanjai-categories-v1"); } }
    if (saved) {
      try { setEntries(JSON.parse(saved) as Entry[]); } catch { localStorage.removeItem("baanjai-entries-v1"); }
    }
    setReady(true);
  }, []);
  useEffect(() => { const media = window.matchMedia("(prefers-color-scheme: dark)"); const updateSystemTheme = () => setSystemDark(media.matches); updateSystemTheme(); media.addEventListener("change", updateSystemTheme); return () => media.removeEventListener("change", updateSystemTheme); }, []);
  useEffect(() => { const root = document.documentElement; root.dataset.theme = theme === "system" ? (systemDark ? "dark" : "light") : theme; root.dataset.accent = accent; root.dataset.palette = paletteMode; root.lang = language === "th" ? "th" : "en"; if (accent === "custom") { root.style.setProperty("--blue", customColor); root.style.setProperty("--blue-dark", adjustHex(customColor, -35)); } else { root.style.removeProperty("--blue"); root.style.removeProperty("--blue-dark"); } if (ready) { localStorage.setItem("baanjai-theme", theme); localStorage.setItem("baanjai-accent", accent); localStorage.setItem("baanjai-palette", paletteMode); localStorage.setItem("baanjai-custom-color", customColor); localStorage.setItem("baanjai-language", language); } }, [theme, systemDark, accent, paletteMode, customColor, language, ready]);
  useEffect(() => { if ("Notification" in window) setNotificationPermission(Notification.permission); else setNotificationPermission("unsupported"); const timer = setInterval(() => setTodayValue(today()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!ready) return; try { localStorage.setItem("baanjai-entries-v1", JSON.stringify(entries)); } catch { setNotice("พื้นที่บันทึกรูปเต็ม กรุณาสำรองข้อมูลหรือลบรูปเก่าก่อน"); } }, [entries, ready]);
  useEffect(() => { if (ready) localStorage.setItem("baanjai-categories-v1", JSON.stringify(extraCategories)); }, [extraCategories, ready]);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2600); return () => clearTimeout(timer); }, [notice]);

  const filteredEntries = useMemo(() => entries.filter((entry) => (category === "ทั้งหมด" || entry.category === category) && (!dateFilter || entry.date === dateFilter) && `${entry.name} ${entry.category} ${entry.note ?? ""}`.toLowerCase().includes(search.toLowerCase())), [entries, category, dateFilter, search]);
  const spent = entries.filter((entry) => entry.kind === "item" && !isIncomeEntry(entry) && entry.date.slice(0, 7) === todayValue.slice(0, 7)).reduce((sum, entry) => sum + (entry.price ?? 0), 0);
  const income = entries.filter((entry) => entry.kind === "item" && isIncomeEntry(entry) && entry.date.slice(0, 7) === todayValue.slice(0, 7)).reduce((sum, entry) => sum + (entry.price ?? 0), 0);
  const headerDate = new Date(`${todayValue}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const activeServices = entries.filter((entry) => entry.kind === "service" && (entry.remaining ?? 0) > 0);
  const copy = language === "en" ? { home: "Home", items: "Items", services: "Services", history: "History", add: "Add record", hello: "Hello, family", intro: "Keep every home detail in one place.", todaySpend: "This month's spending", allRecords: "All records", servicesLeft: "Services remaining", categories: "Categories", recent: "Recent records", viewAll: "View all", viewHistory: "View history", synced: "Saved on this device", preferences: "Display settings", appearance: "Appearance", light: "Light", dark: "Dark", color: "Accent color", language: "Language", close: "Close" } : { home: "หน้าหลัก", items: "รายการ", services: "สิทธิ์บริการ", history: "ประวัติ", add: "เพิ่มบันทึก", hello: "สวัสดี สมาชิกบ้านเรา", intro: "วันนี้มีอะไรอยากจดบันทึกไหม?", todaySpend: "ค่าใช้จ่ายเดือนนี้", allRecords: "รายการทั้งหมด", servicesLeft: "สิทธิ์ที่ยังเหลือ", categories: "หมวดหมู่", recent: "รายการล่าสุด", viewAll: "ดูทั้งหมด", viewHistory: "ดูประวัติ", synced: "บันทึกในอุปกรณ์นี้", preferences: "การแสดงผล", appearance: "โหมดสี", light: "สว่าง", dark: "มืด", color: "โทนสีหลัก", language: "ภาษา", close: "ปิด" };
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const stockAlerts = useMemo(() => entries.flatMap((entry) => { const days = stockDaysLeft(entry.stock); return entry.stock && days !== null && days <= entry.stock.alertDays ? [{ entry, days, quantity: stockRemaining(entry.stock) }] : []; }).sort((a, b) => a.days - b.days), [entries, todayValue]);
  useEffect(() => {
    if (!ready || notificationPermission !== "granted" || stockAlerts.length === 0) return;
    for (const { entry, days, quantity } of stockAlerts) {
      const key = `baanjai-stock-alert-${entry.id}-${today()}`;
      if (localStorage.getItem(key)) continue;
      const title = `ใกล้หมด: ${entry.name}`;
      const body = `เหลือประมาณ ${currency(quantity)} ${entry.stock?.unit} · ${stockRunoutLabel(days)}`;
      try {
        const registrationPromise = "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(undefined);
        void registrationPromise.then((registration) => registration?.showNotification ? registration.showNotification(title, { body, tag: key, icon: "/icon.svg" }) : Promise.resolve().then(() => { new Notification(title, { body, tag: key }); })).then(() => localStorage.setItem(key, "shown")).catch(() => undefined);
      } catch { /* Browser notifications are optional; the in-app alert remains available. */ }
    }
  }, [ready, notificationPermission, stockAlerts]);
  const recordStockUse = (entry: Entry) => {
    if (!entry.stock) return;
    const amount = Math.min(stockRemaining(entry.stock), entry.stock.dailyUse);
    const event = { at: today(), amount, actor: "คุณ" };
    setEntries((prev) => prev.map((item) => item.id === entry.id && item.stock ? { ...item, stock: { ...item.stock, quantity: Math.max(0, stockRemaining(item.stock) - amount), updatedAt: today(), events: [event, ...(item.stock.events ?? [])] } } : item));
    setNotice(`หัก ${amount} ${entry.stock.unit} จาก ${entry.name} แล้ว`);
  };
  const consumed = (entry: Entry) => {
    if (!entry.remaining || entry.remaining <= 0) return;
    const event = { at: today(), actor: "คุณ", action: `ใช้บริการ 1 ${entry.unit ?? "ครั้ง"}` };
    setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, remaining: Math.max(0, (item.remaining ?? 0) - 1), events: [event, ...(item.events ?? [])] } : item));
    setNotice(`บันทึกการใช้ ${entry.name} แล้ว`);
  };
  const openModal = (kind: "item" | "service" | "note") => {
    setEditingEntry(null);
    setForm({ name: "", category: kind === "item" ? "ของใช้ในบ้าน" : kind === "service" ? "บริการ" : "เอกสาร", price: "", total: "", unit: "ครั้ง", note: "", store: "", forPerson: "", paidDate: today(), startDate: today(), medMeals: [], medFoodTiming: "", medFrequencyHours: "", medDose: "", medDoseUnit: "เม็ด", medDetails: "", photos: [], attachments: [], trackStock: false, stockQuantity: "", stockDailyUse: "", stockUnit: "เม็ด", alertDays: "3" });
    setModal(kind);
  };
  const editEntry = (entry: Entry) => {
    setEditingEntry(entry);
    setForm({ name: entry.name, category: entry.category, price: entry.price?.toString() ?? "", total: entry.total?.toString() ?? "", unit: entry.unit ?? "ครั้ง", note: entry.note ?? "", store: entry.store ?? "", forPerson: entry.forPerson ?? "", paidDate: entry.paidDate ?? entry.date, startDate: entry.startDate ?? entry.date, medMeals: entry.medicine?.meals ?? [], medFoodTiming: entry.medicine?.foodTiming ?? "", medFrequencyHours: entry.medicine?.frequencyHours ?? "", medDose: entry.medicine?.dose ?? "", medDoseUnit: entry.medicine?.doseUnit ?? "เม็ด", medDetails: entry.medicine?.details ?? "", photos: entry.photos ?? (entry.photo ? [entry.photo] : []), attachments: entry.attachments ?? [], trackStock: Boolean(entry.stock), stockQuantity: entry.stock?.quantity.toString() ?? "", stockDailyUse: entry.stock?.dailyUse.toString() ?? "", stockUnit: entry.stock?.unit ?? "เม็ด", alertDays: entry.stock?.alertDays.toString() ?? "3" });
    setModal("edit");
  };
  const renewService = (entry: Entry) => {
    setEditingEntry(entry);
    setForm({ name: entry.name, category: entry.category, price: "", total: "", unit: entry.unit ?? "ครั้ง", note: "", store: entry.store ?? "", forPerson: entry.forPerson ?? "", paidDate: today(), startDate: today(), medMeals: [], medFoodTiming: "", medFrequencyHours: "", medDose: "", medDoseUnit: "เม็ด", medDetails: "", photos: [], attachments: [], trackStock: false, stockQuantity: "", stockDailyUse: "", stockUnit: "เม็ด", alertDays: "3" });
    setModal("renew");
  };
  const saveEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal || !form.name.trim()) return;
    if ((modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && form.trackStock && (form.stockQuantity === "" || form.stockDailyUse === "" || Number(form.stockDailyUse) <= 0)) { setNotice("กรุณาระบุจำนวนคงเหลือและจำนวนที่ใช้ต่อวัน"); return; }
    if (modal === "category") {
      if (categories.some((item) => item.name.toLowerCase() === form.name.trim().toLowerCase()) || extraCategories.some((item) => item.name.toLowerCase() === form.name.trim().toLowerCase())) { setNotice("มีหมวดหมู่นี้แล้ว"); return; }
      setExtraCategories((prev) => [...prev, { name: form.name.trim(), icon: "tag", color: "blue" }]); setModal(null); setNotice("เพิ่มหมวดหมู่แล้ว"); return;
    }
    if (modal === "edit") {
      if (!editingEntry) return;
      const updated = { ...editingEntry, name: form.name.trim(), category: form.category.trim() || editingEntry.category, transaction: form.category === "รายรับ" ? "income" as const : "expense" as const, note: form.note.trim() || undefined, attachments: form.attachments };
      if (editingEntry.kind === "item") { updated.store = form.store.trim() || undefined; updated.forPerson = form.forPerson.trim() || undefined; }
      if (editingEntry.kind === "item") { updated.medicine = isMedicineEntry(form.category, form.name) && hasMedicineInstructions(form) ? medicineFromForm(form) : undefined; updated.photos = form.photos; updated.photo = form.photos[0] || undefined; }
      if (editingEntry.kind === "item") updated.stock = form.trackStock ? stockFromForm(form, editingEntry.stock?.events) : undefined;
      if (form.price) updated.price = Number(form.price); else delete updated.price;
      if (editingEntry.kind === "service") {
        const newTotal = Number(form.total) || editingEntry.total || 1;
        const used = (editingEntry.total ?? 0) - (editingEntry.remaining ?? 0);
        updated.total = newTotal; updated.remaining = Math.max(0, newTotal - used); updated.unit = form.unit || editingEntry.unit;
        updated.paidDate = form.paidDate || editingEntry.paidDate || editingEntry.date;
        updated.startDate = form.startDate || editingEntry.startDate || editingEntry.date;
        updated.date = updated.startDate;
      }
      setEntries((prev) => prev.map((entry) => entry.id === editingEntry.id ? updated : entry));
      setModal(null); setEditingEntry(null); setNotice("แก้ไขรายการแล้ว"); return;
    }
    if (modal === "renew") {
      if (editingEntry?.kind !== "service") return;
      const quantity = Math.max(1, Number(form.total) || 1);
      const amount = Math.max(0, Number(form.price) || 0);
      const payment: Payment = { paidAt: form.paidDate || today(), startAt: form.startDate || today(), amount, quantity };
      setEntries((prev) => prev.map((entry) => entry.id === editingEntry.id ? { ...entry, total: (entry.total ?? 0) + quantity, remaining: (entry.remaining ?? 0) + quantity, price: (entry.price ?? 0) + amount, paidDate: payment.paidAt, payments: [...(entry.payments ?? []), payment] } : entry));
      setModal(null); setEditingEntry(null); setNotice(`เพิ่ม ${quantity} ${form.unit} ให้ ${editingEntry.name} แล้ว`); return;
    }
    const entryKind = modal === "item" && form.category === "บริการ" ? "service" : modal;
    const newEntry: Entry = { id: crypto.randomUUID(), name: form.name.trim(), category: form.category.trim() || "อื่น ๆ", kind: entryKind, transaction: form.category === "รายรับ" ? "income" : "expense", date: entryKind === "service" ? (form.startDate || today()) : today(), actor: "คุณ", note: form.note.trim() || undefined, attachments: form.attachments };
    if (modal === "item") { newEntry.store = form.store.trim() || undefined; newEntry.forPerson = form.forPerson.trim() || undefined; newEntry.photos = form.photos; newEntry.photo = form.photos[0] || undefined; }
    if (modal === "item" && form.trackStock) newEntry.stock = stockFromForm(form);
    if (modal === "item" && isMedicineEntry(form.category, form.name) && hasMedicineInstructions(form)) newEntry.medicine = medicineFromForm(form);
    if (modal !== "note" && form.price) newEntry.price = Number(form.price);
    if (entryKind === "service") { const quantity = Number(form.total) || 1; const amount = Number(form.price) || 0; const payment: Payment = { paidAt: form.paidDate || today(), startAt: form.startDate || today(), amount, quantity }; newEntry.total = quantity; newEntry.remaining = quantity; newEntry.unit = form.unit || "ครั้ง"; newEntry.paidDate = payment.paidAt; newEntry.startDate = payment.startAt; newEntry.payments = [payment]; newEntry.events = []; }
    setEntries((prev) => [newEntry, ...prev]); setModal(null); setTab(entryKind === "service" ? "services" : modal === "note" ? "history" : "items"); setNotice("เพิ่มรายการเรียบร้อยแล้ว");
  };
  const removeEntry = (entry: Entry) => setDeleteTarget(entry);
  const confirmRemove = () => {
    if (!deleteTarget) return;
    setEntries((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setNotice("ลบรายการแล้ว");
    setDeleteTarget(null);
  };
  const exportData = () => { const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "baanjai-backup.json"; anchor.click(); URL.revokeObjectURL(url); setNotice("ดาวน์โหลดไฟล์สำรองแล้ว"); };

  const navItems: { id: Tab; label: string; icon: string }[] = [{ id: "home", label: copy.home, icon: "home" }, { id: "items", label: copy.items, icon: "bag" }, { id: "services", label: copy.services, icon: "ticket" }, { id: "history", label: copy.history, icon: "clock" }];
  const displayEntries = tab === "services" ? filteredEntries.filter((entry) => entry.kind === "service") : tab === "items" ? filteredEntries.filter((entry) => entry.kind === "item") : tab === "history" ? filteredEntries : [];

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={() => setTab("home")}><span className="brand-mark"><Icon name="home" size={21}/></span><span><strong>บ้านใจ</strong><small>HOME ORGANIZER</small></span></a>
      <div className="house-switch"><div className="house-avatar">บ</div><div className="house-details"><span>{ui("พื้นที่ครอบครัว", "Family space")}</span><strong>{ui("บ้านของเรา", "Our home")}</strong></div><Icon name="chevron" size={16}/></div>
      <span className="nav-caption">{ui("เมนูหลัก", "Main menu")}</span>
      <nav className="side-nav">{navItems.map((item) => <button key={item.id} className={`nav-link ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}><Icon name={item.icon === "ticket" ? "spark" : item.icon}/><span>{item.label}</span>{item.id === "services" && <small>{activeServices.length}</small>}</button>)}</nav>
      <span className="nav-caption category-caption">{copy.categories}</span>
      <nav className="side-nav category-nav">{[...categories.slice(1), ...extraCategories].map((item) => <button key={item.name} className={`nav-link ${category === item.name ? "active" : ""}`} onClick={() => { setCategory(category === item.name ? "ทั้งหมด" : item.name); setTab("items"); }}><span className={`category-dot ${item.color}`}></span><span>{categoryLabel(item.name, language)}</span></button>)}<button className="add-category" onClick={() => { setForm({ ...form, name: "" }); setModal("category"); }}><span>＋</span> {ui("เพิ่มหมวดหมู่", "Add category")}</button></nav>
      <div className="sidebar-spacer"/><div className="tip-card"><span className="tip-icon"><Icon name="shield" size={17}/></span><strong>{ui("ข้อมูลอยู่ในเครื่องนี้", "Data stays on this device")}</strong><p>{ui("อย่าลืมสำรองข้อมูลไว้ เผื่อเปลี่ยนเครื่องนะ", "Back up your records before changing devices.")}</p><button onClick={exportData}>{ui("สำรองข้อมูล", "Back up data")} <Icon name="arrow" size={14}/></button></div>
      <button className="profile-row"><span className="avatar">ค</span><span className="profile-copy"><strong>{ui("คุณ", "You")}</strong><small>{ui("สมาชิกครอบครัว", "Family member")}</small></span><Icon name="dots" size={18}/></button>
    </aside>

    <section className="main-column" id="home">
      <header className="topbar"><div className="breadcrumb">{ui("บ้านของเรา", "Our home")} <Icon name="chevron" size={15}/><strong>{navItems.find((item) => item.id === tab)?.label}</strong></div><div className="top-actions"><span className="sync-status"><i/> {copy.synced}</span><button className="icon-button preferences-button" type="button" aria-label={copy.preferences} aria-expanded={showPreferences} onClick={() => setShowPreferences((value) => !value)}><Icon name="dots"/></button><button className="icon-button notification-button" aria-label={ui(`การแจ้งเตือน ${stockAlerts.length} รายการใกล้หมด`, `${stockAlerts.length} low-stock alerts`)} aria-expanded={showAlerts} onClick={() => setShowAlerts((value) => !value)}><Icon name="bell"/>{stockAlerts.length > 0 && <span className="notification-count">{stockAlerts.length}</span>}</button><button className="avatar top-avatar" aria-label={ui("โปรไฟล์", "Profile")}>ค</button></div></header>
      {showPreferences && <section className="preferences-popover" aria-label={copy.preferences}><div className="preferences-heading"><strong>{copy.preferences}</strong><button type="button" aria-label={copy.close} onClick={() => setShowPreferences(false)}><Icon name="close" size={16}/></button></div><div className="preference-group"><span>{copy.appearance}</span><div className="theme-options appearance-options"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>☀ {copy.light}</button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>☾ {copy.dark}</button><button type="button" className={theme === "system" ? "selected" : ""} onClick={() => setTheme("system")}>◐ {language === "en" ? "System" : "ตามระบบ"}</button></div></div><div className="preference-group"><span>{language === "en" ? "Color style" : "รูปแบบโทนสี"}</span><div className="theme-options"><button type="button" className={paletteMode === "normal" ? "selected" : ""} onClick={() => setPaletteMode("normal")}>{language === "en" ? "Normal" : "ปกติ"}</button><button type="button" className={paletteMode === "pastel" ? "selected" : ""} onClick={() => setPaletteMode("pastel")}>{language === "en" ? "Pastel" : "พาสเทล"}</button></div></div><div className="preference-group"><span>{copy.color}</span><div className="accent-options">{(["blue", "violet", "green", "rose", "pink", "gray", "gold"] as Accent[]).map((color) => <button type="button" key={color} className={`${color} ${accent === color ? "selected" : ""}`} onClick={() => setAccent(color)} aria-label={color}/>)}</div></div><div className="preference-group custom-color-group"><span>{language === "en" ? "Custom color" : "เลือกสีเอง"}</span><label><input type="color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); setAccent("custom"); }}/><i style={{ background: customColor }}/><strong>{customColor.toUpperCase()}</strong></label></div><div className="preference-group"><span>{copy.language}</span><div className="theme-options"><button type="button" className={language === "th" ? "selected" : ""} onClick={() => setLanguage("th")}>ไทย</button><button type="button" className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}>English</button></div></div></section>}
      {showAlerts && <section className="alerts-popover" aria-label="รายการแจ้งเตือน"><div className="alerts-heading"><div><strong>รายการใกล้หมด</strong><small>ตามจำนวนที่ใช้ต่อวันและวันที่ตั้งเตือน</small></div><button type="button" aria-label="ปิดการแจ้งเตือน" onClick={() => setShowAlerts(false)}><Icon name="close" size={16}/></button></div>{stockAlerts.length ? <ul>{stockAlerts.map(({ entry, days, quantity }) => <li key={entry.id}><span className="alert-dot"/><div><strong>{entry.name}</strong><small>เหลือประมาณ {currency(quantity)} {entry.stock?.unit} · {stockRunoutLabel(days)}</small></div><button type="button" onClick={() => { setTab("items"); setCategory(entry.category); setShowAlerts(false); }}>ดู</button></li>)}</ul> : <p className="alerts-empty">ยังไม่มีรายการที่ใกล้หมด</p>}{notificationPermission === "default" && <button className="enable-notifications" type="button" onClick={() => { if ("Notification" in window) void Notification.requestPermission().then(setNotificationPermission); }}>เปิดการแจ้งเตือนบนอุปกรณ์</button>}{notificationPermission === "denied" && <p className="notification-help">การแจ้งเตือนถูกปิดไว้ เปิดสิทธิ์ได้ในการตั้งค่าเว็บไซต์</p>}{notificationPermission === "unsupported" && <p className="notification-help">เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน</p>}</section>}

      <div className="content-area">
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> {headerDate}</div><h1>{tab === "home" ? <>{copy.hello} <span>✳</span></> : navItems.find((item) => item.id === tab)?.label}</h1><p>{tab === "home" ? copy.intro : language === "en" ? "Manage and search home information in one place." : "จัดการและค้นหาข้อมูลของบ้านได้ในที่เดียว"}</p></div><button className="primary-button desktop-add" onClick={() => openModal("item")}><span>＋</span> {copy.add}</button></section>

        {tab === "home" ? <>
          <section className="summary-grid">
            <article className="summary-card blue-summary"><div className="summary-top"><span>{ui("ค่าใช้จ่ายเดือนนี้", "This month's expenses")}</span><span className="summary-icon"><Icon name="wallet" size={19}/></span></div><strong className="summary-number">฿{currency(spent)}</strong><div className="summary-foot"><span className="summary-trend">↗</span> {ui("รวมรายการซื้อในเดือนนี้", "All purchases this month")}</div><div className="summary-decoration"/></article>
            <article className="summary-card income-summary"><div className="summary-top"><span>{ui("รายรับเดือนนี้", "This month's income")}</span><span className="summary-icon income-icon"><Icon name="wallet" size={19}/></span></div><strong className="summary-number">฿{currency(income)}</strong><div className="summary-foot">{ui("รวมเงินเข้าของครัวเรือน", "All household income")}</div><div className="mini-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            <article className="summary-card"><div className="summary-top"><span>{ui("สิทธิ์ที่ยังเหลือ", "Services remaining")}</span><span className="summary-icon lilac-icon"><Icon name="spark" size={19}/></span></div><strong className="summary-number">{activeServices.reduce((sum, item) => sum + (item.remaining ?? 0), 0)} <small>{ui("ครั้ง", "uses")}</small></strong><div className="summary-foot">{ui("จาก", "Across")} {activeServices.length} {ui("แพ็กเกจบริการ", "service packages")}</div><div className="summary-ring"><span/></div></article>
          </section>

          <section className="section-block category-block"><div className="section-heading"><div><h2>{copy.categories}</h2><p>{ui("เลือกดูข้อมูลตามที่ต้องการ", "Choose a category to explore")}</p></div><button className="text-button" onClick={() => { setCategory("ทั้งหมด"); setTab("items"); }}>{copy.viewAll} <Icon name="arrow" size={15}/></button></div><div className="category-cards">{[...categories.slice(1), ...extraCategories].map((item) => { const count = entries.filter((entry) => entry.category === item.name).length; return <button className="category-card" key={item.name} onClick={() => { setCategory(item.name); setTab(item.name === "บริการ" ? "services" : "items"); }}><span className={`category-icon ${item.color}`}><Icon name={item.icon} size={19}/></span><span className="category-info"><strong>{categoryLabel(item.name, language)}</strong><small>{count} {ui("รายการ", "records")}</small></span><Icon name="chevron" size={16}/></button>; })}<button className="category-card add-category-card" onClick={() => { setForm({ ...form, name: "" }); setModal("category"); }}><span className="add-category-icon">＋</span><span className="category-info"><strong>{ui("เพิ่มหมวดหมู่", "Add category")}</strong><small>{ui("สร้างหมวดใหม่", "Create a new category")}</small></span></button></div></section>

          <section className="section-block recent-block"><div className="section-heading"><div><h2>{copy.recent}</h2><p>{ui("บันทึกล่าสุดของสมาชิกในบ้าน", "Latest records from your household")}</p></div><button className="text-button" onClick={() => { setCategory("ทั้งหมด"); setTab("history"); }}>{copy.viewHistory} <Icon name="arrow" size={15}/></button></div><div className="recent-list">{entries.slice(0, 4).map((entry) => <EntryRow key={entry.id} entry={entry} language={language} onConsume={() => consumed(entry)} onStockUse={() => recordStockUse(entry)} onEdit={() => editEntry(entry)} onRenew={() => renewService(entry)} onRemove={() => removeEntry(entry)} onProgressStyle={(style) => setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, progressStyle: style } : item))}/>)}</div></section>
        </> : <>
          <section className="filter-bar"><label className="search-field"><Icon name="search" size={19}/><input placeholder={ui("ค้นหาชื่อรายการหรือหมวดหมู่...", "Search records or categories...")} value={search} onChange={(event) => setSearch(event.target.value)}/><kbd>⌘ K</kbd></label><div className="date-field"><DatePicker value={dateFilter} onChange={setDateFilter} placeholder={ui("ทุกวันที่", "Any date")} language={language}/></div><button className="filter-button" onClick={() => { setSearch(""); setCategory("ทั้งหมด"); setDateFilter(""); }}><Icon name="grid" size={16}/> {ui("ตัวกรอง", "Filters")}</button></section>
          <div className="filter-chips">{["ทั้งหมด", ...categories.slice(1).map((item) => item.name)].map((name) => <button key={name} className={`filter-chip ${category === name ? "selected" : ""}`} onClick={() => setCategory(name)}>{categoryLabel(name, language)}</button>)}</div>
          <section className="section-block list-page"><div className="section-heading"><div><h2>{tab === "services" ? ui("สิทธิ์และบริการ", "Services") : tab === "items" ? ui("รายการของในบ้าน", "Household records") : ui("ประวัติทั้งหมด", "All history")}</h2><p>{ui("พบ", "Found")} {displayEntries.length} {ui("รายการ", "records")}</p></div><button className="sort-button"><Icon name="calendar" size={16}/> {ui("ล่าสุดก่อน", "Newest first")} <Icon name="chevron" size={14}/></button></div><div className="recent-list">{displayEntries.length ? displayEntries.map((entry) => <EntryRow key={entry.id} entry={entry} language={language} onConsume={() => consumed(entry)} onStockUse={() => recordStockUse(entry)} onEdit={() => editEntry(entry)} onRenew={() => renewService(entry)} onRemove={() => removeEntry(entry)} onProgressStyle={(style) => setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, progressStyle: style } : item))}/>) : <div className="empty-state"><span><Icon name="package" size={27}/></span><strong>{ui("ยังไม่มีรายการในหมวดนี้", "No records in this category")}</strong><p>{ui("ลองเพิ่มบันทึกใหม่ หรือเลือกหมวดหมู่อื่น", "Add a record or choose another category.")}</p><button className="primary-button" onClick={() => openModal(tab === "services" ? "service" : "item")}>＋ {ui("เพิ่มรายการ", "Add record")}</button></div>}</div></section>
        </>}
        <footer className="page-footer"><span>บ้านใจ <i>•</i> พื้นที่เล็ก ๆ สำหรับทุกเรื่องในบ้าน</span><button onClick={exportData}><Icon name="download" size={14}/> ส่งออกข้อมูล</button></footer>
      </div>
      <nav className="mobile-nav">{navItems.slice(0, 2).map((item) => <button key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon === "ticket" ? "spark" : item.icon} size={21}/><span>{item.label === "หน้าหลัก" ? "หน้าแรก" : item.label}</span></button>)}<button className="mobile-add" onClick={() => openModal("item")} aria-label={copy.add}><span>＋</span><b>{language === "en" ? "Add" : "เพิ่ม"}</b></button>{navItems.slice(2).map((item) => <button key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon === "ticket" ? "spark" : item.icon} size={21}/><span>{item.label === "สิทธิ์บริการ" ? "บริการ" : item.label}</span></button>)}</nav>
    </section>

    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModal(null); setEditingEntry(null); } }}>
      <form className="entry-modal" onSubmit={saveEntry}>
        <div className="modal-top"><div><span className="modal-kicker">{modal === "renew" ? "ต่ออายุแพ็กเกจ" : modal === "edit" ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}</span><h2>{modal === "item" ? "เพิ่มรายการซื้อ" : modal === "service" ? "เพิ่มสิทธิ์หรือบริการ" : modal === "category" ? "สร้างหมวดหมู่" : modal === "renew" ? "ซื้อบริการเพิ่ม" : modal === "edit" ? "แก้ไขรายการ" : "เพิ่มบันทึก"}</h2></div><button type="button" className="icon-button" onClick={() => { setModal(null); setEditingEntry(null); }} aria-label="ปิด"><Icon name="close"/></button></div>
        {modal === "renew" ? <label className="form-label">บริการ<input value={form.name} readOnly/></label> : <label className="form-label">{modal === "category" ? "ชื่อหมวดหมู่" : "ชื่อรายการ"}<input autoFocus required placeholder={modal === "service" ? "เช่น นวด 10 ครั้ง" : modal === "item" ? "เช่น ยาแก้แพ้" : modal === "category" ? "เช่น ของใช้สัตว์เลี้ยง" : "เช่น รหัส Wi-Fi"} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>}
        {modal !== "category" && modal !== "renew" && <div className="form-row"><label className="form-label">{ui("หมวดหมู่", "Category")}<CategorySelect value={form.category} options={[...new Set([...categories.slice(1).map((item) => item.name), ...extraCategories.map((item) => item.name), "อื่น ๆ", ...(form.category ? [form.category] : [])])]} language={language} allowCreate onChange={(value) => { if (!categories.some((item) => item.name === value) && !extraCategories.some((item) => item.name === value) && value !== "อื่น ๆ") setExtraCategories((current) => [...current, { name: value, icon: "tag", color: "blue" }]); setForm({ ...form, category: value }); }}/></label>{modal !== "note" && <label className="form-label">{modal === "edit" && editingEntry?.kind === "service" ? ui("ยอดที่จ่ายสะสม (บาท)", "Total paid (THB)") : form.category === "รายรับ" ? ui("รายรับ (บาท)", "Income (THB)") : ui("รายจ่าย (บาท)", "Expense (THB)")}<input type="number" min="0" placeholder="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></label>}</div>}
        {(modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && <div className="form-row"><label className="form-label">ซื้อจากร้าน <span className="optional">ไม่บังคับ</span><input placeholder="เช่น ร้านขายยาใกล้บ้าน" value={form.store} onChange={(event) => setForm({ ...form, store: event.target.value })}/></label><label className="form-label">สำหรับใคร <span className="optional">ไม่บังคับ</span><CategorySelect value={form.forPerson} options={["ตัวเอง", "แม่", "พ่อ", "ลูก", "ส่วนกลาง"]} allowCreate language={language} placeholder={language === "en" ? "Search or add a person" : "ค้นหาหรือเพิ่มชื่อ"} onChange={(value) => setForm({ ...form, forPerson: value })}/></label></div>}
        {(modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && isMedicineEntry(form.category, form.name) && <section className="medicine-form-section">
          <div className="medicine-form-heading"><span className="medicine-form-icon"><Icon name="clock" size={16}/></span><div><strong>วิธีใช้ยา / อาหารเสริม</strong><small>บันทึกตามฉลากหรือคำแนะนำจากผู้เชี่ยวชาญ</small></div></div>
          <div className="medicine-photo-field"><span className="medicine-photo-label">รูปถ่ายยา <small>เพิ่มได้สูงสุด 3 รูป · รูปละไม่เกิน 1 MB</small></span><div className="medicine-photo-grid">{form.photos.map((photo, index) => <div className="medicine-photo-preview" key={photo}><img src={photo} alt={`รูปยาที่แนบ ${index + 1}`}/><button type="button" className="medicine-photo-remove" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => setForm((current) => ({ ...current, photos: current.photos.filter((_, itemIndex) => itemIndex !== index) }))}><Icon name="trash" size={14}/></button></div>)}{form.photos.length < 3 && <><label className="medicine-photo-button"><Icon name="camera" size={18}/><span><strong>ถ่ายรูป</strong><small>เปิดกล้องหลัง</small></span><input type="file" accept="image/*" capture="environment" onChange={async (event) => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; try { const photo = await compressPhoto(file); setForm((current) => current.photos.length < 3 ? { ...current, photos: [...current.photos, photo] } : current); } catch { setNotice("รูปต้องย่อให้เหลือไม่เกิน 1 MB"); } finally { input.value = ""; } }}/></label><label className="medicine-photo-button"><Icon name="package" size={18}/><span><strong>เลือกรูป</strong><small>เลือกได้หลายรูป</small></span><input type="file" accept="image/*" multiple onChange={async (event) => { const input = event.currentTarget; const files = Array.from(input.files ?? []).slice(0, 3); if (!files.length) return; try { const photos = await Promise.all(files.map(compressPhoto)); setForm((current) => ({ ...current, photos: [...current.photos, ...photos].slice(0, 3) })); if (files.length > 3) setNotice("เลือกได้สูงสุด 3 รูป"); } catch { setNotice("มีรูปที่ย่อให้เหลือไม่เกิน 1 MB ไม่สำเร็จ"); } finally { input.value = ""; } }}/></label></>}</div></div>
          <fieldset className="meal-picker"><legend>รับประทานช่วงไหน</legend><div className="meal-options">{["เช้า", "กลางวัน", "เย็น", "ก่อนนอน"].map((meal) => <label key={meal} className={`meal-option ${form.medMeals.includes(meal) ? "selected" : ""}`}><input type="checkbox" checked={form.medMeals.includes(meal)} onChange={() => setForm({ ...form, medMeals: form.medMeals.includes(meal) ? form.medMeals.filter((item) => item !== meal) : [...form.medMeals, meal] })}/><span>{meal}</span></label>)}</div></fieldset>
          <div className="form-row"><label className="form-label">สัมพันธ์กับอาหาร<select value={form.medFoodTiming} onChange={(event) => setForm({ ...form, medFoodTiming: event.target.value })}><option value="">ไม่ระบุ</option><option>ก่อนอาหาร</option><option>หลังอาหาร</option><option>พร้อมอาหาร</option><option>ไม่เกี่ยวกับอาหาร</option></select></label><label className="form-label">รับประทานทุก ๆ <span className="optional">ไม่บังคับ</span><div className="input-with-unit"><input type="number" min="1" placeholder="เช่น 8" value={form.medFrequencyHours} onChange={(event) => setForm({ ...form, medFrequencyHours: event.target.value })}/><span>ชั่วโมง</span></div></label></div>
          <div className="form-row"><label className="form-label">ครั้งละเท่าไร<input type="number" min="0" step="any" placeholder="เช่น 1" value={form.medDose} onChange={(event) => setForm({ ...form, medDose: event.target.value })}/></label><label className="form-label">หน่วย<CategorySelect value={form.medDoseUnit} options={["เม็ด", "แคปซูล", "ช้อนชา", "ช้อนโต๊ะ", "มิลลิลิตร", "หยด", "ซอง", "ครั้ง", "อื่น ๆ"]} allowCreate placeholder="ค้นหาหรือเพิ่มหน่วย" onChange={(value) => setForm({ ...form, medDoseUnit: value })}/></label></div>
          <label className="form-label">รายละเอียดเพิ่มเติม <span className="optional">ไม่บังคับ</span><textarea rows={2} placeholder="เช่น ดื่มน้ำตาม 1 แก้ว หรือคำแนะนำจากฉลากยา" value={form.medDetails} onChange={(event) => setForm({ ...form, medDetails: event.target.value })}/></label>
        </section>}
        {(modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && <section className="stock-form-section">
          <label className="stock-toggle"><input type="checkbox" checked={form.trackStock} onChange={(event) => setForm({ ...form, trackStock: event.target.checked })}/><span className="stock-toggle-mark"><Icon name="check" size={13}/></span><span><strong>คำนวณจำนวนวันที่ใช้ได้ถึง</strong><small>คำนวณจากจำนวนคงเหลือ ÷ จำนวนที่ใช้ต่อวัน</small></span></label>
          {form.trackStock && <div className="stock-fields"><div className="form-row"><label className="form-label">จำนวนที่มีอยู่<input type="number" min="0" step="any" placeholder="เช่น 30" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })}/></label><label className="form-label">หน่วย<CategorySelect value={form.stockUnit} options={["เม็ด", "แคปซูล", "ชิ้น", "ขวด", "กล่อง", "ซอง", "มล.", "กรัม", "ครั้ง"]} allowCreate placeholder="ค้นหาหรือเพิ่มหน่วย" onChange={(value) => setForm({ ...form, stockUnit: value })}/></label></div><div className="form-row"><label className="form-label">ใช้เฉลี่ยต่อวัน<input type="number" min="0.01" step="any" placeholder="เช่น 2" value={form.stockDailyUse} onChange={(event) => setForm({ ...form, stockDailyUse: event.target.value })}/></label><label className="form-label">แจ้งเตือนก่อนหมด (วัน)<input type="number" min="0" max="365" step="1" value={form.alertDays} onChange={(event) => setForm({ ...form, alertDays: event.target.value })}/></label></div><p className="stock-preview">{form.stockQuantity !== "" && Number(form.stockDailyUse) > 0 ? <>คาดว่าใช้ได้อีก <strong>{Math.ceil(Number(form.stockQuantity) / Number(form.stockDailyUse))} วัน</strong> · แจ้งเตือนก่อนหมด {form.alertDays || 0} วัน</> : "ระบุจำนวนที่มีและจำนวนที่ใช้ต่อวันเพื่อคำนวณวันหมด"}</p></div>}
        </section>}
        {(modal === "service" || modal === "renew" || (modal === "item" && form.category === "บริการ") || (modal === "edit" && editingEntry?.kind === "service")) && <>
          <div className="form-row"><label className="form-label">{modal === "renew" ? "จำนวนที่ซื้อเพิ่ม" : "จำนวนทั้งหมด"}<input type="number" min="1" required placeholder="10" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })}/></label><label className="form-label">หน่วย<CategorySelect value={form.unit} options={["ครั้ง", "ชั่วโมง", "เครื่อง", "ใบ"]} allowCreate placeholder="ค้นหาหรือเพิ่มหน่วย" onChange={(value) => setForm({ ...form, unit: value })}/></label></div>
          <div className="form-row"><label className="form-label">วันที่จ่าย<DatePicker value={form.paidDate} onChange={(value) => setForm({ ...form, paidDate: value })} placeholder="เลือกวันที่จ่าย"/></label><label className="form-label">วันที่เริ่มต้น<DatePicker value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} placeholder="เลือกวันเริ่มต้น"/></label></div>
        </>}
        {(modal === "note" || (modal === "edit" && editingEntry?.kind === "note")) && <section className="medicine-photo-field"><span className="medicine-photo-label">ไฟล์เอกสาร <small>ไฟล์ละไม่เกิน 1 MB</small></span><div className="medicine-photo-grid">{form.attachments.map((attachment, index) => <div className="medicine-photo-preview document-preview" key={attachment.data}><Icon name="file" size={21}/><small>{attachment.name}</small><button type="button" className="medicine-photo-remove" aria-label={`ลบไฟล์ที่ ${index + 1}`} onClick={() => setForm((current) => ({ ...current, attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index) }))}><Icon name="trash" size={14}/></button></div>)}{form.attachments.length < 3 && <><label className="medicine-photo-button"><Icon name="camera" size={18}/><span><strong>ถ่ายรูป</strong><small>ย่ออัตโนมัติ</small></span><input type="file" accept="image/*" capture="environment" onChange={async (event) => { const file = event.currentTarget.files?.[0]; if (!file) return; try { const attachment = await documentAttachment(file); setForm((current) => ({ ...current, attachments: [...current.attachments, attachment].slice(0, 3) })); } catch { setNotice("ไฟล์ต้องมีขนาดไม่เกิน 1 MB"); } finally { event.currentTarget.value = ""; } }}/></label><label className="medicine-photo-button"><Icon name="file" size={18}/><span><strong>อัปโหลดไฟล์</strong><small>รูปภาพหรือ PDF</small></span><input type="file" accept="image/*,application/pdf" onChange={async (event) => { const file = event.currentTarget.files?.[0]; if (!file) return; try { const attachment = await documentAttachment(file); setForm((current) => ({ ...current, attachments: [...current.attachments, attachment].slice(0, 3) })); } catch { setNotice("ไฟล์ต้องมีขนาดไม่เกิน 1 MB"); } finally { event.currentTarget.value = ""; } }}/></label></>}</div></section>}
        {modal !== "category" && <label className="form-label">หมายเหตุ <span className="optional">ไม่บังคับ</span><textarea rows={3} placeholder="เพิ่มรายละเอียดที่อยากจำ..." value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/></label>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setModal(null); setEditingEntry(null); }}>ยกเลิก</button><button type="submit" className="primary-button"><Icon name="check" size={17}/> {modal === "category" ? "สร้างหมวดหมู่" : modal === "renew" ? "บันทึกการซื้อเพิ่ม" : modal === "edit" ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</button></div>
        <p className="local-note"><Icon name="shield" size={14}/> ข้อมูลจะถูกบันทึกไว้ในเบราว์เซอร์ของอุปกรณ์นี้</p>
      </form>
    </div>}
    {deleteTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><span className="confirm-icon"><Icon name="trash" size={22}/></span><h2 id="delete-title">ลบรายการนี้?</h2><p id="delete-description">ต้องการลบ <strong>“{deleteTarget.name}”</strong> ใช่ไหม<br/>การลบนี้ไม่สามารถย้อนกลับได้</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>ยกเลิก</button><button className="danger-button" onClick={confirmRemove}><Icon name="trash" size={16}/> ลบรายการ</button></div></section></div>}
    {notice && <div className="toast"><span><Icon name="check" size={15}/></span>{notice}</div>}
  </main>;
}

function CategorySelect({ value, options, language = "th", placeholder, allowCreate = false, onChange }: { value: string; options: string[]; language?: Language; placeholder?: string; allowCreate?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filteredOptions = options.filter((option) => option.toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")));

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={`category-select ${open ? "is-open" : ""}`} ref={rootRef}>
    <button type="button" className="category-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((current) => !current); setQuery(""); }}>
      <span>{value ? categoryLabel(value, language) : placeholder ?? (language === "en" ? "Select category" : "เลือกหมวดหมู่")}</span><Icon name="chevron" size={16}/>
    </button>
    {open && <div className="category-select-menu">
      <label className="category-select-search"><Icon name="search" size={16}/><input autoFocus type="search" placeholder={placeholder ?? (language === "en" ? "Search categories..." : "ค้นหาหมวดหมู่...")} value={query} onChange={(event) => setQuery(event.target.value)}/></label>
      <div className="category-select-options" role="listbox" aria-label={language === "en" ? "Select category" : "เลือกหมวดหมู่"}>
        {filteredOptions.map((option) => <button type="button" role="option" aria-selected={value === option} className={`category-select-option ${value === option ? "selected" : ""}`} key={option} onClick={() => { onChange(option); setOpen(false); setQuery(""); }}><span>{categoryLabel(option, language)}</span>{value === option && <Icon name="check" size={16}/>}</button>)}
        {!filteredOptions.length && !query.trim() && <p className="category-select-empty">{language === "en" ? "No matching options" : "ไม่พบรายการ"}</p>}
        {allowCreate && query.trim() && !options.some((option) => option.toLocaleLowerCase("th") === query.trim().toLocaleLowerCase("th")) && <button type="button" className="category-select-option category-select-create" onClick={() => { onChange(query.trim()); setOpen(false); setQuery(""); }}><span>＋ {language === "en" ? `Add “${query.trim()}”` : `เพิ่ม “${query.trim()}”`}</span></button>}
      </div>
    </div>}
  </div>;
}

function DatePicker({ value, onChange, placeholder = "เลือกวันที่", language = "th" }: { value: string; onChange: (value: string) => void; placeholder?: string; language?: Language }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(2026, 9, 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const todayDate = new Date();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = visibleMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  const isoDate = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const openPicker = () => {
    const base = selectedDate ?? todayDate;
    setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setOpen((current) => !current);
  };

  return <div className={`date-picker ${open ? "is-open" : ""}`} ref={rootRef}>
    <button type="button" className="date-picker-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={openPicker}><Icon name="calendar" size={16}/><span className={value ? "has-value" : "placeholder"}>{value ? dateLabel(value) : placeholder}</span><span className="date-picker-chevron"><Icon name="chevron" size={15}/></span></button>
    {open && <div className="date-picker-popover" role="dialog" aria-label="เลือกวันที่">
      <div className="date-picker-header"><button type="button" aria-label="เดือนก่อน" onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}><Icon name="chevron" size={17}/></button><strong>{monthLabel}</strong><button type="button" aria-label="เดือนถัดไป" onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}><Icon name="chevron" size={17}/></button></div>
      <div className="calendar-weekdays">{["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="calendar-days">{Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-empty" key={`blank-${index}`}/>)}{Array.from({ length: daysInMonth }, (_, index) => { const day = index + 1; const date = isoDate(day); const selected = value === date; const today = todayDate.getFullYear() === year && todayDate.getMonth() === month && todayDate.getDate() === day; return <button type="button" key={date} className={`calendar-day ${selected ? "selected" : ""} ${today ? "today" : ""}`} aria-pressed={selected} onClick={() => { onChange(date); setOpen(false); }}>{day}</button>; })}</div>
      {value && <button type="button" className="date-picker-clear" onClick={() => { onChange(""); setOpen(false); }}>ล้างวันที่</button>}
    </div>}
  </div>;
}

function EntryRow({ entry, language, onConsume, onStockUse, onEdit, onRenew, onRemove, onProgressStyle }: { entry: Entry; language: Language; onConsume: () => void; onStockUse: () => void; onEdit: () => void; onRenew: () => void; onRemove: () => void; onProgressStyle: (style: "bar" | "circle") => void }) {
  const [expanded, setExpanded] = useState(false);
  const income = isIncomeEntry(entry);
  const householdExpense = entry.category === "รายจ่าย" || entry.category === "รายจ่ายในครัวเรือน";
  const icon = entry.kind === "service" ? "spark" : entry.kind === "note" ? "file" : income ? "wallet" : householdExpense ? "receipt" : "bag";
  const color = entry.kind === "service" ? "violet" : entry.kind === "note" ? "teal" : income ? "teal" : entry.category === "ยาและสุขภาพ" || householdExpense ? "rose" : "amber";
  const payments = entry.payments ?? (entry.kind === "service" ? [{ paidAt: entry.paidDate ?? entry.date, startAt: entry.startDate ?? entry.date, amount: entry.price ?? 0, quantity: entry.total ?? 0 }] : []);
  const remaining = entry.remaining ?? 0;
  const total = entry.total ?? 0;
  const entryPhotos = entry.photos ?? (entry.photo ? [entry.photo] : []);
  const used = Math.max(0, total - remaining);
  const progress = total > 0 ? Math.max(0, Math.min(1, used / total)) : 0;
  const handleRowClick = (event: React.MouseEvent<HTMLElement>) => { if ((event.target as HTMLElement).closest("button")) return; setExpanded((value) => !value); };
  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setExpanded((value) => !value); } };
  return <div className="entry-card-wrap">
    <article className={`entry-row ${expanded ? "is-expanded" : ""}`} onClick={handleRowClick} onKeyDown={handleRowKeyDown} tabIndex={0} aria-label={`เปิดรายละเอียด ${entry.name}`} aria-expanded={expanded}>
      <span className={`entry-icon ${color}`}><Icon name={icon} size={19}/></span>
      <div className="entry-main"><div className="entry-title-line"><strong>{entry.name}</strong><span className={`entry-tag ${color}`}>{entry.category}</span></div>
        <div className="entry-meta"><span><Icon name="calendar" size={13}/>{dateLabel(entry.date, language)}</span><i/><span title={language === "en" ? "Recorded by" : "ผู้บันทึกรายการ"}><Icon name="user" size={13}/>{entry.actor}</span>{entry.forPerson && <><i/><span title={language === "en" ? "For" : "สำหรับผู้ใช้"}><Icon name="heart" size={13}/>{language === "en" ? "For " : "สำหรับ "}{entry.forPerson}</span></>}{entry.store && <><i/><span title={language === "en" ? "Store" : "ซื้อจากร้าน"}><Icon name="bag" size={13}/>{entry.store}</span></>}{entry.note && <><i/><span className="entry-note">{entry.note}</span></>}</div>
        {entry.medicine && <p className="medicine-summary"><Icon name="clock" size={13}/><span>{[entry.medicine.meals.length ? entry.medicine.meals.join(" · ") : "", entry.medicine.foodTiming, entry.medicine.frequencyHours ? `ทุก ${entry.medicine.frequencyHours} ชม.` : "", entry.medicine.dose ? `ครั้งละ ${entry.medicine.dose} ${entry.medicine.doseUnit}` : "", entry.medicine.details].filter(Boolean).join(" · ")}</span></p>}
        {entry.kind === "service" && <div className="service-progress"><span className="progress-track"><i style={{ width: `${progress * 100}%` }}/></span><small>ใช้แล้ว <strong>{used}</strong>/{total} · เหลือ {remaining}</small></div>}
        {entry.stock && <p className={`stock-summary ${stockDaysLeft(entry.stock) !== null && stockDaysLeft(entry.stock)! <= entry.stock.alertDays ? "near-empty" : ""}`}><Icon name="package" size={13}/><span>เหลือประมาณ {currency(stockRemaining(entry.stock))} {entry.stock.unit} · {stockDaysLeft(entry.stock) !== null ? stockRunoutLabel(stockDaysLeft(entry.stock)!) : "ยังไม่ระบุอัตราใช้"}</span></p>}
        <button type="button" className={`detail-toggle ${expanded ? "expanded" : ""}`} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}><Icon name="chevron" size={14}/>{expanded ? (language === "en" ? "Hide details" : "ซ่อนรายละเอียด") : (language === "en" ? "View details" : "ดูรายละเอียด")}</button>
      </div>
      <div className={`entry-value ${income ? "income-value" : ""}`}>{entry.price != null ? <strong>{income ? "+" : "-"}฿{currency(entry.price)}</strong> : <span className="no-price">บันทึกไว้</span>}<small>{entry.kind === "service" ? "จ่ายสะสม" : entry.kind === "note" ? "บันทึก" : income ? "รายรับ" : "รายจ่าย"}</small></div>
      <div className="entry-actions">{entry.stock && stockRemaining(entry.stock) > 0 && <button type="button" className="consume-button stock-consume-button" onClick={onStockUse}><Icon name="check" size={14}/> ใช้วันนี้</button>}{entry.kind === "service" && remaining > 0 && <button type="button" className="consume-button" onClick={onConsume}><Icon name="check" size={14}/> ใช้ 1 {entry.unit ?? "ครั้ง"}</button>}{entry.kind === "service" && remaining === 0 && <button type="button" className="renew-button" onClick={onRenew}><Icon name="plus" size={14}/> ซื้อเพิ่ม</button>}<button type="button" className="row-icon-button edit-icon-button" title="แก้ไขรายการ" aria-label={`แก้ไข ${entry.name}`} onClick={onEdit}><Icon name="edit" size={17}/></button><button type="button" className="row-icon-button delete-icon-button" title="ลบรายการ" aria-label={`ลบ ${entry.name}`} onClick={onRemove}><Icon name="trash" size={17}/></button></div>
    </article>
    {expanded && <section className="service-details entry-details" aria-label={`รายละเอียด ${entry.name}`} onClick={(event) => event.stopPropagation()}>
      {entry.kind === "service" ? <>
        <div className="service-progress-detail"><div className="progress-detail-heading"><div><strong>ความคืบหน้าการใช้</strong><small>ใช้แล้ว {used} จาก {total} {entry.unit ?? "ครั้ง"} · คงเหลือ {remaining} {entry.unit ?? "ครั้ง"}</small></div><div className="progress-style-switch" aria-label="รูปแบบแถบความคืบหน้า"><button type="button" className={(entry.progressStyle ?? "bar") === "bar" ? "selected" : ""} aria-pressed={(entry.progressStyle ?? "bar") === "bar"} onClick={() => onProgressStyle("bar")}>แท่ง</button><button type="button" className={entry.progressStyle === "circle" ? "selected" : ""} aria-pressed={entry.progressStyle === "circle" ? "true" : "false"} onClick={() => onProgressStyle("circle")}>วงกลม</button></div></div>
          {(entry.progressStyle ?? "bar") === "bar" ? <div className="progress-bar-detail"><div className="progress-bar-track"><i style={{ width: `${progress * 100}%` }}/></div><div className="progress-bar-labels"><span>ใช้แล้ว {used} {entry.unit ?? "ครั้ง"}</span><strong>เหลือ {remaining} {entry.unit ?? "ครั้ง"}</strong></div></div> : <div className="progress-circle-layout"><div className="progress-circle" role="img" aria-label={`ใช้แล้ว ${used} จาก ${total} ${entry.unit ?? "ครั้ง"}`}><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="progress-circle-bg" cx="32" cy="32" r="27"/><circle className="progress-circle-fill" cx="32" cy="32" r="27" style={{ strokeDasharray: `${Math.PI * 54}`, strokeDashoffset: `${Math.PI * 54 * (1 - progress)}` }}/></svg><span><strong>{used}<small>/{total}</small></strong><small>ใช้แล้ว</small></span></div><div className="progress-circle-copy"><strong>คงเหลือ {remaining} {entry.unit ?? "ครั้ง"}</strong><small>{Math.round(progress * 100)}% ของสิทธิ์ที่ใช้ไป</small></div></div>}
        </div>
        <div className="service-dates"><div><span><Icon name="calendar" size={15}/> วันที่เริ่มต้น</span><strong>{dateLabel(entry.startDate ?? payments[0]?.startAt ?? entry.date)}</strong></div><div><span><Icon name="wallet" size={15}/> วันที่จ่ายล่าสุด</span><strong>{dateLabel(entry.paidDate ?? payments[payments.length - 1]?.paidAt ?? entry.date)}</strong></div></div>
        <div className="detail-columns"><div className="detail-history"><h4><Icon name="clock" size={15}/> ประวัติการใช้</h4>{entry.events?.length ? <ul>{entry.events.map((event, index) => <li key={`${event.at}-${index}`}><span className="timeline-dot"/><div><strong>{event.action}</strong><small>{dateLabel(event.at)} · {event.actor}</small></div></li>)}</ul> : <p className="detail-empty">ยังไม่มีประวัติการใช้</p>}</div><div className="detail-history payment-history"><h4><Icon name="wallet" size={15}/> ประวัติการจ่าย</h4><ul>{payments.map((payment, index) => <li key={`${payment.paidAt}-${index}`}><span className="timeline-dot payment-dot"/><div><strong>{payment.quantity} {entry.unit ?? "ครั้ง"} · ฿{currency(payment.amount)}</strong><small>จ่าย {dateLabel(payment.paidAt)} · เริ่ม {dateLabel(payment.startAt)}</small></div></li>)}</ul></div></div>
      </> : <div className="item-detail-grid">{entryPhotos.length > 0 && <div className="entry-photo-gallery">{entryPhotos.map((photo, index) => <figure className="entry-photo" key={photo}><img src={photo} alt={`รูป ${entry.name} ${index + 1}`}/>{index === 0 && <figcaption>รูปถ่ายยา / บรรจุภัณฑ์</figcaption>}</figure>)}</div>}<div className="item-detail-info">{entry.stock && <><h4><Icon name="package" size={15}/> จำนวนคงเหลือ</h4><p><span>คงเหลือโดยประมาณ</span><strong>{currency(stockRemaining(entry.stock))} {entry.stock.unit}</strong></p><p><span>ใช้เฉลี่ยต่อวัน</span><strong>{entry.stock.dailyUse} {entry.stock.unit}</strong></p><p><span>ระยะเวลาโดยประมาณ</span><strong>{stockDaysLeft(entry.stock) !== null ? stockRunoutLabel(stockDaysLeft(entry.stock)!) : "ไม่ทราบ"}</strong></p><p><span>แจ้งเตือนล่วงหน้า</span><strong>{entry.stock.alertDays} วัน</strong></p><small className="stock-estimate-note">จำนวนคงเหลือปรับตามอัตราใช้เฉลี่ย ตั้งแต่วันที่บันทึกครั้งล่าสุด</small>{entry.stock.events?.length ? <div className="stock-use-history"><strong>ประวัติการใช้</strong>{entry.stock.events.slice(0, 5).map((event, index) => <small key={`${event.at}-${index}`}>ใช้ {event.amount} {entry.stock?.unit} · {dateLabel(event.at, language)} · {event.actor}</small>)}</div> : null}</>}{entry.store && <p><span>ซื้อจากร้าน</span><strong>{entry.store}</strong></p>}{entry.forPerson && <p><span>สำหรับ</span><strong>{entry.forPerson}</strong></p>}{entry.medicine && <><h4><Icon name="clock" size={15}/> วิธีใช้ยา / อาหารเสริม</h4>{entry.medicine.meals.length > 0 && <p><span>ช่วงเวลา</span><strong>{entry.medicine.meals.join(" · ")}</strong></p>}{entry.medicine.foodTiming && <p><span>สัมพันธ์กับอาหาร</span><strong>{entry.medicine.foodTiming}</strong></p>}{entry.medicine.frequencyHours && <p><span>ความถี่</span><strong>ทุก {entry.medicine.frequencyHours} ชั่วโมง</strong></p>}{entry.medicine.dose && <p><span>ปริมาณต่อครั้ง</span><strong>{entry.medicine.dose} {entry.medicine.doseUnit}</strong></p>}{entry.medicine.details && <p><span>รายละเอียดเพิ่ม</span><strong>{entry.medicine.details}</strong></p>}</>}{entry.attachments?.map((attachment) => <p key={attachment.data}><span>ไฟล์แนบ</span><strong><a href={attachment.data} download={attachment.name}>{attachment.name}</a></strong></p>)}{entry.note && <p><span>หมายเหตุ</span><strong>{entry.note}</strong></p>}{entryPhotos.length === 0 && !entry.store && !entry.forPerson && !entry.medicine && !entry.stock && !entry.note && !(entry.attachments?.length) && <p className="detail-empty">ยังไม่มีรายละเอียดเพิ่มเติม</p>}</div></div>}
    </section>}
  </div>;
}
