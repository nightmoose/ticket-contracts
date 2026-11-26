# Marketplace listing draft (not submitted)

Draft only. Do not publish or submit this listing until Alex does so himself. This file is
the copy and the Alex-only checklist, taken from the live Atlassian docs cited below
(retrieved 26 Nov 2026).

**Listing name:** Ticket Contracts (16/60 characters)

**Tagline:** Agents read context. Who checks what they write? (48/130)

**Summary:** Validates the structured fields an AI agent proposes for a support ticket. It checks the data contract, confirms IDs and amounts appear in the ticket text, masks personal data, and holds anything that fails for a person to review. (230/250)

Keywords to use naturally, not stuffed: support ticket, data contract, PII, grounding, Rovo, MCP.

The name does not use the prohibited words Atlassian, plugin, beta, add-on, or app, and does
not start with a product name. "Ticket Contracts" was chosen to avoid a clash with
event-ticketing products that use "TicketGate."

## Highlights (exactly three)

Each highlight later needs a cropped screenshot at 580×330 px and a caption of at most 220
characters. Primary screenshots should be 1840×900 px, showing the app in the Jira UI.

### 1. Hold values the ticket never said (33/50)

IDs, order references and amounts must appear in the ticket text. Invented or injected values are held, and nothing is written, with the reason shown on the ticket. (164/220)

Suggested screenshot: the SUP-5 or SUP-6 issue panel with a held proposal and the grounding
reason visible. Caption: "A $900 refund that does not appear in the ticket is held, and
nothing is written."

### 2. Mask personal data before it lands (34/50)

Phone numbers, email addresses, payment cards and IBANs in free-text fields are masked before a passing proposal is written to the work item. (141/220)

Suggested screenshot: the SUP-3 panel showing masked phone and card values and a "written"
lozenge. Caption: "Personal data in the ticket is masked before accepted fields are stored."

### 3. Explain every decision (22/50)

The issue panel, Rovo Chat and Teamwork Graph all show whether a proposal was written or held, and why, without storing raw personal data in the graph. (151/220)

Suggested screenshot: Rovo Chat relaying a WRITTEN or HELD result, or the Teamwork Graph /
"other tickets" panel. Caption: "Rovo Chat explains what was written or held, in plain language."

## More details (listing body)

Ticket Contracts checks every structured field an AI agent tries to write on a Jira Service
Management or Jira support ticket, before that write lands.

Agents are good at reading a ticket. They are less reliable at writing back IDs, amounts and
categories. Ticket Contracts is the write path:

- The proposal is checked against a data contract (required fields, types, allowed values).
- IDs, order references and amounts must actually appear in the ticket text. Invented or
  prompt-injected values are held.
- Personal data in free-text fields is masked before anything is stored.
- A held proposal is not written. A person can see the reasons on the issue panel and release
  the passing fields or reject the proposal.
- The Ticket Intake agent in Rovo Chat has to read the ticket first. It then relays whether
  the proposal was written or held, and why.
- The same checks are available as MCP tools, so a coding agent or other MCP client can use
  them. The write tool still requires that prior read.
- Each decision is also recorded in Teamwork Graph as a provenance document linked to the
  work item. Those documents carry the decision and the failed checks, not amounts or
  personal data.

The app does not call Forge LLM APIs and does not use Forge Containers. Language work is done
by Rovo on the installed site. The checks themselves are ordinary TypeScript running as Forge
functions.

It works on a site with only Jira installed (the issue panel and the write path). The Rovo
agent, MCP tools and Teamwork Graph connector light up when Rovo is available on the site.

This listing should stay a **free** app. Do not turn on `app.licensing.enabled` and do not
create a paid plan.

## Privacy and data handling (for the Privacy & Security tab)

Be exact. This reflects the app as of this draft (no remotes in the manifest, no self-test
web trigger, no Forge LLM or containers).

**Does the app store End-User Data outside of Atlassian products and services (excluding
logs)?** No.

Accepted fields are stored as a Jira issue property on the work item. Decision records, the
optional admin-edited contract, and scan notes are stored in Forge Key-Value Store on the
installed site. Teamwork Graph provenance documents are stored in Atlassian's Teamwork Graph.
None of that leaves Atlassian.

**Does the app process End-User Data outside of Atlassian products and services or outside
of the end-user's browser (excluding logs)?** No. Checks run in Forge functions on Atlassian
infrastructure. Rovo and MCP invocations also run on Atlassian infrastructure. The app
declares no remote backends.

**Does the app log End-User Data?** Only work item keys, decision identifiers, and short
status lines (for example that a scan ran, or that a graph push was accepted or skipped).
Logs do not include ticket body text, field values, or personal data. Those logs stay in
Forge app logs.

**Does the app process or store End-User Data in logs outside of Atlassian?** No.

**Does the app expose any remote REST APIs for integration with other tools?** No. MCP access
is through Atlassian's MCP server at `mcp.atlassian.com`, not through an API the app hosts.

**Does the app share End-User Data with any third-party entities?** No.

**Does the app share logs that include End-User Data with third parties?** No.

**Does the app support data residency options?** Yes — the app stores end-user data
exclusively within Atlassian products and services that support data residency (Forge
hosted storage and Jira on the customer's site, plus Teamwork Graph). It does not keep a
separate copy in a region the app vendor chooses.

**Personal data the app may see:** ticket summary and description, comments, and any
personal data an agent puts in a proposed field. Phone numbers, email addresses, payment
cards and IBANs in scanned free-text fields are masked before a passing proposal is written.
Teamwork Graph documents do not include field values, amounts, or personal data.

**Retention:** data lives on the customer's site for as long as the app is installed and the
work item or store entries remain. Uninstalling the app removes the app's Forge storage.
Issue properties on the work item remain until someone deletes them. When an admin
disconnects the Teamwork Graph connector, Atlassian deletes the ingested documents.

A public privacy policy URL and an end-user agreement are still required for the listing.
Atlassian offers a standard, customizable end-user agreement. Those documents have not been
published yet; that is an Alex-only step below.

## Alex-only steps (do not do these in this PR)

Taken from [Become a partner](https://developer.atlassian.com/platform/marketplace/become-a-partner/),
[List a Forge app](https://developer.atlassian.com/platform/marketplace/listing-forge-apps/),
[Listing principles](https://developer.atlassian.com/platform/marketplace/marketplace-app-listing-principles/),
[Privacy and Security tab](https://developer.atlassian.com/platform/marketplace/security-privacy-tab/),
and [Partner due diligence](https://developer.atlassian.com/platform/marketplace/partner-due-diligence/).

1. **Create the Codegeist install link first.** In the developer console, use
   [Start sharing your app](https://developer.atlassian.com/platform/forge/distribute-your-apps/#start-sharing-your-app).
   Once an app is listed on the Marketplace, that share-link flow is no longer available for
   the listed app. Official Codegeist guidance is to give judges an unlicensed copy via an
   installation link. Create and keep that link (or a copy of the app) **before** submitting
   the listing.
2. Log in to [marketplace.atlassian.com](https://marketplace.atlassian.com/) with your
   Atlassian account (the nightmoose developer account).
3. **Create a partner profile.** The docs still say an individual developer without a parent
   company should create the profile under their own name (for example, "Alex Suarez"), not
   an employer. Accept the developer terms. This must be you, not an agent.
4. **Partner Verification (since 2 June 2025).** Anyone who wants to upload an app is given
   a Partner Verification ticket. It asks for a **registered business entity** (business
   name, physical address, registration number and/or tax ID) and identity verification of
   the primary contact through Stripe Identity (government ID and a selfie, on a phone).
   Community reports say a personal-only profile often cannot finish publishing. If you do
   not have a registered business, stop and decide how to proceed; do not invent an entity.
   This may affect the Marketplace bonus timing (the review-ticket link is enough for
   Codegeist once a listing is submitted).
5. Turn on **sharing** for the app in the developer console, then follow "publish the
   developer space" / create the Marketplace listing for this Forge app.
6. Publish a **privacy policy** URL and an **end-user agreement** (Atlassian's standard
   customizable agreement is an option). Fill the Privacy & Security tab with the answers
   above. Add a support contact and a working support URL.
7. Add branding: app icon, screenshots (1840×900) and the three highlight crops (580×330)
   with captions. A short demo clip (under 30 seconds on the listing; the Codegeist video is
   separate and may be up to 5 minutes) is recommended.
8. When submitting, be ready to explain each API scope and to confirm there are no remote
   hosts. Keep the listing **free**. Do not enable licensing in the manifest.
9. Submit for review. Atlassian aims to decide in about a week (plan around 5–10 business
   days). For the Codegeist Marketplace bonus, either the live listing URL or the
   **review-ticket link** counts. Target submitting around 11 Dec 2026, ahead of the
   22 Dec 2026, 3:00 PM ET deadline.
10. After approval, do not rely on the listed app as the judges' install path; give them the
    unlicensed install link from step 1.

Sources: the pages linked above, retrieved 26 Nov 2026.
