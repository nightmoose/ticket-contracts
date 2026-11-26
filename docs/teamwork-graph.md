# Teamwork Graph

TicketGate uses Teamwork Graph both ways.

## Read: other tickets from this reporter

The issue panel runs the curated `atlassianUserReportedJiraWorkItems` query as the viewing user
(`read:graph:issue:jira`, `read:graph:user:atlassian`). This query only works as a signed-in user,
so it can't be called from a script with an API token.

## Write: decision provenance (`graph:connector`)

Every TicketGate decision (written, held, released, rejected) becomes an `atlassian:document`
linked to its work item through an `issueIdOrKeys` association. That makes "what did agents
propose for SUP-5 and what happened" visible to Rovo Search, Rovo Chat and agents.

**What goes in.** The document holds the decision, the agent and source, the contract version,
which fields passed or were masked, and which check each held field failed. **What stays out:**
no field values, amounts, order references, evidence snippets or personal data. Those stay in the
app's own storage on the site, as the connector terms require (`src/forge/graph-doc.ts`; covered by
`tests/agent-graph.test.ts`).

Visibility is `ATLASSIAN_WORKSPACE`, and the declared sync is `upsert` and incremental. The
document id is `ticketgate-decision-<recordId>`, so a release or reject updates the same document.

**Failure is never fatal.** If no connection exists or ingestion fails, the decision still goes
through as normal. The outcome of the last push is kept for diagnosis.

### Admin step (once per site)

1. Atlassian Administration → **Apps** → **Sites** → the site → **Connected apps** → **TicketGate**
   → **Connections** tab.
2. Next to the **TicketGate** connector, click **Connect**, give it a nickname, accept, and
   save. No form fields are needed.
3. Atlassian calls `onConnectionChange` (CREATED). TicketGate stores the connection id and pushes
   every stored decision (up to 500, in batches of 100) to the graph. From then on, every new decision is pushed as it
   happens.

Disconnecting (DELETED) clears the stored connection. Atlassian deletes the ingested documents.

### Checking it (dev site only)

The key-gated dev self-test has `op=graph-status` (connection and last push), `op=graph-get`
(reads a decision document back by id), `op=graph-list` (every decision for an issue, and whether
its document is in the graph), `op=graph-backfill` and `op=graph-probe`. Before an
admin connects, `graph-probe` returns `400 Invalid connectionId format` from the graph connector
API. That proves the API and scopes are reachable.
