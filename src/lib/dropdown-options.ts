export function optionLabel(value: string): string {
  return value.normalize("NFC").replace(/[\u200B\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}

export function optionKey(value: string): string {
  return optionLabel(value).normalize("NFKC").toLocaleLowerCase("th-TH");
}

export function uniqueOptions(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    if (typeof value !== "string") return [];
    const label = optionLabel(value), key = optionKey(label);
    if (!key || seen.has(key)) return [];
    seen.add(key); return [label];
  });
}

export type DropdownGroup = "people" | "units" | "stores" | "products";
export type DropdownOptions = Record<DropdownGroup, string[]>;
export const emptyDropdownOptions = (): DropdownOptions => ({ people: [], units: [], stores: [], products: [] });

type OptionEntry = {
  name: string; kind: string; category?: string; forPerson?: string; store?: string; unit?: string;
  stock?: { unit: string }; medicine?: { doseUnit?: string };
  packaging?: { baseUnit: string; innerUnit: string; outerUnit?: string };
  purchases?: { store?: string; unit?: string }[];
  shopping?: { unit?: string };
};

export function entryDropdownOptions(entries: readonly OptionEntry[]): DropdownOptions {
  return {
    people: uniqueOptions(entries.map((entry) => entry.forPerson)),
    stores: uniqueOptions(entries.flatMap((entry) => [entry.store, ...(entry.purchases ?? []).map((purchase) => purchase.store)])),
    units: uniqueOptions(entries.flatMap((entry) => [entry.unit, entry.stock?.unit, entry.medicine?.doseUnit, entry.packaging?.baseUnit, entry.packaging?.innerUnit, entry.packaging?.outerUnit, entry.shopping?.unit, ...(entry.purchases ?? []).map((purchase) => purchase.unit)])),
    products: uniqueOptions(entries.filter((entry) => (entry.kind === "item" || entry.kind === "shopping") && !["การเงิน", "รายรับ", "รายจ่าย", "รายจ่ายในครัวเรือน"].includes(entry.category ?? "")).map((entry) => entry.name)),
  };
}

export function parseDropdownOptions(raw: string | null): DropdownOptions {
  const result = emptyDropdownOptions();
  try {
    const parsed: unknown = JSON.parse(raw || "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return result;
    for (const group of Object.keys(result) as DropdownGroup[]) {
      const values = (parsed as Record<string, unknown>)[group];
      if (Array.isArray(values)) result[group] = uniqueOptions(values.filter((item): item is string => typeof item === "string" && item.length <= 200)).slice(-200);
    }
  } catch { /* Invalid or older local preferences are ignored. */ }
  return result;
}

export function dropdownStorageKey(scope: string): string { return `home-love-dropdowns-v1:${scope}`; }
