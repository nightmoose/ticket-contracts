import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box, Button, ButtonGroup, Heading, Inline, Lozenge, SectionMessage, Spinner, Stack, Strong, Text,
} from '@forge/react';
import { call } from './call';

type Status = 'written' | 'held' | 'released' | 'rejected';
interface Violation { check: string; field: string; message: string }
interface Evidence { field: string; value: string | number; snippet: string }
interface Rec {
  id: string; agent: string; source: string; at: string; status: Status;
  result: { decision: string; contract: { name: string; version: string }; violations: Violation[]; evidence: Evidence[]; fields: Record<string, unknown>; fieldStatus: Record<string, string> };
}
interface State { issueKey: string; records: Rec[]; scan: { pii: { kind: string; masked: string }[]; at: string } | null }

const appearance: Record<Status, 'success' | 'moved' | 'inprogress' | 'removed'> = {
  written: 'success', held: 'moved', released: 'inprogress', rejected: 'removed',
};

function RecordView({ rec, onResolve }: { rec: Rec; onResolve: (id: string, a: 'release' | 'reject') => void }) {
  const r = rec.result;
  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={appearance[rec.status]} isBold>{rec.status}</Lozenge>
        <Text>{rec.agent} · {rec.source} · {r.contract.name}@{r.contract.version}</Text>
      </Inline>
      {r.violations.length > 0 && (
        <SectionMessage appearance="warning" title="Held: nothing was written">
          {r.violations.map((v, i) => (
            <Text key={i}><Strong>{v.field}</Strong> [{v.check}]: {v.message}</Text>
          ))}
        </SectionMessage>
      )}
      {Object.entries(r.fields).map(([f, v]) => (
        <Inline key={f} space="space.100">
          <Text><Strong>{f}</Strong>: {v === null ? 'null' : String(v)}</Text>
          {r.fieldStatus[f] === 'masked' && <Lozenge appearance="new">PII masked</Lozenge>}
          {r.fieldStatus[f] === 'held' && <Lozenge appearance="removed">held</Lozenge>}
        </Inline>
      ))}
      {r.evidence.length > 0 && (
        <Stack space="space.050">
          <Heading size="xsmall">Found in the ticket</Heading>
          {r.evidence.map((e, i) => <Text key={i}>{e.field}: “{e.snippet}”</Text>)}
        </Stack>
      )}
      {rec.status === 'held' && (
        <ButtonGroup>
          <Button onClick={() => onResolve(rec.id, 'release')}>Release passing fields</Button>
          <Button appearance="subtle" onClick={() => onResolve(rec.id, 'reject')}>Reject</Button>
        </ButtonGroup>
      )}
    </Stack>
  );
}

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => call<State>('getIssueState').then(setState).catch((e) => setError(String(e)));
  useEffect(() => { load(); }, []);
  const onResolve = (recordId: string, action: 'release' | 'reject') =>
    call('resolveHeld', { recordId, action }).then(load).catch((e) => setError(String(e)));

  if (error) return <SectionMessage appearance="error" title="TicketGate">{<Text>{error}</Text>}</SectionMessage>;
  if (!state) return <Spinner label="Loading TicketGate" />;
  const [latest, ...older] = state.records;
  return (
    <Stack space="space.200">
      {state.scan && state.scan.pii.length > 0 && (
        <SectionMessage appearance="information" title="PII in this ticket">
          <Text>{[...new Set(state.scan.pii.map((p) => p.kind))].join(', ')}. Agents' writes are masked before they land.</Text>
        </SectionMessage>
      )}
      {!latest && <Text>No agent proposals yet. Ask the Ticket Intake agent to fill this ticket's fields.</Text>}
      {latest && <RecordView rec={latest} onResolve={onResolve} />}
      {older.length > 0 && (
        <Box>
          <Heading size="xsmall">Earlier proposals</Heading>
          {older.map((r) => <Text key={r.id}>{r.at} · {r.agent} · {r.status} · {r.result.violations.length} issue(s)</Text>)}
        </Box>
      )}
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
