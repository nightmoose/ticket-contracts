// Run every fixture through the guard and print what an agent would be told.
// npm run demo
import { readdirSync, readFileSync } from 'node:fs';
import { guardProposal, loadContract } from '../src/guard';
import { ticketText } from '../src/guard/adf';
import { CONTRACTS } from '../src/contracts.generated';

const contract = loadContract(CONTRACTS['support_ticket']);
const dir = new URL('../fixtures/tickets/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const fx = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  const r = guardProposal(contract, ticketText(fx.ticket.summary, fx.ticket.description), fx.proposal);
  console.log(`\n${fx.ticket.key}  ${r.decision.toUpperCase().padEnd(4)}  ${fx.name}`);
  for (const v of r.violations) console.log(`   held  ${v.field} [${v.check}] ${v.message}`);
  for (const e of r.evidence) console.log(`   found ${e.field}=${JSON.stringify(e.value)} in "${e.snippet}"`);
  const masked = Object.entries(r.fieldStatus).filter(([, s]) => s === 'masked');
  for (const [k] of masked) console.log(`   masked ${k}: ${r.fields[k]}`);
}
