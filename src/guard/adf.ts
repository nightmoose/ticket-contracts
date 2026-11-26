/** Flatten Atlassian Document Format (Jira v3 description/comment bodies) to plain text. */
export function adfToText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join('');
  if (typeof node !== 'object') return '';
  const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown> };
  if (n.type === 'text') return n.text ?? '';
  if (n.type === 'hardBreak') return '\n';
  if (n.type === 'mention') return String(n.attrs?.text ?? '');
  if (n.type === 'inlineCard') return String(n.attrs?.url ?? '');
  const inner = adfToText(n.content ?? []);
  const block = ['paragraph', 'heading', 'listItem', 'codeBlock', 'blockquote', 'tableRow', 'panel'];
  return block.includes(n.type ?? '') ? inner + '\n' : inner;
}

/** Build the text the guard grounds against: summary, description, then comments. */
export function ticketText(summary: string, description: unknown, comments: unknown[] = []): string {
  return [summary, adfToText(description), ...comments.map(adfToText)].filter(Boolean).join('\n').trim();
}
