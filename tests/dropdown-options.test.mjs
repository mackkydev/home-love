import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { optionKey, optionLabel, uniqueOptions, entryDropdownOptions, parseDropdownOptions, dropdownStorageKey } = loadTs('src/lib/dropdown-options.ts', {});

test('new choices are canonicalized without duplicating case, spacing, or Unicode variants', () => {
  assert.deepEqual(uniqueOptions([' Milk ', 'milk', 'Ｍｉｌｋ', 'ร้าน  ก', 'ร้าน ก', 'ร้าน\u200b ก', '', null]), ['Milk', 'ร้าน ก']);
  assert.equal(optionKey('น้ำ'), optionKey('น้ํา'));
  assert.equal(optionLabel(' ร้าน  ก '), 'ร้าน ก');
});

test('distinct medicine strengths and units remain distinct', () => {
  assert.deepEqual(uniqueOptions(['ยา 1 มก.', 'ยา 10 มก.', 'เม็ด', 'แคปซูล', 'ร้านก', 'ร้าน ก']), ['ยา 1 มก.', 'ยา 10 มก.', 'เม็ด', 'แคปซูล', 'ร้านก', 'ร้าน ก']);
});

test('saved records restore stores, people, package units and shopping products in dropdowns', () => {
  const choices = entryDropdownOptions([
    { name: 'Vitamin', kind: 'item', forPerson: 'คุณย่า', store: 'Shop', unit: 'ครั้ง', medicine: { doseUnit: 'ช้อน' }, stock: { unit: 'เม็ด' }, packaging: { baseUnit: 'เม็ด', innerUnit: 'แผง', outerUnit: 'ลัง' }, purchases: [{ store: ' shop ', unit: 'แพ็ก' }, { store: 'ร้าน ข', unit: 'ห่อ' }] },
    { name: 'Milk', kind: 'shopping', shopping: { unit: 'ถัง' } },
    { name: 'Salary', kind: 'item', category: 'รายรับ' },
    { name: 'Laundry', kind: 'service' },
  ]);
  assert.deepEqual(choices.people, ['คุณย่า']);
  assert.deepEqual(choices.stores, ['Shop', 'ร้าน ข']);
  assert.deepEqual(choices.units, ['ครั้ง', 'เม็ด', 'ช้อน', 'แผง', 'ลัง', 'แพ็ก', 'ห่อ', 'ถัง']);
  assert.deepEqual(choices.products, ['Vitamin', 'Milk']);
});

test('draft options survive reopening while malformed storage cannot break selection', () => {
  const restored = parseDropdownOptions(JSON.stringify({ stores: [' A ', 'a', 42, null], people: ['คุณย่า'], units: ['ลัง'], products: ['Milk'], unknown: ['ignored'] }));
  assert.deepEqual(restored, { stores: ['A'], people: ['คุณย่า'], units: ['ลัง'], products: ['Milk'] });
  for (const invalid of [null, '{broken', 'null', '42', '[]']) assert.deepEqual(parseDropdownOptions(invalid), { stores: [], people: [], units: [], products: [] });
});

test('draft storage is isolated per account and household', () => {
  assert.notEqual(dropdownStorageKey('user-a:home-a'), dropdownStorageKey('user-b:home-a'));
  assert.notEqual(dropdownStorageKey('user-a:home-a'), dropdownStorageKey('user-a:home-b'));
});
