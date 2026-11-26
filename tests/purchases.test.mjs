import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./load-ts.mjs";

const { purchaseHistory, updatePurchaseDetails } = await loadTs("src/lib/purchases.ts");
const older = { id: "p1", date: "2026-11-20", quantity: 2, unit: "แผง", store: "", price: 0 };
const latest = { ...older, id: "p2", date: "2026-11-26", price: 100, store: "ร้านเดิม" };

test("correct an older purchase without changing the latest summary, quantity or stock", () => {
  const item = { id: "item", date: latest.date, price: 100, store: latest.store, purchases: [older, latest], stock: { quantity: 35, dailyUse: 1 } };
  const result = updatePurchaseDetails([item], "item", "p1", " ร้านยา ", 80)[0];
  assert.deepEqual(result.purchases[0], { ...older, store: "ร้านยา", price: 80 });
  assert.equal(result.price, 100);
  assert.equal(result.store, latest.store);
  assert.equal(result.stock, item.stock);
  assert.equal(result.purchases[1], latest);
  assert.equal(item.purchases[0].price, 0);
});

test("correct the same purchase in completed shopping and product records", () => {
  const item = { id: "item", date: latest.date, purchases: [older, latest] };
  const shopping = { id: "shopping", date: latest.date, purchases: [latest], shopping: { completedAt: latest.date } };
  const untouched = { id: "other", date: latest.date, price: 40 };
  const result = updatePurchaseDetails([item, shopping, untouched], "shopping", "p2", "ร้านใหม่", 125);
  assert.equal(result[0].purchases[1].price, 125);
  assert.equal(result[1].purchases[0].store, "ร้านใหม่");
  assert.equal(result[0].price, 125);
  assert.equal(result[1].shopping, shopping.shopping);
  assert.equal(result[2], untouched);
});

test("legacy purchases keep an unknown quantity and stable ID after editing", () => {
  const legacy = { id: "legacy", date: "2026-11-01", price: 0, store: "" };
  const purchase = purchaseHistory(legacy)[0];
  const result = updatePurchaseDetails([legacy], legacy.id, purchase.id, "ร้านยา", 90)[0];
  assert.equal(result.purchases[0].quantity, 0);
  assert.equal(result.purchases[0].id, "original-legacy");
  assert.equal(result.purchases[0].date, legacy.date);
  assert.equal(result.price, 90);
});

test("invalid store and prices cannot be saved; a removed target is left alone", () => {
  const entries = [{ id: "item", date: latest.date, purchases: [latest] }];
  for (const [store, price] of [["   ", 10], ["ร้าน", -1], ["ร้าน", NaN], ["ร้าน", Infinity]]) {
    assert.throws(() => updatePurchaseDetails(entries, "item", "p2", store, price));
  }
  assert.equal(updatePurchaseDetails(entries, "removed", "p2", "ร้าน", 10), entries);
  assert.equal(updatePurchaseDetails(entries, "item", "removed", "ร้าน", 10), entries);
});
