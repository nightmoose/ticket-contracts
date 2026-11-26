// Development-only diagnostic web trigger. Exercises the real write path (Jira REST + KVS) without
// Rovo, so a deploy can be smoke-tested from a script. Requires the TG_SELFTEST_KEY Forge variable;
// with no key set it refuses every request. Not part of the production feature set.
import { explainHold, issueState, proposeFields, scanIssue } from './service';
import { forgeDeps } from './forge-deps';
import { graph } from '@forge/teamwork-graph';
import { backfill, graphGet, graphStatus } from './graph-sync';
import { agentReply, readTicket } from './service';

interface WebTriggerRequest {
  queryParameters?: Record<string, string[]>;
  body?: string;
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': ['application/json'] },
  body: JSON.stringify(body, null, 2),
});

export async function selftest(req: WebTriggerRequest) {
  const q = (k: string) => req.queryParameters?.[k]?.[0];
  const key = process.env.TG_SELFTEST_KEY;
  if (!key || q('key') !== key) return json(403, { error: 'forbidden' });
  const op = q('op');
  const issue = (q('issue') ?? '').toUpperCase();
  try {
    if (op === 'propose') {
      const r = await proposeFields(forgeDeps, { issueKey: issue, fields: req.body ?? '{}', agent: q('agent') ?? 'selftest', source: 'api' });
      return json(200, agentReply(r.record));
    }
    if (op === 'read') return json(200, await readTicket(forgeDeps, { issueKey: issue }));
    if (op === 'graph-status') return json(200, await graphStatus());
    // Read-only probe with a made-up connection id: shows whether the graph API and scopes are
    // reachable before an admin has connected the connector.
    if (op === 'graph-probe') return json(200, await graph.getObjectByExternalId({ objectType: 'atlassian:document', externalId: 'ticketgate-probe', connectionId: q('conn') ?? '00000000-0000-0000-0000-000000000000' }));
    if (op === 'graph-backfill') return json(200, await backfill());
    if (op === 'graph-get') {
      const rid = q('record') ?? (await issueState(forgeDeps, issue)).records[0]?.id;
      if (!rid) return json(404, { error: 'no record' });
      return json(200, { recordId: rid, result: await graphGet(rid) });
    }
    if (op === 'state') return json(200, await issueState(forgeDeps, issue));
    if (op === 'scan') return json(200, await scanIssue(forgeDeps, issue));
    if (op === 'explain') return json(200, { text: await explainHold(forgeDeps, { issueKey: issue }) });
    return json(400, { error: 'op must be propose|read|state|scan|explain|graph-status|graph-backfill|graph-get|graph-probe' });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
}
