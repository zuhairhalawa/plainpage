import { describe, expect, it } from 'vitest';
import { checkFacts, hasTerm, numbers, wordsToDigits } from '../src/check/facts.ts';
import { gradeLevel, syllables } from '../src/check/readability.ts';
import { factText, verifyReading } from '../src/check/verify.ts';
import type { Block, Reading } from '../src/types.ts';

describe('numbers', () => {
  it('normalises digits, commas, decimals, fractions and percentages', () => {
    expect(numbers('A 1,200 m race takes 3.5 minutes; 3 / 4 of runners finish and 25 % win.')).toEqual(['1200', '3.5', '3/4', '25%']);
    expect(numbers('25% and 25 %')).toEqual(['25%', '25%']);
  });
  it('reads number words', () => {
    expect(wordsToDigits('twenty-five apples and three pears, a half cup')).toBe('25 apples and 3 pears, 1/2 cup');
    expect(numbers('Twelve students')).toEqual(['12']);
  });
  it('does not treat words inside other words as numbers', () => {
    expect(numbers('Someone has gone into the tent')).toEqual([]);
  });
  it('leaves "one" as a word but reads twenty-one', () => {
    expect(numbers('particles move past one another')).toEqual([]);
    expect(numbers('twenty-one days')).toEqual(['21']);
  });
});

describe('checkFacts', () => {
  it('passes when every number and term is kept', () => {
    const r = checkFacts('A plant uses photosynthesis to make 6 sugars.', 'Plants make 6 sugars by photosynthesis.', ['photosynthesis']);
    expect(r.missing).toEqual([]);
    expect(r.kept).toEqual(['6', 'photosynthesis']);
  });
  it('flags a dropped number', () => {
    const r = checkFacts('The rope is 12 cm long and 2 cm wide.', 'The rope is 12 cm long.', []);
    expect(r.missing).toEqual(['2']);
  });
  it('counts repeated numbers', () => {
    expect(checkFacts('Add 2 and 2.', 'Add 2 to it.', []).missing).toEqual(['2']);
  });
  it('accepts number words in either version', () => {
    expect(checkFacts('Name three parts of a cell.', 'Write 3 parts of a cell.', []).missing).toEqual([]);
  });
  it('flags a dropped term but ignores terms not on the worksheet', () => {
    const r = checkFacts('Explain evaporation.', 'Explain how water turns into gas.', ['evaporation', 'condensation']);
    expect(r.missing).toEqual(['evaporation']);
  });
  it('allows plurals', () => {
    expect(hasTerm('Label the chloroplasts.', 'chloroplast')).toBe(true);
  });
});

describe('readability', () => {
  it('counts syllables roughly', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('photosynthesis')).toBeGreaterThanOrEqual(4);
  });
  it('rates dense text above simple text', () => {
    const dense = 'Photosynthesis is the physiological mechanism through which chlorophyll-containing organisms synthesise carbohydrates utilising atmospheric carbon dioxide.';
    const simple = 'Plants make food from light. They use air and water. This is called photosynthesis.';
    expect(gradeLevel(dense)!).toBeGreaterThan(gradeLevel(simple)! + 5);
  });
});

const block = (b: Partial<Block>): Block => ({
  kind: 'question',
  number: null,
  original: '',
  plain: '',
  answer: { type: 'short', choices: [] },
  keyTerms: [],
  ...b,
});

describe('factText', () => {
  it('removes the printed number and whole choices only', () => {
    const t = factText('2. At what temperature does water boil?\n A. 0 degrees Celsius B. 50 degrees Celsius C. 100 degrees Celsius', '2', [
      '0 degrees Celsius',
      '50 degrees Celsius',
      '100 degrees Celsius',
    ]);
    expect(numbers(t)).toEqual([]);
    expect(t).toContain('At what temperature');
  });
});

describe('verifyReading', () => {
  const sheet = 'Name: ________\nThe Water Cycle\n\nWater evaporates when the sun heats the sea to about 30 degrees.\n\n1. Explain what happens during evaporation.\n2. How many degrees is the sea in the text?\n\nPage 1';
  const reading: Reading = {
    isWorksheet: true,
    title: 'The Water Cycle',
    subject: 'Science',
    blocks: [
      block({ kind: 'heading', original: 'The Water Cycle', answer: { type: 'none', choices: [] } }),
      block({ kind: 'text', original: 'Water evaporates when the sun heats the sea to about 30 degrees.', plain: 'The sun heats the sea. It gets to about 30 degrees. Then water turns into gas.', answer: { type: 'none', choices: [] } }),
      block({ number: '1', original: 'Explain what happens during evaporation.', plain: 'What happens when water turns into gas?', keyTerms: [{ term: 'evaporation', meaning: 'water turning into gas' }] }),
      block({ number: '2', original: 'How many degrees is the sea in the text?', plain: 'How hot is the sea in the text, in degrees?', answer: { type: 'number', choices: [] } }),
      block({ number: '3', original: 'Draw a diagram of the rain gauge.', plain: 'Draw the rain gauge.' }),
    ],
  };
  const page = verifyReading(sheet, reading);

  it('drops blocks whose text is not on the worksheet', () => {
    expect(page.invented).toBe(1);
    expect(page.blocks.map((b) => b.number)).toEqual([null, null, '1', '2']);
  });
  it('falls back to the original when a key term is lost', () => {
    const q1 = page.blocks.find((b) => b.number === '1')!;
    expect(q1.plainOk).toBe(false);
    expect(q1.missing).toEqual(['evaporation']);
  });
  it('keeps plain text that passes', () => {
    expect(page.blocks.find((b) => b.kind === 'text')!.plainOk).toBe(true);
  });
  it('ignores page furniture for coverage and reports what was left out', () => {
    expect(page.coverage).toBe(1);
    const partial = verifyReading(sheet + '\n\nBonus: list four places where water is stored on Earth.', reading);
    expect(partial.coverage).toBeLessThan(1);
    expect(partial.leftOut).toEqual(['Bonus: list four places where water is stored on Earth']);
  });
  it('lowers the grade level overall', () => {
    expect(page.gradePlain!).toBeLessThan(page.gradeOriginal!);
  });
});
