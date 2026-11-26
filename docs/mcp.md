# External MCP client

Ticket Contracts exposes its five actions as MCP tools at:

```
https://mcp.atlassian.com/forge/0e5d23f1-5def-4716-bd77-8e05356d98d6
```

The UUID is the Forge app id. A site admin must turn the tools on once in Atlassian
Administration → Apps → Sites → the site → Connected apps → Ticket Contracts → Tools.
That is already done on the development site (`one-atlas-jgqw`).

This is the path in [Build a Rovo MCP hello world app](https://developer.atlassian.com/platform/forge/build-a-hello-world-rovo-mcp/): add the URL as a remote MCP server and complete OAuth 2.1 in a browser. A local client can use [`mcp-remote`](https://github.com/geelen/mcp-remote) / `mcp-remote-client` (MIT). It discovers the app's authorization server, registers dynamically, and listens on a localhost callback.

Do not put access tokens, refresh tokens or client secrets in this file or in commits.

## Verified 26 Nov 2026, 5:44 AM ET (America/New_York)

Client: `mcp-remote-client` 0.17.1 (MIT), OAuth 2.1 with PKCE and dynamic client registration, approved for the `one-atlas-jgqw` site with Read/Write/Search. No card or billed step.

### Tools listed

Development installs suffix tool names with `_development`:

| Tool | Role |
|---|---|
| `read-ticket-for-fields_development` | Required first read. Returns masked ticket text, field rules, and a `readId`. |
| `propose-ticket-fields_development` | The write path. Needs that `readId` or it returns `NOT_CHECKED`. |
| `check-ticket-fields_development` | Dry run. |
| `explain-ticket-hold_development` | Why a proposal was held. |
| `list-held-proposals_development` | The review queue. |

### `read-ticket-for-fields` on SUP-6

Returned `issueKey` SUP-6, summary "Feature idea", contract `support_ticket@1.0.0`, a `readId`, and this ticket text (no PII in it):

> Feature idea
> Ticket T-1200. Pro user. Would love dark mode for the dashboard.

Field rules included the allowed values, `mustAppearInTicket` for `ticket_id`, `order_ref` and `refund_amount_usd`, and the rule that `refund_amount_usd` must be null unless category is billing.

### Held `propose-ticket-fields` on SUP-6

The client then proposed, with that `readId`, grounded ticket_id `T-1200` and tier `pro`, but invented `order_ref: ORD-123456` and `refund_amount_usd: 900` on `category: feature_request`.

Decision: **HELD**. Nothing was written. Record `7dc71114-fe48-4c45-b911-1f085b255577`. Reasons:

- `refund_amount_usd` [rule]: must be null unless category is billing
- `order_ref` [grounding]: "ORD-123456" does not appear in the ticket text
- `refund_amount_usd` [grounding]: 900 does not appear in the ticket text

`tellUser` was: "Ticket Contracts held this proposal, so nothing was written to SUP-6." plus those three reasons.

The decision was also pushed to Teamwork Graph and reads back as "Ticket Contracts decision SUP-6: held" (alongside the earlier written decision from Rovo).

## Search for the decision document

Teamwork Graph read-back works (see above). These searches did **not** find the documents, which is expected: they are connector documents, not Jira issues or Confluence pages.

- Confluence CQL `text ~ "Ticket Contracts decision"` (and several nearby phrases): 0 results. The site does have Confluence spaces, just no matching pages.
- Jira JQL `text ~ "Ticket Contracts decision"`: 0 issues.
- The Rovo/xpsearch aggregator rejected a request authenticated with the developer API token (403). The Rovo Search UI was not opened on this pass, so it is still unconfirmed whether the documents have been indexed for Rovo Search (earlier checks also saw lag).

## Running the check again

1. Confirm tools are still enabled in Connected apps.
2. From a machine that can open a browser to Atlassian and receive a loopback redirect:

   ```
   MCP_REMOTE_CONFIG_DIR=/safe/private/dir \
     npx mcp-remote-client@0.17.1 \
     https://mcp.atlassian.com/forge/0e5d23f1-5def-4716-bd77-8e05356d98d6 \
     17890 --auth-timeout 1800
   ```

3. Open the printed authorize URL, pick the site, and approve. The callback is `http://localhost:17890/oauth/callback`.
4. With tokens cached in that directory, a small MCP client can call `tools/list`, then `read-ticket-for-fields_development` and `propose-ticket-fields_development` (use the `_development` suffix only on a development install).

Keep `MCP_REMOTE_CONFIG_DIR` out of the repo and never commit its contents.
