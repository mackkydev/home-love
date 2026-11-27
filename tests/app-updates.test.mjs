import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { watchAppUpdates, startupRemaining, resumeStartup } = loadTs('src/lib/app-updates.ts', {});
const flush = () => new Promise(resolve => setImmediate(resolve));
class Worker extends EventTarget {
  constructor(state = 'installed') { super(); this.state = state; this.messages = []; }
  postMessage(message) { this.messages.push(message); }
}
function setup({ firstInstall = false, registerError = false, updateError = false } = {}) {
  const events = [];
  const worker = new Worker();
  const registration = new EventTarget();
  Object.assign(registration, { waiting: worker, installing: null, updates: 0, update: async () => { registration.updates++; if (updateError) throw new Error('offline'); return registration; } });
  const container = new EventTarget();
  Object.assign(container, { controller: firstInstall ? null : {}, register: async () => { if (registerError) throw new Error('offline'); return registration; } });
  const manager = watchAppUpdates({ serviceWorker: container, onReady: value => events.push(['ready', value]), onChecked: () => events.push(['checked']), beforeReload: () => events.push(['resume']), reload: () => events.push(['reload']) });
  return { worker, registration, container, manager, events };
}

test('a waiting update is available during startup without reloading until the user chooses', async () => {
  const x = setup(); await flush();
  assert.ok(x.events.some(event => event[0] === 'ready' && event[1]));
  x.container.dispatchEvent(new Event('controllerchange'));
  assert.equal(x.events.some(event => event[0] === 'reload'), false);
  assert.equal(x.manager.apply(), true);
  assert.equal(x.manager.apply(), false);
  assert.deepEqual(x.worker.messages, [{ type: 'SKIP_WAITING' }]);
  x.container.dispatchEvent(new Event('controllerchange'));
  x.container.dispatchEvent(new Event('controllerchange'));
  assert.deepEqual(x.events.filter(event => ['resume', 'reload'].includes(event[0])), [['resume'], ['reload']]);
  x.manager.dispose();
});

test('initial installation is not presented as a second app update', async () => {
  const x = setup({ firstInstall: true }); await flush();
  assert.equal(x.events.some(event => event[0] === 'ready'), false);
  x.manager.dispose();
});

test('an update already activated by another tab can finish with one intentional reload', async () => {
  const x = setup(); await flush();
  x.registration.waiting = null; x.worker.state = 'activated'; x.container.controller = x.worker;
  x.container.dispatchEvent(new Event('controllerchange'));
  assert.equal(x.events.some(event => event[0] === 'reload'), false);
  assert.equal(x.manager.apply(), true);
  assert.equal(x.events.filter(event => event[0] === 'reload').length, 1);
  x.manager.dispose();
});

test('a newly downloaded worker is offered only after installation finishes', async () => {
  const x = setup(); await flush(); x.events.length = 0;
  x.registration.waiting = null;
  const incoming = new Worker('installing');
  x.registration.installing = incoming;
  x.registration.dispatchEvent(new Event('updatefound'));
  assert.equal(x.events.length, 0);
  incoming.state = 'installed'; incoming.dispatchEvent(new Event('statechange'));
  assert.deepEqual(x.events, [['ready', true], ['checked']]);
  x.manager.dispose();
});

test('offline registration or update checks release the startup screen', async () => {
  for (const options of [{ registerError: true }, { updateError: true }]) {
    const x = setup(options); await flush();
    assert.ok(x.events.some(event => event[0] === 'checked'));
    assert.equal(x.events.some(event => event[0] === 'reload'), false);
    x.manager.dispose();
  }
});

test('cleanup prevents accumulated listeners and background reloads after unmount', async () => {
  const x = setup(); await flush();
  x.manager.apply(); x.manager.dispose(); x.events.length = 0;
  x.worker.dispatchEvent(new Event('statechange'));
  x.registration.dispatchEvent(new Event('updatefound'));
  x.container.dispatchEvent(new Event('controllerchange'));
  assert.deepEqual(x.events, []);
});

test('reload resumes the same three-second cycle instead of starting another', () => {
  const startedAt = 1_000_000;
  assert.equal(startupRemaining(startedAt, startedAt + 1000), 2000);
  assert.equal(resumeStartup(String(startedAt), startedAt + 2500), startedAt);
  assert.equal(startupRemaining(resumeStartup(String(startedAt), startedAt + 3500), startedAt + 3500), 0);
  for (const invalid of [null, '', 'bad', '-1', String(startedAt + 10_000), String(startedAt - 61_000)]) assert.equal(resumeStartup(invalid, startedAt), null);
});
