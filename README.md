# TicketGate

**Agents read context. Who checks what they write?**

TicketGate is a Forge app for Jira Service Management. Every structured field an AI agent proposes
for a support ticket goes through one write path. That covers a Rovo agent, a custom Rovo Studio
agent, or an outside client over MCP. Each proposal gets three deterministic checks before anything
lands on the ticket:

1. **Contract check:** types, enums, patterns, ranges, required fields and no undeclared fields, using
   a [ContractGate](https://github.com/nightmoose/contractgate) data contract.
2. **Grounding check:** every id, order reference and amount must appear in the ticket text. Both
   `1,249.50` and `1.249,50` count.
3. **PII masking:** emails, phone numbers, card numbers (Luhn-checked) and IBANs are masked in
   free-text fields before they are written, and are never kept raw in TicketGate's records.

Proposals that pass are written to the work item. The rest are **held** on the issue panel with the
exact reason and the ticket text that was checked, and a person can release or reject them. Every
decision is kept as a provenance record (agent, contract version, evidence).

The agent suggests; code decides. The motivation comes from
[SchemaSmith](https://github.com/nightmoose/schemasmith): on 64 held-out multilingual tickets a small
open model invented an order reference or refund for 32.9% of the ids and amounts it filled in.

## Status

Work in progress for Codegeist 2026.

| Part | State |
|---|---|
| Guard core (`src/guard`): contract, grounding and PII checks | done, unit-tested |
| Write path, held queue, provenance (`src/forge/service.ts`) | done, tested with in-memory fakes |
| Forge wiring: Rovo agent and actions, `rovo:mcp`, issue panel, admin page, issue-created scan | written. The manifest validates offline. Not yet deployed. |
| Teamwork Graph connector and queries | not started |
| Deployed to a Forge dev site | not yet |

## Forge modules

| Module | Key | Purpose |
|---|---|---|
| `rovo:agent` | `ticket-intake` | Reads a ticket and proposes its fields, only through the actions below |
| `action` | `propose-ticket-fields` | The write path: check, then write or hold |
| `action` | `check-ticket-fields` | Dry run |
| `action` | `explain-ticket-hold` | Why a proposal was held, with evidence |
| `action` | `list-held-proposals` | Review queue |
| `rovo:mcp` | `ticketgate-mcp` | The same four actions as MCP tools (see [`skill.md`](skill.md)) |
| `jira:issuePanel` | `ticketgate-panel` | Latest decision, held reasons, evidence, release or reject |
| `jira:adminPage` | `ticketgate-admin` | Setup check, contract editor, held queue |
| `trigger` | `ticketgate-scan` | On issue created, records which kinds of PII a ticket contains |

Accepted fields are stored in the `ticketgate-fields` issue property, so a site needs no
custom-field setup.

**Cost guard:** the app never calls Forge LLM APIs and uses no Forge Containers.
`npm run check:banned` fails CI if either shows up. The language work is done by Rovo, and
everything that decides is plain TypeScript.

## Develop

```bash
npm ci
npm test               # unit tests
npm run demo           # run every fixture ticket through the guard
npm run ci             # everything CI runs
```

Deploying needs the Forge CLI logged in to an Atlassian developer account:
`forge register`, `forge deploy`, `forge install`.

## Contracts

`contracts/support_ticket.yaml` uses ContractGate's contract format plus a `ticketgate` block
(nullable fields, cross-field rules, grounded fields, PII detectors). Edit the YAML, then run
`npm run gen:contracts`. Admins can also edit the contract on the admin page.

## Known limits

- Grounding proves a value is *in* the ticket, not that it is the *right* value. A ticket that
  states a wrong amount will pass the grounding check.
- PII detection is pattern-based (email, phone, card, IBAN). It does not detect names or
  street addresses.

## Third-party code

`src/vendor/contractgate/` is the ContractGate TypeScript local validator (MIT). See its
[NOTICE](src/vendor/contractgate/NOTICE.md). Atlassian `@forge/*` packages are installed from npm
under Atlassian's terms and are not vendored.

## License

MIT
