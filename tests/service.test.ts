import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explainHold, issueState, listHeld, proposeFields, resolveHeld, scanIssue, validateOnly } from '../src/forge/service';
import type { Deps, IssueSnapshot, ProvenanceRecord } from '../src/forge/service';
import { MemoryStore } from '../src/forge/memory-store';

function fixture(name: string) {
  return JSON.parse(readFileSync(new URL(`../fixtures/tickets/${name}.json`, import.meta.url), 'utf8'));
}

function makeDeps(issues: IssueSnapshot[]) {
  const writes: { key: string; fields: Record<string, unknown>; status: string }[] = [];
  let n = 0;
  let t = 0;
  const deps: Deps = {
    async getIssue(key) {
      const i = issues.find((x) => x.key === key);
      if (!i) throw new Error(`no issue ${key}`);
      return i;
    },
    async writeFields(key, fields, rec: ProvenanceRecord) { writes.push({ key, fields, status: rec.status }); },
    store: new MemoryStore(),
    now: () => new Date(Date.UTC(2026, 11, 1, 12, 0, t++)).toISOString(),
    newId: () => `rec-${++n}`,
  };
  return { deps, writes };
}

const asIssue = (fx: { ticket: { key: string; summary: string; description: string } }): IssueSnapshot => ({
  key: fx.ticket.key, summary: fx.ticket.summary,
  description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: fx.ticket.description }] }] },
  comments: [],
});

test('demo story: invented order ref is held, nothing written; corrected proposal is written', async () => {
  const bad = fixture('es-refund-invented-order');
  const good = fixture('es-refund-fixed');
  const { deps, writes } = makeDeps([asIssue(bad)]);

  const r1 = await proposeFields(deps, { issueKey: 'SUP-43', fields: JSON.stringify(bad.proposal), agent: 'Ticket Intake', source: 'rovo' });
  assert.equal(r1.decision, 'held');
  assert.match(r1.message, /HELD: nothing was written/);
  assert.match(r1.message, /order_ref "ORD-123456" does not appear/);
  assert.equal(writes.length, 0);
  assert.equal((await listHeld(deps)).length, 1);

  const why = await explainHold(deps, { issueKey: 'SUP-43' });
  assert.match(why, /Ticket Intake \(rovo\).*HELD/);

  const r2 = await proposeFields(deps, { issueKey: 'SUP-43', fields: good.proposal, agent: 'Ticket Intake', source: 'rovo' });
  assert.equal(r2.decision, 'pass');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].fields['order_ref'], null);

  const st = await issueState(deps, 'SUP-43');
  assert.deepEqual(st.records.map((r) => r.status), ['written', 'held']);
});

test('PII is masked in what gets written and in the stored record', async () => {
  const fx = fixture('es-refund-pass');
  const { deps, writes } = makeDeps([asIssue(fx)]);
  const r = await proposeFields(deps, { issueKey: 'SUP-42', fields: fx.proposal, agent: 'mcp-client', source: 'mcp' });
  assert.equal(r.decision, 'pass');
  assert.match(String(writes[0].fields['summary']), /\[card ••4242\]/);
  const stored = JSON.stringify(await (deps.store as MemoryStore).getRecord(r.record.id));
  assert.doesNotMatch(stored, /4242 4242 4242 4242|612 345 678|lucia\.moreno@example\.com/);
});

test('release writes only the fields that passed; reject writes nothing; double resolve fails', async () => {
  const fx = fixture('off-enum-and-undeclared');
  const { deps, writes } = makeDeps([asIssue(fx)]);
  const r = await proposeFields(deps, { issueKey: 'SUP-46', fields: fx.proposal, agent: 'Studio agent' });
  assert.equal(r.decision, 'held');
  const rel = await resolveHeld(deps, { recordId: r.record.id, action: 'release', by: 'acc-1' });
  assert.equal(rel.status, 'released');
  assert.equal(writes.length, 1);
  assert.ok(!('customer_tier' in writes[0].fields));
  assert.ok(!('assignee' in writes[0].fields));
  assert.equal(writes[0].fields['category'], 'access');
  await assert.rejects(resolveHeld(deps, { recordId: r.record.id, action: 'reject', by: 'acc-1' }), /already released/);
  assert.equal((await listHeld(deps)).length, 0);
});

test('validateOnly never writes or stores', async () => {
  const fx = fixture('injection-amount');
  const { deps, writes } = makeDeps([asIssue(fx)]);
  const r = await validateOnly(deps, { issueKey: 'SUP-48', fields: fx.proposal });
  assert.equal(r.decision, 'held');
  assert.equal(writes.length, 0);
  assert.equal((deps.store as MemoryStore).records.size, 0);
});

test('bad fields input gives a readable error', async () => {
  const fx = fixture('es-refund-pass');
  const { deps } = makeDeps([asIssue(fx)]);
  await assert.rejects(proposeFields(deps, { issueKey: 'SUP-42', fields: '{not json' }), /JSON object string/);
});

test('scanIssue records masked PII kinds only', async () => {
  const fx = fixture('es-refund-pass');
  const { deps } = makeDeps([asIssue(fx)]);
  const f = await scanIssue(deps, 'SUP-42');
  assert.deepEqual([...new Set(f.map((x) => x.kind))].sort(), ['card', 'email', 'phone']);
  assert.doesNotMatch(JSON.stringify(f), /lucia\.moreno@|4242 4242 4242 4242/);
});

test('admin-edited contract overrides the bundled one', async () => {
  const fx = fixture('off-enum-and-undeclared');
  const { deps } = makeDeps([asIssue(fx)]);
  const { CONTRACTS } = await import('../src/contracts.generated');
  const edited = CONTRACTS['support_ticket'].replace('enum: [free, pro, enterprise]', 'enum: [free, pro, enterprise, gold]').replace('version: "1.0.0"', 'version: "1.1.0"');
  await (deps.store as MemoryStore).contracts.set('support_ticket', edited);
  const r = await validateOnly(deps, { issueKey: 'SUP-46', fields: fx.proposal });
  assert.equal(r.contract.version, '1.1.0');
  assert.deepEqual(r.violations.map((v) => v.field), ['assignee']);
});
