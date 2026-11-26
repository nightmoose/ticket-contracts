# Vendored: ContractGate TypeScript local validator

Files `contract.ts`, `validator.ts`, `types.ts`, `errors.ts` in this directory are copied from
https://github.com/nightmoose/contractgate (`sdks/typescript/src/`, package `@nightmoose/contractgate-sdk` 0.4.1,
commit `9fffa22c84e6864f137ff576ac7961d27e7898e9`), MIT License, Copyright (c) 2025-2026 nightmoose (Alex Suarez).
See `LICENSE` in this directory.

Changes from upstream:
- Relative import specifiers changed from `./x.js` to `./x` so the Forge bundler resolves the TypeScript sources.
- No other edits. The HTTP client (`client.ts`) and `llm.ts` were not copied; TicketGate makes no network calls to validate.
