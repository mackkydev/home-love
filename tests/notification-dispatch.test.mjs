import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { runConcurrent } = loadTs('src/lib/notification-reminders.ts', { './calendar-recurrence': {} });
function setup({ claimError, sendError, disabledCategory = false } = {}) {
  const calls = [], claims = new Set();
  const entry = { id: 'dose', category: 'ยาและสุขภาพ', kind: 'item', medicine: { recipientIds: ['chosen'] } };
  const client = {
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { notification_preferences: disabledCategory ? { 'ยาและสุขภาพ': false } : {} } } } }) } },
    rpc: async () => ({ data: [{ household_id: 'house', user_id: 'chosen' }, { household_id: 'house', user_id: 'other' }] }),
    from: table => ({
      select: async () => ({ data: table === 'entries' ? [{ household_id: 'house', data: entry }] : [{ endpoint: 'chosen-device', user_id: 'chosen', p256dh: 'key', auth_key: 'auth' }, { endpoint: 'other-device', user_id: 'other' }] }),
      insert: async row => {
        calls.push(['claim', row.endpoint]);
        if (claimError) return { error: { code: claimError } };
        const key = row.occurrence_key + row.endpoint;
        if (claims.has(key)) return { error: { code: '23505' } };
        claims.add(key); return {};
      },
      delete: () => {
        const query = { eq: (key, value) => { calls.push(['delete', table, key, value]); return query; }, then: resolve => resolve({}) };
        return query;
      },
    }),
  };
  const route = loadTs('src/app/api/notifications/dispatch/route.ts', {
    '@supabase/supabase-js': { createClient: () => client },
    'web-push': { default: { setVapidDetails: () => {}, sendNotification: async (subscription, payload, options) => { calls.push(['send', subscription.endpoint, JSON.parse(payload), options]); if (sendError) throw { statusCode: sendError }; } } },
    '@/lib/notification-reminders': { dueFor: () => [{ key: 'dose:medicine:morning:2026-11-27', title: 'Dose', body: 'Reminder', url: '/?item=dose' }], runConcurrent },
    '@/lib/travel': { isInTrip: () => true },
  }, { process: { env: { NOTIFICATION_CRON_SECRET: 'test-secret', NEXT_PUBLIC_SUPABASE_URL: 'https://test.invalid', SUPABASE_SECRET_KEY: 'test-only', NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'test-private' } } });
  return { route, calls };
}
const request = (token = 'test-secret') => new Request('https://test.invalid/api/notifications/dispatch', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

test('dispatch authenticates the scheduler before accessing household data', async () => {
  const { route, calls } = setup();
  assert.equal((await route.POST(request('wrong'))).status, 401);
  assert.deepEqual(calls, []);
});

test('overlapping runs claim each recipient device once and use urgent, short-lived pushes', async () => {
  const { route, calls } = setup();
  await Promise.all([route.POST(request()), route.POST(request())]);
  const sent = calls.filter(row => row[0] === 'send');
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1], 'chosen-device');
  assert.deepEqual(sent[0][3], { TTL: 300, urgency: 'high', timeout: 10000 });
});

test('disabled categories prevent all deliveries', async () => {
  const { route, calls } = setup({ disabledCategory: true });
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(calls, []);
});

test('claim infrastructure errors are reported for monitoring instead of silent success', async () => {
  const { route, calls } = setup({ claimError: 'XX000' });
  const response = await route.POST(request());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { sent: 0, failed: 1 });
  assert.equal(calls.some(row => row[0] === 'send'), false);
});

test('expired endpoints are removed and failed claims are released', async () => {
  const { route, calls } = setup({ sendError: 410 });
  assert.equal((await route.POST(request())).status, 502);
  assert.ok(calls.some(row => row[0] === 'delete' && row[1] === 'push_deliveries'));
  assert.ok(calls.some(row => row[0] === 'delete' && row[1] === 'push_subscriptions' && row[3] === 'chosen-device'));
});
