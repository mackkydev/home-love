import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/pin-errors.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } });
const { pinError } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('PIN errors display PostgREST messages rather than object coercion', () => {
  assert.equal(pinError({ message: 'Request failed', code: 'XX000' }, 'en'), 'Request failed');
  assert.equal(pinError(new Error('Session expired'), 'en'), 'Session expired');
  for (const cause of [{}, null, undefined, '[object Object]', { message: {} }]) {
    assert.equal(pinError(cause, 'th'), 'ใช้งานระบบ PIN ไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
});

test('missing PIN RPCs and crypto functions explain the database update', () => {
  for (const code of ['PGRST202', '42P01', '42883']) {
    assert.match(pinError({ code, message: 'Missing resource' }, 'th'), /อัปเดตฐานข้อมูล PIN/);
    assert.match(pinError({ code }, 'en'), /database update/);
  }
  assert.match(pinError({ message: 'PIN temporarily locked. Try again in 15 minutes' }, 'th'), /15 นาที/);
});
