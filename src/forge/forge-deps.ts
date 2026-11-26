import api, { route } from '@forge/api';
import { randomUUID } from 'node:crypto';
import type { Deps, IssueSnapshot, ProvenanceRecord } from './service';
import { kvsStore } from './kvs-store';

export const FIELDS_PROPERTY = 'ticketgate-fields';

async function getIssue(key: string): Promise<IssueSnapshot> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${key}?fields=summary,description,comment`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Jira returned ${res.status} for ${key}`);
  const body = (await res.json()) as {
    key: string;
    fields: { summary?: string; description?: unknown; comment?: { comments?: { body: unknown }[] } };
  };
  return {
    key: body.key,
    summary: body.fields.summary ?? '',
    description: body.fields.description ?? null,
    comments: (body.fields.comment?.comments ?? []).map((c) => c.body),
  };
}

// Accepted fields are stored as an issue property, so the app needs no custom-field setup on a
// judge's site. JQL can search it via the property, and the issue panel renders it.
async function writeFields(issueKey: string, fields: Record<string, unknown>, record: ProvenanceRecord) {
  const value = {
    fields,
    recordId: record.id,
    agent: record.agent,
    contract: record.result.contract,
    status: record.status,
    at: record.at,
  };
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/properties/${FIELDS_PROPERTY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Jira returned ${res.status} writing ${FIELDS_PROPERTY} on ${issueKey}`);
}

export const forgeDeps: Deps = {
  getIssue,
  writeFields,
  store: kvsStore,
  now: () => new Date().toISOString(),
  newId: () => randomUUID(),
};
