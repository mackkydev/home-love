import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { dueFor, runConcurrent, type ReminderEntry } from "@/lib/notification-reminders";
import { isInTrip, type CalendarInfo } from "@/lib/travel";

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
    db.rpc("active_notification_members"),
    db.from("push_subscriptions").select("endpoint,user_id,p256dh,auth_key"),
  ]);
  if (entriesError || membersError || subscriptionsError) return Response.json({ error: "Could not load notifications" }, { status: 500 });
  const usersByHouse = new Map<string, Set<string>>();
  for (const member of (members ?? []) as { household_id: string; user_id: string }[]) { const users = usersByHouse.get(member.household_id) ?? new Set<string>(); users.add(member.user_id); usersByHouse.set(member.household_id, users); }
  const subscriptionsByUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions ?? []) { const list = subscriptionsByUser.get(subscription.user_id) ?? []; list.push(subscription); subscriptionsByUser.set(subscription.user_id, list); }
  const now = new Date();
  const preferencesByUser = new Map<string, Record<string, boolean>>();
  const tripDates = new Map<string, CalendarInfo>();
  for (const row of entries ?? []) {
    const entry = row.data as ReminderEntry;
    if (entry.travel?.kind === "trip" && entry.calendar) tripDates.set(`${row.household_id}/${entry.id}`, entry.calendar);
  }
  let sent = 0;
  let failed = 0;
  const unavailableUsers = new Set<string>();
  const deliveries: (() => Promise<void>)[] = [];
  for (const row of entries ?? []) {
    const entry = row.data as ReminderEntry;
    if (entry.travel?.kind === "stop" && !isInTrip(entry.calendar?.start ?? "", tripDates.get(`${row.household_id}/${entry.travel.tripId}`))) continue;
    for (const reminder of dueFor(entry, now)) {
      for (const userId of usersByHouse.get(row.household_id) ?? []) {
        if (unavailableUsers.has(userId)) continue;
        if (!preferencesByUser.has(userId)) {
          const { data: user, error } = await db.auth.admin.getUserById(userId);
          if (error || !user?.user) { unavailableUsers.add(userId); failed += 1; continue; }
          preferencesByUser.set(userId, (user?.user?.user_metadata?.notification_preferences ?? {}) as Record<string, boolean>);
        }
        if (entry.category && preferencesByUser.get(userId)?.[entry.category] === false) continue;
        if (reminder.key.includes(":medicine:") && entry.medicine?.recipientIds && !entry.medicine.recipientIds.includes(userId)) continue;
        if (entry.kind === "calendar" && entry.calendar?.recipientIds && !entry.calendar.recipientIds.includes(userId)) continue;
        for (const subscription of subscriptionsByUser.get(userId) ?? []) {
          deliveries.push(async () => {
            const { error: claimError } = await db.from("push_deliveries").insert({ occurrence_key: reminder.key, endpoint: subscription.endpoint });
            if (claimError) { if (claimError.code !== "23505") failed += 1; return; }
            try {
              await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify(reminder), { TTL: 300, urgency: "high", timeout: 10_000 });
              sent += 1;
            } catch (error) {
              failed += 1;
              await db.from("push_deliveries").delete().eq("occurrence_key", reminder.key).eq("endpoint", subscription.endpoint);
              const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
              if (statusCode === 404 || statusCode === 410) await db.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
            }
          });
        }
      }
    }
  }
  await runConcurrent(deliveries);
  return Response.json({ sent, failed }, { status: failed ? 502 : 200 });
}
