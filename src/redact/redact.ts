/**
 * Blanks personal details out of the letter's text on the device, before
 * anything is sent anywhere. Masks keep the text's length (each character
 * becomes █), so positions found later still line up with the original.
 */

export type MaskKind = 'email' | 'phone' | 'emirates-id' | 'passport' | 'iban' | 'name' | 'user';

export interface Mask {
  start: number;
  end: number;
  kind: MaskKind;
}

export const MASK_CHAR = '█';

interface Pattern {
  kind: MaskKind;
  re: RegExp;
  /** Capture group to mask; 0 means the whole match. */
  group: number;
}

const PATTERNS: Pattern[] = [
  { kind: 'email', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, group: 0 },
  // Emirates ID: 784-YYYY-NNNNNNN-C, with or without dashes or spaces.
  { kind: 'emirates-id', re: /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g, group: 0 },
  // UAE IBAN: AE + 21 digits, often grouped in fours.
  { kind: 'iban', re: /\bAE\d{2}(?:\s?\d){19}\b/g, group: 0 },
  // UAE phone numbers: +971 / 00971 / 0, then a mobile (5x) or area code.
  { kind: 'phone', re: /(?:\+971|00971|\b0)[\s-]?(?:5\d|[2-9])[\s-]?\d{3}[\s-]?\d{4}\b/g, group: 0 },
  // Passport number after the word "passport".
  { kind: 'passport', re: /passport\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z]{0,2}\d[A-Z0-9]{5,8})\b/gi, group: 1 },
  // "Dear Aisha Khan," / "Dear Mr. Omar,"
  { kind: 'name', re: /\bDear\s+((?:(?:Mr|Ms|Mrs|Dr)\.?\s+)?[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){0,3})\s*[,:\n]/g, group: 1 },
  // "Name: ...", "Student name: ...", "Candidate: ..." up to the end of the line.
  { kind: 'name', re: /^\s*(?:Employee\s+|Candidate\s+|Full\s+|Student\s+|Pupil\s+|Learner\s+)?(?:Name|Candidate)\s*:\s*([^\n]+)$/gim, group: 1 },
];

/** Finds personal details. Overlapping matches are merged. */
export function findPersonalDetails(text: string): Mask[] {
  const found: Mask[] = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    for (let m = p.re.exec(text); m; m = p.re.exec(text)) {
      const part = m[p.group];
      if (!part) continue;
      const start = m.index + (p.group === 0 ? 0 : m[0].indexOf(part));
      found.push({ start, end: start + part.trimEnd().length, kind: p.kind });
    }
  }
  return mergeMasks(found);
}

export function mergeMasks(masks: Mask[]): Mask[] {
  const sorted = [...masks].sort((a, b) => a.start - b.start);
  const out: Mask[] = [];
  for (const m of sorted) {
    const last = out[out.length - 1];
    if (last && m.start <= last.end) last.end = Math.max(last.end, m.end);
    else out.push({ ...m });
  }
  return out;
}

/** The text with every mask replaced by █ characters (newlines kept). */
export function applyMasks(text: string, masks: Mask[]): string {
  // UTF-16 indexes throughout, which is what the regexes and selections use.
  let out = text;
  for (const m of masks) {
    const middle = out.slice(m.start, m.end).replace(/[^\n]/g, MASK_CHAR);
    out = out.slice(0, m.start) + middle + out.slice(m.end);
  }
  return out;
}

/** Blank out personal details; returns the safe text and what was masked. */
export function redact(text: string, extra: Mask[] = []): { text: string; masks: Mask[] } {
  const masks = mergeMasks([...findPersonalDetails(text), ...extra]);
  return { text: applyMasks(text, masks), masks };
}
