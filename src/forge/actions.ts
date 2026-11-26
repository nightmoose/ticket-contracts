// Rovo action handlers. The same actions back the Rovo agent and the rovo:mcp tools.
import { agentReply, checkRead, explainHold, listHeld, proposeFields, readFirstReply, readTicket, validateOnly } from './service';
import { forgeDeps } from './forge-deps';

interface ActionPayload {
  issueKey?: string;
  fields?: string;
  agentName?: string;
  recordId?: string;
  readId?: string;
  context?: { jira?: { issueKey?: string }; [k: string]: unknown };
  [k: string]: unknown;
}

function issueKeyOf(p: ActionPayload): string {
  const key = p.issueKey || p.context?.jira?.issueKey;
  if (!key) throw new Error('issueKey is required (open the work item or pass its key, e.g. SUP-42)');
  return String(key).trim().toUpperCase();
}

function sourceOf(p: ActionPayload): 'rovo' | 'mcp' {
  // MCP calls carry no Rovo surface context; agent calls from Jira do.
  return p.context && Object.keys(p.context).length ? 'rovo' : 'mcp';
}

async function safe<T>(fn: () => Promise<T>): Promise<T | string> {
  try {
    return await fn();
  } catch (e) {
    return `Ticket Contracts error: ${(e as Error).message}`;
  }
}

export const readTicketForFields = (p: ActionPayload) =>
  safe(async () => {
    const r = await readTicket(forgeDeps, { issueKey: issueKeyOf(p) });
    console.log(`ticket-contracts read ${r.issueKey}`);
    return r;
  });

// Proposals must follow a read-ticket-for-fields call for the same work item (enforced, not just
// prompted): an agent that skips the read gets NOT_CHECKED and nothing is written or recorded.
export const proposeTicketFields = (p: ActionPayload) =>
  safe(async () => {
    const issueKey = issueKeyOf(p);
    const notRead = await checkRead(forgeDeps, issueKey, p.readId);
    if (notRead) {
      console.log(`ticket-contracts propose refused ${issueKey}: ${notRead}`);
      return readFirstReply(issueKey, notRead);
    }
    return agentReply((await proposeFields(forgeDeps, { issueKey, fields: p.fields, agent: p.agentName, source: sourceOf(p) })).record);
  });

export const checkTicketFields = (p: ActionPayload) =>
  safe(async () => {
    const r = await validateOnly(forgeDeps, { issueKey: issueKeyOf(p), fields: p.fields });
    return {
      decision: r.decision === 'pass' ? 'WOULD_PASS' : 'WOULD_BE_HELD',
      written: [],
      held: r.violations.map((v) => ({ field: v.field, check: v.check, reason: v.message })),
      tellUser: r.decision === 'pass'
        ? 'Dry run: this proposal would pass. Nothing was written.'
        : `Dry run: this proposal would be held. ${r.violations.map((v) => `${v.field}: ${v.message}`).join('; ')}. Nothing was written.`,
    };
  });

export const explainTicketHold = (p: ActionPayload) =>
  safe(() => explainHold(forgeDeps, { issueKey: p.recordId ? undefined : issueKeyOf(p), recordId: p.recordId }));

export const listHeldProposals = (p: ActionPayload) =>
  safe(async () => {
    const held = await listHeld(forgeDeps, { issueKey: p.issueKey ? issueKeyOf(p) : undefined });
    if (!held.length) return 'No held proposals.';
    return held.map((h) => `${h.issueKey} (${h.agent}, ${h.at}, record ${h.id}): ${h.reasons.join('; ')}`).join('\n');
  });
