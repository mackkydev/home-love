"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloud, cloudEnabled, createHouseholdInvite, createPortableBackup, getProfilePhotoUrl, isAppAdmin, joinHousehold, listHouseholds, openHousehold, saveHousehold, type CloudSnapshot, type Household } from "@/lib/cloud";
import CloudAuth from "./CloudAuth";
import SettingsPage from "./SettingsPage";
import AdminPanel from "./AdminPanel";
import PinLock from "./PinLock";

type Tab = "home" | "items" | "services" | "calendar" | "history" | "settings";
type AppTheme = "light" | "dark" | "system";
type Accent = "blue" | "violet" | "green" | "rose" | "pink" | "gray" | "gold" | "custom";
type PaletteMode = "normal" | "pastel";
type Language = "th" | "en";
type Payment = { paidAt: string; startAt: string; amount: number; quantity: number };
type ServiceAutoUse = { amount: number; everyDays: number; anchorDate: string; baseRemaining: number };
type Attachment = { name: string; data: string; type: string };
type Purchase = { id: string; date: string; store: string; price: number; quantity: number };
type CalendarInfo = { type: "appointment" | "contract"; start: string; end?: string; time: string; remindMinutes: number; message: string; linkedEntryId?: string };
type Entry = {
  id: string;
  name: string;
  category: string;
  kind: "item" | "service" | "note" | "calendar";
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
  serviceAuto?: ServiceAutoUse;
  purchases?: Purchase[];
  calendar?: CalendarInfo;
};
type MedicineInstructions = { meals: string[]; foodTiming: string; frequencyHours: string; dose: string; doseUnit: string; details: string; reminders?: { meal: string; time: string; message: string }[] };
type StockInfo = { quantity: number; dailyUse: number; unit: string; alertDays: number; autoDeduct?: boolean; updatedAt?: string; events?: { at: string; amount: number; actor: string }[] };

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
  { name: "การเงิน", icon: "wallet", color: "teal" },
  { name: "บริการ", icon: "spark", color: "violet" },
  { name: "เอกสาร", icon: "file", color: "teal" },
  { name: "บันทึกแจ้งเตือน", icon: "calendar", color: "violet" },
];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<string, React.ReactNode> = {
    camera: <><path d="M14 5h-4l-2 3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-3l-2-3Z"/><circle cx="12" cy="13" r="3.5"/></>,
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9M9 21v-7h6v7"/></>, grid: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></>, plus: <><path d="M12 8v8m-4-4h8"/><circle cx="12" cy="12" r="9"/></>, spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/></>, file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/></>, bag: <><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>, search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>, chevron: <path d="m9 18 6-6-6-6"/>, arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>, check: <path d="m5 12 4 4L19 6"/>, close: <path d="m18 6-12 12M6 6l12 12"/>, cart: <><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 8H5"/></>, user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>, wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-5 5h2"/></>, edit: <><path d="m4 16-.8 4.8L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17"/><path d="m14.5 6.5 3 3"/></>, trash: <><path d="M3 6h18m-2 0-.9 14H5L4 6m4 0V4h8v2m-6 4v6m4-6v6"/></>, download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>, menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>, heart: <path d="M20.8 8.7c0 4.2-8.8 10-8.8 10s-8.8-5.8-8.8-10a4.6 4.6 0 0 1 8.8-1.5 4.6 4.6 0 0 1 8.8 1.5Z"/>, shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>, dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>, tag: <><path d="M20 13 13 20 3 10V4h6l11 9Z"/><circle cx="7.5" cy="7.5" r=".8"/></>, receipt: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Z"/><path d="M8 8h8m-8 4h8m-8 4h4"/></>, package: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8m-9 5v9"/></>
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function currency(value = 0) { return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value); }
function dateLabel(value: string, language: Language = "th") { return new Date(`${value}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric" }); }
function isMedicineCategory(category: string) { return /ยา|สุขภาพ|อาหารเสริม/.test(category); }
function isMedicineEntry(category: string, name: string) { return isMedicineCategory(category) || /(^|\s)(ยา|วิตามิน|อาหารเสริม)|supplement|medicine/i.test(name); }
function isIncomeEntry(entry: Pick<Entry, "category" | "transaction">) { return entry.transaction === "income" || entry.category === "รายรับ"; }
function categoryLabel(category: string, language: Language) {
  if (language === "th") return category;
  return ({ "ทั้งหมด": "All", "ยาและสุขภาพ": "Health & medicine", "ของใช้ในบ้าน": "Household items", "การเงิน": "Finance", "รายรับ": "Income", "รายจ่าย": "Expenses", "รายจ่ายในครัวเรือน": "Expenses", "บริการ": "Services", "เอกสาร": "Documents", "บันทึกแจ้งเตือน": "Calendar", "อื่น ๆ": "Other" } as Record<string, string>)[category] ?? category;
}
function elapsedDays(from: string) { const result = Math.floor((Date.parse(`${today()}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000); return Number.isFinite(result) ? Math.max(0, result) : 0; }
function stockRemaining(stock: StockInfo) { const elapsed = stock.autoDeduct === false || !stock.updatedAt ? 0 : elapsedDays(stock.updatedAt); return Math.max(0, stock.quantity - stock.dailyUse * elapsed); }
function stockDaysLeft(stock?: StockInfo) { return stock && stock.dailyUse > 0 ? Math.ceil(stockRemaining(stock) / stock.dailyUse) : null; }
function addCalendarDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function stockRunoutDate(stock?: StockInfo) { return stock && stock.dailyUse > 0 ? addCalendarDays(today(), Math.ceil(stockRemaining(stock) / stock.dailyUse)) : null; }
function stockFromForm(form: { stockQuantity: string; stockDailyUse: string; stockUnit: string; alertDays: string; stockAutoDeduct: boolean }, events: StockInfo["events"] = []): StockInfo { return { quantity: Math.max(0, Number(form.stockQuantity) || 0), dailyUse: Math.max(0.01, Number(form.stockDailyUse) || 0.01), unit: form.stockUnit, alertDays: Math.max(0, Number(form.alertDays) || 0), autoDeduct: form.stockAutoDeduct, updatedAt: today(), events }; }
function autoServiceUsed(entry: Entry) { const auto = entry.serviceAuto; if (!auto || auto.everyDays < 1 || auto.amount <= 0) return 0; return Math.min(auto.baseRemaining, Math.floor(elapsedDays(auto.anchorDate) / auto.everyDays) * auto.amount); }
function serviceRemaining(entry: Entry) { return entry.serviceAuto ? Math.max(0, entry.serviceAuto.baseRemaining - autoServiceUsed(entry)) : Math.max(0, entry.remaining ?? 0); }
function serviceAutoHistory(entry: Entry) { const auto = entry.serviceAuto; if (!auto || auto.amount <= 0) return []; const latestCycle = Math.min(Math.floor(elapsedDays(auto.anchorDate) / auto.everyDays), Math.ceil(auto.baseRemaining / auto.amount)); const count = Math.min(30, latestCycle); return Array.from({ length: count }, (_, index) => { const cycle = latestCycle - index; const at = addCalendarDays(auto.anchorDate, cycle * auto.everyDays); const amount = Math.min(auto.amount, Math.max(0, auto.baseRemaining - (cycle - 1) * auto.amount)); return { at, actor: "อัตโนมัติ", action: `หักอัตโนมัติ ${amount} ${entry.unit ?? "ครั้ง"}` }; }); }
function stockRunoutLabel(days: number, language: Language, runoutDate?: string | null) {
  const relative = days <= 0 ? (language === "en" ? "Estimated to be empty" : "คาดว่าหมดแล้ว") : days === 1 ? (language === "en" ? "Estimated to run out tomorrow" : "คาดว่าจะหมดพรุ่งนี้") : language === "en" ? `Estimated to run out in ${days} days` : `คาดว่าจะหมดในอีก ${days} วัน`;
  return runoutDate ? `${relative} · ${dateLabel(runoutDate, language)}` : relative;
}
function adjustHex(hex: string, amount: number) { const value = hex.replace("#", ""); if (!/^[0-9a-f]{6}$/i.test(value)) return "#244fe0"; const channels = [0, 2, 4].map((index) => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount))); return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`; }
function hasMedicineInstructions(form: { medMeals: string[]; medFoodTiming: string; medFrequencyHours: string; medDose: string; medDetails: string; medReminders: MedicineInstructions["reminders"] }) { return form.medMeals.length > 0 || Boolean(form.medFoodTiming || form.medFrequencyHours || form.medDose || form.medDetails.trim() || form.medReminders?.length); }
function medicineFromForm(form: { medMeals: string[]; medFoodTiming: string; medFrequencyHours: string; medDose: string; medDoseUnit: string; medDetails: string; medReminders: MedicineInstructions["reminders"] }): MedicineInstructions {
  return { meals: form.medMeals, foodTiming: form.medFoodTiming, frequencyHours: form.medFrequencyHours, dose: form.medDose, doseUnit: form.medDoseUnit, details: form.medDetails.trim(), reminders: form.medReminders };
}
function vapidBytes(value: string) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")); return Uint8Array.from(raw, (char) => char.charCodeAt(0)); }
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
  const [authStatus, setAuthStatus] = useState<"checking" | "signed-out" | "signed-in">(cloudEnabled ? "checking" : "signed-in");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [cloudSaving, setCloudSaving] = useState(false);
  const [syncRevision, setSyncRevision] = useState(0);
  const [pendingLocalImport, setPendingLocalImport] = useState<{ entries: Entry[]; categories: { name: string; icon: string; color: string }[] } | null>(null);
  const [householdId, setHouseholdId] = useState("");
  const [households, setHouseholds] = useState<Household[]>([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [appAdmin, setAppAdmin] = useState(false);
  const [deviceLocked, setDeviceLocked] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [householdBusy, setHouseholdBusy] = useState(false);
  const [householdError, setHouseholdError] = useState("");
  const cloudSnapshot = useRef<CloudSnapshot<Entry> | null>(null);
  const cloudQueue = useRef<Promise<void>>(Promise.resolve());
  const activeHouseholdRef = useRef("");
  const switchingHouseholdRef = useRef(false);
  const loadedUser = useRef("");
  const mediaPickerOpen = useRef(false);
  const [todayValue, setTodayValue] = useState("2026-10-09");
  const [modal, setModal] = useState<"item" | "service" | "note" | "category" | "edit" | "renew" | "purchase" | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [photoDeleteTarget, setPhotoDeleteTarget] = useState<{ kind: "form"; index: number } | { kind: "attachment"; index: number } | { kind: "entry"; entryId: string; index: number } | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [extraCategories, setExtraCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [category, setCategory] = useState("ทั้งหมด");
  const [endingSoon, setEndingSoon] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", category: "ของใช้ในบ้าน", transaction: "expense" as "income" | "expense", price: "", purchaseQuantity: "1", total: "", unit: "ครั้ง", note: "", store: "", forPerson: "", paidDate: "", startDate: "", medMeals: [] as string[], medFoodTiming: "", medFrequencyHours: "", medDose: "", medDoseUnit: "เม็ด", medDetails: "", medReminders: [] as NonNullable<MedicineInstructions["reminders"]>, useReminders: false, photos: [] as string[], attachments: [] as Attachment[], trackStock: false, stockQuantity: "", stockDailyUse: "", stockUnit: "เม็ด", stockAutoDeduct: false, alertDays: "3", serviceAutoDeduct: false, serviceAutoAmount: "1", serviceAutoEveryDays: "1" });
  const [showAlerts, setShowAlerts] = useState(false);

  const [theme, setTheme] = useState<AppTheme>("light");
  const [systemDark, setSystemDark] = useState(false);
  const [accent, setAccent] = useState<Accent>("blue");
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("normal");
  const [customColor, setCustomColor] = useState("#3565f6");
  const [language, setLanguage] = useState<Language>("th");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushReady, setPushReady] = useState(false);
  useEffect(() => { if (!ready || notificationPermission !== "granted" || !("serviceWorker" in navigator)) return; void navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setPushReady(Boolean(subscription))).catch(() => undefined); }, [ready, notificationPermission]);

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
    if (!cloudEnabled && savedCategories) { try { setExtraCategories(JSON.parse(savedCategories) as { name: string; icon: string; color: string }[]); } catch { localStorage.removeItem("baanjai-categories-v1"); } }
    if (!cloudEnabled && saved) {
      try { setEntries(JSON.parse(saved) as Entry[]); } catch { localStorage.removeItem("baanjai-entries-v1"); }
    }
    setReady(true);
  }, []);
  useEffect(() => { const media = window.matchMedia("(prefers-color-scheme: dark)"); const updateSystemTheme = () => setSystemDark(media.matches); updateSystemTheme(); media.addEventListener("change", updateSystemTheme); return () => media.removeEventListener("change", updateSystemTheme); }, []);
  useEffect(() => { const root = document.documentElement; root.dataset.theme = theme === "system" ? (systemDark ? "dark" : "light") : theme; root.dataset.accent = accent; root.dataset.palette = paletteMode; root.lang = language === "th" ? "th" : "en"; if (accent === "custom") { root.style.setProperty("--blue", customColor); root.style.setProperty("--blue-dark", adjustHex(customColor, -35)); } else { root.style.removeProperty("--blue"); root.style.removeProperty("--blue-dark"); } document.querySelector('meta[name="theme-color"]')?.setAttribute("content", root.dataset.theme === "dark" ? "#151f35" : getComputedStyle(root).getPropertyValue("--blue").trim() || "#3565f6"); if (ready) { localStorage.setItem("baanjai-theme", theme); localStorage.setItem("baanjai-accent", accent); localStorage.setItem("baanjai-palette", paletteMode); localStorage.setItem("baanjai-custom-color", customColor); localStorage.setItem("baanjai-language", language); } }, [theme, systemDark, accent, paletteMode, customColor, language, ready]);
  useEffect(() => { if ("Notification" in window) setNotificationPermission(Notification.permission); else setNotificationPermission("unsupported"); const timer = setInterval(() => setTodayValue(today()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
    if (installed && typeof orientation?.lock === "function") void orientation.lock("portrait-primary").catch(() => undefined);
  }, []);
  useEffect(() => { if (!ready || cloudEnabled) return; try { localStorage.setItem("baanjai-entries-v1", JSON.stringify(entries)); } catch { setNotice("พื้นที่บันทึกรูปเต็ม กรุณาสำรองข้อมูลหรือลบรูปเก่าก่อน"); } }, [entries, ready]);
  useEffect(() => { if (ready && !cloudEnabled) localStorage.setItem("baanjai-categories-v1", JSON.stringify(extraCategories)); }, [extraCategories, ready]);
  const loadHouseholdData = useCallback(async (requestedId?: string, userId = loadedUser.current) => {
    if (!userId) return;
    setCloudReady(false);
    setCloudError("");
    const list = await listHouseholds();
    if (userId !== loadedUser.current) return;
    const storageKey = `baanjai-active-household-${userId}`;
    const preferredId = requestedId ?? localStorage.getItem(storageKey);
    const selectedId = list.find((house) => house.id === preferredId)?.id ?? list[0]?.id;
    if (!selectedId) throw new Error("No household is available");
    const { householdId: id, snapshot } = await openHousehold<Entry>(selectedId);
    if (userId !== loadedUser.current) return;
    localStorage.setItem(storageKey, id);
    cloudSnapshot.current = snapshot;
    activeHouseholdRef.current = id;
    setHouseholds(list);
    setHouseholdId(id);
    const savedEntries = localStorage.getItem("baanjai-entries-v1");
    const savedCategories = localStorage.getItem("baanjai-categories-v1");
    let localEntries: Entry[] = [];
    let localCategories: { name: string; icon: string; color: string }[] = [];
    try { if (savedEntries) localEntries = JSON.parse(savedEntries) as Entry[]; } catch { /* Keep cloud data available if an old backup is invalid. */ }
    try { if (savedCategories) localCategories = JSON.parse(savedCategories) as { name: string; icon: string; color: string }[]; } catch { /* Keep cloud data available if an old backup is invalid. */ }
    const hasRealLocalData = JSON.stringify(localEntries) !== JSON.stringify(initialEntries);
    setPendingLocalImport(snapshot.entries.length === 0 && hasRealLocalData && localEntries.length > 0 ? { entries: localEntries, categories: localCategories } : null);
    setEntries(snapshot.entries.sort((a, b) => b.date.localeCompare(a.date)));
    setExtraCategories(snapshot.categories);
    setCloudReady(true);
  }, []);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setAuthStatus(session ? "signed-in" : "signed-out");
      if (session && loadedUser.current !== session.user.id) { loadedUser.current = session.user.id; void getProfilePhotoUrl(session.user.id).then((url) => { if (active) setProfilePhotoUrl(url); }); setDeviceLocked(event === "INITIAL_SESSION" && localStorage.getItem(`baanjai-pin-device-${session.user.id}`) === "enabled"); setTimeout(() => { if (active) { void loadHouseholdData(undefined, session.user.id).catch((error) => setCloudError(error instanceof Error ? error.message : "เชื่อมต่อ Supabase ไม่สำเร็จ")); void isAppAdmin().then((value) => { if (active && loadedUser.current === session.user.id) setAppAdmin(value); }).catch(() => setAppAdmin(false)); } }, 0); }
      if (!session) { loadedUser.current = ""; setDeviceLocked(false); setProfilePhotoUrl(""); setAppAdmin(false); setShowAdmin(false); setRecoveryMode(false); setCloudReady(false); setCloudError(""); setHouseholdId(""); setHouseholds([]); setPendingLocalImport(null); cloudSnapshot.current = null; activeHouseholdRef.current = ""; }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [loadHouseholdData]);
  useEffect(() => {
    let wasHidden = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") wasHidden = true;
      else {
        if (mediaPickerOpen.current) mediaPickerOpen.current = false;
        else if (wasHidden && loadedUser.current && localStorage.getItem(`baanjai-pin-device-${loadedUser.current}`) === "enabled") setDeviceLocked(true);
        wasHidden = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useEffect(() => {
    if (!cloudReady || !householdId || !cloudSnapshot.current) return;
    const timer = setTimeout(() => {
      if (switchingHouseholdRef.current || householdId !== activeHouseholdRef.current) return;
      const currentEntries = entries;
      const currentCategories = extraCategories;
      cloudQueue.current = cloudQueue.current.catch(() => undefined).then(async () => {
        if (!cloudSnapshot.current || householdId !== activeHouseholdRef.current || switchingHouseholdRef.current) return;
        try {
          setCloudSaving(true);
          cloudSnapshot.current = await saveHousehold(householdId, currentEntries, currentCategories, cloudSnapshot.current);
          setCloudError("");
        } catch (error) {
          setCloudError(error instanceof Error ? error.message : "บันทึกข้อมูลออนไลน์ไม่สำเร็จ");
        } finally {
          setCloudSaving(false);
        }
      });
    }, 450);
    return () => clearTimeout(timer);
  }, [entries, extraCategories, cloudReady, householdId, syncRevision]);
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
  useEffect(() => {
    const syncDetail = () => setSelectedEntryId(new URL(window.location.href).searchParams.get("item"));
    syncDetail();
    window.addEventListener("popstate", syncDetail);
    return () => window.removeEventListener("popstate", syncDetail);
  }, []);

  const filteredEntries = useMemo(() => entries.filter((entry) => entry.kind !== "calendar" && (category === "ทั้งหมด" || entry.category === category || category === "การเงิน" && ["รายรับ", "รายจ่าย", "รายจ่ายในครัวเรือน"].includes(entry.category)) && (!dateFilter || entry.date === dateFilter) && (!endingSoon || (entry.stock && stockDaysLeft(entry.stock) !== null && stockDaysLeft(entry.stock)! <= entry.stock.alertDays)) && `${entry.name} ${entry.category} ${entry.note ?? ""}`.toLowerCase().includes(search.toLowerCase())), [entries, category, dateFilter, endingSoon, search, todayValue]);
  const spent = entries.filter((entry) => entry.kind === "item" && !isIncomeEntry(entry)).reduce((sum, entry) => sum + (entry.purchases?.length ? entry.purchases.reduce((total, purchase) => purchase.date.slice(0, 7) === todayValue.slice(0, 7) ? total + purchase.price : total, 0) : entry.date.slice(0, 7) === todayValue.slice(0, 7) ? entry.price ?? 0 : 0), 0);
  const income = entries.filter((entry) => entry.kind === "item" && isIncomeEntry(entry) && entry.date.slice(0, 7) === todayValue.slice(0, 7)).reduce((sum, entry) => sum + (entry.price ?? 0), 0);
  const headerDate = new Date(`${todayValue}T00:00:00`).toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const activeServices = entries.filter((entry) => entry.kind === "service" && serviceRemaining(entry) > 0);
  const copy = language === "en" ? { home: "Home", items: "Items", services: "Services", history: "History", add: "Add record", hello: "Hello, family", intro: "Keep every home detail in one place.", todaySpend: "This month's spending", allRecords: "All records", servicesLeft: "Services remaining", categories: "Categories", recent: "Recent records", viewAll: "View all", viewHistory: "View history", synced: "Saved on this device", preferences: "Display settings", appearance: "Appearance", light: "Light", dark: "Dark", color: "Accent color", language: "Language", close: "Close" } : { home: "หน้าหลัก", items: "รายการ", services: "สิทธิ์บริการ", history: "ประวัติ", add: "เพิ่มบันทึก", hello: "สวัสดี สมาชิกบ้านเรา", intro: "วันนี้มีอะไรอยากจดบันทึกไหม?", todaySpend: "ค่าใช้จ่ายเดือนนี้", allRecords: "รายการทั้งหมด", servicesLeft: "สิทธิ์ที่ยังเหลือ", categories: "หมวดหมู่", recent: "รายการล่าสุด", viewAll: "ดูทั้งหมด", viewHistory: "ดูประวัติ", synced: "บันทึกในอุปกรณ์นี้", preferences: "การแสดงผล", appearance: "โหมดสี", light: "สว่าง", dark: "มืด", color: "โทนสีหลัก", language: "ภาษา", close: "ปิด" };
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const formStockDays = form.stockQuantity !== "" && Number(form.stockDailyUse) > 0 ? Math.ceil(Number(form.stockQuantity) / Number(form.stockDailyUse)) : null;
  const formStockDate = formStockDays !== null ? addCalendarDays(todayValue, formStockDays) : null;
  const stockAlerts = useMemo(() => entries.flatMap((entry) => { const days = stockDaysLeft(entry.stock); return entry.stock && days !== null && days <= entry.stock.alertDays ? [{ entry, days, quantity: stockRemaining(entry.stock) }] : []; }).sort((a, b) => a.days - b.days), [entries, todayValue]);
  const enablePush = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !cloud) { setNotice(ui("อุปกรณ์นี้ยังไม่รองรับเว็บพุช", "Web Push is unavailable here")); return; }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) { setNotice(ui("การส่งแจ้งเตือนยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์", "Push server is not configured yet")); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(publicKey) });
      const { data: userData, error: userError } = await cloud.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Sign in required");
      const json = subscription.toJSON();
      const { error } = await cloud.from("push_subscriptions").upsert({ endpoint: subscription.endpoint, user_id: userData.user.id, p256dh: json.keys?.p256dh, auth_key: json.keys?.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      setPushReady(true);
      setNotice(ui("เปิดการแจ้งเตือนแล้ว", "Notifications enabled"));
    } catch { setNotice(ui("เปิดเว็บพุชไม่สำเร็จ กรุณาลองอีกครั้ง", "Could not enable Web Push")); }
  };
  const signOut = async () => {
    if (!cloud) return;
    try {
      if ("serviceWorker" in navigator) {
        const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (subscription) { await cloud.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint); await subscription.unsubscribe(); }
      }
    } catch { /* The server removes expired endpoints if the browser cannot unsubscribe. */ }
    setPushReady(false);
    await cloud.auth.signOut();
  };
  useEffect(() => {
    if (!ready || notificationPermission !== "granted" || stockAlerts.length === 0) return;
    for (const { entry, days, quantity } of stockAlerts) {
      const key = `baanjai-stock-alert-${entry.id}-${today()}`;
      if (localStorage.getItem(key)) continue;
      const title = `ใกล้หมด: ${entry.name}`;
      const body = `เหลือประมาณ ${currency(quantity)} ${entry.stock?.unit} · ${stockRunoutLabel(days, language, stockRunoutDate(entry.stock))}`;
      try {
        const registrationPromise = "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(undefined);
        void registrationPromise.then((registration) => registration?.showNotification ? registration.showNotification(title, { body, tag: key, icon: "/icon-192.png" }) : Promise.resolve().then(() => { new Notification(title, { body, tag: key }); })).then(() => localStorage.setItem(key, "shown")).catch(() => undefined);
      } catch { /* Browser notifications are optional; the in-app alert remains available. */ }
    }
  }, [ready, notificationPermission, stockAlerts]);
  const recordStockUse = (entry: Entry) => {
    if (!entry.stock || entry.stock.autoDeduct !== false) return;
    const amount = Math.min(stockRemaining(entry.stock), entry.stock.dailyUse);
    const event = { at: today(), amount, actor: "คุณ" };
    setEntries((prev) => prev.map((item) => item.id === entry.id && item.stock ? { ...item, stock: { ...item.stock, quantity: Math.max(0, stockRemaining(item.stock) - amount), updatedAt: today(), events: [event, ...(item.stock.events ?? [])] } } : item));
    setNotice(`หัก ${amount} ${entry.stock.unit} จาก ${entry.name} แล้ว`);
  };
  const consumed = (entry: Entry) => {
    if (entry.serviceAuto || serviceRemaining(entry) <= 0) return;
    const event = { at: today(), actor: "คุณ", action: `ใช้บริการ 1 ${entry.unit ?? "ครั้ง"}` };
    setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, remaining: Math.max(0, (item.remaining ?? 0) - 1), events: [event, ...(item.events ?? [])] } : item));
    setNotice(`บันทึกการใช้ ${entry.name} แล้ว`);
  };
  const openModal = (kind: "item" | "service" | "note") => {
    setEditingEntry(null);
    setForm({ name: "", category: kind === "item" ? (tab === "items" && category !== "ทั้งหมด" && category !== "บริการ" && category !== "บันทึกแจ้งเตือน" ? category : "ของใช้ในบ้าน") : kind === "service" ? "บริการ" : "เอกสาร", transaction: "expense", price: "", purchaseQuantity: "1", total: "", unit: "ครั้ง", note: "", store: "", forPerson: "", paidDate: today(), startDate: today(), medMeals: [], medFoodTiming: "", medFrequencyHours: "", medDose: "", medDoseUnit: "เม็ด", medDetails: "", medReminders: [], useReminders: false, photos: [], attachments: [], trackStock: false, stockQuantity: "", stockDailyUse: "", stockUnit: "เม็ด", stockAutoDeduct: false, alertDays: "3", serviceAutoDeduct: false, serviceAutoAmount: "1", serviceAutoEveryDays: "1" });
    setModal(kind);
  };
  const editEntry = (entry: Entry) => {
    setEditingEntry(entry);
    setForm({ name: entry.name, category: entry.category, transaction: isIncomeEntry(entry) ? "income" : "expense", price: entry.price?.toString() ?? "", purchaseQuantity: "1", total: entry.total?.toString() ?? "", unit: entry.unit ?? "ครั้ง", note: entry.note ?? "", store: entry.store ?? "", forPerson: entry.forPerson ?? "", paidDate: entry.paidDate ?? entry.date, startDate: entry.startDate ?? entry.date, medMeals: entry.medicine?.meals ?? [], medFoodTiming: entry.medicine?.foodTiming ?? "", medFrequencyHours: entry.medicine?.frequencyHours ?? "", medDose: entry.medicine?.dose ?? "", medDoseUnit: entry.medicine?.doseUnit ?? "เม็ด", medDetails: entry.medicine?.details ?? "", medReminders: entry.medicine?.reminders ?? [], useReminders: Boolean(entry.medicine?.reminders?.length), photos: entry.photos ?? (entry.photo ? [entry.photo] : []), attachments: entry.attachments ?? [], trackStock: Boolean(entry.stock), stockQuantity: entry.stock ? stockRemaining(entry.stock).toString() : "", stockDailyUse: entry.stock?.dailyUse.toString() ?? "", stockUnit: entry.stock?.unit ?? "เม็ด", stockAutoDeduct: entry.stock?.autoDeduct !== false, alertDays: entry.stock?.alertDays.toString() ?? "3", serviceAutoDeduct: Boolean(entry.serviceAuto), serviceAutoAmount: entry.serviceAuto?.amount.toString() ?? "1", serviceAutoEveryDays: entry.serviceAuto?.everyDays.toString() ?? "1" });
    setModal("edit");
  };
  const renewService = (entry: Entry) => {
    setEditingEntry(entry);
    setForm({ name: entry.name, category: entry.category, transaction: "expense", price: "", purchaseQuantity: "1", total: "", unit: entry.unit ?? "ครั้ง", note: "", store: entry.store ?? "", forPerson: entry.forPerson ?? "", paidDate: today(), startDate: today(), medMeals: [], medFoodTiming: "", medFrequencyHours: "", medDose: "", medDoseUnit: "เม็ด", medDetails: "", medReminders: [], useReminders: false, photos: [], attachments: [], trackStock: false, stockQuantity: "", stockDailyUse: "", stockUnit: "เม็ด", stockAutoDeduct: false, alertDays: "3", serviceAutoDeduct: Boolean(entry.serviceAuto), serviceAutoAmount: entry.serviceAuto?.amount.toString() ?? "1", serviceAutoEveryDays: entry.serviceAuto?.everyDays.toString() ?? "1" });
    setModal("renew");
  };
  const buyAgain = (entry: Entry) => {
    setEditingEntry(entry);
    setForm((current) => ({ ...current, name: entry.name, category: entry.category, store: entry.store ?? "", price: "", purchaseQuantity: "1", paidDate: today() }));
    setModal("purchase");
  };
  const saveEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal || !form.name.trim()) return;
    if (((modal === "item" && form.category !== "บริการ") || (modal === "edit" && editingEntry?.kind === "item")) && form.trackStock && (form.stockQuantity === "" || form.stockDailyUse === "" || Number(form.stockDailyUse) <= 0)) { setNotice("กรุณาระบุจำนวนคงเหลือและจำนวนที่ใช้ต่อวัน"); return; }
    if (form.serviceAutoDeduct && (modal === "service" || modal === "renew" || (modal === "item" && form.category === "บริการ") || (modal === "edit" && editingEntry?.kind === "service")) && (!Number.isInteger(Number(form.serviceAutoAmount)) || Number(form.serviceAutoAmount) < 1 || !Number.isInteger(Number(form.serviceAutoEveryDays)) || Number(form.serviceAutoEveryDays) < 1)) { setNotice("กรุณาระบุจำนวนที่หักและรอบวันเป็นจำนวนเต็มมากกว่า 0"); return; }
    if (modal === "category") {
      if (categories.some((item) => item.name.toLowerCase() === form.name.trim().toLowerCase()) || extraCategories.some((item) => item.name.toLowerCase() === form.name.trim().toLowerCase())) { setNotice("มีหมวดหมู่นี้แล้ว"); return; }
      setExtraCategories((prev) => [...prev, { name: form.name.trim(), icon: "tag", color: "blue" }]); setModal(null); setNotice("เพิ่มหมวดหมู่แล้ว"); return;
    }
    if (modal === "purchase") {
      if (!editingEntry || !form.price || Number(form.price) < 0) { setNotice(ui("กรุณาระบุราคา", "Enter a price")); return; }
      const purchase: Purchase = { id: crypto.randomUUID(), date: form.paidDate || today(), store: form.store.trim(), price: Number(form.price), quantity: Math.max(1, Number(form.purchaseQuantity) || 1) };
      setEntries((previous) => previous.map((entry) => entry.id === editingEntry.id ? { ...entry, store: purchase.store, price: purchase.price, date: purchase.date, purchases: [...(entry.purchases ?? [{ id: `original-${entry.id}`, date: entry.date, store: entry.store ?? "", price: entry.price ?? 0, quantity: 1 }]), purchase], stock: entry.stock ? { ...entry.stock, quantity: stockRemaining(entry.stock) + purchase.quantity, updatedAt: today() } : undefined } : entry));
      setModal(null); setEditingEntry(null); setNotice(ui("บันทึกการซื้อเพิ่มแล้ว", "Purchase saved")); return;
    }
    if (modal === "edit") {
      if (!editingEntry) return;
      const updated = { ...editingEntry, name: form.name.trim(), category: form.category.trim() || editingEntry.category, transaction: form.category === "การเงิน" ? form.transaction : form.category === "รายรับ" ? "income" as const : "expense" as const, note: form.note.trim() || undefined, attachments: form.attachments };
      if (editingEntry.kind === "item") { updated.store = form.store.trim() || undefined; updated.forPerson = form.forPerson.trim() || undefined; }
      if (editingEntry.kind === "item") { updated.medicine = (isMedicineEntry(form.category, form.name) || form.useReminders) && hasMedicineInstructions(form) ? medicineFromForm(form) : undefined; updated.photos = form.photos; updated.photo = form.photos[0] || undefined; }
      if (editingEntry.kind === "item") updated.stock = form.trackStock ? stockFromForm(form, editingEntry.stock?.events) : undefined;
      if (form.price) updated.price = Number(form.price); else delete updated.price;
      if (editingEntry.kind === "service") {
        const newTotal = Number(form.total) || editingEntry.total || 1;
        const nextRemaining = Math.max(0, serviceRemaining(editingEntry) + newTotal - (editingEntry.total ?? 0));
        const sameSchedule = editingEntry.serviceAuto && form.serviceAutoDeduct && editingEntry.serviceAuto.amount === Number(form.serviceAutoAmount) && editingEntry.serviceAuto.everyDays === Number(form.serviceAutoEveryDays);
        updated.total = newTotal; updated.remaining = nextRemaining; updated.unit = form.unit || editingEntry.unit;
        if (sameSchedule && editingEntry.serviceAuto) updated.serviceAuto = { ...editingEntry.serviceAuto, baseRemaining: Math.max(0, editingEntry.serviceAuto.baseRemaining + newTotal - (editingEntry.total ?? 0)) };
        else {
          if (editingEntry.serviceAuto) updated.events = [...serviceAutoHistory(editingEntry), ...(editingEntry.events ?? [])];
          updated.serviceAuto = form.serviceAutoDeduct ? { amount: Number(form.serviceAutoAmount), everyDays: Number(form.serviceAutoEveryDays), anchorDate: today(), baseRemaining: nextRemaining } : undefined;
        }
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
      setEntries((prev) => prev.map((entry) => entry.id === editingEntry.id ? { ...entry, total: (entry.total ?? 0) + quantity, remaining: serviceRemaining(entry) + quantity, serviceAuto: entry.serviceAuto ? { ...entry.serviceAuto, anchorDate: payment.startAt, baseRemaining: serviceRemaining(entry) + quantity } : undefined, events: entry.serviceAuto ? [...serviceAutoHistory(entry), ...(entry.events ?? [])] : entry.events, price: (entry.price ?? 0) + amount, paidDate: payment.paidAt, payments: [...(entry.payments ?? []), payment] } : entry));
      setModal(null); setEditingEntry(null); setNotice(`เพิ่ม ${quantity} ${form.unit} ให้ ${editingEntry.name} แล้ว`); return;
    }
    const entryKind = modal === "item" && form.category === "บริการ" ? "service" : modal;
    const newEntry: Entry = { id: crypto.randomUUID(), name: form.name.trim(), category: form.category.trim() || "อื่น ๆ", kind: entryKind, transaction: form.category === "การเงิน" ? form.transaction : form.category === "รายรับ" ? "income" : "expense", date: entryKind === "service" ? (form.startDate || today()) : today(), actor: "คุณ", note: form.note.trim() || undefined, attachments: form.attachments };
    if (modal === "item") { newEntry.store = form.store.trim() || undefined; newEntry.forPerson = form.forPerson.trim() || undefined; newEntry.photos = form.photos; newEntry.photo = form.photos[0] || undefined; if (form.price && !isIncomeEntry(newEntry)) newEntry.purchases = [{ id: crypto.randomUUID(), date: newEntry.date, store: form.store.trim(), price: Number(form.price), quantity: Math.max(1, Number(form.purchaseQuantity) || 1) }]; }
    if (entryKind === "item" && form.trackStock) newEntry.stock = stockFromForm(form);
    if (modal === "item" && (isMedicineEntry(form.category, form.name) || form.useReminders) && hasMedicineInstructions(form)) newEntry.medicine = medicineFromForm(form);
    if (modal !== "note" && form.price) newEntry.price = Number(form.price);
    if (entryKind === "service") { const quantity = Number(form.total) || 1; const amount = Number(form.price) || 0; const payment: Payment = { paidAt: form.paidDate || today(), startAt: form.startDate || today(), amount, quantity }; newEntry.total = quantity; newEntry.remaining = quantity; newEntry.unit = form.unit || "ครั้ง"; newEntry.paidDate = payment.paidAt; newEntry.startDate = payment.startAt; newEntry.payments = [payment]; newEntry.events = []; if (form.serviceAutoDeduct) newEntry.serviceAuto = { amount: Number(form.serviceAutoAmount), everyDays: Number(form.serviceAutoEveryDays), anchorDate: payment.startAt, baseRemaining: quantity }; }
    setEntries((prev) => [newEntry, ...prev]); setModal(null); setTab(entryKind === "service" ? "services" : "items"); setNotice("เพิ่มรายการเรียบร้อยแล้ว");
  };
  const removeEntry = (entry: Entry) => setDeleteTarget(entry);
  const confirmRemove = () => {
    if (!deleteTarget) return;
    setEntries((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    if (selectedEntryId === deleteTarget.id) { setSelectedEntryId(null); const url = new URL(window.location.href); url.searchParams.delete("item"); window.history.replaceState(null, "", url); }
    setNotice("ลบรายการแล้ว");
    setDeleteTarget(null);
  };
  const confirmPhotoRemove = () => {
    if (!photoDeleteTarget) return;
    const index = photoDeleteTarget.index;
    if (photoDeleteTarget.kind === "form") setForm((current) => ({ ...current, photos: current.photos.filter((_, photoIndex) => photoIndex !== index) }));
    else if (photoDeleteTarget.kind === "attachment") setForm((current) => ({ ...current, attachments: current.attachments.filter((_, fileIndex) => fileIndex !== index) }));
    else {
      const entryId = photoDeleteTarget.entryId;
      setEntries((current) => current.map((entry) => {
        if (entry.id !== entryId) return entry;
        const photos = (entry.photos ?? (entry.photo ? [entry.photo] : [])).filter((_, photoIndex) => photoIndex !== index);
        return { ...entry, photos, photo: photos[0] };
      }));
    }
    setPhotoDeleteTarget(null);
    setNotice(photoDeleteTarget.kind === "attachment" ? ui("ลบไฟล์แนบแล้ว", "Attachment removed") : ui("ลบรูปภาพแล้ว", "Photo removed"));
  };
  const exportData = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const backup = await createPortableBackup(entries, extraCategories, households.find((house) => house.id === householdId)?.name ?? "บ้านของเรา");
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const filename = `home-love-backup-${today()}.json`;
      if (window.matchMedia("(max-width: 760px)").matches && navigator.canShare?.({ files: [new File([blob], filename, { type: "application/json" })] })) {
        try {
          await navigator.share({ files: [new File([blob], filename, { type: "application/json" })], title: ui("ข้อมูลสำรองบ้านของเรา", "Our Home backup") });
          setNotice(ui("ส่งไฟล์สำรองแล้ว", "Backup shared"));
          return;
        } catch (cause) { if (cause instanceof DOMException && cause.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(ui("ดาวน์โหลดข้อมูลสำรองพร้อมรูปและเอกสารแล้ว", "Backup downloaded with photos and documents"));
    } catch (cause) { setNotice(ui("สำรองข้อมูลไม่สำเร็จ: ", "Backup failed: ") + (cause instanceof Error ? cause.message : String(cause))); }
    finally { setBackupBusy(false); }
  };
  const openDetail = (id: string) => { const url = new URL(window.location.href); url.searchParams.set("item", id); window.history.pushState({ homeLoveDetail: true }, "", url); setSelectedEntryId(id); };
  const closeDetail = () => { if (window.history.state?.homeLoveDetail) window.history.back(); else { const url = new URL(window.location.href); url.searchParams.delete("item"); window.history.replaceState(null, "", url); setSelectedEntryId(null); } };

  const flushCurrentHousehold = async () => {
    switchingHouseholdRef.current = true;
    await cloudQueue.current;
    if (cloudSnapshot.current && householdId) cloudSnapshot.current = await saveHousehold(householdId, entries, extraCategories, cloudSnapshot.current);
  };
  const switchHousehold = async (id: string) => {
    if (id === householdId) return;
    setHouseholdBusy(true);
    setHouseholdError("");
    try {
      await flushCurrentHousehold();
      await loadHouseholdData(id);
      setInviteCode("");
    } catch (error) {
      setHouseholdError(error instanceof Error ? error.message : "เปลี่ยนบ้านไม่สำเร็จ");
    } finally {
      switchingHouseholdRef.current = false;
      setHouseholdBusy(false);
    }
  };
  const createInvite = async () => {
    setHouseholdBusy(true);
    setHouseholdError("");
    try { setInviteCode(await createHouseholdInvite(householdId)); }
    catch (error) { setHouseholdError(error instanceof Error ? error.message : "สร้างรหัสเชิญไม่สำเร็จ"); }
    finally { setHouseholdBusy(false); }
  };
  const joinWithCode = async (code: string) => {
    setHouseholdBusy(true);
    setHouseholdError("");
    try {
      await flushCurrentHousehold();
      const id = await joinHousehold(code);
      await loadHouseholdData(id);
      setInviteCode("");
      setNotice(language === "en" ? "Joined the household" : "เข้าร่วมบ้านแล้ว");
    } catch (error) {
      setHouseholdError(error instanceof Error ? error.message : "เข้าร่วมบ้านไม่สำเร็จ");
    } finally {
      switchingHouseholdRef.current = false;
      setHouseholdBusy(false);
    }
  };

  const displaySettings = <section className="preferences-popover settings-display-controls" aria-label={copy.preferences}><div className="preferences-heading"><strong>{copy.preferences}</strong></div><div className="preference-group"><span>{copy.appearance}</span><div className="theme-options appearance-options"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}>☀ {copy.light}</button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}>☾ {copy.dark}</button><button type="button" className={theme === "system" ? "selected" : ""} onClick={() => setTheme("system")}>◐ {language === "en" ? "System" : "ตามระบบ"}</button></div></div><div className="preference-group"><span>{language === "en" ? "Color style" : "รูปแบบโทนสี"}</span><div className="theme-options"><button type="button" className={paletteMode === "normal" ? "selected" : ""} onClick={() => setPaletteMode("normal")}>{language === "en" ? "Normal" : "ปกติ"}</button><button type="button" className={paletteMode === "pastel" ? "selected" : ""} onClick={() => setPaletteMode("pastel")}>{language === "en" ? "Pastel" : "พาสเทล"}</button></div></div><div className="preference-group"><span>{copy.color}</span><div className="accent-options">{(["blue", "violet", "green", "rose", "pink", "gray", "gold"] as Accent[]).map((color) => <button type="button" key={color} className={`${color} ${accent === color ? "selected" : ""}`} onClick={() => setAccent(color)} aria-label={color}/>)}</div></div><div className="preference-group custom-color-group"><span>{language === "en" ? "Custom color" : "เลือกสีเอง"}</span><label><input type="color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); setAccent("custom"); }}/><i style={{ background: customColor }}/><strong>{customColor.toUpperCase()}</strong></label></div><button type="button" className="preferences-backup" disabled={backupBusy} onClick={() => void exportData()}><Icon name="download" size={18}/>{backupBusy ? ui("กำลังเตรียมไฟล์สำรอง...", "Preparing backup...") : ui("สำรองข้อมูลพร้อมรูปภาพ", "Back up data with photos")}</button></section>;
  const navItems: { id: Tab; label: string; icon: string }[] = [{ id: "home", label: copy.home, icon: "home" }, { id: "items", label: copy.items, icon: "bag" }, { id: "services", label: copy.services, icon: "ticket" }, { id: "settings", label: ui("ตั้งค่า", "Settings"), icon: "settings" }];
  const displayEntries = tab === "services" ? filteredEntries.filter((entry) => entry.kind === "service") : tab === "items" ? filteredEntries.filter((entry) => entry.kind === "item" || entry.kind === "note") : tab === "history" ? filteredEntries : [];

  if (cloudEnabled && (recoveryMode || !cloudReady || authStatus !== "signed-in")) return <CloudAuth checking={authStatus === "checking" || (authStatus === "signed-in" && !cloudReady)} recoveryMode={recoveryMode} language={language} cloudError={cloudError} onRecoveryComplete={() => setRecoveryMode(false)}/>;
  if (cloudEnabled && deviceLocked) return <PinLock language={language} onUnlock={() => setDeviceLocked(false)}/>;

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
  return <main className={`app-shell ${tab !== "home" && tab !== "settings" ? "is-list-view" : ""}`}>
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={() => setTab("home")}><span className="brand-mark"><Icon name="home" size={21}/></span><span><strong>บ้านของเรา</strong><small>HOME ORGANIZER</small></span></a>
      <button type="button" className="house-switch" disabled={!cloudEnabled} onClick={() => setTab("settings")}><div className="house-avatar">บ</div><div className="house-details"><span>{ui("พื้นที่ครอบครัว", "Family space")}</span><strong>{households.find((house) => house.id === householdId)?.name ?? ui("บ้านของเรา", "Our home")}</strong></div><Icon name="chevron" size={16}/></button>
      <span className="nav-caption">{ui("เมนูหลัก", "Main menu")}</span>
      <nav className="side-nav">{navItems.map((item) => <button key={item.id} className={`nav-link ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}><Icon name={item.icon === "ticket" ? "spark" : item.icon}/><span>{item.label}</span>{item.id === "services" && <small>{activeServices.length}</small>}</button>)}</nav>
      <span className="nav-caption category-caption">{copy.categories}</span>
      <nav className="side-nav category-nav">{[...categories.slice(1), ...extraCategories].map((item) => <button key={item.name} className={`nav-link ${category === item.name ? "active" : ""}`} onClick={() => { setCategory(category === item.name ? "ทั้งหมด" : item.name); setTab(item.name === "บันทึกแจ้งเตือน" ? "calendar" : item.name === "บริการ" ? "services" : "items"); }}><span className={`category-dot ${item.color}`}></span><span>{categoryLabel(item.name, language)}</span></button>)}<button className="add-category" onClick={() => { setForm({ ...form, name: "" }); setModal("category"); }}><span>＋</span> {ui("เพิ่มหมวดหมู่", "Add category")}</button></nav>
      <div className="sidebar-spacer"/><div className="tip-card"><span className="tip-icon"><Icon name="shield" size={17}/></span><strong>{cloudEnabled ? ui("ข้อมูลบันทึกออนไลน์", "Data saved online") : ui("ข้อมูลอยู่ในเครื่องนี้", "Data stays on this device")}</strong><p>{ui("สำรองข้อมูลเพิ่มเติมไว้ได้ทุกเมื่อ", "You can export an extra backup anytime.")}</p><button onClick={() => void exportData()} disabled={backupBusy}>{backupBusy ? ui("กำลังสำรอง...", "Preparing backup...") : ui("สำรองข้อมูล", "Back up data")} <Icon name="arrow" size={14}/></button></div>
      <button className="profile-row" onClick={() => cloudEnabled && setTab("settings")}><span className="avatar">{profilePhotoUrl ? <img src={profilePhotoUrl} alt=""/> : "ค"}</span><span className="profile-copy"><strong>{ui("คุณ", "You")}</strong><small>{cloudEnabled ? ui("จัดการบัญชีและบ้าน", "Account and household") : ui("สมาชิกครอบครัว", "Family member")}</small></span><Icon name="dots" size={18}/></button>
    </aside>

    <section className="main-column" id="home">
      <header className="topbar"><div className="breadcrumb"><button type="button" className="breadcrumb-house" onClick={() => cloudEnabled && setTab("settings")}>{households.find((house) => house.id === householdId)?.name ?? ui("บ้านของเรา", "Our home")}</button><Icon name="chevron" size={15}/><strong>{(navItems.find((item) => item.id === tab)?.label ?? (tab === "calendar" ? ui("บันทึกแจ้งเตือน", "Calendar") : copy.history))}</strong></div><div className="top-actions"><span className={`sync-status ${cloudError ? "sync-error" : cloudSaving ? "sync-saving" : ""}`} role="status" title={cloudEnabled ? cloudError ? ui("ซิงก์มีปัญหา", "Sync issue") : cloudSaving ? ui("กำลังบันทึก", "Saving") : ui("บันทึกแล้ว", "Saved") : copy.synced} aria-label={cloudEnabled ? cloudError ? ui("ซิงก์มีปัญหา", "Sync issue") : cloudSaving ? ui("กำลังบันทึก", "Saving") : ui("บันทึกแล้ว", "Saved") : copy.synced}><i/></span><button type="button" className="language-toggle" onClick={() => setLanguage((current) => current === "th" ? "en" : "th")} aria-label={language === "th" ? "เปลี่ยนภาษาเป็นอังกฤษ" : "Switch language to Thai"} title={language === "th" ? "English" : "ไทย"}>{language.toUpperCase()}</button><button className="icon-button notification-button" aria-label={ui(`การแจ้งเตือน ${stockAlerts.length} รายการใกล้หมด`, `${stockAlerts.length} low-stock alerts`)} aria-expanded={showAlerts} onClick={() => setShowAlerts((value) => !value)}><Icon name="bell"/>{stockAlerts.length > 0 && <span className="notification-count">{stockAlerts.length}</span>}</button><button className="avatar top-avatar" aria-label={ui("จัดการบัญชีและบ้าน", "Account and household")} onClick={() => setTab("settings")}>{profilePhotoUrl ? <img src={profilePhotoUrl} alt=""/> : "ค"}</button></div></header>
      {cloudError && <div className="cloud-sync-error" role="alert">{ui("บันทึกออนไลน์ไม่สำเร็จ", "Online save failed")}: {cloudError} <button type="button" onClick={() => setSyncRevision((value) => value + 1)}>{ui("ลองอีกครั้ง", "Retry")}</button></div>}
      {pendingLocalImport && <div className="cloud-import-banner"><span>{ui(`พบบันทึกเดิม ${pendingLocalImport.entries.length} รายการในเครื่องนี้`, `Found ${pendingLocalImport.entries.length} local records on this device`)}</span><button type="button" onClick={() => { setEntries(pendingLocalImport.entries); setExtraCategories(pendingLocalImport.categories); setPendingLocalImport(null); setNotice(ui("กำลังนำข้อมูลเดิมเข้าบัญชี", "Importing local records")); }}>{ui("นำเข้าบัญชี", "Import")}</button><button type="button" onClick={() => setPendingLocalImport(null)}>{ui("ภายหลัง", "Later")}</button></div>}
      {showAlerts && <section className="alerts-popover" aria-label="รายการแจ้งเตือน"><div className="alerts-heading"><div><strong>รายการใกล้หมด</strong><small>ตามจำนวนที่ใช้ต่อวันและวันที่ตั้งเตือน</small></div><button type="button" aria-label="ปิดการแจ้งเตือน" onClick={() => setShowAlerts(false)}><Icon name="close" size={16}/></button></div>{stockAlerts.length ? <ul>{stockAlerts.map(({ entry, days, quantity }) => <li key={entry.id}><span className="alert-dot"/><div><strong>{entry.name}</strong><small>เหลือประมาณ {currency(quantity)} {entry.stock?.unit} · {stockRunoutLabel(days, language, stockRunoutDate(entry.stock))}</small></div><button type="button" onClick={() => { setTab("items"); setCategory(entry.category); setEndingSoon(true); setShowAlerts(false); }}>ดู</button></li>)}</ul> : <p className="alerts-empty">ยังไม่มีรายการที่ใกล้หมด</p>}{notificationPermission !== "denied" && !pushReady && <button className="enable-notifications" type="button" onClick={() => void enablePush()}>{ui("เปิดแจ้งเตือนบนโทรศัพท์", "Enable phone notifications")}</button>}{pushReady && <p className="notification-help">{ui("เปิดเว็บพุชแล้ว", "Web Push enabled")}</p>}{notificationPermission === "denied" && <p className="notification-help">การแจ้งเตือนถูกปิดไว้ เปิดสิทธิ์ได้ในการตั้งค่าเว็บไซต์</p>}{notificationPermission === "unsupported" && <p className="notification-help">เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน</p>}</section>}

      <div className="content-area">
        {tab === "settings" ? <SettingsPage houses={households} activeId={householdId} inviteCode={inviteCode} busy={householdBusy} error={householdError} language={language} userId={loadedUser.current} isAdmin={appAdmin} profilePhotoUrl={profilePhotoUrl} displaySettings={displaySettings} onPhotoChanged={setProfilePhotoUrl} onMediaPickerStart={() => { mediaPickerOpen.current = true; }} onMediaPickerEnd={() => { mediaPickerOpen.current = false; }} onOpenAdmin={() => setShowAdmin(true)} onOpenHistory={() => { setCategory("ทั้งหมด"); setTab("history"); }} onSwitch={(id) => void switchHousehold(id)} onInvite={() => void createInvite()} onJoin={(code) => void joinWithCode(code)} onSignOut={() => void signOut()}/> : <>
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> {headerDate}</div><h1>{tab === "home" ? <>{copy.hello} <span>✳</span></> : (navItems.find((item) => item.id === tab)?.label ?? (tab === "calendar" ? ui("บันทึกแจ้งเตือน", "Calendar") : copy.history))}</h1><p>{tab === "home" ? copy.intro : language === "en" ? "Manage and search home information in one place." : "จัดการและค้นหาข้อมูลของบ้านได้ในที่เดียว"}</p></div><button className="primary-button desktop-add" onClick={() => openModal(tab === "services" ? "service" : tab === "items" && category === "เอกสาร" ? "note" : "item")}><span>＋</span> {copy.add}</button></section>

        {tab === "calendar" ? <CalendarPage entries={entries} language={language} onSave={(entry) => setEntries((previous) => [entry, ...previous])} onDelete={(entry) => removeEntry(entry)} onOpenEntry={(id) => openDetail(id)}/> : tab === "home" ? <>
          <section className="summary-grid">
            <article className="summary-card blue-summary"><div className="summary-top"><span>{ui("ค่าใช้จ่ายเดือนนี้", "This month's expenses")}</span><span className="summary-icon"><Icon name="wallet" size={19}/></span></div><strong className="summary-number">฿{currency(spent)}</strong><div className="summary-foot"><span className="summary-trend">↗</span> {ui("รวมรายการซื้อในเดือนนี้", "All purchases this month")}</div><div className="summary-decoration"/></article>
            <article className="summary-card income-summary"><div className="summary-top"><span>{ui("รายรับเดือนนี้", "This month's income")}</span><span className="summary-icon income-icon"><Icon name="wallet" size={19}/></span></div><strong className="summary-number">฿{currency(income)}</strong><div className="summary-foot">{ui("รวมเงินเข้าของครัวเรือน", "All household income")}</div><div className="mini-bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></article>
            <article className="summary-card"><div className="summary-top"><span>{ui("สิทธิ์ที่ยังเหลือ", "Services remaining")}</span><span className="summary-icon lilac-icon"><Icon name="spark" size={19}/></span></div><strong className="summary-number">{activeServices.reduce((sum, item) => sum + serviceRemaining(item), 0)} <small>{ui("ครั้ง", "uses")}</small></strong><div className="summary-foot">{ui("จาก", "Across")} {activeServices.length} {ui("แพ็กเกจบริการ", "service packages")}</div><div className="summary-ring"><span/></div></article>
          </section>

          <section className="section-block category-block"><div className="section-heading"><div><h2>{copy.categories}</h2><p>{ui("เลือกดูข้อมูลตามที่ต้องการ", "Choose a category to explore")}</p></div><button className="text-button" onClick={() => { setCategory("ทั้งหมด"); setTab("items"); }}>{copy.viewAll} <Icon name="arrow" size={15}/></button></div><div className="category-cards">{[...categories.slice(1), ...extraCategories].map((item) => { const count = entries.filter((entry) => entry.category === item.name || item.name === "การเงิน" && ["รายรับ", "รายจ่าย", "รายจ่ายในครัวเรือน"].includes(entry.category)).length; return <button className="category-card" key={item.name} onClick={() => { setCategory(item.name); setTab(item.name === "บันทึกแจ้งเตือน" ? "calendar" : item.name === "บริการ" ? "services" : "items"); }}><span className={`category-icon ${item.color}`}><Icon name={item.icon} size={19}/></span><span className="category-info"><strong>{categoryLabel(item.name, language)}</strong><small>{count} {ui("รายการ", "records")}</small></span><Icon name="chevron" size={16}/></button>; })}<button className="category-card add-category-card" onClick={() => { setForm({ ...form, name: "" }); setModal("category"); }}><span className="add-category-icon">＋</span><span className="category-info"><strong>{ui("เพิ่มหมวดหมู่", "Add category")}</strong><small>{ui("สร้างหมวดใหม่", "Create a new category")}</small></span></button></div></section>

          <section className="section-block recent-block"><div className="section-heading"><div><h2>{copy.recent}</h2><p>{ui("บันทึกล่าสุดของสมาชิกในบ้าน", "Latest records from your household")}</p></div><button className="text-button" onClick={() => { setCategory("ทั้งหมด"); setTab("history"); }}>{copy.viewHistory} <Icon name="arrow" size={15}/></button></div><div className="recent-list">{entries.filter((entry) => entry.kind !== "calendar").slice(0, 4).map((entry) => <EntryRow key={entry.id} entry={entry} language={language} onOpen={() => openDetail(entry.id)} onConsume={() => consumed(entry)} onStockUse={() => recordStockUse(entry)} onEdit={() => editEntry(entry)} onRenew={() => renewService(entry)} onBuyAgain={() => buyAgain(entry)} onRemove={() => removeEntry(entry)} onProgressStyle={(style) => setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, progressStyle: style } : item))}/>)}</div></section>
        </> : <>
          <section className="filter-bar"><label className="search-field"><Icon name="search" size={19}/><input placeholder={ui("ค้นหาชื่อรายการหรือหมวดหมู่...", "Search records or categories...")} value={search} onChange={(event) => setSearch(event.target.value)}/><kbd>⌘ K</kbd></label><div className="date-field"><DatePicker value={dateFilter} onChange={setDateFilter} placeholder={ui("ทุกวันที่", "Any date")} language={language}/></div><button className="filter-button" onClick={() => { setSearch(""); setCategory("ทั้งหมด"); setDateFilter(""); setEndingSoon(false); }}><Icon name="grid" size={16}/> {ui("ล้างตัวกรอง", "Clear filters")}</button></section>
          <div className="filter-chips"><button type="button" className={`filter-chip ${endingSoon ? "selected" : ""}`} aria-pressed={endingSoon} onClick={() => { setEndingSoon((current) => !current); if (tab === "services") setTab("items"); }}><Icon name="bell" size={14}/> {ui("กำลังจะหมด", "Running out soon")}</button>{["ทั้งหมด", ...categories.slice(1).map((item) => item.name)].map((name) => <button key={name} className={`filter-chip ${category === name ? "selected" : ""}`} onClick={() => setCategory(name)}>{categoryLabel(name, language)}</button>)}</div>
          <section className="section-block list-page"><div className="section-heading"><div><h2>{tab === "services" ? ui("สิทธิ์และบริการ", "Services") : tab === "items" ? ui("รายการของในบ้าน", "Household records") : ui("ประวัติทั้งหมด", "All history")}</h2><p>{ui("พบ", "Found")} {displayEntries.length} {ui("รายการ", "records")}</p></div><button className="sort-button"><Icon name="calendar" size={16}/> {ui("ล่าสุดก่อน", "Newest first")} <Icon name="chevron" size={14}/></button></div><div className="recent-list">{displayEntries.length ? displayEntries.map((entry) => <EntryRow key={entry.id} entry={entry} language={language} onOpen={() => openDetail(entry.id)} onConsume={() => consumed(entry)} onStockUse={() => recordStockUse(entry)} onEdit={() => editEntry(entry)} onRenew={() => renewService(entry)} onBuyAgain={() => buyAgain(entry)} onRemove={() => removeEntry(entry)} onProgressStyle={(style) => setEntries((prev) => prev.map((item) => item.id === entry.id ? { ...item, progressStyle: style } : item))}/>) : <div className="empty-state"><span><Icon name="package" size={27}/></span><strong>{endingSoon ? ui("ยังไม่มีรายการที่กำลังจะหมด", "Nothing is running out soon") : ui("ยังไม่มีรายการในหมวดนี้", "No records in this category")}</strong><p>{endingSoon ? ui("รายการจะปรากฏเมื่ออยู่ในช่วงวันที่ตั้งแจ้งเตือน", "Records appear when they reach their alert window.") : ui("ลองเพิ่มบันทึกใหม่ หรือเลือกหมวดหมู่อื่น", "Add a record or choose another category.")}</p><button className="primary-button" onClick={() => openModal(tab === "services" ? "service" : tab === "items" && category === "เอกสาร" ? "note" : "item")}>＋ {ui("เพิ่มรายการ", "Add record")}</button></div>}</div></section>
        </>}
        </>}
        {tab !== "settings" && <footer className="page-footer"><span>บ้านของเรา <i>•</i> พื้นที่เล็ก ๆ สำหรับทุกเรื่องในบ้าน</span><button onClick={() => void exportData()} disabled={backupBusy}><Icon name="download" size={14}/> {backupBusy ? ui("กำลังสำรอง...", "Preparing...") : ui("สำรองข้อมูล", "Back up data")}</button></footer>}
      </div>
      <nav className="mobile-nav">{navItems.slice(0, 2).map((item) => <button key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon === "ticket" ? "spark" : item.icon} size={21}/><span>{item.label === "หน้าหลัก" ? "หน้าแรก" : item.label}</span></button>)}<button className="mobile-add" onClick={() => openModal(tab === "services" ? "service" : tab === "items" && category === "เอกสาร" ? "note" : "item")} aria-label={copy.add}><span>＋</span><b>{language === "en" ? "Add" : "เพิ่ม"}</b></button>{navItems.slice(2).map((item) => <button key={item.id} className={tab === item.id ? "selected" : ""} onClick={() => setTab(item.id)}><Icon name={item.icon === "ticket" ? "spark" : item.icon} size={21}/><span>{item.label === "สิทธิ์บริการ" ? "บริการ" : item.label}</span></button>)}</nav>
    </section>

    {selectedEntryId && <section className="detail-page" aria-label={ui("รายละเอียดรายการ", "Record details")}>
      <header className="detail-page-header"><button type="button" className="detail-back-button" onClick={closeDetail} aria-label={ui("กลับ", "Back")}><Icon name="chevron" size={20}/></button><div><small>{ui("รายละเอียดรายการ", "Record details")}</small><strong>{selectedEntry?.name ?? ui("ไม่พบรายการ", "Record not found")}</strong></div></header>
      <div className="detail-page-body">{selectedEntry ? <><EntryRow entry={selectedEntry} language={language} detailMode onDeletePhoto={(index) => setPhotoDeleteTarget({ kind: "entry", entryId: selectedEntry.id, index })} onConsume={() => consumed(selectedEntry)} onStockUse={() => recordStockUse(selectedEntry)} onEdit={() => editEntry(selectedEntry)} onRenew={() => renewService(selectedEntry)} onBuyAgain={() => buyAgain(selectedEntry)} onRemove={() => removeEntry(selectedEntry)} onProgressStyle={(style) => setEntries((prev) => prev.map((entry) => entry.id === selectedEntry.id ? { ...entry, progressStyle: style } : entry))}/>{Boolean(selectedEntry.medicine?.reminders?.length) && <section className="purchase-history"><div className="section-heading"><h2>{ui("เวลาแจ้งเตือน", "Reminder times")}</h2></div>{selectedEntry.medicine?.reminders?.map((reminder) => <div className="purchase-history-row" key={reminder.meal}><span>{reminder.meal} · {reminder.message || `${ui("ถึงเวลากิน", "Time for")} ${selectedEntry.name}`}</span><strong>{reminder.time}</strong></div>)}</section>}{selectedEntry.kind === "item" && !isIncomeEntry(selectedEntry) && <section className="purchase-history"><div className="section-heading"><h2>{ui("ประวัติการซื้อ", "Purchase history")}</h2><button type="button" className="primary-button" onClick={() => buyAgain(selectedEntry)}>＋ {ui("ซื้ออีกครั้ง", "Buy again")}</button></div>{(selectedEntry.purchases ?? (selectedEntry.price != null ? [{ id: `original-${selectedEntry.id}`, date: selectedEntry.date, store: selectedEntry.store ?? "", price: selectedEntry.price, quantity: 1 }] : [])).slice().reverse().map((purchase) => <div className="purchase-history-row" key={purchase.id}><span>{dateLabel(purchase.date, language)} · {purchase.store || ui("ไม่ระบุร้าน", "No store")} · {purchase.quantity} {ui("ชิ้น", "items")}</span><strong>฿{currency(purchase.price)}</strong></div>)}</section>}</> : <div className="empty-state"><strong>{ui("ไม่พบรายการนี้", "Record not found")}</strong><button type="button" className="primary-button" onClick={closeDetail}>{ui("กลับ", "Back")}</button></div>}</div>
    </section>}

    {cloudEnabled && appAdmin && showAdmin && <AdminPanel language={language} onClose={() => setShowAdmin(false)}/>}

    {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModal(null); setEditingEntry(null); } }}>
      <form className="entry-modal" onSubmit={saveEntry}>
        <div className="modal-top"><div><span className="modal-kicker">{modal === "renew" ? "ต่ออายุแพ็กเกจ" : modal === "edit" ? "แก้ไขข้อมูล" : "เพิ่มข้อมูลใหม่"}</span><h2>{modal === "item" ? "เพิ่มรายการซื้อ" : modal === "service" ? "เพิ่มสิทธิ์หรือบริการ" : modal === "category" ? "สร้างหมวดหมู่" : modal === "renew" ? "ซื้อบริการเพิ่ม" : modal === "purchase" ? "บันทึกการซื้ออีกครั้ง" : modal === "edit" ? "แก้ไขรายการ" : "เพิ่มเอกสาร"}</h2></div><button type="button" className="icon-button" onClick={() => { setModal(null); setEditingEntry(null); }} aria-label="ปิด"><Icon name="close"/></button></div>
        {modal === "purchase" && <><label className="form-label">{ui("รายการ", "Item")}<input value={form.name} readOnly/></label><div className="form-row"><div className="form-label">{ui("ซื้อจากร้าน", "Store")}<CategorySelect value={form.store} options={[...new Set(entries.flatMap((entry) => [entry.store ?? "", ...(entry.purchases ?? []).map((purchase) => purchase.store)]).filter(Boolean))]} allowCreate language={language} onChange={(value) => setForm({ ...form, store: value })}/></div><label className="form-label">{ui("ราคา (บาท)", "Price (THB)")}<input type="number" min="0" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></label></div><div className="form-row"><label className="form-label">{ui("จำนวน", "Quantity")}<input type="number" min="1" step="1" value={form.purchaseQuantity} onChange={(event) => setForm({ ...form, purchaseQuantity: event.target.value })}/></label><label className="form-label">{ui("วันที่ซื้อ", "Purchase date")}<input type="date" value={form.paidDate} onChange={(event) => setForm({ ...form, paidDate: event.target.value })}/></label></div></>}
        {modal === "renew" ? <label className="form-label">บริการ<input value={form.name} readOnly/></label> : modal !== "purchase" && <label className="form-label">{modal === "category" ? "ชื่อหมวดหมู่" : modal === "note" || (modal === "edit" && editingEntry?.kind === "note") ? ui("ชื่อเอกสาร", "Document name") : "ชื่อรายการ"}<input autoFocus required placeholder={modal === "service" ? "เช่น นวด 10 ครั้ง" : modal === "item" ? "เช่น ยาแก้แพ้" : modal === "category" ? "เช่น ของใช้สัตว์เลี้ยง" : "เช่น กรมธรรม์ประกันบ้าน"} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label>}
        {modal !== "category" && modal !== "renew" && modal !== "purchase" && <><div className="form-row"><div className="form-label">{ui("หมวดหมู่", "Category")}{modal === "note" || (modal === "edit" && editingEntry?.kind === "note") ? <input value={ui("เอกสาร", "Documents")} readOnly/> : <CategorySelect value={form.category} options={[...new Set([...categories.slice(1).filter((item) => item.name !== "บันทึกแจ้งเตือน" && item.name !== "เอกสาร").map((item) => item.name), ...extraCategories.map((item) => item.name), "อื่น ๆ", ...(form.category ? [form.category] : [])])]} language={language} allowCreate onChange={(value) => { if (!categories.some((item) => item.name === value) && !extraCategories.some((item) => item.name === value) && value !== "อื่น ๆ") setExtraCategories((current) => [...current, { name: value, icon: "tag", color: "blue" }]); setForm({ ...form, category: value }); }}/>}</div>{modal !== "note" && editingEntry?.kind !== "note" && <label className="form-label">{modal === "edit" && editingEntry?.kind === "service" ? ui("ยอดที่จ่ายสะสม (บาท)", "Total paid (THB)") : form.category === "รายรับ" || form.category === "การเงิน" && form.transaction === "income" ? ui("รายรับ (บาท)", "Income (THB)") : ui("รายจ่าย (บาท)", "Expense (THB)")}<input type="number" min="0" placeholder="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></label>}</div>{form.category === "การเงิน" && <label className="form-label">{ui("ประเภทการเงิน", "Transaction type")}<select value={form.transaction} onChange={(event) => setForm({ ...form, transaction: event.target.value as "income" | "expense" })}><option value="expense">{ui("รายจ่าย", "Expense")}</option><option value="income">{ui("รายรับ", "Income")}</option></select></label>}</>}
        {(modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && <div className="form-row"><div className="form-label">{ui("ซื้อจากร้าน", "Store")} <span className="optional">{ui("ไม่บังคับ", "Optional")}</span><CategorySelect value={form.store} options={[...new Set(entries.map((entry) => entry.store).filter((name): name is string => Boolean(name)))]} allowCreate language={language} placeholder={ui("ค้นหาหรือเพิ่มร้าน", "Search or add a store")} onChange={(value) => setForm({ ...form, store: value })}/></div><div className="form-label">{ui("สำหรับใคร", "For whom")} <span className="optional">{ui("ไม่บังคับ", "Optional")}</span><CategorySelect value={form.forPerson} options={["ตัวเอง", "แม่", "พ่อ", "ลูก", "ส่วนกลาง"]} allowCreate language={language} placeholder={language === "en" ? "Search or add a person" : "ค้นหาหรือเพิ่มชื่อ"} onChange={(value) => setForm({ ...form, forPerson: value })}/></div></div>}
        {(modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && !isMedicineEntry(form.category, form.name) && <label className="stock-toggle"><input type="checkbox" checked={form.useReminders} onChange={(event) => setForm({ ...form, useReminders: event.target.checked })}/><span className="stock-toggle-mark"><Icon name="check" size={13}/></span><span><strong>{ui("ต้องแจ้งเตือนเวลากินหรือใช้งาน", "Remind me when to eat or use this")}</strong><small>{ui("ตั้งเวลาแยกตามช่วงของวันได้", "Set a time for each part of the day")}</small></span></label>}
        {(modal === "item" || (modal === "edit" && editingEntry?.kind === "item")) && (isMedicineEntry(form.category, form.name) || form.useReminders) && <section className="medicine-form-section">
          <div className="medicine-form-heading"><span className="medicine-form-icon"><Icon name="clock" size={16}/></span><div><strong>วิธีใช้ยา / อาหารเสริม</strong><small>บันทึกตามฉลากหรือคำแนะนำจากผู้เชี่ยวชาญ</small></div></div>
          <div className="medicine-photo-field"><span className="medicine-photo-label">รูปถ่ายยา <small>เพิ่มได้สูงสุด 3 รูป · รูปละไม่เกิน 1 MB</small></span><div className="medicine-photo-grid">{form.photos.map((photo, index) => <div className="medicine-photo-preview" key={photo}><img src={photo} alt={`รูปยาที่แนบ ${index + 1}`}/><button type="button" className="medicine-photo-remove" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => setPhotoDeleteTarget({ kind: "form", index })}><Icon name="trash" size={14}/></button></div>)}{form.photos.length < 3 && <><label className="medicine-photo-button"><Icon name="camera" size={18}/><span><strong>ถ่ายรูป</strong><small>เปิดกล้องหลัง</small></span><input type="file" accept="image/*" capture="environment" onChange={async (event) => { const input = event.currentTarget; const file = input.files?.[0]; if (!file) return; try { const photo = await compressPhoto(file); setForm((current) => current.photos.length < 3 ? { ...current, photos: [...current.photos, photo] } : current); } catch { setNotice("รูปต้องย่อให้เหลือไม่เกิน 1 MB"); } finally { input.value = ""; } }}/></label><label className="medicine-photo-button"><Icon name="package" size={18}/><span><strong>เลือกรูป</strong><small>เลือกได้หลายรูป</small></span><input type="file" accept="image/*" multiple onChange={async (event) => { const input = event.currentTarget; const files = Array.from(input.files ?? []).slice(0, 3); if (!files.length) return; try { const photos = await Promise.all(files.map(compressPhoto)); setForm((current) => ({ ...current, photos: [...current.photos, ...photos].slice(0, 3) })); if (files.length > 3) setNotice("เลือกได้สูงสุด 3 รูป"); } catch { setNotice("มีรูปที่ย่อให้เหลือไม่เกิน 1 MB ไม่สำเร็จ"); } finally { input.value = ""; } }}/></label></>}</div></div>
          <fieldset className="meal-picker"><legend>รับประทานช่วงไหน</legend><div className="meal-options">{["เช้า", "กลางวัน", "เย็น", "ก่อนนอน"].map((meal) => <label key={meal} className={`meal-option ${form.medMeals.includes(meal) ? "selected" : ""}`}><input type="checkbox" checked={form.medMeals.includes(meal)} onChange={() => setForm((current) => ({ ...current, medMeals: current.medMeals.includes(meal) ? current.medMeals.filter((item) => item !== meal) : [...current.medMeals, meal], medReminders: current.medReminders.filter((item) => item.meal !== meal) }))}/><span>{meal}</span></label>)}</div></fieldset>
          <div className="form-row"><label className="form-label">สัมพันธ์กับอาหาร<select value={form.medFoodTiming} onChange={(event) => setForm({ ...form, medFoodTiming: event.target.value })}><option value="">ไม่ระบุ</option><option>ก่อนอาหาร</option><option>หลังอาหาร</option><option>พร้อมอาหาร</option><option>ไม่เกี่ยวกับอาหาร</option></select></label><label className="form-label">รับประทานทุก ๆ <span className="optional">ไม่บังคับ</span><div className="input-with-unit"><input type="number" min="1" placeholder="เช่น 8" value={form.medFrequencyHours} onChange={(event) => setForm({ ...form, medFrequencyHours: event.target.value })}/><span>ชั่วโมง</span></div></label></div>
          <div className="form-row"><label className="form-label">ครั้งละเท่าไร<input type="number" min="0" step="any" placeholder="เช่น 1" value={form.medDose} onChange={(event) => setForm({ ...form, medDose: event.target.value })}/></label><div className="form-label">หน่วย<CategorySelect value={form.medDoseUnit} options={["เม็ด", "แคปซูล", "ช้อนชา", "ช้อนโต๊ะ", "มิลลิลิตร", "หยด", "ซอง", "ครั้ง", "อื่น ๆ"]} allowCreate placeholder="ค้นหาหรือเพิ่มหน่วย" onChange={(value) => setForm({ ...form, medDoseUnit: value })}/></div></div>
          <label className="form-label">รายละเอียดเพิ่มเติม <span className="optional">ไม่บังคับ</span><textarea rows={2} placeholder="เช่น ดื่มน้ำตาม 1 แก้ว หรือคำแนะนำจากฉลากยา" value={form.medDetails} onChange={(event) => setForm({ ...form, medDetails: event.target.value })}/></label>
          <section className="medicine-reminder-fields"><div className="medicine-form-heading"><span className="medicine-form-icon"><Icon name="bell" size={16}/></span><div><strong>{ui("เวลาแจ้งเตือน", "Reminder times")}</strong><small>{ui("ตั้งเวลาและข้อความสำหรับแต่ละมื้อ", "Set a time and message for each meal")}</small></div></div>{form.medMeals.map((meal) => { const reminder = form.medReminders.find((item) => item.meal === meal); const defaultTime = ({ "เช้า": "08:00", "กลางวัน": "12:00", "เย็น": "18:00", "ก่อนนอน": "21:00" } as Record<string, string>)[meal] ?? "08:00"; return <div className="reminder-meal-row" key={meal}><label className="stock-toggle"><input type="checkbox" checked={Boolean(reminder)} onChange={(event) => setForm((current) => ({ ...current, medReminders: event.target.checked ? [...current.medReminders, { meal, time: defaultTime, message: "" }] : current.medReminders.filter((item) => item.meal !== meal) }))}/><span>{meal}</span></label>{reminder && <div className="form-row"><label className="form-label">{ui("เวลา", "Time")}<input type="time" value={reminder.time} onChange={(event) => setForm((current) => ({ ...current, medReminders: current.medReminders.map((item) => item.meal === meal ? { ...item, time: event.target.value } : item) }))}/></label><label className="form-label">{ui("ข้อความแจ้งเตือน", "Reminder text")}<input placeholder={ui(`ได้เวลากิน ${form.name || "ยา"}`, `Time for ${form.name || "medicine"}`)} value={reminder.message} onChange={(event) => setForm((current) => ({ ...current, medReminders: current.medReminders.map((item) => item.meal === meal ? { ...item, message: event.target.value } : item) }))}/></label></div>}</div>; })}</section>
        </section>}
        {((modal === "item" && form.category !== "บริการ") || (modal === "edit" && editingEntry?.kind === "item")) && <section className="stock-form-section">
          <label className="stock-toggle"><input type="checkbox" checked={form.trackStock} onChange={(event) => setForm({ ...form, trackStock: event.target.checked })}/><span className="stock-toggle-mark"><Icon name="check" size={13}/></span><span><strong>คำนวณจำนวนวันที่ใช้ได้ถึง</strong><small>คำนวณจากจำนวนคงเหลือ ÷ จำนวนที่ใช้ต่อวัน</small></span></label>
          {form.trackStock && <div className="stock-fields"><div className="form-row"><label className="form-label">จำนวนที่มีอยู่<input type="number" min="0" step="any" placeholder="เช่น 30" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: event.target.value })}/></label><div className="form-label">หน่วย<CategorySelect value={form.stockUnit} options={["เม็ด", "แคปซูล", "ชิ้น", "ขวด", "กล่อง", "ซอง", "มล.", "กรัม", "ครั้ง"]} allowCreate placeholder="ค้นหาหรือเพิ่มหน่วย" onChange={(value) => setForm({ ...form, stockUnit: value })}/></div></div><div className="form-row"><label className="form-label">ใช้เฉลี่ยต่อวัน<input type="number" min="0.01" step="any" placeholder="เช่น 2" value={form.stockDailyUse} onChange={(event) => setForm({ ...form, stockDailyUse: event.target.value })}/></label><label className="form-label">แจ้งเตือนก่อนหมด (วัน)<input type="number" min="0" max="365" step="1" value={form.alertDays} onChange={(event) => setForm({ ...form, alertDays: event.target.value })}/></label></div><p className="stock-preview">{formStockDays !== null && formStockDate ? <><strong>{stockRunoutLabel(formStockDays, language, formStockDate)}</strong> · {language === "en" ? "Alert" : "แจ้งเตือนก่อนหมด"} {form.alertDays || 0} {language === "en" ? "days early" : "วัน"}</> : (language === "en" ? "Enter quantity and daily use to calculate the estimated date." : "ระบุจำนวนที่มีและจำนวนที่ใช้ต่อวันเพื่อคำนวณวันหมด")}</p></div>}
          {form.trackStock && <label className="stock-toggle auto-use-toggle"><input type="checkbox" checked={form.stockAutoDeduct} onChange={(event) => setForm({ ...form, stockAutoDeduct: event.target.checked })}/><span className="stock-toggle-mark"><Icon name="check" size={13}/></span><span><strong>{ui("หักจำนวนอัตโนมัติ", "Deduct automatically")}</strong><small>{ui("หักตามจำนวนที่ใช้เฉลี่ยทุกวัน หากปิดให้กดบันทึกการใช้เอง", "Deduct the daily use each day. Turn off to record use manually.")}</small></span></label>}
        </section>}
        {(modal === "service" || modal === "renew" || (modal === "item" && form.category === "บริการ") || (modal === "edit" && editingEntry?.kind === "service")) && <>
          <div className="form-row"><label className="form-label">{modal === "renew" ? "จำนวนที่ซื้อเพิ่ม" : "จำนวนทั้งหมด"}<input type="number" min="1" required placeholder="10" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })}/></label><div className="form-label">หน่วย<CategorySelect value={form.unit} options={["ครั้ง", "ชั่วโมง", "เครื่อง", "ใบ"]} allowCreate placeholder="ค้นหาหรือเพิ่มหน่วย" onChange={(value) => setForm({ ...form, unit: value })}/></div></div>
          <div className="form-row"><div className="form-label">วันที่จ่าย<DatePicker value={form.paidDate} onChange={(value) => setForm({ ...form, paidDate: value })} placeholder="เลือกวันที่จ่าย"/></div><div className="form-label">วันที่เริ่มต้น<DatePicker value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} placeholder="เลือกวันเริ่มต้น"/></div></div>
          {modal !== "renew" && <section className="stock-form-section"><label className="stock-toggle"><input type="checkbox" checked={form.serviceAutoDeduct} onChange={(event) => setForm({ ...form, serviceAutoDeduct: event.target.checked })}/><span className="stock-toggle-mark"><Icon name="check" size={13}/></span><span><strong>{ui("หักสิทธิ์อัตโนมัติ", "Deduct service uses automatically")}</strong><small>{ui("เริ่มนับจากวันที่เริ่มต้น และหักเมื่อครบแต่ละรอบ", "Count from the start date and deduct after each interval.")}</small></span></label>{form.serviceAutoDeduct && <div className="stock-fields"><div className="form-row"><label className="form-label">{ui("หักครั้งละ", "Deduct each time")}<input type="number" min="1" step="1" required value={form.serviceAutoAmount} onChange={(event) => setForm({ ...form, serviceAutoAmount: event.target.value })}/></label><label className="form-label">{ui("ทุกกี่วัน", "Every how many days")}<input type="number" min="1" step="1" required value={form.serviceAutoEveryDays} onChange={(event) => setForm({ ...form, serviceAutoEveryDays: event.target.value })}/></label></div></div>}</section>}
        </>}
        {(modal === "note" || (modal === "edit" && editingEntry?.kind === "note")) && <section className="medicine-photo-field"><span className="medicine-photo-label">ไฟล์เอกสาร <small>ไฟล์ละไม่เกิน 1 MB</small></span><div className="medicine-photo-grid">{form.attachments.map((attachment, index) => <div className="medicine-photo-preview document-preview" key={attachment.data}><Icon name="file" size={21}/><small>{attachment.name}</small><button type="button" className="medicine-photo-remove" aria-label={`ลบไฟล์ที่ ${index + 1}`} onClick={() => setPhotoDeleteTarget({ kind: "attachment", index })}><Icon name="trash" size={14}/></button></div>)}{form.attachments.length < 3 && <><label className="medicine-photo-button"><Icon name="camera" size={18}/><span><strong>ถ่ายรูป</strong><small>ย่ออัตโนมัติ</small></span><input type="file" accept="image/*" capture="environment" onChange={async (event) => { const file = event.currentTarget.files?.[0]; if (!file) return; try { const attachment = await documentAttachment(file); setForm((current) => ({ ...current, attachments: [...current.attachments, attachment].slice(0, 3) })); } catch { setNotice("ไฟล์ต้องมีขนาดไม่เกิน 1 MB"); } finally { event.currentTarget.value = ""; } }}/></label><label className="medicine-photo-button"><Icon name="file" size={18}/><span><strong>อัปโหลดไฟล์</strong><small>รูปภาพหรือ PDF</small></span><input type="file" accept="image/*,application/pdf" onChange={async (event) => { const file = event.currentTarget.files?.[0]; if (!file) return; try { const attachment = await documentAttachment(file); setForm((current) => ({ ...current, attachments: [...current.attachments, attachment].slice(0, 3) })); } catch { setNotice("ไฟล์ต้องมีขนาดไม่เกิน 1 MB"); } finally { event.currentTarget.value = ""; } }}/></label></>}</div></section>}
        {modal !== "category" && modal !== "purchase" && <label className="form-label">{modal === "note" || editingEntry?.kind === "note" ? ui("รายละเอียดเอกสาร", "Document details") : ui("หมายเหตุ", "Notes")} <span className="optional">{ui("ไม่บังคับ", "Optional")}</span><textarea rows={3} placeholder={ui("เพิ่มรายละเอียดที่อยากจำ...", "Add details...")} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })}/></label>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setModal(null); setEditingEntry(null); }}>ยกเลิก</button><button type="submit" className="primary-button"><Icon name="check" size={17}/> {modal === "category" ? "สร้างหมวดหมู่" : modal === "renew" ? "บันทึกการซื้อเพิ่ม" : modal === "edit" ? "บันทึกการแก้ไข" : "บันทึกข้อมูล"}</button></div>
        <p className="local-note"><Icon name="shield" size={14}/> {cloudEnabled ? ui("ข้อมูลจะบันทึกออนไลน์ในบ้านนี้", "Saved online to this household") : ui("ข้อมูลจะบันทึกในอุปกรณ์นี้", "Saved on this device")}</p>
      </form>
    </div>}
    {deleteTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><span className="confirm-icon"><Icon name="trash" size={22}/></span><h2 id="delete-title">ลบรายการนี้?</h2><p id="delete-description">ต้องการลบ <strong>“{deleteTarget.name}”</strong> ใช่ไหม<br/>การลบนี้ไม่สามารถย้อนกลับได้</p><div className="confirm-actions"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>ยกเลิก</button><button className="danger-button" onClick={confirmRemove}><Icon name="trash" size={16}/> ลบรายการ</button></div></section></div>}
    {photoDeleteTarget && <div className="modal-backdrop photo-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoDeleteTarget(null); }}><section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="photo-delete-title" aria-describedby="photo-delete-description"><span className="confirm-icon"><Icon name="trash" size={22}/></span><h2 id="photo-delete-title">{photoDeleteTarget.kind === "attachment" ? ui("ลบไฟล์แนบนี้?", "Delete this attachment?") : ui("ลบรูปภาพนี้?", "Delete this photo?")}</h2><p id="photo-delete-description">{ui("ไฟล์ที่ลบจากรายการจะถูกลบจากที่เก็บออนไลน์หลังบันทึกข้อมูล", "The file will also be removed from online storage after the record is saved.")}</p><div className="confirm-actions"><button type="button" className="secondary-button" onClick={() => setPhotoDeleteTarget(null)}>{ui("ยกเลิก", "Cancel")}</button><button type="button" className="danger-button" onClick={confirmPhotoRemove}><Icon name="trash" size={16}/>{ui("ลบไฟล์", "Delete file")}</button></div></section></div>}
    {notice && <div className="toast"><span><Icon name="check" size={15}/></span>{notice}</div>}
  </main>;
}

function CalendarPage({ entries, language, onSave, onDelete, onOpenEntry }: { entries: Entry[]; language: Language; onSave: (entry: Entry) => void; onDelete: (entry: Entry) => void; onOpenEntry: (id: string) => void }) {
  const ui = (th: string, en: string) => language === "en" ? en : th;
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"appointment" | "contract">("appointment");
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState("1");
  const [durationUnit, setDurationUnit] = useState<"days" | "months" | "years">("years");
  const [time, setTime] = useState("09:00");
  const [remindMinutes, setRemindMinutes] = useState("60");
  const [message, setMessage] = useState("");
  const [linkedEntryId, setLinkedEntryId] = useState("");
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const iso = (day: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const calendarEntries = entries.filter((entry) => entry.kind === "calendar" && entry.calendar);
  const dayEntries = calendarEntries.filter((entry) => entry.calendar?.start === selected || entry.calendar?.end === selected).sort((a, b) => (a.calendar?.time ?? "").localeCompare(b.calendar?.time ?? ""));
  const calculatedEnd = (() => { if (!start || !Number(duration)) return ""; const date = new Date(`${start}T00:00:00`); const count = Math.max(1, Number(duration)); if (durationUnit === "years") date.setFullYear(date.getFullYear() + count); else if (durationUnit === "months") date.setMonth(date.getMonth() + count); else date.setDate(date.getDate() + count); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; })();
  const save = (event: React.FormEvent) => { event.preventDefault(); if (!name.trim() || !start) return; onSave({ id: crypto.randomUUID(), name: name.trim(), category: "บันทึกแจ้งเตือน", kind: "calendar", date: start, actor: "คุณ", calendar: { type, start, end: type === "contract" ? (end || calculatedEnd) : undefined, time, remindMinutes: Number(remindMinutes), message: message.trim(), linkedEntryId: linkedEntryId || undefined } }); setSelected(start); setMonth(new Date(`${start}T00:00:00`)); setShowForm(false); setName(""); setMessage(""); setLinkedEntryId(""); };
  return <section className="calendar-page"><div className="calendar-toolbar"><div><h2>{ui("ปฏิทินและการแจ้งเตือน", "Calendar & reminders")}</h2><p>{ui("นัดหมาย สัญญา และรายการสำคัญในบ้าน", "Appointments, contracts, and important records")}</p></div><button className="primary-button" type="button" onClick={() => { setStart(selected); setShowForm(true); }}>＋ {ui("เพิ่มลงปฏิทิน", "Add event")}</button></div><div className="calendar-layout"><section className="calendar-panel"><div className="calendar-month-header"><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={ui("เดือนก่อน", "Previous month")}>‹</button><strong>{month.toLocaleDateString(language === "en" ? "en-GB" : "th-TH", { month: "long", year: "numeric" })}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={ui("เดือนถัดไป", "Next month")}>›</button></div><div className="calendar-grid">{(language === "en" ? ["M", "T", "W", "T", "F", "S", "S"] : ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]).map((label, index) => <span className="calendar-weekday" key={`${label}-${index}`}>{label}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`}/>)}{Array.from({ length: daysInMonth }, (_, index) => { const date = iso(index + 1); const hasEvent = calendarEntries.some((entry) => entry.calendar?.start === date || entry.calendar?.end === date); return <button type="button" key={date} className={`calendar-cell ${date === selected ? "selected" : ""} ${date === today() ? "today" : ""}`} onClick={() => setSelected(date)}><span>{index + 1}</span>{hasEvent && <i/>}</button>; })}</div></section><section className="calendar-agenda"><h3>{dateLabel(selected, language)}</h3>{dayEntries.length ? dayEntries.map((entry) => <article className="calendar-event" key={entry.id}><span className="calendar-event-icon"><Icon name={entry.calendar?.type === "contract" ? "file" : "calendar"} size={19}/></span><div><strong>{entry.name}</strong><small>{entry.calendar?.type === "contract" ? ui("สัญญา", "Contract") : ui("นัดหมาย", "Appointment")} · {entry.calendar?.time}{entry.calendar?.end && ` · ${ui("สิ้นสุด", "Ends")} ${dateLabel(entry.calendar.end, language)}`}</small>{entry.calendar?.message && <small>{entry.calendar.message}</small>}{entry.calendar?.linkedEntryId && <button type="button" className="text-button" onClick={() => onOpenEntry(entry.calendar!.linkedEntryId!)}>{ui("ดูรายการที่เกี่ยวข้อง", "View linked record")}</button>}</div><button className="row-icon-button delete-icon-button" type="button" onClick={() => onDelete(entry)} aria-label={ui("ลบรายการ", "Delete event")}><Icon name="trash" size={17}/></button></article>) : <p className="calendar-empty-day">{ui("วันนี้ยังไม่มีรายการ", "No events for this day")}</p>}</section></div>{showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><form className="entry-modal" onSubmit={save}><div className="modal-top"><div><span className="modal-kicker">{ui("บันทึกแจ้งเตือน", "Reminder")}</span><h2>{ui("เพิ่มลงปฏิทิน", "Add to calendar")}</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}><Icon name="close"/></button></div><label className="form-label">{ui("ชื่อรายการ", "Title")}<input required autoFocus value={name} onChange={(event) => setName(event.target.value)}/></label><label className="form-label">{ui("ประเภท", "Type")}<select value={type} onChange={(event) => setType(event.target.value as "appointment" | "contract")}><option value="appointment">{ui("นัดหมาย", "Appointment")}</option><option value="contract">{ui("สัญญา", "Contract")}</option></select></label><div className="form-row"><label className="form-label">{ui("วันเริ่มต้น", "Start date")}<input type="date" required value={start} onChange={(event) => setStart(event.target.value)}/></label><label className="form-label">{ui("เวลา", "Time")}<input type="time" value={time} onChange={(event) => setTime(event.target.value)}/></label></div>{type === "contract" && <><div className="form-row"><label className="form-label">{ui("ระยะเวลา", "Duration")}<input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)}/></label><label className="form-label">{ui("หน่วย", "Unit")}<select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value as "days" | "months" | "years")}><option value="years">{ui("ปี", "Years")}</option><option value="months">{ui("เดือน", "Months")}</option><option value="days">{ui("วัน", "Days")}</option></select></label></div><label className="form-label">{ui("วันสิ้นสุด (แก้ไขได้)", "End date (editable)")}<input type="date" value={end || calculatedEnd} onChange={(event) => setEnd(event.target.value)}/></label></>}<div className="form-row"><label className="form-label">{ui("แจ้งเตือนก่อน", "Remind before")}<select value={remindMinutes} onChange={(event) => setRemindMinutes(event.target.value)}><option value="0">{ui("เมื่อถึงเวลา", "At event time")}</option><option value="15">15 {ui("นาที", "minutes")}</option><option value="60">1 {ui("ชั่วโมง", "hour")}</option><option value="1440">1 {ui("วัน", "day")}</option><option value="4320">3 {ui("วัน", "days")}</option><option value="10080">7 {ui("วัน", "days")}</option></select></label><label className="form-label">{ui("เชื่อมกับรายการ", "Linked record")}<select value={linkedEntryId} onChange={(event) => setLinkedEntryId(event.target.value)}><option value="">{ui("ไม่เชื่อม", "None")}</option>{entries.filter((entry) => entry.kind !== "calendar").map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label></div><label className="form-label">{ui("ข้อความแจ้งเตือน", "Reminder text")}<input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={ui("เช่น อย่าลืมเตรียมเอกสาร", "e.g. Bring the documents")}/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>{ui("ยกเลิก", "Cancel")}</button><button type="submit" className="primary-button">{ui("บันทึก", "Save")}</button></div></form></div>}</section>;
}

function CategorySelect({ value, options, language = "th", placeholder, allowCreate = false, onChange }: { value: string; options: string[]; language?: Language; placeholder?: string; allowCreate?: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().normalize("NFKC").toLocaleLowerCase();
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const filteredOptions = options.filter((option) => {
    const name = option.normalize("NFKC").toLocaleLowerCase();
    return words.every((word) => name.includes(word));
  }).sort((a, b) => {
    const score = (name: string) => name.toLocaleLowerCase().startsWith(normalizedQuery) ? 0 : name.toLocaleLowerCase().includes(normalizedQuery) ? 1 : 2;
    return score(a) - score(b) || a.localeCompare(b, language === "th" ? "th" : "en");
  });

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

function EntryRow({ entry, language, detailMode = false, onOpen, onDeletePhoto, onConsume, onStockUse, onEdit, onRenew, onBuyAgain, onRemove, onProgressStyle }: { entry: Entry; language: Language; detailMode?: boolean; onOpen?: () => void; onDeletePhoto?: (index: number) => void; onConsume: () => void; onStockUse: () => void; onEdit: () => void; onRenew: () => void; onBuyAgain: () => void; onRemove: () => void; onProgressStyle: (style: "bar" | "circle") => void }) {
  const expanded = detailMode;
  const income = isIncomeEntry(entry);
  const householdExpense = entry.category === "รายจ่าย" || entry.category === "รายจ่ายในครัวเรือน";
  const icon = entry.kind === "service" ? "spark" : entry.kind === "note" ? "file" : income ? "wallet" : householdExpense ? "receipt" : "bag";
  const color = entry.kind === "service" ? "violet" : entry.kind === "note" ? "teal" : income ? "teal" : entry.category === "ยาและสุขภาพ" || householdExpense ? "rose" : "amber";
  const payments = entry.payments ?? (entry.kind === "service" ? [{ paidAt: entry.paidDate ?? entry.date, startAt: entry.startDate ?? entry.date, amount: entry.price ?? 0, quantity: entry.total ?? 0 }] : []);
  const remaining = serviceRemaining(entry);
  const total = entry.total ?? 0;
  const entryPhotos = entry.photos ?? (entry.photo ? [entry.photo] : []);
  const used = Math.max(0, total - remaining);
  const progress = total > 0 ? Math.max(0, Math.min(1, used / total)) : 0;
  const handleRowClick = (event: React.MouseEvent<HTMLElement>) => { if (!detailMode && !(event.target as HTMLElement).closest("button")) onOpen?.(); };
  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>) => { if (!detailMode && event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen?.(); } };
  return <div className="entry-card-wrap">
    <article className={`entry-row ${expanded ? "is-expanded" : ""}`} onClick={handleRowClick} onKeyDown={handleRowKeyDown} tabIndex={detailMode ? -1 : 0} aria-label={`${detailMode ? "รายละเอียด" : "เปิดรายละเอียด"} ${entry.name}`}>
      <span className={`entry-icon ${color}`}><Icon name={icon} size={19}/></span>
      <div className="entry-main"><div className="entry-title-line"><strong>{entry.name}</strong><span className={`entry-tag ${color}`}>{categoryLabel(entry.category, language)}</span></div>
        <div className="entry-meta"><span><Icon name="calendar" size={13}/>{dateLabel(entry.date, language)}</span><i/><span title={language === "en" ? "Recorded by" : "ผู้บันทึกรายการ"}><Icon name="user" size={13}/>{entry.actor}</span>{entry.forPerson && <><i/><span title={language === "en" ? "For" : "สำหรับผู้ใช้"}><Icon name="heart" size={13}/>{language === "en" ? "For " : "สำหรับ "}{entry.forPerson}</span></>}{entry.store && <><i/><span title={language === "en" ? "Store" : "ซื้อจากร้าน"}><Icon name="bag" size={13}/>{entry.store}</span></>}{entry.note && <><i/><span className="entry-note">{entry.note}</span></>}</div>
        {entry.medicine && <p className="medicine-summary"><Icon name="clock" size={13}/><span>{[entry.medicine.meals.length ? entry.medicine.meals.join(" · ") : "", entry.medicine.foodTiming, entry.medicine.frequencyHours ? `ทุก ${entry.medicine.frequencyHours} ชม.` : "", entry.medicine.dose ? `ครั้งละ ${entry.medicine.dose} ${entry.medicine.doseUnit}` : "", entry.medicine.details].filter(Boolean).join(" · ")}</span></p>}
        {entry.kind === "service" && <div className="service-progress"><span className="progress-track"><i style={{ width: `${progress * 100}%` }}/></span><small>ใช้แล้ว <strong>{used}</strong>/{total} · เหลือ {remaining}{entry.serviceAuto ? ` · ${language === "en" ? "Auto" : "หักอัตโนมัติ"} ${entry.serviceAuto.amount}/${entry.serviceAuto.everyDays} ${language === "en" ? "days" : "วัน"}` : ""}</small></div>}
        {entry.stock && <p className={`stock-summary ${stockDaysLeft(entry.stock) !== null && stockDaysLeft(entry.stock)! <= entry.stock.alertDays ? "near-empty" : ""}`}><Icon name="package" size={13}/><span>เหลือประมาณ {currency(stockRemaining(entry.stock))} {entry.stock.unit} · {stockDaysLeft(entry.stock) !== null ? stockRunoutLabel(stockDaysLeft(entry.stock)!, language, stockRunoutDate(entry.stock)) : "ยังไม่ระบุอัตราใช้"} · {entry.stock.autoDeduct === false ? (language === "en" ? "Manual" : "หักเอง") : (language === "en" ? "Auto" : "หักอัตโนมัติ")}</span></p>}
        {!detailMode && <button type="button" className="detail-toggle" onClick={onOpen}><Icon name="chevron" size={14}/>{language === "en" ? "View details" : "ดูรายละเอียด"}</button>}
      </div>
      <div className={`entry-value ${income ? "income-value" : ""}`}>{entry.price != null ? <strong>{income ? "+" : "-"}฿{currency(entry.price)}</strong> : <span className="no-price">บันทึกไว้</span>}<small>{entry.kind === "service" ? "จ่ายสะสม" : entry.kind === "note" ? "บันทึก" : income ? "รายรับ" : "รายจ่าย"}</small></div>
      <div className="entry-actions">{entry.stock && entry.stock.autoDeduct === false && stockRemaining(entry.stock) > 0 && <button type="button" className="consume-button stock-consume-button" onClick={onStockUse}><Icon name="check" size={14}/> ใช้วันนี้</button>}{entry.kind === "service" && !entry.serviceAuto && remaining > 0 && <button type="button" className="consume-button" onClick={onConsume}><Icon name="check" size={14}/> ใช้ 1 {entry.unit ?? "ครั้ง"}</button>}{entry.kind === "service" && remaining === 0 && <button type="button" className="renew-button" onClick={onRenew}><Icon name="plus" size={14}/> ซื้อเพิ่ม</button>}{detailMode && entry.kind === "item" && !income && <button type="button" className="renew-button" onClick={onBuyAgain}><Icon name="cart" size={14}/> {language === "en" ? "Buy again" : "ซื้ออีกครั้ง"}</button>}<button type="button" className="row-icon-button edit-icon-button" title="แก้ไขรายการ" aria-label={`แก้ไข ${entry.name}`} onClick={onEdit}><Icon name="edit" size={17}/></button><button type="button" className="row-icon-button delete-icon-button" title="ลบรายการ" aria-label={`ลบ ${entry.name}`} onClick={onRemove}><Icon name="trash" size={17}/></button></div>
    </article>
    {expanded && <section className="service-details entry-details" aria-label={`รายละเอียด ${entry.name}`} onClick={(event) => event.stopPropagation()}>
      {entry.kind === "service" ? <>
        <div className="service-progress-detail"><div className="progress-detail-heading"><div><strong>ความคืบหน้าการใช้</strong><small>ใช้แล้ว {used} จาก {total} {entry.unit ?? "ครั้ง"} · คงเหลือ {remaining} {entry.unit ?? "ครั้ง"}</small></div><div className="progress-style-switch" aria-label="รูปแบบแถบความคืบหน้า"><button type="button" className={(entry.progressStyle ?? "bar") === "bar" ? "selected" : ""} aria-pressed={(entry.progressStyle ?? "bar") === "bar"} onClick={() => onProgressStyle("bar")}>แท่ง</button><button type="button" className={entry.progressStyle === "circle" ? "selected" : ""} aria-pressed={entry.progressStyle === "circle" ? "true" : "false"} onClick={() => onProgressStyle("circle")}>วงกลม</button></div></div>
          {(entry.progressStyle ?? "bar") === "bar" ? <div className="progress-bar-detail"><div className="progress-bar-track"><i style={{ width: `${progress * 100}%` }}/></div><div className="progress-bar-labels"><span>ใช้แล้ว {used} {entry.unit ?? "ครั้ง"}</span><strong>เหลือ {remaining} {entry.unit ?? "ครั้ง"}</strong></div></div> : <div className="progress-circle-layout"><div className="progress-circle" role="img" aria-label={`ใช้แล้ว ${used} จาก ${total} ${entry.unit ?? "ครั้ง"}`}><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="progress-circle-bg" cx="32" cy="32" r="27"/><circle className="progress-circle-fill" cx="32" cy="32" r="27" style={{ strokeDasharray: `${Math.PI * 54}`, strokeDashoffset: `${Math.PI * 54 * (1 - progress)}` }}/></svg><span><strong>{used}<small>/{total}</small></strong><small>ใช้แล้ว</small></span></div><div className="progress-circle-copy"><strong>คงเหลือ {remaining} {entry.unit ?? "ครั้ง"}</strong><small>{Math.round(progress * 100)}% ของสิทธิ์ที่ใช้ไป</small></div></div>}
        </div>
        <div className="service-dates"><div><span><Icon name="calendar" size={15}/> วันที่เริ่มต้น</span><strong>{dateLabel(entry.startDate ?? payments[0]?.startAt ?? entry.date)}</strong></div><div><span><Icon name="wallet" size={15}/> วันที่จ่ายล่าสุด</span><strong>{dateLabel(entry.paidDate ?? payments[payments.length - 1]?.paidAt ?? entry.date)}</strong></div></div>
        <div className="detail-columns"><div className="detail-history"><h4><Icon name="clock" size={15}/> ประวัติการใช้</h4>{entry.serviceAuto && <p className="stock-estimate-note">{language === "en" ? `Auto deduct ${entry.serviceAuto.amount} every ${entry.serviceAuto.everyDays} days` : `หักอัตโนมัติ ${entry.serviceAuto.amount} ${entry.unit ?? "ครั้ง"} ทุก ${entry.serviceAuto.everyDays} วัน`}</p>}{(entry.events?.length || serviceAutoHistory(entry).length) ? <ul>{[...serviceAutoHistory(entry), ...(entry.events ?? [])].sort((a, b) => b.at.localeCompare(a.at)).map((event, index) => <li key={`${event.at}-${index}`}><span className="timeline-dot"/><div><strong>{event.action}</strong><small>{dateLabel(event.at, language)} · {event.actor}</small></div></li>)}</ul> : <p className="detail-empty">ยังไม่มีประวัติการใช้</p>}</div><div className="detail-history payment-history"><h4><Icon name="wallet" size={15}/> ประวัติการจ่าย</h4><ul>{payments.map((payment, index) => <li key={`${payment.paidAt}-${index}`}><span className="timeline-dot payment-dot"/><div><strong>{payment.quantity} {entry.unit ?? "ครั้ง"} · ฿{currency(payment.amount)}</strong><small>จ่าย {dateLabel(payment.paidAt)} · เริ่ม {dateLabel(payment.startAt)}</small></div></li>)}</ul></div></div>
      </> : <div className="item-detail-grid">{entryPhotos.length > 0 && <div className="entry-photo-gallery">{entryPhotos.map((photo, index) => <figure className="entry-photo" key={photo}><img src={photo} alt={`รูป ${entry.name} ${index + 1}`}/>{onDeletePhoto && <button type="button" className="entry-photo-delete" aria-label={`${language === "en" ? "Delete photo" : "ลบรูปภาพ"} ${index + 1}`} onClick={() => onDeletePhoto(index)}><Icon name="trash" size={16}/></button>}{index === 0 && <figcaption>รูปถ่ายยา / บรรจุภัณฑ์</figcaption>}</figure>)}</div>}<div className="item-detail-info">{entry.stock && <><h4><Icon name="package" size={15}/> จำนวนคงเหลือ</h4><p><span>คงเหลือโดยประมาณ</span><strong>{currency(stockRemaining(entry.stock))} {entry.stock.unit}</strong></p><p><span>ใช้เฉลี่ยต่อวัน</span><strong>{entry.stock.dailyUse} {entry.stock.unit}</strong></p><p><span>{language === "en" ? "Estimated time remaining" : "คาดว่าจะหมดภายใน"}</span><strong>{stockDaysLeft(entry.stock) !== null ? stockRunoutLabel(stockDaysLeft(entry.stock)!, language) : (language === "en" ? "Unknown" : "ไม่ทราบ")}</strong></p><p><span>{language === "en" ? "Estimated runout date" : "วันที่คาดว่าจะหมด"}</span><strong>{stockRunoutDate(entry.stock) ? dateLabel(stockRunoutDate(entry.stock)!, language) : (language === "en" ? "Unknown" : "ไม่ทราบ")}</strong></p><p><span>แจ้งเตือนล่วงหน้า</span><strong>{entry.stock.alertDays} วัน</strong></p><small className="stock-estimate-note">{entry.stock.autoDeduct === false ? (language === "en" ? "Manual deduction: record each use yourself." : "หักจำนวนด้วยการกดบันทึกการใช้เอง") : (language === "en" ? "Automatically deducted each day at the average rate." : "หักจำนวนอัตโนมัติทุกวันตามอัตราใช้เฉลี่ย")}</small>{entry.stock.events?.length ? <div className="stock-use-history"><strong>ประวัติการใช้</strong>{entry.stock.events.slice(0, 5).map((event, index) => <small key={`${event.at}-${index}`}>ใช้ {event.amount} {entry.stock?.unit} · {dateLabel(event.at, language)} · {event.actor}</small>)}</div> : null}</>}{entry.store && <p><span>ซื้อจากร้าน</span><strong>{entry.store}</strong></p>}{entry.forPerson && <p><span>สำหรับ</span><strong>{entry.forPerson}</strong></p>}{entry.medicine && <><h4><Icon name="clock" size={15}/> วิธีใช้ยา / อาหารเสริม</h4>{entry.medicine.meals.length > 0 && <p><span>ช่วงเวลา</span><strong>{entry.medicine.meals.join(" · ")}</strong></p>}{entry.medicine.foodTiming && <p><span>สัมพันธ์กับอาหาร</span><strong>{entry.medicine.foodTiming}</strong></p>}{entry.medicine.frequencyHours && <p><span>ความถี่</span><strong>ทุก {entry.medicine.frequencyHours} ชั่วโมง</strong></p>}{entry.medicine.dose && <p><span>ปริมาณต่อครั้ง</span><strong>{entry.medicine.dose} {entry.medicine.doseUnit}</strong></p>}{entry.medicine.details && <p><span>รายละเอียดเพิ่ม</span><strong>{entry.medicine.details}</strong></p>}</>}{entry.attachments?.map((attachment) => <p key={attachment.data}><span>ไฟล์แนบ</span><strong><a href={attachment.data} download={attachment.name}>{attachment.name}</a></strong></p>)}{entry.note && <p><span>หมายเหตุ</span><strong>{entry.note}</strong></p>}{entryPhotos.length === 0 && !entry.store && !entry.forPerson && !entry.medicine && !entry.stock && !entry.note && !(entry.attachments?.length) && <p className="detail-empty">ยังไม่มีรายละเอียดเพิ่มเติม</p>}</div></div>}
    </section>}
  </div>;
}
