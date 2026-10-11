import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { calendarOccurrenceDates, type CalendarRecurrence } from "@/lib/calendar-recurrence";

type ReminderEntry = { id: string; name: string; kind: string; medicine?: { reminders?: { meal: string; time: string; message: string }[]; recipientIds?: string[] }; calendar?: { type: "appointment" | "contract"; start: string; end?: string; time: string; remindMinutes: number; message: string; recipientIds?: string[]; recurrence?: CalendarRecurrence } };
type Due = { key: string; title: string; body: string; url: string };

function dueFor(entry: ReminderEntry, now: Date): Due[] {
  const windowStart = now.getTime() - 5 * 60_000;
  const due: Due[] = [];
  const add = (key: string, date: string, time: string, minutesBefore: number, title: string, body: string, occurrenceDate?: string) => {
    const timestamp = Date.parse(`${date}T${time || "09:00"}:00+07:00`) - minutesBefore * 60_000;
    if (timestamp <= now.getTime() && timestamp > windowStart) due.push({ key, title, body, url: `/?item=${encodeURIComponent(entry.id)}${occurrenceDate ? `&occurrence=${occurrenceDate}` : ""}` });
  };
  if (entry.kind === "item") {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    const bangkokDay = `${part("year")}-${part("month")}-${part("day")}`;
    for (const reminder of entry.medicine?.reminders ?? []) add(`${entry.id}:medicine:${reminder.meal}:${bangkokDay}`, bangkokDay, reminder.time, 0, `ถึงเวลา: ${entry.name}`, reminder.message || `ถึงเวลากิน ${entry.name} (${reminder.meal})`);
  }
  if (entry.kind === "calendar" && entry.calendar) {
    const event = entry.calendar;
    const minutesBefore = Math.max(0, event.remindMinutes || 0);
    if (event.type === "contract") {
      const date = event.end || event.start;
      add(`${entry.id}:calendar:${date}:${event.time}`, date, event.time, minutesBefore, entry.name, event.message || `สัญญา ${entry.name} จะสิ้นสุด`, date);
    } else {
      const bangkokDay = (timestamp: number) => new Date(timestamp + 7 * 60 * 60_000).toISOString().slice(0, 10);
      const first = bangkokDay(windowStart + minutesBefore * 60_000);
      const last = bangkokDay(now.getTime() + minutesBefore * 60_000);
      for (const date of calendarOccurrenceDates(event, first, last)) add(`${entry.id}:calendar:${date}:${event.time}`, date, event.time, minutesBefore, entry.name, event.message || `นัดหมาย ${entry.name}`, date);
    }
  }
  return due;
}

export async function POST(request: Request) {
  const cronSecret = process.env.NOTIFICATION_CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!url || !key || !publicKey || !privateKey) return Response.json({ error: "Push is not configured" }, { status: 503 });
  webpush.setVapidDetails("https://home-love-pi.vercel.app", publicKey, privateKey);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const [{ data: entries, error: entriesError }, { data: members, error: membersError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    db.from("entries").select("household_id,data"),
    db.from("household_members").select("household_id,user_id"),
    db.from("push_subscriptions").select("endpoint,user_id,p256dh,auth_key"),
  ]);
  if (entriesError || membersError || subscriptionsError) return Response.json({ error: "Could not load notifications" }, { status: 500 });
  const usersByHouse = new Map<string, Set<string>>();
  for (const member of members ?? []) { const users = usersByHouse.get(member.household_id) ?? new Set<string>(); users.add(member.user_id); usersByHouse.set(member.household_id, users); }
  const subscriptionsByUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions ?? []) { const list = subscriptionsByUser.get(subscription.user_id) ?? []; list.push(subscription); subscriptionsByUser.set(subscription.user_id, list); }
  const now = new Date();
  let sent = 0;
  for (const row of entries ?? []) {
    const entry = row.data as ReminderEntry;
    for (const reminder of dueFor(entry, now)) {
      for (const userId of usersByHouse.get(row.household_id) ?? []) {
        if (entry.kind === "item" && entry.medicine?.recipientIds && !entry.medicine.recipientIds.includes(userId)) continue;
        if (entry.kind === "calendar" && entry.calendar?.recipientIds && !entry.calendar.recipientIds.includes(userId)) continue;
        for (const subscription of subscriptionsByUser.get(userId) ?? []) {
          const { error: claimError } = await db.from("push_deliveries").insert({ occurrence_key: reminder.key, endpoint: subscription.endpoint });
          if (claimError) continue;
          try {
            await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify(reminder), { TTL: 3600, urgency: "high" });
            sent += 1;
          } catch (error) {
            await db.from("push_deliveries").delete().eq("occurrence_key", reminder.key).eq("endpoint", subscription.endpoint);
            const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
            if (statusCode === 404 || statusCode === 410) await db.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          }
        }
      }
    }
  }
  return Response.json({ sent });
}
