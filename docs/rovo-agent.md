# Rovo agent notes

## Read before propose

The agent's first step is always `read-ticket-for-fields`, a GET action, so it has no confirm card.
It returns the ticket text exactly as Ticket Contracts checks it, with PII masked, plus the contract's
fields, allowed values and grounding rules. The prompt forbids values from memory, other tickets
or examples. It also says `ticket_id` is the customer's reference in the text (e.g. `T-6060`),
not the Jira key.

### Enforced, not just prompted

In the first Rovo Chat run after the read action was added, the agent skipped it. It went straight
to the write, using the ticket Rovo had attached as chat context. It got the fields right that
time, but a prompt alone can't guarantee the read.

So `read-ticket-for-fields` now returns a `readId`, and `propose-ticket-fields` requires it. The
readId must have been issued for the same work item within the last hour. A missing or made-up
readId gets `decision: NOT_CHECKED`: nothing is checked, written or recorded, and `nextStep` tells
the agent to read first. The cost is one wasted confirm card if the agent skips the read anyway.
The read action's name says it is required, and the prompt opens with the rule.

## Replies the agent can relay

`propose-ticket-fields` returns JSON:

- `decision`: `WRITTEN` or `HELD`.
- `written`: the fields written.
- `piiMasked`: the fields where personal data was masked.
- `held`: a list of `{field, check, reason}`.
- `nextStep`, plus `tellUser`, a sentence the agent can say as-is ("Ticket Contracts held this
  proposal, so nothing was written to SUP-5. refund_amount_usd: refund_amount_usd 900 does not
  appear in the ticket text.").

`check-ticket-fields` (dry run) returns the same shape with `WOULD_PASS` / `WOULD_BE_HELD`.

## The "Please review" confirm card

Rovo shows a confirm card before any action whose `actionVerb` is not `GET`.
`propose-ticket-fields` writes to the work item, so it is `UPDATE` and the card appears. This is
intended, for two reasons:

- Marketplace security requirement 14 says `actionVerb` must truthfully say whether an action
  changes data.
- The card is a second, human check on top of Ticket Contracts' own.

It also means automation-triggered agents won't call the write action.

Questions that don't write anything get no card: "what was held and why" uses
`explain-ticket-hold`, `check-ticket-fields` or `list-held-proposals`, all `GET`.

## Demo material: the hallucinated run

In one early Rovo Chat run on SUP-5, before the read-first action existed, the agent proposed:

- `customer_tier: enterprise` (the ticket says pro)
- `order_ref: ORD-992834` (the ticket says ORD-777001)
- `refund_amount_usd: 45.0` (not in the ticket)

None of these appear in the ticket. This is exactly the failure Ticket Contracts exists for. Confirming
that proposal on camera shows it being HELD with "does not appear in the ticket text", and nothing
is written. Keep a screenshot of that review card for the video.
