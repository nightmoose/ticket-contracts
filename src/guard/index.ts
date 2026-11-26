import { ground } from './grounding';
import { maskText } from './pii';
import type { LoadedContract } from './contract';
import type { Evidence, GuardResult, GuardViolation, PiiFinding } from './types';

export { loadContract } from './contract';
export type { LoadedContract } from './contract';
export { maskText, luhn } from './pii';
export { findNumber, findString, ground } from './grounding';
export * from './types';

/**
 * Check one agent proposal against a contract and the ticket text.
 * Deterministic: no network, no model. The agent suggests; this decides.
 */
export function guardProposal(
  contract: LoadedContract,
  ticketText: string,
  proposal: Record<string, unknown>,
): GuardResult {
  const violations: GuardViolation[] = [];
  const evidence: Evidence[] = [];
  const pii: PiiFinding[] = [];
  const { ext } = contract;

  if (proposal === null || typeof proposal !== 'object' || Array.isArray(proposal)) {
    return {
      decision: 'held',
      contract: { name: contract.name, version: contract.version },
      violations: [{ check: 'contract', field: '<root>', kind: 'type_mismatch', message: 'Proposal must be a JSON object' }],
      evidence, pii, fields: {}, fieldStatus: {},
    };
  }

  // 1. Nullable fields: must be present; null is allowed and skipped by the contract check.
  const forValidation: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(proposal)) {
    if (v === null && ext.nullable.includes(k)) continue;
    forValidation[k] = v;
  }
  for (const f of ext.nullable) {
    if (!(f in proposal)) {
      violations.push({ check: 'nullable', field: f, kind: 'missing_required_field', message: `Required field '${f}' is missing (use null if the ticket has no value)` });
    }
  }

  // 2. ContractGate validation (types, enums, patterns, ranges, undeclared fields).
  const vr = contract.compiled.validate(forValidation);
  for (const v of vr.violations) violations.push({ check: 'contract', field: v.field, kind: v.kind, message: v.message });

  // 3. Cross-field rules.
  for (const r of ext.rules) {
    const val = proposal[r.field];
    if (val === null || val === undefined) continue;
    const unlessMet = Object.entries(r.null_unless).every(([k, want]) => proposal[k] === want);
    if (!unlessMet) {
      violations.push({ check: 'rule', field: r.field, kind: 'null_unless', message: r.message ?? `${r.field} must be null unless ${JSON.stringify(r.null_unless)}` });
    }
  }

  // 4. Grounding: ids and amounts must appear in the ticket text.
  const maskedTicket = maskText(ticketText, 'ticket_text', ext.pii.detectors);
  pii.push(...maskedTicket.findings);
  for (const f of ext.grounded) {
    const val = proposal[f];
    if (val === null || val === undefined) continue;
    const g = ground(ticketText, f, val);
    if (g.ok) {
      // Re-cut the snippet from masked text so evidence never carries raw PII.
      const m = maskText(g.evidence.snippet, f, ext.pii.detectors);
      evidence.push({ ...g.evidence, snippet: m.text });
    } else {
      violations.push({ check: 'grounding', field: f, kind: 'not_in_source', message: `${f} ${JSON.stringify(val)} does not appear in the ticket text` });
    }
  }

  // 5. PII masking on free-text fields (masking is applied, never a reason to hold).
  const fields: Record<string, unknown> = { ...proposal };
  const fieldStatus: GuardResult['fieldStatus'] = {};
  for (const k of Object.keys(proposal)) fieldStatus[k] = 'ok';
  for (const f of ext.pii.scan_fields) {
    const v = proposal[f];
    if (typeof v !== 'string') continue;
    const m = maskText(v, f, ext.pii.detectors);
    if (m.findings.length) {
      fields[f] = m.text;
      fieldStatus[f] = 'masked';
      pii.push(...m.findings);
    }
  }
  for (const v of violations) if (v.field in fieldStatus || v.check !== 'contract') fieldStatus[v.field] = 'held';

  return {
    decision: violations.length === 0 ? 'pass' : 'held',
    contract: { name: contract.name, version: contract.version },
    violations,
    evidence,
    pii,
    fields,
    fieldStatus,
  };
}
