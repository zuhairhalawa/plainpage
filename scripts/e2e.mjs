// End-to-end check on a running site with the fictional sample photo:
// screenshots of each screen, an axe accessibility audit of the rebuilt page,
// and a keyboard-only pass through the answers.
// Run: node scripts/e2e.mjs <path-to-playwright-index.mjs> [base-url] [out-dir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? 'http://localhost:8789';
const out = process.argv[4] ?? 'eval/out/e2e';
mkdirSync(out, { recursive: true });
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(base);
await page.screenshot({ path: `${out}/01-start.png` });
const t0 = Date.now();
await page.click('#sample');
await page.waitForSelector('#build:not([hidden])');
await page.waitForSelector('.piece', { timeout: 120_000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/02-build.png` });
await page.waitForSelector('#result:not([hidden])', { timeout: 120_000 });
const seconds = (Date.now() - t0) / 1000;
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/03-result.png` });
await page.screenshot({ path: `${out}/03-result-full.png`, fullPage: true });

const scores = await page.$$eval('#scores dt', (dts) => dts.map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`));
const outline = await page.$$eval('#sr-after li', (lis) => lis.map((l) => l.textContent));
const fallbacks = await page.$$eval('.check-note.fallback', (n) => n.map((e) => e.textContent));

// Accessibility audit of the whole result screen, in every reading theme.
await page.addScriptTag({ content: axeSource });
const audit = {};
for (const theme of ['paper', 'tint', 'contrast', 'night']) {
  await page.selectOption('#theme', theme);
  audit[theme] = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} — ${v.nodes[0]?.target}`);
  });
}
await page.selectOption('#theme', 'paper');

// Keyboard only: tab to the first answer box and type, pick a choice with arrow keys.
await page.focus('#page-title');
let reached = '';
for (let i = 0; i < 40 && !reached; i++) {
  await page.keyboard.press('Tab');
  reached = await page.evaluate(() => (document.activeElement?.matches('input.answer, textarea.answer') ? document.activeElement.getAttribute('aria-label') : ''));
}
await page.keyboard.type('Chlorophyll');
await page.locator('input[type=radio]').first().focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
const radio = await page.evaluate(() => document.querySelector('input[type=radio]:checked')?.value);

// Other views.
await page.click('[data-wording="original"]');
await page.screenshot({ path: `${out}/04-as-printed.png` });
await page.click('[data-wording="plain"]');
await page.selectOption('#theme', 'contrast');
await page.click('#size-up');
await page.click('#size-up');
await page.screenshot({ path: `${out}/05-contrast-large.png` });
await page.selectOption('#theme', 'paper');
await page.click('#size-down');
await page.click('#size-down');

// Offline copy.
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#save')]);
const file = `${out}/offline.html`;
await dl.saveAs(file);
const offline = await browser.newPage({ viewport: { width: 900, height: 900 } });
await offline.goto(pathToFileURL(file).href);
const offlineAnswer = await offline.$eval('input.answer', (i) => i.value).catch(() => null);
await offline.screenshot({ path: `${out}/06-offline.png` });

const report = { seconds, scores, fallbacks, outline, audit, keyboard: { reached, typed: 'Chlorophyll', radio }, offlineAnswer, errors };
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
