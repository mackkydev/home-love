import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';
const { mobileViewport } = loadTs('src/lib/mobile-viewport.ts', {});

test('keyboard-open layout follows the visible area without extending behind the keyboard', () => {
  assert.deepEqual(mobileViewport({ innerHeight: 844, visualHeight: 500, offsetTop: 40, editing: true }), { height: 500, top: 40 });
});
test('keyboard dismissal recovers full height even while iOS reports the previous visual height', () => {
  assert.deepEqual(mobileViewport({ innerHeight: 844, visualHeight: 760, offsetTop: 84, editing: false }), { height: 844, top: 0 });
  assert.deepEqual(mobileViewport({ innerHeight: 760, visualHeight: 844, editing: false }), { height: 844, top: 0 });
});
test('viewport updates preserve pinch zoom and work without VisualViewport', () => {
  assert.equal(mobileViewport({ innerHeight: 844, visualHeight: 422, scale: 2, editing: false }), null);
  assert.deepEqual(mobileViewport({ innerHeight: 844, editing: false }), { height: 844, top: 0 });
  assert.equal(mobileViewport({ innerHeight: 0, editing: false }), null);
});
