import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { travelDays } = loadTs('src/lib/travel-days.ts', {});

test('travel tabs include both endpoints and cross month, year and leap-day boundaries', () => {
  assert.deepEqual(travelDays('2026-11-28', '2026-11-28'), ['2026-11-28']);
  assert.deepEqual(travelDays('2026-12-31', '2027-01-02'), ['2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(travelDays('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
});
test('invalid or reversed trip dates cannot produce selectable tabs', () => {
  for (const range of [['bad', '2026-11-28'], ['2026-02-30', '2026-03-02'], ['2026-11-29', '2026-11-28']]) assert.deepEqual(travelDays(...range), []);
});
