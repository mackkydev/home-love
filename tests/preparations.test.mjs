import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { preparationCategory, isPreparationRecord, togglePreparation, preparationCounts } = loadTs('src/lib/preparations.ts', {});

test('household checklist records stay separate from products, purchases and trips', () => {
  assert.equal(preparationCategory, 'สิ่งที่ต้องเตรียม');
  assert.equal(isPreparationRecord({ kind: 'preparation', preparation: {} }), true);
  for (const kind of ['item', 'shopping', 'calendar', 'note']) assert.equal(isPreparationRecord({ kind, preparation: {} }), false);
  assert.equal(isPreparationRecord({ kind: 'preparation' }), false);
});

test('checking and unchecking preserve the record, notes and unrelated shared fields', () => {
  const original = { id: 'one', name: 'เอกสาร', kind: 'preparation', category: preparationCategory, date: '2026-11-27', actor: 'คุณ', preparation: { note: 'ต้นฉบับ 2 ชุด' }, extra: { preserved: true } };
  const checked = togglePreparation(original, '2026-11-27T03:00:00Z');
  assert.equal(checked.preparation.completedAt, '2026-11-27T03:00:00Z');
  assert.equal(original.preparation.completedAt, undefined);
  assert.deepEqual({ ...checked, preparation: original.preparation }, original);
  assert.deepEqual(JSON.parse(JSON.stringify(togglePreparation(checked, 'unused'))), original);
});

test('checklist filters and progress counts agree after toggles', () => {
  const pending = { id: 'one', name: 'A', kind: 'preparation', category: preparationCategory, date: '2026-11-27', actor: 'คุณ', preparation: {} };
  const completed = { ...pending, id: 'two', preparation: { completedAt: '2026-11-27T03:00:00Z' } };
  assert.deepEqual(preparationCounts([]), { total: 0, completed: 0, pending: 0 });
  assert.deepEqual(preparationCounts([pending, completed]), { total: 2, completed: 1, pending: 1 });
  assert.deepEqual(preparationCounts([togglePreparation(pending, 'now'), completed]), { total: 2, completed: 2, pending: 0 });
});
