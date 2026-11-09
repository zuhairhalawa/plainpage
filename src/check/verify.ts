/**
 * Checks the reader's output against the worksheet before anything is shown:
 * 1. Every block's original text must really be on the worksheet, or the block is dropped.
 * 2. Every number and key term in a block must survive in its plain version,
 *    or the original wording is shown instead.
 * 3. Worksheet text that no block covers is listed, so nothing silently disappears.
 */
import { locateQuote } from '../read/locateQuote.ts';
import type { CheckedBlock, CheckedPage, Reading } from '../types.ts';
import { checkFacts, hasTerm } from './facts.ts';
import { gradeLevel } from './readability.ts';

const FURNITURE = /^\s*(name|date|class|teacher|period|form|score|mark)s?\s*[:_.\-]|^\s*(page\s*)?\d{1,3}\s*(of\s*\d+)?\s*$/i;

function locate(text: string, original: string): CheckedBlock['span'] {
  const q = original.trim();
  if (!q) return null;
  if (q.length < 8) {
    const at = text.toLowerCase().indexOf(q.toLowerCase());
    return at >= 0 ? { start: at, end: at + q.length, exact: true } : null;
  }
  return locateQuote(text, q, 0.8);
}

/** Word spans of the source text that count as content (not page furniture). */
function contentWords(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let lineStart = 0;
  for (const line of text.split('\n')) {
    if (!FURNITURE.test(line) && line.replace(/[_\s.]/g, '').length > 0) {
      // Printed question numbers ("1.", "2b)", "Q3") are not content of their own.
      const skip = (/^\s*(?:q(?:uestion)?\s*)?\(?\d{1,2}[a-z]?[.):]\s*/i.exec(line)?.[0] ?? '').length;
      for (const m of line.slice(skip).matchAll(/[A-Za-z0-9]+/g)) {
        const at = lineStart + skip + (m.index ?? 0);
        out.push({ start: at, end: at + m[0].length });
      }
    }
    lineStart += line.length + 1;
  }
  return out;
}

/** The part of a block whose facts the plain version must keep: without the printed number and the answer choices, which are shown as printed. */
export function factText(original: string, number: string | null, choices: string[]): string {
  const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let t = original;
  if (number) t = t.replace(new RegExp(`^\\s*(?:q(?:uestion)?\\s*)?\\(?${re(number)}[.):]?\\s*`, 'i'), '');
  // Whole choices only, longest first, so removing "0 degrees" never eats the end of "50 degrees".
  for (const c of [...choices].sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(`(?<![\\w.])${re(c.trim())}(?![\\w])`, 'gi'), ' ');
  }
  return t.replace(/(^|\s)\(?[A-Ha-h][.)](?=\s)/g, ' ');
}

export function verifyReading(text: string, reading: Reading): CheckedPage {
  const blocks: CheckedBlock[] = [];
  let invented = 0;
  for (const [i, b] of reading.blocks.entries()) {
    const span = locate(text, b.original);
    if (!span) {
      invented++;
      continue;
    }
    // Key terms must come from the worksheet itself.
    const keyTerms = b.keyTerms.filter((k) => k.term.trim() && hasTerm(b.original, k.term)).slice(0, 3);
    // Answer choices are shown as they are printed, so only keep the ones really on the worksheet.
    const choices = b.kind === 'question' ? b.answer.choices.filter((c) => c.trim() && b.original.toLowerCase().includes(c.trim().toLowerCase())) : [];
    const answerType = b.kind !== 'question' ? 'none' : b.answer.type === 'choice' && choices.length < 2 ? 'short' : b.answer.type;
    const { kept, missing } = b.kind === 'heading' ? { kept: [], missing: [] } : checkFacts(factText(b.original, b.number, choices), b.plain, keyTerms.map((k) => k.term));
    const plainOk = b.kind !== 'heading' && b.plain.trim().length > 0 && missing.length === 0;
    blocks.push({
      ...b,
      keyTerms,
      answer: { type: answerType, choices: answerType === 'choice' ? choices : [] },
      id: `b${i}`,
      span,
      kept,
      missing,
      plainOk,
      gradeOriginal: b.kind === 'heading' ? null : gradeLevel(b.original),
      gradePlain: plainOk ? gradeLevel(b.plain) : null,
    });
  }

  // Coverage: which content words of the worksheet ended up in some block.
  const words = contentWords(text);
  const covered = words.map((w) => blocks.some((b) => b.span && w.start >= b.span.start && w.end <= b.span.end));
  const coverage = words.length ? covered.filter(Boolean).length / words.length : 1;
  const leftOut: string[] = [];
  let run: { start: number; end: number; n: number } | null = null;
  const flush = () => {
    if (run && run.n >= 4) leftOut.push(text.slice(run.start, run.end).replace(/\s+/g, ' ').trim());
    run = null;
  };
  words.forEach((w, i) => {
    if (covered[i]) return flush();
    if (run && text.slice(run.end, w.start).includes('\n\n')) flush();
    run = run ? { ...run, end: w.end, n: run.n + 1 } : { start: w.start, end: w.end, n: 1 };
  });
  flush();

  const shown = blocks.filter((b) => b.kind !== 'heading');
  const all = (pick: (b: CheckedBlock) => string) => shown.map(pick).join(' ');
  return {
    title: reading.title,
    subject: reading.subject,
    blocks,
    coverage,
    leftOut,
    invented,
    gradeOriginal: gradeLevel(all((b) => b.original)),
    gradePlain: gradeLevel(all((b) => (b.plainOk ? b.plain : b.original))),
  };
}
