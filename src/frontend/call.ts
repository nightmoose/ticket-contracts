import { invoke } from '@forge/bridge';

/** invoke() without metadata returns the resolver's value; narrow the bridge's union type. */
export function call<T>(key: string, payload?: Record<string, unknown>): Promise<T> {
  return invoke(key, payload) as Promise<T>;
}
