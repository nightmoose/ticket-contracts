import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agentReply, proposeFields, readTicket, resolveHeld } from '../src/forge/service';
import type { Deps, IssueSnapshot, ProvenanceRecord } from '../src/forge/service';
import { MemoryStore } from '../src/forge/memory-store';
import { decisionDocument, docId } from '../src/forge/graph-doc';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`../fixtures/tickets/${n}.json`, import.meta.url), 'utf8'));
const asIssue = (f: { ticket: { key: string; summary: string; description: string } }): IssueSnapshot => ({
  key: f.ticket.key, summary: f.ticket.summary,
  description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: f.ticket.description }] }] },
  comments: [],
});

function deps(issues: IssueSnapshot[], onRecord?: (r: ProvenanceRecord) => Promise<void>): Deps {
  let n = 0;
  return {
    async getIssue(k) { const i = issues.find((x) => x.key === k); if (!i) throw new Error('no issue'); return i; },
    async writeFields() {},
    store: new MemoryStore(),
    now: () => '2026-12-01T12:00:00.000Z',
    newId: () => `rec-${++n}`,
    onRecord,
  };
}

test('agentReply: held proposal explains each held field and says nothing was written', async () => {
  const bad = fx('es-refund-invented-order');
  const r = await proposeFields(deps([asIssue(bad)]), { issueKey: bad.ticket.key, fields: bad.proposal, agent: 'Ticket Intake' });
  const a = agentReply(r.record);
  assert.equal(a.decision, 'HELD');
  assert.deepEqual(a.written, []);
  assert.ok(a.held.some((h) => h.field === 'order_ref' && /does not appear/.test(h.reason)));
  assert.match(a.tellUser, /held this proposal, so nothing was written/);
  assert.match(a.tellUser, /order_ref/);
});

test('agentReply: written proposal lists fields and masked PII', async () => {
  const ok = fx('es-refund-pass');
  const r = await proposeFields(deps([asIssue(ok)]), { issueKey: ok.ticket.key, fields: ok.proposal, agent: 'Ticket Intake' });
  const a = agentReply(r.record);
  assert.equal(a.decision, 'WRITTEN');
  assert.ok(a.written.length >= 8);
  assert.deepEqual(a.held, []);
  assert.match(a.tellUser, /wrote \d+ fields/);
});

test('readTicket returns masked text and contract field rules', async () => {
  const ok = fx('es-refund-pass');
  const t = await readTicket(deps([asIssue(ok)]), { issueKey: ok.ticket.key });
  assert.equal(t.issueKey, ok.ticket.key);
  assert.ok(!/4242424242424242|4242 4242 4242 4242/.test(t.ticketText), 'card must be masked');
  const tier = t.fields.find((f) => f.name === 'customer_tier');
  assert.deepEqual(tier?.allowed, ['free', 'pro', 'enterprise']);
  assert.equal(t.fields.find((f) => f.name === 'order_ref')?.mustAppearInTicket, true);
  assert.match(t.instructions, /not the Jira key/);
});

test('onRecord fires for each decision and release; a failing hook never breaks the gate', async () => {
  const bad = fx('es-refund-invented-order');
  const seen: string[] = [];
  const d = deps([asIssue(bad)], async (r) => { seen.push(r.status); throw new Error('graph down'); });
  const r = await proposeFields(d, { issueKey: bad.ticket.key, fields: bad.proposal });
  await resolveHeld(d, { recordId: r.record.id, action: 'reject', by: 'acc-1' });
  assert.deepEqual(seen, ['held', 'rejected']);
});

test('graph document carries the decision but no ticket values or PII', async () => {
  const ok = fx('es-refund-pass');
  const bad = fx('es-refund-invented-order');
  const d = deps([asIssue(ok), asIssue(bad)]);
  const w = (await proposeFields(d, { issueKey: ok.ticket.key, fields: ok.proposal, agent: 'Ticket Intake', source: 'rovo' })).record;
  const h = (await proposeFields(d, { issueKey: bad.ticket.key, fields: bad.proposal, agent: 'Ticket Intake', source: 'rovo' })).record;
  for (const [rec, f] of [[w, ok], [h, bad]] as const) {
    const doc = decisionDocument(rec, 'https://example.atlassian.net/');
    assert.equal(doc.id, docId(rec.id));
    assert.equal(doc.url, `https://example.atlassian.net/browse/${rec.issueKey}`);
    assert.deepEqual(doc.associations.set, [{ associationType: 'issueIdOrKeys', values: [rec.issueKey] }]);
    assert.equal(doc.permissions[0].accessControls[0].principals[0].type, 'ATLASSIAN_WORKSPACE');
    const all = JSON.stringify(doc);
    for (const v of Object.values(f.proposal as Record<string, unknown>)) {
      if (v === null || typeof v === 'boolean') continue;
      if (typeof v === 'string' && ['free', 'pro', 'enterprise', 'billing', 'bug', 'access', 'en', 'es', 'fr'].includes(v)) continue;
      if (typeof v === 'number' && v < 10) continue; // severity
      assert.ok(!all.includes(String(v)), `graph doc leaked value ${v}`);
    }
    assert.ok(!/@[a-z-]+\.[a-z]{2,}|••|\d{4} ?\d{4}/i.test(doc['atlassian:document'].content.text));
  }
  assert.match(decisionDocument(h, 'https://x').displayName, /held/);
  assert.match(decisionDocument(h, 'https://x')['atlassian:document'].content.text, /order_ref failed the grounding check/);
});

test('read-before-propose: readId from readTicket is accepted, a made-up or missing one is refused', async () => {
  const ok = fx('es-refund-pass');
  const d = deps([asIssue(ok)]);
  const { checkRead, readFirstReply } = await import('../src/forge/service');
  assert.match(String(await checkRead(d, ok.ticket.key, undefined)), /no readId/);
  assert.match(String(await checkRead(d, ok.ticket.key, 'abc-made-up')), /no readId/);
  const t = await readTicket(d, { issueKey: ok.ticket.key });
  assert.equal(await checkRead(d, ok.ticket.key, t.readId), null);
  assert.match(String(await checkRead(d, 'OTHER-1', t.readId)), /no readId/);
  const r = readFirstReply(ok.ticket.key, 'x');
  assert.equal(r.decision, 'NOT_CHECKED');
  assert.match(r.nextStep, /read-ticket-for-fields/);
});

test('a later written decision supersedes an earlier held one: shown first, out of the review queue', async () => {
  const { issueState, listHeld, explainHold } = await import('../src/forge/service');
  const bad = fx('es-refund-invented-order');
  const good = fx('es-refund-fixed');
  let t = 0;
  const d = deps([asIssue(bad)]);
  d.now = () => new Date(Date.UTC(2026, 11, 1, 12, 0, t++)).toISOString();
  const h = (await proposeFields(d, { issueKey: bad.ticket.key, fields: bad.proposal })).record;
  assert.equal((await listHeld(d)).length, 1);
  const w = (await proposeFields(d, { issueKey: bad.ticket.key, fields: good.proposal })).record;
  const st = await issueState(d, bad.ticket.key);
  assert.equal(st.records[0].id, w.id);
  assert.equal((st.records[1] as { supersededBy?: string }).supersededBy, w.id);
  assert.equal(h.status, 'held');
  assert.equal((await listHeld(d)).length, 0);
  assert.match(await explainHold(d, { issueKey: bad.ticket.key }), /latest Ticket Contracts decision is WRITTEN/);
});
