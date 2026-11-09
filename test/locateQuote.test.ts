import { describe, expect, it } from 'vitest';
import { locateQuote } from '../src/read/locateQuote.ts';

const letter = `Dear Candidate,

We are pleased to offer you the position of Junior Developer.
Your probation period will be  six (6) months, during which
either party may end the employment with 7 days’ notice.
You agree not to work for any competitor anywhere in the world for 3 years.`;

describe('locateQuote', () => {
  it('finds an exact quote despite line breaks, double spaces and curly quotes', () => {
    const q = "either party may end the employment with 7 days' notice.";
    const m = locateQuote(letter, q);
    expect(m?.exact).toBe(true);
    expect(letter.slice(m!.start, m!.end)).toBe('either party may end the employment with 7 days’ notice.');
  });

  it('matches across a line break inside the quote', () => {
    const m = locateQuote(letter, 'Your probation period will be six (6) months, during which either party');
    expect(m).not.toBeNull();
    expect(letter.slice(m!.start, m!.end)).toContain('six (6) months, during which\neither party');
  });

  it('tolerates small OCR slips', () => {
    const ocr = letter.replace('competitor', 'cornpetitor').replace('world', 'wor1d');
    const m = locateQuote(ocr, 'You agree not to work for any competitor anywhere in the world for 3 years.');
    expect(m).not.toBeNull();
    expect(m!.exact).toBe(false);
    expect(ocr.slice(m!.start, m!.end)).toMatch(/^You agree.*years$/);
  });

  it('rejects a quote that is not in the letter', () => {
    expect(locateQuote(letter, 'The employer will keep your passport for safekeeping.')).toBeNull();
  });

  it('rejects a paraphrase', () => {
    expect(locateQuote(letter, 'You cannot join a competitor anywhere for three years after leaving.')).toBeNull();
  });
});
