import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { guardProposal, loadContract } from '../src/guard';
import { ticketText } from '../src/guard/adf';
import { CONTRACTS } from '../src/contracts.generated';

const contract = loadContract(CONTRACTS['support_ticket']);
const dir = new URL('../fixtures/tickets/', import.meta.url);

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const fx = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  test(`fixture ${file}: ${fx.name}`, () => {
    const text = ticketText(fx.ticket.summary, fx.ticket.description);
    const r = guardProposal(contract, text, fx.proposal);
    assert.equal(r.decision, fx.expect.decision, JSON.stringify(r.violations, null, 2));
    const got = r.violations.map((v) => `${v.check}:${v.field}`).sort();
    const want = fx.expect.violations.map((v: { check: string; field: string }) => `${v.check}:${v.field}`).sort();
    assert.deepEqual(got, want);
    if (fx.expect.pii) {
      const kinds = [...new Set(r.pii.filter((p) => p.where !== 'ticket_text').map((p) => p.kind))].sort();
      assert.deepEqual(kinds, [...fx.expect.pii].sort());
    }
    for (const f of fx.expect.maskedFields ?? []) assert.equal(r.fieldStatus[f], 'masked');
    // Nothing the guard returns may carry raw PII from the ticket.
    const out = JSON.stringify({ fields: r.fields, evidence: r.evidence, pii: r.pii });
    assert.doesNotMatch(out, /4242 4242 4242 4242|612 345 678|lucia\.moreno@/);
    if (r.decision === 'pass') {
      for (const f of contract.ext.grounded) {
        if (fx.proposal[f] != null) assert.ok(r.evidence.some((e) => e.field === f), `evidence for ${f}`);
      }
    }
  });
}

test('evidence snippets never contain partial card or phone digits', () => {
  const text = 'Refund 25.00 USD please. Card 4242 4242 4242 4242 and phone +34 612 345 678, ticket T-1.';
  const r = guardProposal(contract, text, {
    ticket_id: 'T-1', customer_tier: 'pro', category: 'billing', severity: 2,
    order_ref: null, refund_amount_usd: 25, language: 'en', summary: 'Refund request.',
  });
  assert.equal(r.decision, 'pass');
  const snippets = r.evidence.map((e) => e.snippet).join(' | ');
  assert.doesNotMatch(snippets, /4242 4242|612 345|345 678/);
  assert.match(snippets, /\[card ••/);
});
