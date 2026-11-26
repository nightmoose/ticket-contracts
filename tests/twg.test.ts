import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRelated } from '../src/forge/twg';

test('parseRelated keeps other work items and drops the current one', () => {
  const body = { data: { atlassianUserReportedJiraWorkItems: { edges: [
    { node: { __typename: 'JiraWorkItem', key: 'SUP-2', summary: 'Reembolso' } },
    { node: { __typename: 'JiraWorkItem', key: 'SUP-3', summary: 'Refund again' } },
    { node: null },
  ] } } };
  assert.deepEqual(parseRelated(body, 'SUP-2'), [{ key: 'SUP-3', summary: 'Refund again' }]);
  assert.deepEqual(parseRelated({ data: null }, 'SUP-2'), []);
});
