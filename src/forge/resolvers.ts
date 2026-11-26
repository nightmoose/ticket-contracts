import Resolver from '@forge/resolver';
import { DEFAULT_CONTRACT, getContract, issueState, listHeld, resolveHeld } from './service';
import { forgeDeps } from './forge-deps';
import { saveContractSource } from './kvs-store';
import { loadContract } from '../guard';
import { CONTRACTS } from '../contracts.generated';
import { reporterTickets } from './twg';

const resolver = new Resolver();

resolver.define('getIssueState', async ({ context }) => {
  const key = (context as { extension?: { issue?: { key?: string } } }).extension?.issue?.key;
  if (!key) throw new Error('No issue in context');
  return issueState(forgeDeps, key);
});

resolver.define('getRelated', async ({ context }) => {
  const key = (context as { extension?: { issue?: { key?: string } } }).extension?.issue?.key;
  if (!key) throw new Error('No issue in context');
  try {
    return await reporterTickets(key);
  } catch (e) {
    return { ok: false, items: [], note: (e as Error).message };
  }
});

resolver.define('resolveHeld', async ({ payload, context }) => {
  const { recordId, action } = payload as { recordId: string; action: 'release' | 'reject' };
  return resolveHeld(forgeDeps, { recordId, action, by: String((context as { accountId?: string }).accountId ?? 'unknown') });
});

resolver.define('getAdminState', async () => {
  const contract = await getContract(forgeDeps);
  const source = (await forgeDeps.store.getContractSource(DEFAULT_CONTRACT)) ?? CONTRACTS[DEFAULT_CONTRACT];
  const held = await listHeld(forgeDeps);
  return { contract: { name: contract.name, version: contract.version, source }, held };
});

resolver.define('saveContract', async ({ payload }) => {
  const { yaml } = payload as { yaml: string };
  const c = loadContract(yaml); // throws with a readable message if invalid
  if (c.name !== DEFAULT_CONTRACT) throw new Error(`Contract name must be ${DEFAULT_CONTRACT}`);
  await saveContractSource(DEFAULT_CONTRACT, yaml);
  return { ok: true, version: c.version };
});

export const handler = resolver.getDefinitions();
