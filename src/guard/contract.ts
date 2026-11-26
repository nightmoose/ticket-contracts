import { parse as yamlParse } from 'yaml';
import { Contract, ContractCompileError } from '../vendor/contractgate';
import type { CompiledContract } from '../vendor/contractgate';
import type { TicketContractsExtension } from './types';

export interface LoadedContract {
  compiled: CompiledContract;
  ext: TicketContractsExtension;
  name: string;
  version: string;
}

export function loadContract(source: string): LoadedContract {
  const compiled = Contract.fromYaml(source).compile();
  // `ticketgate` is the block's name from before the rename; still accepted for saved contracts.
  const doc = yamlParse(source) as Record<string, unknown>;
  const raw = (doc['ticket_contracts'] ?? doc['ticketgate']) as Partial<TicketContractsExtension> | undefined;
  const ext: TicketContractsExtension = {
    nullable: raw?.nullable ?? [],
    grounded: raw?.grounded ?? [],
    rules: raw?.rules ?? [],
    pii: {
      scan_fields: raw?.pii?.scan_fields ?? [],
      detectors: raw?.pii?.detectors ?? ['email', 'phone', 'card', 'iban'],
    },
  };
  const declared = new Set(compiled.contract.entities.map((e) => e.name));
  for (const f of [...ext.nullable, ...ext.grounded, ...ext.rules.map((r) => r.field), ...ext.pii.scan_fields]) {
    if (!declared.has(f)) throw new ContractCompileError(`ticket_contracts block names undeclared field '${f}'`);
  }
  for (const f of ext.nullable) {
    const def = compiled.contract.entities.find((e) => e.name === f)!;
    if (def.required) {
      throw new ContractCompileError(`nullable field '${f}' must be declared required: false (Ticket Contracts checks presence itself)`);
    }
  }
  return { compiled, ext, name: compiled.contract.name, version: compiled.contract.version };
}
