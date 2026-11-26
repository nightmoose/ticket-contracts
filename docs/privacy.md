# Ticket Contracts privacy policy (draft, not published)

This is a draft of the privacy policy for the Ticket Contracts Forge app. It is not a public
URL yet. A Marketplace listing needs a hosted privacy-policy link; publishing that URL is an
Alex-only step. Do not treat this file as already live.

The public partner name is NightMoose. The legal entity on Atlassian verification forms is
NightMoose, Inc.

Last updated: 26 November 2026.

## What Ticket Contracts is

Ticket Contracts is a Forge app for Jira and Jira Service Management. It checks the
structured fields an AI agent proposes for a support ticket (a data contract, a grounding
check that IDs and amounts appear in the ticket text, and masking of personal data in
free-text fields) before those fields are written to the work item.

## Where data is stored and processed

End-user data stays in Atlassian products and services. The app does not send ticket content,
field values, or personal data to a vendor-operated server, and it declares no remote
backends or third-party egress.

Specifically:

- Accepted field values are stored as a Jira issue property on the work item, on the
  customer's Atlassian site.
- Decision records, an optional admin-edited contract, and short scan notes are stored in
  Forge hosted storage (Key-Value Store) on the installed site.
- Each decision is also written to Atlassian Teamwork Graph as a provenance document linked
  to the work item. Those documents record the decision and which checks failed. They do not
  carry field values, amounts, or personal data.
- Checks run in Forge functions on Atlassian infrastructure. Rovo and Atlassian MCP
  invocations also run on Atlassian infrastructure.

The app does not use Forge LLM APIs or Forge Containers.

## Personal data the app may see

The app may read a work item's summary, description and comments, and any personal data an
agent puts in a proposed field, in order to run the checks above.

Phone numbers, email addresses, payment card numbers and IBANs in scanned free-text fields
are masked before a passing proposal is written. Raw values of that kind are not kept in
Ticket Contracts' decision records.

## Logging

App logs include work item keys, decision identifiers, and short status lines (for example
that a scan ran, or that a graph push was accepted or skipped). Logs do not include ticket
body text, field values, or personal data. Those logs stay in Forge app logs on Atlassian
infrastructure. Logs are not shared with third parties.

## Data residency

End-user data is stored exclusively within Atlassian products and services that support data
residency (Forge hosted storage and Jira on the customer's site, plus Teamwork Graph). The
app does not keep a separate copy in a region the app vendor chooses.

## Retention and uninstall

Data lives on the customer's site for as long as the app is installed and the work item or
store entries remain. Uninstalling the app removes the app's Forge storage. Issue properties
on the work item remain until someone deletes them. When an admin disconnects the Teamwork
Graph connector, Atlassian deletes the ingested documents.

## Sharing with third parties

The app does not share end-user data with third-party entities. It does not expose a vendor
REST API. Outside agents can call the same checks only through Atlassian's MCP server
(`mcp.atlassian.com`), which is an Atlassian service.

## End-user agreement

For the Marketplace listing, we recommend adopting Atlassian's standard, customizable
end-user agreement (the Bonterms Standard End User Agreement, Version 1.0), rather than
writing a separate EULA. Review it with counsel, then opt in on the listing:

- How to adopt it: https://developer.atlassian.com/platform/marketplace/list-customizable-end-user-agreement/
- Agreement text: https://www.atlassian.com/licensing/marketplace/end-user-agreement-v1

Provider-specific terms can point at this privacy policy and, if needed, a DPA. Opting in
and accepting Marketplace agreements is an Alex-only step.

## Contact

Support and privacy questions should use the support contact published on the Marketplace
partner profile once that profile exists. This draft does not invent a public support
address.
