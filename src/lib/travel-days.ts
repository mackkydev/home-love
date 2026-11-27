export function travelDays(start: string, end: string): string[] {
  const first = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first > last || new Date(first).toISOString().slice(0, 10) !== start || new Date(last).toISOString().slice(0, 10) !== end) return [];
  return Array.from({ length: Math.floor((last - first) / 86_400_000) + 1 }, (_, index) => new Date(first + index * 86_400_000).toISOString().slice(0, 10));
}
