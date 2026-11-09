/**
 * Finds where a quote from the reader sits in the letter's text. A finding
 * whose quote can't be found is not shown as a verdict: the model may have
 * paraphrased or invented it.
 *
 * Matching ignores case, spacing, curly vs straight quotes and dash styles.
 * For photos, OCR noise is allowed for: a quote also matches when at least
 * `minRatio` of its words appear in order in a window of the text.
 */

interface Normalised {
  text: string;
  /** For each character of `text`, its index in the original. */
  map: number[];
}

function normaliseChar(c: string): string {
  if (/[‘’‚‛`´]/.test(c)) return "'";
  if (/[“”„‟]/.test(c)) return '"';
  if (/[‐‑‒–—―−]/.test(c)) return '-';
  return c.toLowerCase();
}

function normalise(s: string): Normalised {
  let text = '';
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (/\s/.test(c)) {
      if (!lastSpace) {
        text += ' ';
        map.push(i);
        lastSpace = true;
      }
      continue;
    }
    text += normaliseChar(c);
    map.push(i);
    lastSpace = false;
  }
  return { text: text.trimEnd(), map };
}

export interface QuoteMatch {
  start: number;
  end: number;
  exact: boolean;
}

const WORD = /[a-z0-9]+(?:['.,][a-z0-9]+)*/g;

function words(s: string): { w: string; start: number; end: number }[] {
  const out: { w: string; start: number; end: number }[] = [];
  WORD.lastIndex = 0;
  for (let m = WORD.exec(s); m; m = WORD.exec(s)) out.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/** Edit distance up to a small limit (for single OCR slips like "rn" for "m"). */
function close(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2 || a.length < 4) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] as number;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] as number;
      prev[j] = Math.min((prev[j] as number) + 1, (prev[j - 1] as number) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return (prev[b.length] as number) <= 2;
}

export function locateQuote(text: string, quote: string, minRatio = 0.85): QuoteMatch | null {
  const q = normalise(quote).text.replace(/^["']|["']$/g, '').trim();
  if (q.length < 8) return null;
  const t = normalise(text);

  const at = t.text.indexOf(q);
  if (at >= 0) {
    return { start: t.map[at] as number, end: (t.map[at + q.length - 1] as number) + 1, exact: true };
  }

  // Fuzzy: slide a window of the quote's word count over the text's words.
  const qw = words(q);
  const tw = words(t.text);
  if (qw.length < 3 || tw.length < qw.length) return null;
  let best = { score: 0, i: -1, len: 0 };
  const span = qw.length + 2;
  for (let i = 0; i + qw.length <= tw.length; i++) {
    // Count quote words found in order inside the window.
    let k = 0;
    let firstHit = -1;
    let lastHit = -1;
    for (let j = i; j < Math.min(tw.length, i + span) && k < qw.length; j++) {
      const w = (tw[j] as { w: string }).w;
      let hit = false;
      if (close(w, (qw[k] as { w: string }).w)) {
        k++;
        hit = true;
      } else if (k + 1 < qw.length && close(w, (qw[k + 1] as { w: string }).w)) {
        k += 2;
        hit = true;
      }
      if (hit) {
        if (firstHit < 0) firstHit = j;
        lastHit = j;
      }
    }
    const score = Math.min(k, qw.length) / qw.length;
    if (score > best.score) best = { score, i: firstHit, len: lastHit - firstHit + 1 };
  }
  if (best.score < minRatio || best.i < 0) return null;
  const first = tw[best.i] as { start: number };
  const last = tw[best.i + best.len - 1] as { end: number };
  return { start: t.map[first.start] as number, end: (t.map[last.end - 1] as number) + 1, exact: false };
}
