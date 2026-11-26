import { parse as yamlParse } from 'yaml';
import { Contract, ContractCompileError } from '../vendor/contractgate';
import type { CompiledContract } from '../vendor/contractgate';
import type { TicketGateExtension } from './types';

export interface LoadedContract {
  compiled: CompiledContract;
  ext: TicketGateExtension;
  name: string;
  version: string;
}

export function loadContract(source: string): LoadedContract {
  const compiled = Contract.fromYaml(source).compile();
  const raw = (yamlParse(source) as Record<string, unknown>)['ticketgate'] as Partial<TicketGateExtension> | undefined;
  const ext: TicketGateExtension = {
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
    if (!declared.has(f)) throw new ContractCompileError(`ticketgate block names undeclared field '${f}'`);
  }
  for (const f of ext.nullable) {
    const def = compiled.contract.entities.find((e) => e.name === f)!;
    if (def.required) {
      throw new ContractCompileError(`nullable field '${f}' must be declared required: false (TicketGate checks presence itself)`);
    }
  }
  return { compiled, ext, name: compiled.contract.name, version: compiled.contract.version };
}
