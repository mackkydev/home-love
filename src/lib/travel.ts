import type { CalendarRecurrence } from "./calendar-recurrence";

export type CalendarInfo = {
  type: "appointment" | "contract";
  start: string;
  end?: string;
  time: string;
  remindMinutes: number;
  message: string;
  linkedEntryId?: string;
  locationUrl?: string;
  recipientIds?: string[];
  recurrence?: CalendarRecurrence;
};

export type TravelInfo = { kind: "trip" } | {
  kind: "stop";
  tripId: string;
  endTime?: string;
  details?: string;
  contact?: string;
};

export type TravelRecord = {
  id: string;
  name: string;
  category: string;
  date: string;
  actor: string;
  kind: "calendar";
  calendar: CalendarInfo;
  travel: TravelInfo;
  photo?: string;
};

export type TravelSelection = { id: string; date?: string; stopId?: string };

export function isInTrip(date: string, trip?: CalendarInfo) {
  return Boolean(trip && date >= trip.start && date <= (trip.end ?? trip.start));
}

export function currentTravelEntries<T extends { id: string; calendar?: CalendarInfo; travel?: TravelInfo }>(entries: T[]): T[] {
  const trips = new Map(entries.filter((entry) => entry.travel?.kind === "trip").map((entry) => [entry.id, entry.calendar]));
  return entries.filter((entry) => entry.travel?.kind !== "stop" || isInTrip(entry.calendar?.start ?? "", trips.get(entry.travel.tripId)));
}

export function isTravelRecord<T extends { kind: string; calendar?: CalendarInfo; travel?: TravelInfo }>(
  entry: T,
): entry is T & { kind: "calendar"; calendar: CalendarInfo; travel: TravelInfo } {
  return entry.kind === "calendar" && Boolean(entry.calendar && entry.travel);
}

export function travelSelection(entry: { id: string; date: string; travel?: TravelInfo }, occurrence?: string): TravelSelection {
  return entry.travel?.kind === "stop"
    ? { id: entry.travel.tripId, date: entry.date, stopId: entry.id }
    : { id: entry.id, date: occurrence ?? entry.date };
}
