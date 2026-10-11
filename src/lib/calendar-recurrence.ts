export type CalendarRecurrence = {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays?: number[]; // Monday = 0, Sunday = 6.
  monthlyDay?: number | "last";
  until?: string; // Inclusive YYYY-MM-DD.
  excludedDates?: string[];
  excludedBefore?: string; // Hide past occurrences without ending the series.
};

export type RecurringCalendar = {
  start: string;
  time: string;
  recurrence?: CalendarRecurrence;
};

const dayMs = 86_400_000;

function utcDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function calendarWeekday(value: string): number {
  const date = utcDate(value);
  return date ? (date.getUTCDay() + 6) % 7 : 0;
}

export function calendarOccursOn(calendar: RecurringCalendar, date: string): boolean {
  const start = utcDate(calendar.start);
  const target = utcDate(date);
  if (!start || !target || date < calendar.start) return false;
  const repeat = calendar.recurrence;
  if (!repeat) return date === calendar.start;
  if (repeat.until && date > repeat.until) return false;
  if (repeat.excludedBefore && date < repeat.excludedBefore) return false;
  if (repeat.excludedDates?.includes(date)) return false;
  const interval = Math.max(1, Math.floor(repeat.interval) || 1);
  const days = Math.round((target.getTime() - start.getTime()) / dayMs);
  if (repeat.frequency === "daily") return days % interval === 0;
  if (repeat.frequency === "weekly") {
    const startWeek = Math.floor((start.getTime() - calendarWeekday(calendar.start) * dayMs) / dayMs);
    const targetWeek = Math.floor((target.getTime() - calendarWeekday(date) * dayMs) / dayMs);
    const weekDifference = Math.round((targetWeek - startWeek) / 7);
    const weekdays = repeat.weekdays?.length ? repeat.weekdays : [calendarWeekday(calendar.start)];
    return weekDifference % interval === 0 && weekdays.includes(calendarWeekday(date));
  }
  const months = (target.getUTCFullYear() - start.getUTCFullYear()) * 12 + target.getUTCMonth() - start.getUTCMonth();
  if (repeat.frequency === "monthly") {
    if (months % interval !== 0) return false;
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    const selectedDay = repeat.monthlyDay === "last" ? lastDay : Math.min(lastDay, Math.max(1, Number(repeat.monthlyDay) || start.getUTCDate()));
    return target.getUTCDate() === selectedDay;
  }
  const years = target.getUTCFullYear() - start.getUTCFullYear();
  if (years % interval !== 0 || target.getUTCMonth() !== start.getUTCMonth()) return false;
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return target.getUTCDate() === Math.min(start.getUTCDate(), lastDay);
}

export function calendarDateAtOrBefore(date: string, time: string, now = new Date()): boolean {
  const timestamp = new Date(`${date}T${time || "23:59"}:00`).getTime();
  return !Number.isNaN(timestamp) && timestamp < now.getTime();
}

export function calendarSeriesFinished(calendar: RecurringCalendar, now = new Date()): boolean {
  return calendarDateAtOrBefore(calendar.recurrence?.until || calendar.start, calendar.time, now)
    && (!calendar.recurrence || Boolean(calendar.recurrence.until));
}

export function calendarOccurrenceDates(calendar: RecurringCalendar, first: string, last: string): string[] {
  const start = utcDate(first);
  const end = utcDate(last);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let day = start.getTime(); day <= end.getTime() && dates.length < 400; day += dayMs) {
    const date = new Date(day).toISOString().slice(0, 10);
    if (calendarOccursOn(calendar, date)) dates.push(date);
  }
  return dates;
}

export function calendarHasPastOccurrence(calendar: RecurringCalendar, now = new Date()): boolean {
  const start = utcDate(calendar.start);
  if (!start) return false;
  const current = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const earliest = Math.max(start.getTime(), utcDate(calendar.recurrence?.excludedBefore ?? calendar.start)?.getTime() ?? start.getTime());
  for (let day = current.getTime(); day >= earliest; day -= dayMs) {
    const date = new Date(day).toISOString().slice(0, 10);
    if (calendarOccursOn(calendar, date) && calendarDateAtOrBefore(date, calendar.time, now)) return true;
  }
  return false;
}
