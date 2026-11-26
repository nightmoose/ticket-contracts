# Teamwork Graph

Ticket Contracts uses Teamwork Graph both ways.

## Read: other tickets from this reporter

The issue panel runs the curated `atlassianUserReportedJiraWorkItems` query as the viewing user
(`read:graph:issue:jira`, `read:graph:user:atlassian`). This query only works as a signed-in user,
so it can't be called from a script with an API token.

## Write: decision provenance (`graph:connector`)

Every Ticket Contracts decision (written, held, released, rejected) becomes an `atlassian:document`
linked to its work item through an `issueIdOrKeys` association. That makes "what did agents
propose for SUP-5 and what happened" visible to Rovo Search, Rovo Chat and agents.

**What goes in.** The document holds the decision, the agent and source, the contract version,
which fields passed or were masked, and which check each held field failed. **What stays out:**
no field values, amounts, order references, evidence snippets or personal data. Those stay in the
app's own storage on the site, as the connector terms require (`src/forge/graph-doc.ts`; covered by
`tests/agent-graph.test.ts`).

Visibility is `ATLASSIAN_WORKSPACE`, and the declared sync is `upsert` and incremental. The
document id is `ticketgate-decision-<recordId>`, so a release or reject updates the same document. The sequence number is the update time with a wording revision (`DOC_REVISION`) in the low two digits, so a re-push after a wording change replaces existing documents.

**Failure is never fatal.** If no connection exists or ingestion fails, the decision still goes
through as normal. The outcome of the last push is kept for diagnosis.

### Admin step (once per site)

1. Atlassian Administration → **Apps** → **Sites** → the site → **Connected apps** → **Ticket Contracts**
   → **Connections** tab.
2. Next to the **Ticket Contracts** connector, click **Connect**, give it a nickname, accept, and
   save. No form fields are needed.
3. Atlassian calls `onConnectionChange` (CREATED). Ticket Contracts stores the connection id and pushes
   every stored decision (up to 500, in batches of 100) to the graph. From then on, every new decision is pushed as it
   happens.

Disconnecting (DELETED) clears the stored connection. Atlassian deletes the ingested documents.

### Checking it (dev site only)

After a connection exists, a new decision (for example a held proposal through the
MCP tools or the Ticket Intake agent) is pushed as it happens. `docs/dev-verification.md`
describes how to confirm a document reads back. The old key-gated self-test web trigger
was removed so the app can qualify for "Runs on Atlassian." 
