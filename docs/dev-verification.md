# Verifying Ticket Contracts on the development site

The `ticketgate-selftest` web trigger is **not** in the manifest and is not deployed. It made
the app ineligible for the "Runs on Atlassian" program, even when the handler was key-gated.
Do not add a `webtrigger` module back for production or for a release you intend to share
with judges.

After this change was deployed to the development environment, `forge eligibility -e development` reported the app as eligible for Runs on Atlassian. The previously deployed version was not, because of the web trigger.

Unit tests (`npm test`, 36 at the time of writing) and `npm run ci` do not use the trigger.

## On the development site

The app is installed on https://one-atlas-jgqw.atlassian.net (development environment).

1. **Issue panel.** Open a seeded ticket such as
   [SUP-3](https://one-atlas-jgqw.atlassian.net/browse/SUP-3) or
   [SUP-5](https://one-atlas-jgqw.atlassian.net/browse/SUP-5) and confirm the latest
   decision, masked fields, and "Other tickets from this reporter."
2. **Rovo.** In Rovo Chat, pick the Ticket Intake agent and ask it to fill a ticket
   (for example SUP-1 or a fresh issue). It should call `read-ticket-for-fields` first
   (no confirm card), then show a confirm card for `propose-ticket-fields`, then relay
   WRITTEN or HELD reasons.
3. **MCP.** With tools enabled in Connected apps, an outside client can list and call
   the tools. See [mcp.md](mcp.md). A held proposal is a good check: invent an order
   reference that is not in the ticket and confirm nothing is written.
4. **Teamwork Graph write.** After an admin has connected the Ticket Contracts connector,
   a new decision should appear as a document named `Ticket Contracts decision <KEY>: held`
   or `written`, linked to the work item. The panel's reporter list exercises the graph read.
5. **Issue-created scan.** Create a work item and check `forge logs` for
   `ticket-contracts scan ok <KEY>`.

## After a production or share-link deploy

Use the same five checks on the target site. There is no HTTP smoke-test hook. If you still
have a `TG_SELFTEST_KEY` variable in the development environment, it is unused and can be
deleted.
