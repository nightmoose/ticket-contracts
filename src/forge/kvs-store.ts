import { kvs } from '@forge/kvs';
import type { ProvenanceRecord, Store } from './service';
import type { PiiFinding } from '../guard';

// Key layout (all values are small JSON; well inside the KVS free allowance):
//   rec:<id>          ProvenanceRecord
//   issue:<key>       string[]  newest-first record ids, capped
//   held              string[]  ids of records currently held, capped
//   contract:<name>   string    admin-edited contract YAML (falls back to bundled)
//   scan:<key>        { pii, at }
//   read:<key>        { id, at }[]  recent read-ticket-for-fields calls, capped at 10
const ISSUE_CAP = 25;
const HELD_CAP = 200;

async function pushId(key: string, id: string, cap: number) {
  const ids = ((await kvs.get<string[]>(key)) ?? []).filter((x) => x !== id);
  ids.unshift(id);
  await kvs.set(key, ids.slice(0, cap));
}

export const kvsStore: Store = {
  async saveRecord(r: ProvenanceRecord) {
    await kvs.set(`rec:${r.id}`, r);
    await pushId(`issue:${r.issueKey}`, r.id, ISSUE_CAP);
    const held = ((await kvs.get<string[]>('held')) ?? []).filter((x) => x !== r.id);
    if (r.status === 'held') held.unshift(r.id);
    await kvs.set('held', held.slice(0, HELD_CAP));
  },
  async getRecord(id: string) {
    return kvs.get<ProvenanceRecord>(`rec:${id}`);
  },
  async issueRecords(issueKey: string) {
    const ids = (await kvs.get<string[]>(`issue:${issueKey}`)) ?? [];
    const recs = await Promise.all(ids.map((id) => kvs.get<ProvenanceRecord>(`rec:${id}`)));
    return recs.filter((r): r is ProvenanceRecord => !!r);
  },
  async heldRecords() {
    const ids = (await kvs.get<string[]>('held')) ?? [];
    const recs = await Promise.all(ids.map((id) => kvs.get<ProvenanceRecord>(`rec:${id}`)));
    return recs.filter((r): r is ProvenanceRecord => !!r && r.status === 'held');
  },
  async getContractSource(name: string) {
    return kvs.get<string>(`contract:${name}`);
  },
  async saveScan(issueKey: string, pii: PiiFinding[], at: string) {
    await kvs.set(`scan:${issueKey}`, { pii, at });
  },
  async getScan(issueKey: string) {
    return kvs.get<{ pii: PiiFinding[]; at: string }>(`scan:${issueKey}`);
  },
  async saveRead(issueKey: string, read: { id: string; at: string }) {
    const reads = (await kvs.get<{ id: string; at: string }[]>(`read:${issueKey}`)) ?? [];
    await kvs.set(`read:${issueKey}`, [read, ...reads].slice(0, 10));
  },
  async getReads(issueKey: string) {
    return (await kvs.get<{ id: string; at: string }[]>(`read:${issueKey}`)) ?? [];
  },
};

export async function saveContractSource(name: string, yaml: string) {
  await kvs.set(`contract:${name}`, yaml);
}
