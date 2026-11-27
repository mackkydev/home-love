import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const { appendPinDigit, erasePinDigit, isCompletePin } = loadTs('src/lib/pin-input.ts', {});
test('the PIN pad preserves leading zeroes and caps input at six digits', () => {
  let value = '';
  for (const digit of '0012345') value = appendPinDigit(value, digit);
  assert.equal(value, '001234');
  assert.equal(isCompletePin(value), true);
});
test('non-digits, pasted multi-digit strings and malformed input are rejected', () => {
  for (const digit of ['x', '', '12', ' ', '-', '๑']) assert.equal(appendPinDigit('12', digit), '12');
  assert.equal(appendPinDigit('12x', '3'), '12x');
  for (const value of ['', '12345', '1234567', 'abcdef', '๑๒๓๔๕๖']) assert.equal(isCompletePin(value), false);
});
test('backspace lets the user correct a digit without changing the prefix', () => {
  assert.equal(erasePinDigit('001234'), '00123');
  assert.equal(appendPinDigit(erasePinDigit('001234'), '9'), '001239');
  assert.equal(erasePinDigit(''), '');
});
