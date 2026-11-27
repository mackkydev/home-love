import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { preparationCategory, isPreparationRecord, togglePreparation, preparationCounts, preparationLists, preparationItems, preparationTitle, preparationRemovalIds, withoutLegacyPreparationItem } = loadTs('src/lib/preparations.ts', {});

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

const record = (id, preparation = {}) => ({ id, name: id, kind: 'preparation', category: preparationCategory, date: '2026-11-27', actor: 'คุณ', preparation });

test('main list counts dated checklists, while each detail contains only its own items', () => {
  const a = record('a', { type: 'list', dueDate: '2026-12-01' });
  const b = record('b', { type: 'list', dueDate: '2026-12-02' });
  const entries = [a, record('a1', { listId: 'a' }), record('a2', { listId: 'a', completedAt: 'done' }), b, record('b1', { listId: 'b' })];
  assert.deepEqual(preparationLists(entries).map(x => x.id), ['a', 'b']);
  assert.deepEqual(preparationItems(entries, a).map(x => x.id), ['a1', 'a2']);
  assert.deepEqual(preparationCounts(preparationItems(entries, a)), { total: 2, completed: 1, pending: 1 });
  assert.deepEqual(preparationItems(entries, record('empty', { type: 'list' })), []);
});

test('legacy flat records retain their original item, notes and completed state', () => {
  const legacy = record('old', { note: 'Keep original note', completedAt: 'old-completion' });
  const child = record('new', { listId: 'old' });
  assert.deepEqual(preparationLists([legacy, child]), [legacy]);
  assert.deepEqual(preparationItems([legacy, child], legacy), [legacy, child]);
  assert.equal(preparationTitle(legacy), 'old');
  assert.equal(legacy.preparation.dueDate, undefined);
});

test('editing a legacy checklist title does not rename its original item', () => {
  const legacy = record('original-item', { title: 'Family checklist', dueDate: '2026-12-01' });
  assert.equal(preparationTitle(legacy), 'Family checklist');
  assert.equal(preparationItems([legacy], legacy)[0].name, 'original-item');
  assert.equal(preparationTitle(record('normal-title', { type: 'list', title: 'ignored legacy field' })), 'normal-title');
});

test('moving an item between ready tabs preserves its parent and preparation date', () => {
  const item = record('a1', { listId: 'a', dueDate: '2026-12-01', note: '2 copies' });
  const ready = togglePreparation(item, '2026-11-27T03:00:00Z');
  assert.equal(ready.preparation.listId, 'a');
  assert.equal(ready.preparation.dueDate, '2026-12-01');
  assert.equal(ready.preparation.note, '2 copies');
  assert.deepEqual(preparationCounts([ready]), { total: 1, completed: 1, pending: 0 });
  assert.deepEqual(preparationCounts([togglePreparation(ready, 'unused')]), { total: 1, completed: 0, pending: 1 });
});

test('deleting a checklist selects its children without affecting another checklist', () => {
  const entries = [record('a', { type: 'list' }), record('a1', { listId: 'a' }), record('b', { type: 'list' }), record('b1', { listId: 'b' })];
  const deleted = preparationRemovalIds(entries, 'a');
  assert.deepEqual([...deleted], ['a', 'a1']);
  assert.deepEqual(entries.filter(x => !deleted.has(x.id)).map(x => x.id), ['b', 'b1']);
});

test('removing the original legacy item preserves the checklist and newer children', () => {
  const legacy = record('old', { title: 'Family checklist', dueDate: '2026-12-01', description: 'Shared description', note: 'Old item note', completedAt: 'done' });
  const child = record('new', { listId: 'old' });
  const converted = withoutLegacyPreparationItem(legacy);
  assert.equal(converted.id, 'old');
  assert.equal(converted.name, 'Family checklist');
  assert.equal(converted.preparation.dueDate, '2026-12-01');
  assert.equal(converted.preparation.description, 'Shared description');
  assert.deepEqual(preparationItems([converted, child], converted), [child]);
  assert.equal(legacy.preparation.note, 'Old item note');
});
