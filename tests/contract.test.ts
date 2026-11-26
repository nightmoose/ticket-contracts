import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardProposal, loadContract } from '../src/guard';
import { adfToText } from '../src/guard/adf';
import { CONTRACTS } from '../src/contracts.generated';
import { readFileSync } from 'node:fs';

test('generated contracts match contracts/*.yaml', () => {
  const yaml = readFileSync(new URL('../contracts/support_ticket.yaml', import.meta.url), 'utf8');
  assert.equal(CONTRACTS['support_ticket'], yaml, 'run npm run gen:contracts');
});

test('support_ticket contract loads with its Ticket Contracts block', () => {
  const c = loadContract(CONTRACTS['support_ticket']);
  assert.equal(c.name, 'support_ticket');
  assert.deepEqual(c.ext.grounded, ['ticket_id', 'order_ref', 'refund_amount_usd']);
});

test('ticket_contracts block naming an undeclared field is rejected', () => {
  const bad = CONTRACTS['support_ticket'].replace('grounded: [ticket_id,', 'grounded: [nope, ticket_id,');
  assert.throws(() => loadContract(bad), /undeclared field 'nope'/);
});

test('non-object proposal is held', () => {
  const c = loadContract(CONTRACTS['support_ticket']);
  const r = guardProposal(c, 'text', [] as unknown as Record<string, unknown>);
  assert.equal(r.decision, 'held');
});

test('adfToText flattens a Jira description', () => {
  const adf = { type: 'doc', version: 1, content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Pedido ' }, { type: 'text', text: 'ORD-204611', marks: [{ type: 'strong' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Gracias' }, { type: 'hardBreak' }, { type: 'text', text: 'Lucía' }] },
  ] };
  assert.equal(adfToText(adf), 'Pedido ORD-204611\nGracias\nLucía\n');
});
