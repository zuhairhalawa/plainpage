import { describe, expect, it } from 'vitest';
import { MASK_CHAR, redact } from '../src/redact/redact.ts';

const masked = (s: string) => MASK_CHAR.repeat(s.length);

describe('redact', () => {
  it('keeps the text length so positions still line up', () => {
    const t = 'Dear Aisha Khan,\nEmail aisha.k@mail.com or call +971 50 123 4567.';
    const r = redact(t);
    expect(r.text.length).toBe(t.length);
  });

  it('masks emails, phones, Emirates ID, IBAN and passport numbers', () => {
    const t = [
      'Email: aisha.k@mail.com',
      'Mobile: +971 50 123 4567, office 04 123 4567, alt 0501234567',
      'Emirates ID: 784-1999-1234567-1',
      'IBAN: AE07 0331 2345 6789 0123 456',
      'Passport No: N1234567',
    ].join('\n');
    const r = redact(t).text;
    expect(r).not.toContain('aisha.k@mail.com');
    expect(r).not.toContain('123 4567');
    expect(r).not.toContain('0501234567');
    expect(r).not.toContain('784-1999-1234567-1');
    expect(r).not.toContain('AE07 0331');
    expect(r).not.toContain('N1234567');
    expect(r).toContain('Passport No: ' + masked('N1234567'));
  });

  it('masks the name after "Dear" and on "Name:" lines', () => {
    const r = redact('Dear Ms. Aisha Khan,\nEmployee Name: Aisha Khan\nPosition: Intern').text;
    expect(r).toBe(`Dear ${masked('Ms. Aisha Khan')},\nEmployee Name: ${masked('Aisha Khan')}\nPosition: Intern`);
  });

  it('leaves money, dates and article numbers alone', () => {
    const t = 'Basic salary AED 4,000 per month from 01/02/2027. Probation: 6 months (Article 9).';
    expect(redact(t).text).toBe(t);
  });

  it('adds masks the user selects', () => {
    const t = 'Signed by Omar in Dubai';
    const r = redact(t, [{ start: 10, end: 14, kind: 'user' }]);
    expect(r.text).toBe(`Signed by ${masked('Omar')} in Dubai`);
  });
});
