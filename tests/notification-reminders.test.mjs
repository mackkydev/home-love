import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const recurrence = loadTs('src/lib/calendar-recurrence.ts', {});
const { dueFor, bangkokDate, runConcurrent } = loadTs('src/lib/notification-reminders.ts', { './calendar-recurrence': recurrence });
const medicine = { id: 'dose', kind: 'item', name: 'Vitamin', medicine: { reminders: [{ meal: 'morning', time: '08:00', message: '' }] } };

test('medicine uses Thai scheduled time, never early, with a five-minute catch-up window', () => {
  assert.equal(dueFor(medicine, new Date('2026-11-27T00:59:59.999Z')).length, 0);
  const [atTime] = dueFor(medicine, new Date('2026-11-27T01:00:00Z'));
  assert.equal(atTime.key, 'dose:medicine:morning:2026-11-27');
  assert.deepEqual(dueFor(medicine, new Date('2026-11-27T01:00:30Z')), [atTime]);
  assert.equal(dueFor(medicine, new Date('2026-11-27T01:04:59Z')).length, 1);
  assert.equal(dueFor(medicine, new Date('2026-11-27T01:05:00Z')).length, 0);
});

test('midnight catch-up recovers yesterday without creating a second occurrence key', () => {
  const entry = { ...medicine, medicine: { reminders: [{ meal: 'bedtime', time: '23:59', message: '' }] } };
  const expected = dueFor(entry, new Date('2026-11-27T16:59:30Z'));
  assert.deepEqual(dueFor(entry, new Date('2026-11-27T17:00:30Z')), expected);
  assert.equal(expected[0].key, 'dose:medicine:bedtime:2026-11-27');
  assert.equal(bangkokDate(Date.parse('2026-11-27T17:00:00Z')), '2026-11-28');
});

test('calendar lead time can cross midnight and preserves occurrence deep links', () => {
  const entry = { id: 'meet/a', name: 'Meeting', kind: 'calendar', calendar: { type: 'appointment', start: '2026-11-28', time: '00:10', remindMinutes: 30 } };
  assert.equal(dueFor(entry, new Date('2026-11-27T16:39:59Z')).length, 0);
  const [alert] = dueFor(entry, new Date('2026-11-27T16:40:00Z'));
  assert.equal(alert.key, 'meet/a:calendar:2026-11-28:00:10');
  assert.equal(alert.url, '/?item=meet%2Fa&occurrence=2026-11-28');
});

test('excluded recurring dates and completed shopping do not alert', () => {
  const entry = { id: 'event', name: 'Weekly', kind: 'calendar', calendar: { type: 'appointment', start: '2026-11-26', time: '08:00', recurrence: { frequency: 'daily', interval: 1, excludedDates: ['2026-11-27'] } } };
  assert.equal(dueFor(entry, new Date('2026-11-27T01:00:15Z')).length, 0);
  assert.equal(dueFor(entry, new Date('2026-11-28T01:00:15Z')).length, 1);
  assert.equal(dueFor({ id: 'buy', name: 'Bought', kind: 'shopping', shopping: { dueDate: '2026-11-26', completedAt: '2026-11-26' } }, new Date('2026-11-27T02:00:00Z')).length, 0);
});

test('deliveries run concurrently with a strict limit, once per queued task', async () => {
  let active = 0, peak = 0;
  const finished = [];
  await runConcurrent(Array.from({ length: 17 }, (_, index) => async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve));
    finished.push(index); active--;
  }), 4);
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.deepEqual(finished.sort((a, b) => a - b), Array.from({ length: 17 }, (_, i) => i));
});
