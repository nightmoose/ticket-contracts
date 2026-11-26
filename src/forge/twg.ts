// Teamwork Graph read (Preview API). Runs as the current user only, so it is called from the
// issue panel resolver. Uses the curated query atlassianUserReportedJiraWorkItems: other tickets
// this reporter has opened, which surfaces repeat refund requests next to a held proposal.
import api, { route } from '@forge/api';

const QUERY = `query ticketgate_reporterTickets($userId: ID!, $first: Int) {
  atlassianUserReportedJiraWorkItems(userId: $userId, first: $first) {
    edges { node { __typename ... on JiraWorkItem { key summary } } }
  }
}`;

export interface RelatedTicket { key: string; summary: string }

export function parseRelated(body: unknown, currentKey: string): RelatedTicket[] {
  const edges = (body as { data?: { atlassianUserReportedJiraWorkItems?: { edges?: { node?: { key?: string; summary?: string } }[] } } })
    ?.data?.atlassianUserReportedJiraWorkItems?.edges ?? [];
  return edges
    .map((e) => e.node)
    .filter((n): n is { key: string; summary: string } => !!n?.key && n.key !== currentKey)
    .map((n) => ({ key: n.key, summary: n.summary ?? '' }));
}

export async function reporterTickets(issueKey: string): Promise<{ ok: boolean; items: RelatedTicket[]; note?: string }> {
  const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}?fields=reporter`, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { ok: false, items: [], note: `Jira ${res.status}` };
  const reporter = ((await res.json()) as { fields?: { reporter?: { accountId?: string } } }).fields?.reporter?.accountId;
  if (!reporter) return { ok: true, items: [], note: 'No reporter on this work item' };
  const twg = await api.asUser().requestTeamworkGraph(QUERY, { userId: `ari:cloud:identity::user/${reporter}`, first: 10 }, 'ticketgate_reporterTickets');
  const body = await twg.json();
  const errors = (body as { errors?: { message: string }[] }).errors;
  if (errors?.length) return { ok: false, items: [], note: errors.map((e) => e.message).join('; ').slice(0, 300) };
  // Missing read:graph scopes return empty data, not an error: say so in the panel.
  const items = parseRelated(body, issueKey);
  return { ok: true, items, note: items.length ? undefined : 'No other tickets from this reporter in Teamwork Graph (or the app is missing read:graph scopes).' };
}
