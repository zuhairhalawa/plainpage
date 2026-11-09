/**
 * Accuracy test: runs the live reader and the checks on every fictional
 * worksheet in eval/sheets and compares the result with *.expected.json.
 *
 * Usage: npm run eval -- [runs]   (needs GEMINI_API_KEY in .dev.vars; never printed)
 * Writes eval/out/results.json. Numbers in the README come from this file.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { checkFacts } from '../src/check/facts.ts';
import { verifyReading } from '../src/check/verify.ts';
import { redact } from '../src/redact/redact.ts';
import { loadVars, read } from './try-read.ts';

interface Expected {
  isWorksheet: boolean;
  questions: number;
  answers: Record<string, string[]>;
}

const dir = new URL('./sheets/', import.meta.url);
const runs = Number(process.argv[2] ?? 1);
const vars = loadVars();
const rows: Record<string, unknown>[] = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()) {
  const raw = readFileSync(new URL(file, dir), 'utf8');
  const exp = JSON.parse(readFileSync(new URL(file.replace('.txt', '.expected.json'), dir), 'utf8')) as Expected;
  for (let run = 1; run <= runs; run++) {
    const text = redact(raw).text;
    const { data, model, ms } = await read(text, vars);
    const page = verifyReading(text, data);
    const questions = page.blocks.filter((b) => b.kind === 'question');
    const shown = page.blocks.filter((b) => b.kind !== 'heading');
    // Independent re-check: facts lost on what the reader actually sees (plain when it passed, else as printed).
    const lostOnPage = shown.reduce((n, b) => n + checkFacts(b.original, b.plainOk ? b.plain : b.original, b.keyTerms.map((k) => k.term)).missing.length, 0);
    const factsTotal = shown.reduce((n, b) => n + b.kept.length + b.missing.length, 0);
    const caught = shown.filter((b) => !b.plainOk && b.plain.trim()).map((b) => `${b.number ?? b.kind}: ${b.missing.join(', ')}`);
    // Answer leaks: an expected answer word that the plain question adds but the printed question doesn't contain.
    const leaks: string[] = [];
    for (const q of questions) {
      const key = q.number?.replace(/[.)]/g, '').replace(/^Task\s*/i, '') ?? '';
      for (const a of exp.answers[key] ?? []) {
        if (q.plain.toLowerCase().includes(a.toLowerCase()) && !q.original.toLowerCase().includes(a.toLowerCase())) leaks.push(`${key}: "${a}"`);
      }
    }
    const row = {
      sheet: file,
      run,
      model,
      ms,
      worksheetOk: data.isWorksheet === exp.isWorksheet,
      questionsExpected: exp.questions,
      questionsFound: questions.length,
      invented: page.invented,
      factsTotal,
      caughtByCheck: caught,
      lostOnPage,
      leaks,
      coverage: Math.round(page.coverage * 100),
      grade: [page.gradeOriginal, page.gradePlain],
    };
    rows.push(row);
    console.log(
      `${file} #${run} ${model} ${ms}ms | worksheet ${row.worksheetOk ? 'ok' : 'WRONG'} | questions ${questions.length}/${exp.questions} | invented ${page.invented} | facts ${factsTotal}, caught ${caught.length}, lost on page ${lostOnPage} | leaks ${leaks.length} | coverage ${row.coverage}% | grade ${page.gradeOriginal} -> ${page.gradePlain}`,
    );
    if (caught.length) console.log('   caught:', caught.join(' | '));
    if (leaks.length) console.log('   LEAKS:', leaks.join(' | '));
  }
}

const sheets = rows.filter((r) => (r.questionsExpected as number) > 0);
const sum = (k: string, rs = rows) => rs.reduce((n, r) => n + (r[k] as number), 0);
const summary = {
  runs: rows.length,
  worksheetDetection: `${rows.filter((r) => r.worksheetOk).length}/${rows.length}`,
  questions: `${sum('questionsFound', sheets)}/${sum('questionsExpected', sheets)}`,
  invented: sum('invented'),
  facts: sum('factsTotal'),
  caughtByCheck: rows.reduce((n, r) => n + (r.caughtByCheck as string[]).length, 0),
  lostOnPage: sum('lostOnPage'),
  leaks: rows.reduce((n, r) => n + (r.leaks as string[]).length, 0),
  medianMs: [...rows.map((r) => r.ms as number)].sort((a, b) => a - b)[Math.floor(rows.length / 2)],
  gradeBefore: +(sheets.reduce((n, r) => n + ((r.grade as number[])[0] ?? 0), 0) / sheets.length).toFixed(1),
  gradeAfter: +(sheets.reduce((n, r) => n + ((r.grade as number[])[1] ?? 0), 0) / sheets.length).toFixed(1),
};
console.log('\nSUMMARY', JSON.stringify(summary));
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/results.json', import.meta.url), JSON.stringify({ summary, rows }, null, 1));
