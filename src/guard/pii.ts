import type { PiiFinding, PiiKind } from './types';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// IBAN: 2 letters, 2 digits, 11-30 alphanumerics, optional single spaces between groups.
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g;
// Card: 13-19 digits with optional spaces/dashes; confirmed with a Luhn check.
const CARD = /\b\d(?:[ -]?\d){12,18}\b/g;
// Phone: optional +country, 9-15 digits total with common separators. Run after card/IBAN.
const PHONE = /(?<![\w-])\+?\d{1,3}?[ .-]?\(?\d{2,4}\)?(?:[ .-]?\d{2,4}){2,4}(?![\w-])/g;

export function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

function maskEmail(s: string): string {
  const [user, domain] = s.split('@');
  return `${user[0]}***@${domain}`;
}

function maskTail(s: string, keep: number, label: string): string {
  const digits = s.replace(/\D/g, '');
  return `[${label} ••${digits.slice(-keep)}]`;
}

/** Placeholder tokens must not be re-detected by later passes. */
const PLACEHOLDER = /\[(?:card|iban|phone) ••[0-9A-Z]{0,4}\]/;

/**
 * Mask PII in free text. Returns masked text plus findings.
 * Order matters: emails, then IBAN, then Luhn-valid cards, then phones,
 * so a card number is never reported as a phone.
 */
export function maskText(
  text: string,
  where: string,
  detectors: PiiKind[] = ['email', 'phone', 'card', 'iban'],
): { text: string; findings: PiiFinding[] } {
  const findings: PiiFinding[] = [];
  let out = text;
  const on = new Set(detectors);

  if (on.has('email')) {
    out = out.replace(EMAIL, (m) => {
      const masked = maskEmail(m);
      findings.push({ kind: 'email', where, masked });
      return masked;
    });
  }
  if (on.has('iban')) {
    out = out.replace(IBAN, (m) => {
      const compact = m.replace(/ /g, '');
      if (compact.length < 15 || !/\d{6,}/.test(compact)) return m;
      const masked = `[iban ••${compact.slice(-4)}]`;
      findings.push({ kind: 'iban', where, masked });
      return masked;
    });
  }
  if (on.has('card')) {
    out = out.replace(CARD, (m) => {
      const digits = m.replace(/\D/g, '');
      if (!luhn(digits)) return m;
      const masked = maskTail(m, 4, 'card');
      findings.push({ kind: 'card', where, masked });
      return masked;
    });
  }
  if (on.has('phone')) {
    out = out.replace(PHONE, (m) => {
      if (PLACEHOLDER.test(m)) return m;
      const digits = m.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) return m;
      // Leave ids, order refs and dates alone: phones need a separator or a leading +.
      if (!/[+ ().-]/.test(m)) return m;
      if (/^\d{4}-\d{2}-\d{2}$/.test(m.trim())) return m;
      const masked = maskTail(m, 2, 'phone');
      findings.push({ kind: 'phone', where, masked });
      return masked;
    });
  }
  return { text: out, findings };
}
