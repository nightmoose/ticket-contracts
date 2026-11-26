import { test } from 'node:test';
import assert from 'node:assert/strict';
import { luhn, maskText } from '../src/guard';

test('luhn accepts valid test cards and rejects near misses', () => {
  assert.ok(luhn('4242424242424242'));
  assert.ok(luhn('5555555555554444'));
  assert.ok(!luhn('4242424242424241'));
  assert.ok(!luhn('123456789012'));
});

test('masks email, card, phone, iban and reports each', () => {
  const src = 'Mail ana@example.org, card 5555-5555-5555-4444, tel +1 (415) 555-0134, IBAN DE89 3704 0044 0532 0130 00.';
  const { text, findings } = maskText(src, 'summary');
  assert.deepEqual(findings.map((f) => f.kind).sort(), ['card', 'email', 'iban', 'phone']);
  assert.match(text, /a\*\*\*@example\.org/);
  assert.match(text, /\[card ••4444\]/);
  assert.match(text, /\[phone ••34\]/);
  assert.match(text, /\[iban ••3000\]/);
  assert.doesNotMatch(text, /5555-5555|555-0134|3704 0044/);
});

test('does not mask ids, order refs, dates, amounts or non-Luhn digit runs', () => {
  const src = 'Ticket T-8841, order ORD-204611, on 2026-11-25, refund 1.249,50 EUR, ref 1234567890123.';
  const { text, findings } = maskText(src, 'summary');
  assert.equal(findings.length, 0, JSON.stringify(findings));
  assert.equal(text, src);
});

test('detectors can be limited per contract', () => {
  const { findings } = maskText('ana@example.org +34 612 345 678', 'x', ['email']);
  assert.deepEqual(findings.map((f) => f.kind), ['email']);
});
