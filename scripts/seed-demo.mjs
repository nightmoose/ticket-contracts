// Create the fixture tickets as work items in a Jira Service Management project.
// Usage: JIRA_SITE=https://<site>.atlassian.net JIRA_EMAIL=... JIRA_TOKEN=... node scripts/seed-demo.mjs [PROJECT_KEY]
// Idempotent: tickets already present (same summary + label ticketgate-demo) are skipped.
import { readdirSync, readFileSync } from 'node:fs';

const site = process.env.JIRA_SITE;
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');
const project = process.argv[2] || 'SUP';
if (!site || !process.env.JIRA_EMAIL || !process.env.JIRA_TOKEN) {
  console.error('Set JIRA_SITE, JIRA_EMAIL and JIRA_TOKEN');
  process.exit(2);
}

async function jira(method, path, body) {
  const res = await fetch(site + path, {
    method,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const types = await jira('GET', `/rest/api/3/issue/createmeta/${project}/issuetypes`);
const type = types.issueTypes.find((t) => t.name === 'Support') ?? types.issueTypes.find((t) => !t.subtask);
const existing = await jira('POST', '/rest/api/3/search/jql', {
  jql: `project = ${project} AND labels = ticketgate-demo`, fields: ['summary', 'description'], maxResults: 100,
});
const have = new Map(existing.issues.map((i) => [i.fields.summary + '\u0000' + JSON.stringify(i.fields.description), i.key]));

const dir = new URL('../fixtures/tickets/', import.meta.url);
const seen = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const fx = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  const description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: fx.ticket.description }] }] };
  const id = fx.ticket.summary + '\u0000' + JSON.stringify(description);
  let key = seen.get(id) ?? have.get(id);
  if (!key) {
    const created = await jira('POST', '/rest/api/3/issue', {
      fields: { project: { key: project }, issuetype: { id: type.id }, summary: fx.ticket.summary, description, labels: ['ticketgate-demo'] },
    });
    key = created.key;
    console.log(`created ${key}  ${f}`);
  } else {
    console.log(`exists  ${key}  ${f}`);
  }
  seen.set(id, key);
}
