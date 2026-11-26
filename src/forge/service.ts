// Orchestration between Jira, storage and the guard. No Forge imports here, so it is unit-tested
// with in-memory fakes (tests/service.test.ts). Forge wiring lives in ./forge-deps.ts.
import { guardProposal, loadContract, maskText } from '../guard';
import type { GuardResult, LoadedContract, PiiFinding } from '../guard';
import { ticketText } from '../guard/adf';
import { CONTRACTS } from '../contracts.generated';

export const DEFAULT_CONTRACT = 'support_ticket';

export interface IssueSnapshot {
  key: string;
  summary: string;
  description: unknown;
  comments: unknown[];
}

export type RecordStatus = 'written' | 'held' | 'released' | 'rejected';

export interface ProvenanceRecord {
  id: string;
  issueKey: string;
  agent: string;
  source: 'rovo' | 'mcp' | 'panel' | 'api';
  at: string;
  status: RecordStatus;
  result: GuardResult;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface Store {
  saveRecord(r: ProvenanceRecord): Promise<void>;
  getRecord(id: string): Promise<ProvenanceRecord | undefined>;
  issueRecords(issueKey: string): Promise<ProvenanceRecord[]>;
  heldRecords(): Promise<ProvenanceRecord[]>;
  getContractSource(name: string): Promise<string | undefined>;
  saveScan(issueKey: string, pii: PiiFinding[], at: string): Promise<void>;
  getScan(issueKey: string): Promise<{ pii: PiiFinding[]; at: string } | undefined>;
}

export interface Deps {
  getIssue(key: string): Promise<IssueSnapshot>;
  /** Write accepted (already masked) fields onto the issue. */
  writeFields(issueKey: string, fields: Record<string, unknown>, record: ProvenanceRecord): Promise<void>;
  store: Store;
  now(): string;
  newId(): string;
}

export async function getContract(deps: Deps, name = DEFAULT_CONTRACT): Promise<LoadedContract> {
  const custom = await deps.store.getContractSource(name);
  const src = custom ?? CONTRACTS[name];
  if (!src) throw new Error(`Unknown contract '${name}'`);
  return loadContract(src);
}

export function parseFields(input: unknown): Record<string, unknown> {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      throw new Error('fields must be a JSON object string, e.g. {"category":"billing"}');
    }
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  throw new Error('fields must be a JSON object');
}

export function summarize(r: ProvenanceRecord): string {
  const res = r.result;
  if (r.status === 'written') {
    const masked = Object.entries(res.fieldStatus).filter(([, s]) => s === 'masked').map(([f]) => f);
    return `PASS: wrote ${Object.keys(res.fields).length} fields to ${r.issueKey} (contract ${res.contract.name}@${res.contract.version})` +
      (masked.length ? `; PII masked in ${masked.join(', ')}` : '') + `. Record ${r.id}.`;
  }
  const reasons = res.violations.map((v) => `- ${v.field}: ${v.message}`).join('\n');
  return `HELD: nothing was written to ${r.issueKey}. Fix these and propose again, using null for values the ticket does not contain:\n${reasons}\nRecord ${r.id}.`;
}

/** The one write path. Every agent proposal for an issue goes through here. */
export async function proposeFields(
  deps: Deps,
  args: { issueKey: string; fields: unknown; agent?: string; source?: ProvenanceRecord['source']; contract?: string },
): Promise<{ decision: GuardResult['decision']; message: string; record: ProvenanceRecord }> {
  if (!args.issueKey) throw new Error('issueKey is required');
  const proposal = parseFields(args.fields);
  const [issue, contract] = await Promise.all([deps.getIssue(args.issueKey), getContract(deps, args.contract)]);
  const text = ticketText(issue.summary, issue.description, issue.comments);
  const result = guardProposal(contract, text, proposal);
  const record: ProvenanceRecord = {
    id: deps.newId(),
    issueKey: issue.key,
    agent: args.agent?.trim() || 'unknown-agent',
    source: args.source ?? 'api',
    at: deps.now(),
    status: result.decision === 'pass' ? 'written' : 'held',
    result,
  };
  if (record.status === 'written') await deps.writeFields(issue.key, result.fields, record);
  await deps.store.saveRecord(record);
  return { decision: result.decision, message: summarize(record), record };
}

/** Check without writing anything (for agents that want to self-correct first). */
export async function validateOnly(deps: Deps, args: { issueKey: string; fields: unknown; contract?: string }) {
  const proposal = parseFields(args.fields);
  const [issue, contract] = await Promise.all([deps.getIssue(args.issueKey), getContract(deps, args.contract)]);
  return guardProposal(contract, ticketText(issue.summary, issue.description, issue.comments), proposal);
}

export async function explainHold(deps: Deps, args: { issueKey?: string; recordId?: string }): Promise<string> {
  let rec: ProvenanceRecord | undefined;
  if (args.recordId) rec = await deps.store.getRecord(args.recordId);
  else if (args.issueKey) rec = (await deps.store.issueRecords(args.issueKey)).find((r) => r.status === 'held' || r.status === 'rejected');
  if (!rec) return args.issueKey ? `No held TicketGate proposals for ${args.issueKey}.` : 'Record not found.';
  const res = rec.result;
  const lines = [
    `${rec.issueKey}: proposal from ${rec.agent} (${rec.source}) at ${rec.at} was ${rec.status.toUpperCase()} under contract ${res.contract.name}@${res.contract.version}.`,
    ...res.violations.map((v) => `- [${v.check}] ${v.field}: ${v.message}`),
  ];
  if (res.evidence.length) lines.push('Grounded values:', ...res.evidence.map((e) => `- ${e.field} = ${JSON.stringify(e.value)} found in: "${e.snippet}"`));
  if (rec.resolvedBy) lines.push(`Resolved by ${rec.resolvedBy} at ${rec.resolvedAt}.`);
  return lines.join('\n');
}

export async function listHeld(deps: Deps, args: { issueKey?: string } = {}) {
  const held = (await deps.store.heldRecords()).filter((r) => r.status === 'held' && (!args.issueKey || r.issueKey === args.issueKey));
  return held.map((r) => ({ id: r.id, issueKey: r.issueKey, agent: r.agent, at: r.at, reasons: r.result.violations.map((v) => `${v.field}: ${v.message}`) }));
}

/** A person releases (writes anyway, still masked) or rejects a held proposal. */
export async function resolveHeld(deps: Deps, args: { recordId: string; action: 'release' | 'reject'; by: string }) {
  const rec = await deps.store.getRecord(args.recordId);
  if (!rec) throw new Error('Record not found');
  if (rec.status !== 'held') throw new Error(`Record is already ${rec.status}`);
  const updated: ProvenanceRecord = { ...rec, status: args.action === 'release' ? 'released' : 'rejected', resolvedBy: args.by, resolvedAt: deps.now() };
  if (args.action === 'release') {
    // Release writes only fields that passed their own checks; held fields stay out.
    const safe = Object.fromEntries(Object.entries(rec.result.fields).filter(([f]) => rec.result.fieldStatus[f] !== 'held'));
    await deps.writeFields(rec.issueKey, safe, updated);
  }
  await deps.store.saveRecord(updated);
  return updated;
}

/** On issue creation: note which PII kinds the ticket contains (masked), without touching the issue. */
export async function scanIssue(deps: Deps, issueKey: string) {
  const issue = await deps.getIssue(issueKey);
  const contract = await getContract(deps);
  const { findings } = maskText(ticketText(issue.summary, issue.description, issue.comments), 'ticket_text', contract.ext.pii.detectors);
  await deps.store.saveScan(issueKey, findings, deps.now());
  return findings;
}

export async function issueState(deps: Deps, issueKey: string) {
  const [records, scan] = await Promise.all([deps.store.issueRecords(issueKey), deps.store.getScan(issueKey)]);
  return { issueKey, records, scan: scan ?? null };
}
