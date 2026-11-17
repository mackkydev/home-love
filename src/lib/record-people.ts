type PersonRecord = { id: string; forPerson?: string; shopping?: { linkedEntryId?: string } };

export function recordPerson(record: PersonRecord, records: PersonRecord[]) {
  return record.forPerson?.trim() || records.find((item) => item.id === record.shopping?.linkedEntryId)?.forPerson?.trim() || "";
}

export function recordPeople(records: PersonRecord[], householdRecords: PersonRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const person = recordPerson(record, householdRecords);
    counts.set(person, (counts.get(person) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => !a ? 1 : !b ? -1 : a.localeCompare(b, "th"));
}
