import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, Heading, SectionMessage, Spinner, Stack, Text, TextArea, Strong,
} from '@forge/react';
import { call } from './call';

interface AdminState {
  contract: { name: string; version: string; source: string };
  held: { id: string; issueKey: string; agent: string; at: string; reasons: string[] }[];
}

const SETUP_STEPS = [
  'Rovo: open Rovo Chat and pick the "Ticket Intake" agent. If it is missing, check that Rovo is enabled for this site.',
  'Automation (optional): rule "Work item created" → "Use Rovo agent" → Ticket Intake, so new tickets are filled automatically.',
  'MCP (optional): Atlassian Administration → Apps → this site → TicketGate → Tools, turn on external exposure.',
];

function App() {
  const [state, setState] = useState<AdminState | null>(null);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => call<AdminState>('getAdminState').then((s) => { setState(s); setDraft(s.contract.source); });
  useEffect(() => { load(); }, []);
  const save = () =>
    call<{ version: string }>('saveContract', { yaml: draft })
      .then((r) => { setMsg({ ok: true, text: `Saved contract version ${r.version}` }); load(); })
      .catch((e) => setMsg({ ok: false, text: String(e) }));

  if (!state) return <Spinner label="Loading" />;
  return (
    <Stack space="space.300">
      <Heading size="large">TicketGate</Heading>
      <Stack space="space.100">
        <Heading size="medium">Setup check</Heading>
        {SETUP_STEPS.map((s, i) => <Text key={i}>{i + 1}. {s}</Text>)}
      </Stack>
      <Stack space="space.100">
        <Heading size="medium">Contract: {state.contract.name}@{state.contract.version}</Heading>
        <TextArea name="contract" value={draft} onChange={(e) => setDraft(e.target.value)} resize="vertical" />
        <Button appearance="primary" onClick={save}>Validate and save</Button>
        {msg && <SectionMessage appearance={msg.ok ? 'success' : 'error'}><Text>{msg.text}</Text></SectionMessage>}
      </Stack>
      <Stack space="space.100">
        <Heading size="medium">Held proposals ({state.held.length})</Heading>
        {state.held.length === 0 && <Text>None.</Text>}
        {state.held.map((h) => (
          <Text key={h.id}><Strong>{h.issueKey}</Strong> · {h.agent} · {h.at}: {h.reasons.join('; ')}</Text>
        ))}
      </Stack>
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);
