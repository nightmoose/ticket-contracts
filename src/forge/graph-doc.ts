// Turns a Ticket Contracts decision record into a Teamwork Graph document object. Pure (no Forge
// imports), so it is unit-tested. The document deliberately carries NO ticket values: no field
// values, amounts, order refs, PII or evidence snippets. Only the decision, the contract, which
// fields passed/masked/held and which check failed. The values stay in the app's own storage.
import type { ProvenanceRecord } from './service';

export const DOC_TYPE = 'atlassian:document';
export const DOC_PREFIX = 'ticketgate-decision-';
/** Bump (0-99) when the document's wording changes, so re-pushing replaces existing documents. 1 = rename to Ticket Contracts. */
export const DOC_REVISION = 1;

export interface GraphDocument {
  schemaVersion: string;
  id: string;
  updateSequenceNumber: number;
  displayName: string;
  description: string;
  url: string;
  createdAt: string;
  lastUpdatedAt: string;
  permissions: { accessControls: { principals: { type: 'ATLASSIAN_WORKSPACE' }[] }[] }[];
  associations: { lastUpdatedAt: string; updateSequenceNumber: number; set: { associationType: string; values: string[] }[] };
  'atlassian:document': {
    type: { category: string; mimeType: string };
    content: { mimeType: string; text: string };
    labels: string[];
  };
}

export const docId = (recordId: string) => `${DOC_PREFIX}${recordId}`;

export function decisionText(r: ProvenanceRecord): string {
  const res = r.result;
  const by = (s: string) => Object.entries(res.fieldStatus).filter(([, v]) => v === s).map(([f]) => f);
  const lines = [
    `Ticket Contracts decision for ${r.issueKey}: ${r.status.toUpperCase()}.`,
    `Proposed by ${r.agent} via ${r.source} at ${r.at}, checked against contract ${res.contract.name}@${res.contract.version}.`,
  ];
  const passed = Object.keys(res.fieldStatus).filter((f) => res.fieldStatus[f] !== 'held');
  if (passed.length) lines.push(`Fields that passed: ${passed.join(', ')}.`);
  if (by('masked').length) lines.push(`PII masked before writing in: ${by('masked').join(', ')}.`);
  if (res.violations.length) {
    lines.push('Held because:');
    for (const v of res.violations) lines.push(`- ${v.field} failed the ${v.check} check`);
  }
  if (r.status === 'written') lines.push('The fields were written to the work item.');
  if (r.status === 'held') lines.push('Nothing was written; the proposal waits for a person to release or reject it.');
  if (r.resolvedBy) lines.push(`${r.status === 'released' ? 'Released' : 'Rejected'} by a person at ${r.resolvedAt}.`);
  return lines.join('\n');
}

export function decisionDocument(r: ProvenanceRecord, siteUrl: string): GraphDocument {
  const updated = r.resolvedAt ?? r.at;
  // Last write wins by sequence number: time-ordered, with the wording revision in the low digits.
  const seq = (Date.parse(updated) || Date.now()) * 100 + DOC_REVISION;
  return {
    schemaVersion: '2.0',
    id: docId(r.id),
    updateSequenceNumber: seq,
    displayName: `Ticket Contracts decision ${r.issueKey}: ${r.status}`,
    description: `${r.status.toUpperCase()} proposal from ${r.agent} for ${r.issueKey} (${r.result.violations.length} problem${r.result.violations.length === 1 ? '' : 's'})`,
    url: `${siteUrl.replace(/\/$/, '')}/browse/${encodeURIComponent(r.issueKey)}`,
    createdAt: r.at,
    lastUpdatedAt: updated,
    permissions: [{ accessControls: [{ principals: [{ type: 'ATLASSIAN_WORKSPACE' }] }] }],
    associations: { lastUpdatedAt: updated, updateSequenceNumber: seq, set: [{ associationType: 'issueIdOrKeys', values: [r.issueKey] }] },
    'atlassian:document': {
      type: { category: 'DOCUMENT', mimeType: 'text/plain' },
      content: { mimeType: 'text/plain', text: decisionText(r) },
      labels: ['ticket-contracts', `ticket-contracts-${r.status}`, r.result.contract.name],
    },
  };
}
