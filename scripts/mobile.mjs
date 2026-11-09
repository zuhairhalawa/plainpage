// Phone-size screenshots of the start screen and the rebuilt page (fictional sample only).
// Run: node scripts/mobile.mjs <path-to-playwright-index.mjs> [base-url] [out-dir]
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.argv[3] ?? 'http://localhost:8789';
const out = process.argv[4] ?? 'docs/media';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(base);
await page.screenshot({ path: `${out}/07-phone-start.png` });
await page.click('#sample');
await page.waitForSelector('#result:not([hidden])', { timeout: 120_000 });
await page.evaluate(() => document.querySelector('fieldset.blk')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/08-phone-question.png` });
await browser.close();
console.log('phone screenshots written');
