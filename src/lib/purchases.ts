export type Purchase = { id: string; date: string; store: string; price: number; quantity: number; unit?: string };
type PurchaseEntry = { id: string; date: string; store?: string; price?: number; purchases?: Purchase[] };

export function purchaseHistory(entry: PurchaseEntry): Purchase[] {
  if (entry.purchases?.length) return entry.purchases;
  return entry.price != null ? [{ id: `original-${entry.id}`, date: entry.date, store: entry.store ?? "", price: entry.price, quantity: 0 }] : [];
}

// A completed shopping record and its product share a purchase ID. Keep both
// copies in sync, without replaying the purchase or changing any stock data.
export function updatePurchaseDetails<T extends PurchaseEntry>(entries: T[], entryId: string, purchaseId: string, store: string, price: number): T[] {
  if (!store.trim() || !Number.isFinite(price) || price < 0) throw new Error("Invalid purchase details");
  const target = entries.find((entry) => entry.id === entryId);
  if (!target || !purchaseHistory(target).some((purchase) => purchase.id === purchaseId)) return entries;
  return entries.map((entry) => {
    const purchases = entry.id === entryId ? purchaseHistory(entry) : entry.purchases;
    if (!purchases?.some((purchase) => purchase.id === purchaseId)) return entry;
    const next = purchases.map((purchase) => purchase.id === purchaseId ? { ...purchase, store: store.trim(), price } : purchase);
    const latest = next.at(-1)!;
    return { ...entry, purchases: next, ...(latest.id === purchaseId ? { store: latest.store, price: latest.price } : {}) };
  });
}
