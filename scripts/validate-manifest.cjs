// Offline manifest check using the same @forge/manifest validators `forge lint` runs.
// (`forge lint` itself needs a logged-in Forge CLI; this runs in CI without credentials.)
const { validate } = require('@forge/manifest');
(async () => {
  const r = await validate(false, 'manifest.yml');
  const errors = r.errors || [];
  for (const e of errors) console.error(`${e.level || 'error'}: ${e.message}${e.reference ? ` (${e.reference})` : ''}${e.line ? ` line ${e.line}` : ''}`);
  const fatal = errors.filter((e) => (e.level || 'error') === 'error');
  console.log(`manifest: ${r.success && fatal.length === 0 ? 'valid' : 'INVALID'} (${errors.length} message(s))`);
  process.exit(r.success && fatal.length === 0 ? 0 : 1);
})();
