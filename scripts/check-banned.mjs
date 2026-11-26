// Cost guard: fail if the app could ever bill the developer.
//  - Forge LLMs have no free allowance and bill the developer (even during judging).
//  - Forge Containers have a 0 free allowance.
// Also checks every manifest function handler is exported from src/index.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';

const problems = [];
const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage']);
const SELF = 'scripts/check-banned.mjs';
const BANNED_IMPORT = /@forge\/llm\b/;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(m?[jt]sx?|cjs|json|ya?ml)$/.test(name) && p !== SELF && !p.endsWith('package-lock.json')) {
      const text = readFileSync(p, 'utf8');
      if (BANNED_IMPORT.test(text)) problems.push(`${p}: references @forge/llm (Forge LLM APIs are billed to the developer)`);
    }
  }
}
walk('.');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const dep of Object.keys(pkg[section] ?? {})) {
    if (dep === '@forge/llm') problems.push(`package.json ${section}: @forge/llm is banned`);
  }
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
for (const key of Object.keys(lock.packages ?? {})) {
  if (key.endsWith('node_modules/@forge/llm')) problems.push(`package-lock.json: @forge/llm is installed (${key})`);
}

const manifest = yamlParse(readFileSync('manifest.yml', 'utf8'));
const modules = manifest.modules ?? {};
if ('llm' in modules) problems.push('manifest.yml: modules.llm declares Forge LLM usage (billed)');
if ('services' in manifest) problems.push('manifest.yml: top-level services (Forge Containers) are billed with no free allowance');
(function findContainers(node, path) {
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'containers') problems.push(`manifest.yml: ${path}${k} (Forge Containers are billed)`);
      findContainers(v, `${path}${k}.`);
    }
  }
})(manifest, '');

const index = readFileSync('src/index.ts', 'utf8');
for (const fn of modules.function ?? []) {
  const [file, exp] = String(fn.handler).split('.');
  if (file !== 'index') problems.push(`manifest.yml function ${fn.key}: handler must live in src/index.ts`);
  else if (!new RegExp(`\\b${exp}\\b`).test(index)) problems.push(`manifest.yml function ${fn.key}: src/index.ts does not export ${exp}`);
}

if (problems.length) {
  console.error('Banned or broken items found:\n' + problems.map((p) => ` - ${p}`).join('\n'));
  process.exit(1);
}
console.log('check-banned: OK (no @forge/llm, no llm module, no containers/services; all handlers exported)');
