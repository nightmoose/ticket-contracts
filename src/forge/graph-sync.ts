// Teamwork Graph write: each TicketGate decision becomes a provenance document linked to its Jira
// work item. Needs an admin to connect the "TicketGate" connector once (Atlassian Administration >
// Apps > Connected apps > TicketGate > Connections). Until then pushes are skipped, never fatal.
import api, { route } from '@forge/api';
import { kvs } from '@forge/kvs';
import { graph } from '@forge/teamwork-graph';
import type { ProvenanceRecord } from './service';
import { DOC_TYPE, decisionDocument, docId } from './graph-doc';

const CONN_KEY = 'twg:connection';
const LAST_KEY = 'twg:last';
const RECENT_KEY = 'twg:recent';
const RECENT_CAP = 100;

export interface GraphPushResult { at: string; ok: boolean; skipped?: string; accepted?: number; rejected?: unknown[]; error?: string; ids?: string[] }

let siteUrl: string | undefined;
async function getSiteUrl(): Promise<string> {
  if (siteUrl) return siteUrl;
  const res = await api.asApp().requestJira(route`/rest/api/3/serverInfo`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`serverInfo returned ${res.status}`);
  siteUrl = ((await res.json()) as { baseUrl: string }).baseUrl;
  return siteUrl;
}

export async function getConnection() {
  return kvs.get<{ connectionId: string; name: string; at: string }>(CONN_KEY);
}

async function remember(recordId: string) {
  const ids = ((await kvs.get<string[]>(RECENT_KEY)) ?? []).filter((x) => x !== recordId);
  ids.unshift(recordId);
  await kvs.set(RECENT_KEY, ids.slice(0, RECENT_CAP));
}

export async function pushRecords(records: ProvenanceRecord[]): Promise<GraphPushResult> {
  const at = new Date().toISOString();
  const conn = await getConnection();
  let out: GraphPushResult;
  if (!conn) out = { at, ok: false, skipped: 'no Teamwork Graph connection yet (admin must connect the TicketGate connector)' };
  else if (!records.length) out = { at, ok: true, accepted: 0 };
  else {
    const base = await getSiteUrl();
    const objects = records.map((r) => decisionDocument(r, base));
    // SDK object types are stricter unions than our plain document shape; the payload follows
    // the documented atlassian:document schema.
    const res = await graph.setObjects({ connectionId: conn.connectionId, objects: objects as never });
    out = {
      at,
      ok: !!res.success && !(res.results?.rejected?.length),
      accepted: res.results?.accepted?.length ?? 0,
      rejected: res.results?.rejected ?? [],
      error: res.error,
      ids: objects.map((o) => o.id),
    };
  }
  await kvs.set(LAST_KEY, out);
  if (out.ok) console.log(`ticketgate twg push ok accepted=${out.accepted}`);
  else console.log(`ticketgate twg push ${out.skipped ? 'skipped' : 'failed'}: ${out.skipped ?? out.error ?? JSON.stringify(out.rejected)}`);
  return out;
}

/** Called after every decision is saved. Never throws: the gate must not depend on the graph. */
export async function onDecision(r: ProvenanceRecord) {
  try {
    await remember(r.id);
    await pushRecords([r]);
  } catch (e) {
    console.log(`ticketgate twg push error: ${(e as Error).message}`);
  }
}

export async function graphStatus() {
  return { connection: await getConnection(), last: await kvs.get<GraphPushResult>(LAST_KEY) };
}

export async function graphGet(recordId: string) {
  const conn = await getConnection();
  if (!conn) return { ok: false, error: 'no connection' };
  return graph.getObjectByExternalId({ objectType: DOC_TYPE, externalId: docId(recordId), connectionId: conn.connectionId });
}

/** Re-push the most recent decisions (used on connect, so existing history shows up). */
export async function backfill(): Promise<GraphPushResult> {
  const ids = (await kvs.get<string[]>(RECENT_KEY)) ?? [];
  const recs = (await Promise.all(ids.map((id) => kvs.get<ProvenanceRecord>(`rec:${id}`)))).filter((r): r is ProvenanceRecord => !!r);
  return pushRecords(recs);
}

interface ConnectionChange { action: 'CREATED' | 'UPDATED' | 'DELETED'; name: string; connectionId: string }

export async function onConnectionChange(event: ConnectionChange | { body?: ConnectionChange }) {
  const e = ('body' in event && event.body ? event.body : event) as ConnectionChange;
  console.log(`ticketgate twg connection ${e.action}`);
  if (e.action === 'DELETED') {
    await kvs.delete(CONN_KEY);
    return { success: true };
  }
  await kvs.set(CONN_KEY, { connectionId: e.connectionId, name: e.name, at: new Date().toISOString() });
  await backfill();
  return { success: true };
}
