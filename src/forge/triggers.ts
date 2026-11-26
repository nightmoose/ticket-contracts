import { scanIssue } from './service';
import { forgeDeps } from './forge-deps';

/** avi:jira:created:issue — record which PII kinds a new ticket contains. Never edits the issue. */
export async function onIssueCreated(event: { issue?: { key?: string } }) {
  const key = event.issue?.key;
  if (!key) return;
  try {
    await scanIssue(forgeDeps, key);
  } catch (e) {
    console.error('ticketgate scan failed', key, (e as Error).message);
  }
}
