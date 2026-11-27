import { calendarOccurrenceDates } from "./calendar-recurrence";
import type { CalendarInfo, TravelInfo } from "./travel";

export type ReminderEntry = { id: string; name: string; category?: string; kind: string; medicine?: { reminders?: { meal: string; time: string; message: string }[]; recipientIds?: string[] }; stock?: { quantity: number; dailyUse: number; alertDays: number; unit: string; updatedAt?: string; autoDeduct?: boolean }; shopping?: { dueDate: string; completedAt?: string }; calendar?: CalendarInfo; travel?: TravelInfo };
export type DueReminder = { key: string; title: string; body: string; url: string };

// Match the scheduler's Thai wall-clock times on every device and server timezone.
export function bangkokDate(timestamp: number): string {
  return new Date(timestamp + 7 * 60 * 60_000).toISOString().slice(0, 10);
}

export function dueFor(entry: ReminderEntry, now: Date): DueReminder[] {
  const nowMs = now.getTime();
  const windowStart = nowMs - 5 * 60_000;
  const due: DueReminder[] = [];
  const today = bangkokDate(nowMs);
  const add = (key: string, date: string, time: string, minutesBefore: number, title: string, body: string, occurrenceDate?: string) => {
    const timestamp = Date.parse(`${date}T${time || "09:00"}:00+07:00`) - minutesBefore * 60_000;
    if (timestamp <= nowMs && timestamp > windowStart) due.push({ key, title, body, url: `/?item=${encodeURIComponent(entry.id)}${occurrenceDate ? `&occurrence=${occurrenceDate}` : ""}` });
  };
  if (entry.kind === "item") {
    // A delayed run just after midnight must also recover the previous day's dose.
    for (const date of new Set([bangkokDate(windowStart), today])) {
      for (const reminder of entry.medicine?.reminders ?? []) add(`${entry.id}:medicine:${reminder.meal}:${date}`, date, reminder.time, 0, `ถึงเวลา: ${entry.name}`, reminder.message || `ถึงเวลากิน ${entry.name} (${reminder.meal})`);
    }
    if (entry.stock && entry.stock.dailyUse > 0) {
      const elapsed = entry.stock.autoDeduct === false || !entry.stock.updatedAt ? 0 : Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${entry.stock.updatedAt}T00:00:00Z`)) / 86400000));
      const remaining = Math.max(0, entry.stock.quantity - entry.stock.dailyUse * elapsed);
      if (Math.ceil(remaining / entry.stock.dailyUse) <= entry.stock.alertDays) add(`${entry.id}:stock:${today}`, today, "09:00", 0, `ใกล้หมด: ${entry.name}`, `เหลือประมาณ ${remaining} ${entry.stock.unit}`);
    }
  }
  if (entry.kind === "shopping" && entry.shopping && !entry.shopping.completedAt && entry.shopping.dueDate <= today) add(`${entry.id}:shopping:${today}`, today, "09:00", 0, `ต้องซื้อ: ${entry.name}`, `ถึงวันซื้อ ${entry.name} แล้ว`);
  if (entry.kind === "calendar" && entry.calendar) {
    const event = entry.calendar;
    const minutesBefore = Math.max(0, event.remindMinutes || 0);
    if (event.type === "contract") {
      const date = event.end || event.start;
      add(`${entry.id}:calendar:${date}:${event.time}`, date, event.time, minutesBefore, entry.name, event.message || `สัญญา ${entry.name} จะสิ้นสุด`, date);
    } else {
      const first = bangkokDate(windowStart + minutesBefore * 60_000);
      const last = bangkokDate(nowMs + minutesBefore * 60_000);
      const message = event.message || (entry.travel ? "แจ้งเตือนแผนเดินทาง" : `นัดหมาย ${entry.name}`);
      for (const date of calendarOccurrenceDates(event, first, last)) add(`${entry.id}:calendar:${date}:${event.time}`, date, event.time, minutesBefore, entry.name, message, date);
    }
  }
  return due;
}

// Start multiple deliveries promptly without unbounded requests to the push provider.
export async function runConcurrent(tasks: (() => Promise<void>)[], limit = 6): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), tasks.length) }, async () => {
    while (next < tasks.length) await tasks[next++]();
  }));
}
