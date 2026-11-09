/**
 * The facts a plain-English rewrite must keep: every number (with fractions,
 * decimals and percentages) and every key term. Number words count as numbers,
 * so "three" in the worksheet is kept by "3" in the rewrite, and the other way round.
 * "One" is left alone: it is usually a word ("one another", "one of"), not a quantity.
 */

const UNITS: Record<string, number> = {
  zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const FRACTION_WORDS: Record<string, string> = { half: '1/2', 'a half': '1/2', 'one half': '1/2', quarter: '1/4', 'a quarter': '1/4', 'one quarter': '1/4', 'three quarters': '3/4' };

/** Replaces number words ("twenty-five", "three", "a half") with digits. */
export function wordsToDigits(s: string): string {
  let out = s.replace(/\b(three quarters|one quarter|a quarter|one half|a half)\b/gi, (m) => FRACTION_WORDS[m.toLowerCase()] ?? m);
  out = out.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](one|two|three|four|five|six|seven|eight|nine))?\b/gi, (_m, t: string, u?: string) =>
    String((TENS[t.toLowerCase()] ?? 0) + (u ? (u.toLowerCase() === 'one' ? 1 : (UNITS[u.toLowerCase()] ?? 0)) : 0)),
  );
  out = out.replace(/\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi, (m) =>
    String(UNITS[m.toLowerCase()]),
  );
  return out;
}

const NUMBER = /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:\s*\/\s*(\d+))?(\s*%)?/g;

/** All numbers in a text, normalised ("1,200" → "1200", "3 / 4" → "3/4", "25 %" → "25%"). */
export function numbers(s: string): string[] {
  const t = wordsToDigits(s);
  const out: string[] = [];
  NUMBER.lastIndex = 0;
  for (let m = NUMBER.exec(t); m; m = NUMBER.exec(t)) {
    let n = (m[1] as string).replace(/,/g, '');
    if (m[2]) n += `.${m[2]}`;
    if (m[3]) n += `/${m[3]}`;
    if (m[4]) n += '%';
    out.push(n);
  }
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/** True when `term` appears in `text` as whole words (case and spacing ignored, simple plural allowed). */
export function hasTerm(text: string, term: string): boolean {
  const t = norm(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!t) return false;
  return new RegExp(`(?<![a-z0-9])${t}(?:s|es)?(?![a-z0-9])`, 'i').test(norm(text));
}

export interface FactCheck {
  kept: string[];
  missing: string[];
}

/**
 * Checks that `plain` keeps every number in `original` (as many times as it
 * appears) and every key term that the original really contains.
 */
export function checkFacts(original: string, plain: string, terms: string[]): FactCheck {
  const kept: string[] = [];
  const missing: string[] = [];
  const pool = numbers(plain);
  for (const n of numbers(original)) {
    const i = pool.indexOf(n);
    if (i >= 0) {
      pool.splice(i, 1);
      kept.push(n);
    } else missing.push(n);
  }
  for (const term of terms) {
    if (!hasTerm(original, term)) continue; // Not on the worksheet: nothing to keep.
    (hasTerm(plain, term) ? kept : missing).push(term);
  }
  return { kept, missing };
}
