// Development-only diagnostic web trigger. Exercises the real write path (Jira REST + KVS) without
// Rovo, so a deploy can be smoke-tested from a script. Requires the TG_SELFTEST_KEY Forge variable;
// with no key set it refuses every request. Not part of the production feature set.
import { explainHold, issueState, proposeFields, scanIssue } from './service';
import { forgeDeps } from './forge-deps';

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
      return json(200, { decision: r.decision, message: r.message });
    }
    if (op === 'state') return json(200, await issueState(forgeDeps, issue));
    if (op === 'scan') return json(200, await scanIssue(forgeDeps, issue));
    if (op === 'explain') return json(200, { text: await explainHold(forgeDeps, { issueKey: issue }) });
    return json(400, { error: 'op must be propose|state|scan|explain' });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
}
