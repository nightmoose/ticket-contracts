import type { ProvenanceRecord, Store } from './service';
import type { PiiFinding } from '../guard';

/** In-memory Store for tests and local demos. */
export class MemoryStore implements Store {
  records = new Map<string, ProvenanceRecord>();
  contracts = new Map<string, string>();
  scans = new Map<string, { pii: PiiFinding[]; at: string }>();
  async saveRecord(r: ProvenanceRecord) { this.records.set(r.id, structuredClone(r)); }
  async getRecord(id: string) { return this.records.get(id); }
  async issueRecords(k: string) { return [...this.records.values()].filter((r) => r.issueKey === k).sort((a, b) => b.at.localeCompare(a.at)); }
  async heldRecords() { return [...this.records.values()].filter((r) => r.status === 'held').sort((a, b) => b.at.localeCompare(a.at)); }
  async getContractSource(n: string) { return this.contracts.get(n); }
  async saveScan(k: string, pii: PiiFinding[], at: string) { this.scans.set(k, { pii, at }); }
  async getScan(k: string) { return this.scans.get(k); }
}
