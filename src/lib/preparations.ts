export const preparationCategory = "สิ่งที่ต้องเตรียม";
export type PreparationInfo = {
  completedAt?: string; note?: string;
  type?: "list"; listId?: string; title?: string; dueDate?: string; description?: string;
};
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

export function preparationLists(entries: readonly { kind: string; preparation?: PreparationInfo }[]): PreparationRecord[] {
  return entries.filter(isPreparationRecord).filter((entry) => !entry.preparation.listId);
}

export function preparationItems(entries: readonly { kind: string; preparation?: PreparationInfo }[], list: PreparationRecord): PreparationRecord[] {
  const children = entries.filter(isPreparationRecord).filter((entry) => entry.preparation.listId === list.id);
  // Older flat checklists remain visible as a list containing the original item.
  return list.preparation.type === "list" ? children : [list, ...children];
}

export function preparationTitle(list: PreparationRecord): string {
  return list.preparation.type === "list" ? list.name : list.preparation.title || list.name;
}

export function preparationRemovalIds(entries: readonly { kind: string; preparation?: PreparationInfo }[], listId: string): Set<string> {
  return new Set(entries.filter(isPreparationRecord).filter((entry) => entry.id === listId || entry.preparation.listId === listId).map((entry) => entry.id));
}

export function withoutLegacyPreparationItem(list: PreparationRecord): PreparationRecord {
  return { ...list, name: preparationTitle(list), preparation: { ...list.preparation, type: "list", completedAt: undefined, note: undefined } };
}
