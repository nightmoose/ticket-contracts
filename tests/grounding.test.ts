import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNumber, findString, ground } from '../src/guard';
import { readings } from '../src/guard/grounding';

test('strings match ignoring case and punctuation, on token boundaries', () => {
  assert.ok(findString('pedido ord 204611 duplicado', 'ORD-204611') >= 0);
  assert.equal(findString('pedido ORD-2046119', 'ORD-204611'), -1);
  assert.equal(findString('pedido XORD-204611', 'ORD-204611'), -1);
  assert.equal(findString('nothing here', 'ORD-123456'), -1);
});

test('numbers match in both decimal conventions and ignore digits inside ids', () => {
  assert.deepEqual(readings('1.249,50'), [1249.5]);
  assert.deepEqual(readings('1,249.50'), [1249.5]);
  assert.ok(findNumber('devuélvanme 49,90 USD', 49.9) >= 0);
  assert.ok(findNumber('refund $19.00 please', 19) >= 0);
  assert.equal(findNumber('order ORD-900123', 900), -1);
  assert.equal(findNumber('ticket T-900', 900), -1);
  assert.equal(findNumber('refund 19.00', 190), -1);
});

test('ground returns a snippet around the evidence', () => {
  const g = ground('Hola. Me cobraron dos veces el pedido ORD-204611, gracias.', 'order_ref', 'ORD-204611');
  assert.ok(g.ok);
  if (g.ok) assert.match(g.evidence.snippet, /ORD-204611/);
  assert.equal(ground('x', 'f', { a: 1 }).ok, false);
});
