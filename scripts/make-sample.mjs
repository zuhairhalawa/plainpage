// Renders the fictional sample worksheet as a cramped school photocopy
// (eval/out/sample-page.png); scripts/fake_photo.py then turns it into a phone photo.
// Run: node scripts/make-sample.mjs <path-to-playwright-module>
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const text = readFileSync('public/sample/photosynthesis-worksheet.txt', 'utf8').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const lines = text.split('\n');
const body = lines
  .map((l) => {
    const t = esc(l.trim());
    if (!t) return '<div class="gap"></div>';
    if (/^Name:/.test(t)) return `<div class="meta">${t}</div>`;
    if (/^GRADE 7/.test(t)) return `<div class="kicker">${t}</div>`;
    if (/^Worksheet 4\.2/.test(t)) return `<h1>${t}</h1>`;
    if (/^(Background Information|Section [AB])/.test(t)) return `<h2>${t}</h2>`;
    if (/^\d+\./.test(t)) return `<p class="q">${t}</p><div class="ans"></div>`;
    if (/^[A-D]\)/.test(t)) return `<p class="opts">${t.replace(/\s{2,}/g, '&nbsp;&nbsp;&nbsp;&nbsp;')}</p>`;
    if (/^(Word bank|Extension)/.test(t)) return `<p class="box">${t}</p>`;
    return `<p>${t}</p>`;
  })
  .join('\n')
  // Answer line after the choices, not between the question and its choices.
  .replace(/<div class="ans"><\/div>\n(<p class="opts">.*?<\/p>)/g, '$1<div class="ans"></div>');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; }
  .page { width: 190mm; min-height: 270mm; padding: 11mm 12mm; background: #fff; color: #161616; font: 9.6pt/1.32 'Times New Roman', Times, serif; }
  .meta { font: 9pt Arial, sans-serif; border-bottom: 0.6pt solid #444; padding-bottom: 3pt; margin-bottom: 6pt; }
  .kicker { font: 700 8.5pt Arial, sans-serif; letter-spacing: 0.08em; }
  h1 { font: 700 13pt/1.2 Arial, sans-serif; margin: 2pt 0 6pt; }
  h2 { font: 700 10.5pt Arial, sans-serif; margin: 7pt 0 2pt; text-decoration: underline; }
  p { margin: 0 0 3pt; text-align: justify; }
  .q { margin-top: 4pt; }
  .opts { padding-left: 14pt; }
  .ans { border-bottom: 0.6pt dotted #555; height: 13pt; margin: 0 0 2pt 14pt; }
  .box { border: 0.8pt solid #333; padding: 4pt 6pt; margin-top: 6pt; }
  .gap { height: 2pt; }
</style></head><body><div class="page">${body}</div></body></html>`;

mkdirSync('eval/out', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ deviceScaleFactor: 2.2 });
await page.setContent(html);
await (await page.$('.page')).screenshot({ path: 'eval/out/sample-page.png' });
await browser.close();
console.log('wrote eval/out/sample-page.png');
