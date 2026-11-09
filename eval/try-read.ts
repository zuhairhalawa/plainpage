/**
 * Runs the read step on one worksheet against the live model, checks it and prints a summary.
 * Usage: node --experimental-strip-types eval/try-read.ts <worksheet.txt> [--json]
 * The API key comes from .dev.vars (git-ignored) and is never printed.
 */
import { readFileSync } from 'node:fs';
import { verifyReading } from '../src/check/verify.ts';
import { geminiJson } from '../src/read/gemini.ts';
import { READ_SCHEMA, READ_SYSTEM } from '../src/read/prompts.ts';
import type { Reading } from '../src/types.ts';

export function loadVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = /^(\w+)="?(.*?)"?$/.exec(line.trim());
    if (m) out[m[1] as string] = m[2] as string;
  }
  return out;
}

export function modelList(vars: Record<string, string>): string[] {
  return (process.env.MODELS ?? vars.GEMINI_MODELS ?? 'gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-3.5-flash').split(',');
}

export async function read(text: string, vars: Record<string, string>): Promise<{ data: Reading; model: string; ms: number }> {
  const t0 = Date.now();
  const { data, model } = await geminiJson<Reading>({
    apiKey: vars.GEMINI_API_KEY as string,
    models: modelList(vars),
    system: READ_SYSTEM,
    user: text,
    schema: READ_SCHEMA,
    timeoutMs: 60_000,
  });
  return { data, model, ms: Date.now() - t0 };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  const text = readFileSync(process.argv[2] as string, 'utf8');
  const { data, model, ms } = await read(text, loadVars());
  const page = verifyReading(text, data);
  if (process.argv.includes('--json')) console.log(JSON.stringify(data, null, 1));
  console.log(`${model} ${ms} ms | blocks ${data.blocks.length} kept ${page.blocks.length} invented ${page.invented} | coverage ${(page.coverage * 100).toFixed(0)}% | grade ${page.gradeOriginal} -> ${page.gradePlain}`);
  for (const b of page.blocks) {
    console.log(`\n[${b.kind}${b.number ? ' ' + b.number : ''}${b.span?.exact ? '' : ' ~'}] ${b.plainOk ? 'OK' : 'ORIGINAL'} ${b.missing.length ? 'missing ' + b.missing.join(', ') : ''} (${b.gradeOriginal} -> ${b.gradePlain}) ${b.answer.type}${b.answer.choices.length ? ' ' + JSON.stringify(b.answer.choices) : ''}`);
    console.log('  O: ' + b.original.slice(0, 160));
    if (b.plain) console.log('  P: ' + b.plain.slice(0, 220));
    for (const k of b.keyTerms) console.log(`  * ${k.term}: ${k.meaning}`);
  }
  if (page.leftOut.length) console.log('\nLEFT OUT:', page.leftOut);
}
