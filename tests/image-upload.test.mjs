import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const jpeg = bytes => 'data:image/jpeg;base64,' + Buffer.alloc(bytes, 1).toString('base64');
function environment({ bitmap, failImage = false, canvasAvailable = true, bytes } = {}) {
  const draws = [], dimensions = [], revoked = [];
  let canvas;
  class Photo {
    naturalWidth = 4000;
    naturalHeight = 3000;
    set src(value) { this.source = value; queueMicrotask(() => failImage ? this.onerror?.() : this.onload?.()); }
  }
  const globals = {
    createImageBitmap: bitmap,
    Image: Photo,
    URL: { createObjectURL: () => 'blob:local-photo', revokeObjectURL: value => revoked.push(value) },
    document: { createElement: () => {
      canvas = { width: 0, height: 0, getContext: () => canvasAvailable ? { fillRect() {}, drawImage: (...args) => draws.push(args) } : null,
        toDataURL: (_format, quality) => { dimensions.push([canvas.width, canvas.height, quality]); return jpeg(bytes ?? Math.ceil(canvas.width * canvas.height * quality * .3)); } };
      return canvas;
    } },
  };
  return { globals, draws, dimensions, revoked };
}
const file = { name: 'camera.jpg', type: 'image/jpeg', size: 25 * 1024 * 1024 };

test('byte budget counts decoded image bytes and excludes the data URL prefix', () => {
  const { dataUrlBytes } = loadTs('src/lib/image-upload.ts', {});
  for (const size of [1, 2, 3, 10, 1024]) assert.equal(dataUrlBytes(jpeg(size)), size);
});

test('large photos are progressively resized to fit the byte budget while preserving aspect ratio', () => {
  const env = environment();
  const { encodeJpeg, dataUrlBytes } = loadTs('src/lib/image-upload.ts', {}, env.globals);
  const output = encodeJpeg({}, { x: 10, y: 20, width: 1920, height: 1080 }, 1280, 12000);
  assert.ok(dataUrlBytes(output) <= 12000);
  assert.ok(env.dimensions.length > 1);
  for (const [width, height] of env.dimensions) {
    assert.ok(width <= 1280);
    assert.ok(Math.abs(height - width * 1080 / 1920) <= .5);
  }
  assert.deepEqual(env.draws[0].slice(1, 5), [10, 20, 1920, 1080]);
});

test('Safari fallback accepts a large original and makes a centered square profile image', async () => {
  const env = environment({ bytes: 100 });
  const { compressPhoto } = loadTs('src/lib/image-upload.ts', {}, env.globals);
  const output = await compressPhoto(file, 1024, { maxWidth: 512, aspect: 1 });
  assert.equal(output, jpeg(100));
  assert.deepEqual(env.draws[0].slice(1, 5), [500, 0, 3000, 3000]);
  assert.deepEqual(env.dimensions[0].slice(0, 2), [512, 512]);
  assert.deepEqual(env.revoked, ['blob:local-photo']);
});

test('bitmap decode failure falls back to the browser image decoder', async () => {
  const env = environment({ bytes: 100, bitmap: async () => { throw new Error('unsupported decoder'); } });
  const { compressPhoto } = loadTs('src/lib/image-upload.ts', {}, env.globals);
  await compressPhoto({ ...file, name: 'camera.heic', type: 'image/heic' });
  assert.equal(env.draws.length, 1);
  assert.deepEqual(env.revoked, ['blob:local-photo']);
});

test('decoded bitmaps are closed even when canvas encoding fails', async () => {
  let closed = 0;
  const env = environment({ canvasAvailable: false, bitmap: async () => ({ width: 300, height: 400, close() { closed += 1; } }) });
  const { compressPhoto } = loadTs('src/lib/image-upload.ts', {}, env.globals);
  await assert.rejects(compressPhoto(file), /Canvas/);
  assert.equal(closed, 1);
  assert.deepEqual(env.revoked, []);
});

test('unreadable photos release object URLs and cannot reach upload', async () => {
  const env = environment({ failImage: true });
  const { compressPhoto } = loadTs('src/lib/image-upload.ts', {}, env.globals);
  await assert.rejects(compressPhoto(file), /decode/);
  assert.equal(env.draws.length, 0);
  assert.deepEqual(env.revoked, ['blob:local-photo']);
});

test('impossible byte limits fail after bounded attempts; small images are not enlarged', () => {
  const env = environment({ bytes: 100 });
  const { encodeJpeg } = loadTs('src/lib/image-upload.ts', {}, env.globals);
  assert.throws(() => encodeJpeg({}, { x: 0, y: 0, width: 100, height: 100 }, 1280, 1), /resize/);
  assert.equal(env.dimensions.length, 12);
  assert.deepEqual(env.dimensions[0].slice(0, 2), [100, 100]);
});
