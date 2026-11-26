export type CheckKind = 'contract' | 'rule' | 'grounding' | 'nullable';

export interface GuardViolation {
  check: CheckKind;
  field: string;
  kind: string;
  message: string;
}

export interface Evidence {
  field: string;
  value: string | number;
  /** Character offset of the match in the ticket text. */
  index: number;
  /** Short window of ticket text around the match, already PII-masked. */
  snippet: string;
}

export type PiiKind = 'email' | 'phone' | 'card' | 'iban';

export interface PiiFinding {
  kind: PiiKind;
  /** Where it was found: a proposal field name, or "ticket_text". */
  where: string;
  masked: string;
}

export type Decision = 'pass' | 'held';

export interface GuardResult {
  decision: Decision;
  contract: { name: string; version: string };
  violations: GuardViolation[];
  evidence: Evidence[];
  pii: PiiFinding[];
  /** The proposal with PII masked. Only safe to write when decision === 'pass'. */
  fields: Record<string, unknown>;
  /** Per-field status, for the issue panel. */
  fieldStatus: Record<string, 'ok' | 'held' | 'masked'>;
}

export interface TicketGateExtension {
  nullable: string[];
  grounded: string[];
  rules: NullUnlessRule[];
  pii: { scan_fields: string[]; detectors: PiiKind[] };
}

export interface NullUnlessRule {
  field: string;
  null_unless: Record<string, unknown>;
  message?: string;
}
