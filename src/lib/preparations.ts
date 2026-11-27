export const preparationCategory = "สิ่งที่ต้องเตรียม";
export type PreparationInfo = { completedAt?: string; note?: string };
export type PreparationRecord = { id: string; name: string; kind: "preparation"; category: string; date: string; actor: string; preparation: PreparationInfo };

export function isPreparationRecord(entry: { kind: string; preparation?: PreparationInfo }): entry is PreparationRecord {
  return entry.kind === "preparation" && Boolean(entry.preparation);
}

export function togglePreparation<T extends PreparationRecord>(entry: T, now: string): T {
  return { ...entry, preparation: { ...entry.preparation, completedAt: entry.preparation.completedAt ? undefined : now } };
}

export function preparationCounts(entries: readonly PreparationRecord[]) {
  const completed = entries.filter((entry) => Boolean(entry.preparation.completedAt)).length;
  return { total: entries.length, completed, pending: entries.length - completed };
}
