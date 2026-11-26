import type { Evidence } from './types';

/** Upper-case and drop everything but letters and digits, keeping a map back to source offsets. */
function compact(text: string): { s: string; map: number[] } {
  let s = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/[\p{L}\p{N}]/u.test(ch)) {
      s += ch.toUpperCase();
      map.push(i);
    }
  }
  return { s, map };
}

function snippetAt(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + len + 30);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '');
}

/**
 * A string value is grounded if, ignoring case, spaces and punctuation, it occurs in the ticket
 * text on token boundaries. "ORD-123456" matches "ord 123456" but not "ORD-1234567".
 */
export function findString(text: string, value: string): number {
  const needle = compact(value).s;
  if (!needle) return -1;
  const hay = compact(text);
  let from = 0;
  for (;;) {
    const at = hay.s.indexOf(needle, from);
    if (at < 0) return -1;
    const before = at > 0 ? hay.s[at - 1] : '';
    const after = hay.s[at + needle.length] ?? '';
    const srcStart = hay.map[at];
    const srcEnd = hay.map[at + needle.length - 1];
    const prevCh = srcStart > 0 ? text[srcStart - 1] : ' ';
    const nextCh = srcEnd + 1 < text.length ? text[srcEnd + 1] : ' ';
    const boundaryBefore = !before || !/[\p{L}\p{N}]/u.test(prevCh);
    const boundaryAfter = !after || !/[\p{L}\p{N}]/u.test(nextCh);
    if (boundaryBefore && boundaryAfter) return srcStart;
    from = at + 1;
  }
}

const NUMBER_TOKEN = /\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;

/** Parse a number written in either 1,234.56 or 1.234,56 style. Returns all plausible readings. */
export function readings(tok: string): number[] {
  const t = tok.replace(/\s/g, '');
  const out = new Set<number>();
  const lastSep = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
  if (lastSep < 0) {
    out.add(Number(t));
  } else {
    const decimals = t.length - lastSep - 1;
    const intPart = t.slice(0, lastSep).replace(/[.,]/g, '');
    if (decimals <= 2) out.add(Number(`${intPart}.${t.slice(lastSep + 1)}`));
    if (decimals === 3) out.add(Number(t.replace(/[.,]/g, '')));
  }
  return [...out].filter((n) => Number.isFinite(n));
}

/** A number is grounded if some numeric token in the text reads as the same value (to the cent). */
export function findNumber(text: string, value: number): number {
  for (const m of text.matchAll(NUMBER_TOKEN)) {
    const prev = m.index! > 0 ? text[m.index! - 1] : ' ';
    // Skip digits glued to letters or dashes, e.g. "ORD-123456" or "T-88".
    if (/[\p{L}-]/u.test(prev)) continue;
    if (readings(m[0]).some((n) => Math.abs(n - value) < 0.005)) return m.index!;
  }
  return -1;
}

export function ground(
  text: string,
  field: string,
  value: unknown,
): { ok: true; evidence: Evidence } | { ok: false } {
  let index = -1;
  let len = 0;
  if (typeof value === 'number') {
    index = findNumber(text, value);
    len = String(value).length;
  } else if (typeof value === 'string') {
    index = findString(text, value);
    len = value.length;
  } else {
    return { ok: false };
  }
  if (index < 0) return { ok: false };
  return { ok: true, evidence: { field, value: value as string | number, index, snippet: snippetAt(text, index, len) } };
}
