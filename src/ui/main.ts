/** The flow: add a worksheet → rebuild (photo on one side, page assembling on the other) → the accessible page. */
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/lexend/500.css';
import '@fontsource/lexend/700.css';
import './style.css';
import { verifyReading } from '../check/verify.ts';
import type { Doc } from '../ingest/types.ts';
import { redact } from '../redact/redact.ts';
import type { CheckedPage } from '../types.ts';
import { readWorksheet } from './api.ts';
import { download, offlineHtml } from './offline.ts';
import { renderPage, screenReaderOutline } from './page.ts';
import { speak, speaking, stopSpeaking } from './speak.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const screens = ['start', 'build', 'result'] as const;
type Screen = (typeof screens)[number];
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, calm() ? 0 : ms));

function show(s: Screen, focus?: HTMLElement | null): void {
  for (const id of screens) $(id).hidden = id !== s;
  window.scrollTo({ top: 0 });
  const target = focus ?? $(s).querySelector<HTMLElement>('h1, h2');
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}

function status(id: string, msg: string, error = false): void {
  const s = $(id);
  s.textContent = msg;
  s.classList.toggle('error', error);
}

function step(name: string, state: 'active' | 'done'): void {
  const li = $('steps').querySelector<HTMLElement>(`[data-step="${name}"]`);
  if (!li) return;
  li.classList.remove('active', 'done');
  li.classList.add(state);
}

let result: CheckedPage | null = null;

/* ---------- 1. Add a worksheet ---------- */

function showSource(doc: Doc | null, text: string): void {
  const frame = $('source-frame');
  frame.replaceChildren();
  if (doc?.pages.length) {
    for (const p of doc.pages.slice(0, 2)) {
      const img = document.createElement('img');
      img.src = p.imageUrl;
      img.alt = '';
      frame.append(img);
    }
    $('sr-before').textContent = 'A screen reader announces: “Image.” No headings, no questions, no answer boxes, nothing to read aloud.';
  } else {
    const pre = document.createElement('pre');
    pre.textContent = text;
    frame.append(pre);
    $('sr-before').textContent = 'One long block of text: no headings to jump to, no labelled answer boxes.';
  }
}

async function loadFiles(list: FileList | File[] | Blob[] | null | undefined): Promise<void> {
  const files = [...(list ?? [])] as File[];
  files.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true }));
  const file = files[0];
  if (!file) return;
  for (const s of ['ocr', 'blank', 'read', 'check']) $('steps').querySelector(`[data-step="${s}"]`)?.classList.remove('active', 'done');
  $('assembly').replaceChildren();
  $('meter-grade').textContent = '–';
  $('meter-facts').textContent = '0';
  status('build-status', '');
  const progress = (m: string, f?: number) => status('build-status', f !== undefined && f > 0 && f < 1 ? `${m} (${Math.round(f * 100)}%)` : m);
  try {
    if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      showSource(null, 'Reading the PDF…');
      show('build');
      step('ocr', 'active');
      const { readPdf } = await import('../ingest/pdf.ts');
      const doc = await readPdf(file, progress);
      showSource(doc, doc.text);
      await rebuild(doc.text, doc.ocrConfidence);
    } else if (files.every((f) => f.type.startsWith('image/'))) {
      const urls = files.slice(0, 4).map((f) => URL.createObjectURL(f));
      showSource({ text: '', source: 'photo', pages: urls.map((u) => ({ imageUrl: u, width: 0, height: 0, words: [] })) }, '');
      show('build');
      step('ocr', 'active');
      const { readPhotos } = await import('../ingest/ocr.ts');
      const doc = await readPhotos(files.slice(0, 4), progress);
      await rebuild(doc.text, doc.ocrConfidence);
    } else {
      status('start-status', 'Please add photos of the worksheet (one per page) or one PDF.', true);
    }
  } catch (e) {
    console.error(e);
    show('start');
    status('start-status', 'That file could not be read. Try a flatter, brighter photo, a PDF, or paste the text.', true);
  }
}

$('file').addEventListener('change', (e) => void loadFiles((e.target as HTMLInputElement).files));
$('camera').addEventListener('change', (e) => void loadFiles((e.target as HTMLInputElement).files));
const drop = $('drop');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  void loadFiles(e.dataTransfer?.files);
});
$('paste-open').addEventListener('click', () => {
  $('paste-box').hidden = false;
  $('paste-open').setAttribute('aria-expanded', 'true');
  $('paste-text').focus();
});
$('paste-go').addEventListener('click', () => {
  const text = $<HTMLTextAreaElement>('paste-text').value.trim();
  if (text.length < 40) return status('start-status', 'That is very short. Paste the whole worksheet.', true);
  showSource(null, text);
  show('build');
  void rebuild(text);
});
$('sample').addEventListener('click', async () => {
  status('start-status', 'Loading the sample worksheet photo');
  const blob = await (await fetch('/sample/photosynthesis-photo.jpg')).blob();
  status('start-status', '');
  await loadFiles([new File([blob], 'photosynthesis-photo.jpg', { type: 'image/jpeg' })]);
});

/* ---------- 2. Rebuild ---------- */

async function rebuild(raw: string, ocrConfidence?: number): Promise<void> {
  try {
    step('ocr', 'done');
    step('blank', 'active');
    const safe = redact(raw).text;
    await sleep(300);
    step('blank', 'done');
    step('read', 'active');
    status('build-status', ocrConfidence !== undefined && ocrConfidence < 65 ? 'Parts of the photo were hard to read; the page may miss some words.' : '');
    const reading = await readWorksheet(safe);
    if (!reading.isWorksheet || !reading.blocks.length) throw new Error('This does not look like a worksheet or other school material.');
    step('read', 'done');
    step('check', 'active');
    result = verifyReading(safe, reading);
    await assemble(result);
    step('check', 'done');
    await sleep(500);
    openResult(result);
  } catch (e) {
    status('build-status', (e as Error).message, true);
    const back = document.createElement('button');
    back.className = 'btn';
    back.type = 'button';
    back.textContent = 'Try another worksheet';
    back.addEventListener('click', () => show('start'));
    $('build-status').append(' ', back);
  }
}

/** The page assembling itself, block by block, with each kept fact ticking in. */
async function assemble(page: CheckedPage): Promise<void> {
  const box = $('assembly');
  box.replaceChildren();
  let facts = 0;
  $('meter-grade').textContent = page.gradeOriginal !== null ? `Grade ${page.gradeOriginal}` : '–';
  for (const b of page.blocks) {
    const card = document.createElement('div');
    card.className = `piece ${b.kind}${b.plainOk || b.kind === 'heading' ? '' : ' fallback'}`;
    const label = document.createElement('span');
    label.className = 'piece-kind';
    label.textContent = b.kind === 'question' ? (b.number ? `Q${b.number}` : 'Task') : b.kind;
    const text = document.createElement('span');
    text.className = 'piece-text';
    const shown = b.plainOk ? b.plain : b.original;
    text.textContent = shown.length > 90 ? `${shown.slice(0, 88)}…` : shown;
    card.append(label, text);
    box.append(card);
    box.scrollTop = box.scrollHeight;
    await sleep(160);
    for (const k of b.kept) {
      const chip = document.createElement('span');
      chip.className = 'chip tick';
      chip.textContent = k;
      card.append(chip);
      facts++;
      $('meter-facts').textContent = String(facts);
      await sleep(70);
    }
  }
  if (page.gradePlain !== null && page.gradeOriginal !== null) {
    $('meter-grade').textContent = `Grade ${page.gradeOriginal} → ${page.gradePlain}`;
    $('meter-grade').classList.add('drop');
  }
}

/* ---------- 3. The accessible page ---------- */

function openResult(page: CheckedPage): void {
  renderPage($('page'), page);
  const blocks = page.blocks.filter((b) => b.kind !== 'heading');
  const plain = blocks.filter((b) => b.plainOk).length;
  const kept = blocks.reduce((n, b) => n + b.kept.length, 0);
  const missing = blocks.reduce((n, b) => n + b.missing.length, 0);
  const rows: [string, string][] = [
    ['Reading level', page.gradeOriginal !== null && page.gradePlain !== null ? `Grade ${page.gradeOriginal} → ${page.gradePlain}` : 'Not enough text to score'],
    ['Numbers and key terms kept', `${kept} of ${kept + missing}`],
    ['Parts in plain English', `${plain} of ${blocks.length}${plain < blocks.length ? ' (the rest shown as printed)' : ''}`],
    ['Worksheet text on this page', `${Math.round(page.coverage * 100)}%`],
  ];
  if (page.invented) rows.push(['Parts removed because they were not on the worksheet', String(page.invented)]);
  $('scores').replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }),
  );
  show('result', $('page-title'));
  refreshOutline();
}

function refreshOutline(): void {
  $('sr-after').replaceChildren(
    ...screenReaderOutline($('page')).map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      return li;
    }),
  );
}

/* Reading options, remembered on this device. */
const prefs = { wording: 'plain', size: 1.25, theme: 'paper', wide: false };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('plainpage-prefs') ?? '{}'));
} catch {
  /* private mode: defaults are fine */
}
function applyPrefs(): void {
  const page = $('page');
  page.dataset.wording = prefs.wording;
  page.dataset.theme = prefs.theme;
  page.classList.toggle('wide', prefs.wide);
  page.style.setProperty('--page-size', `${prefs.size}rem`);
  for (const b of document.querySelectorAll<HTMLButtonElement>('.toolbar [data-wording]')) b.setAttribute('aria-pressed', String(b.dataset.wording === prefs.wording));
  $<HTMLSelectElement>('theme').value = prefs.theme;
  $('spacing').setAttribute('aria-pressed', String(prefs.wide));
  try {
    localStorage.setItem('plainpage-prefs', JSON.stringify(prefs));
  } catch {
    /* not saved; still applied */
  }
}
applyPrefs();

for (const b of document.querySelectorAll<HTMLButtonElement>('.toolbar [data-wording]')) {
  b.addEventListener('click', () => {
    prefs.wording = b.dataset.wording as string;
    applyPrefs();
    refreshOutline();
  });
}
$('size-down').addEventListener('click', () => {
  prefs.size = Math.max(1, Math.round((prefs.size - 0.125) * 1000) / 1000);
  applyPrefs();
});
$('size-up').addEventListener('click', () => {
  prefs.size = Math.min(2.25, Math.round((prefs.size + 0.125) * 1000) / 1000);
  applyPrefs();
});
$('theme').addEventListener('change', () => {
  prefs.theme = $<HTMLSelectElement>('theme').value;
  applyPrefs();
});
$('spacing').addEventListener('click', () => {
  prefs.wide = !prefs.wide;
  applyPrefs();
});

const visibleWording = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('.page-head h1, h2.sec, .w-plain, .w-orig')].filter((e) => e.offsetParent !== null);

$('read-all').addEventListener('click', () => {
  if (speaking()) {
    stopSpeaking();
    $('read-all').textContent = 'Read aloud';
    return;
  }
  $('read-all').textContent = 'Stop reading';
  speak(visibleWording($('page')), () => ($('read-all').textContent = 'Read aloud'));
});
$('page').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.say');
  if (!btn) return;
  const blk = btn.closest<HTMLElement>('.blk');
  if (blk) speak(visibleWording(blk));
});
$('save').addEventListener('click', () => {
  if (!result) return;
  const title = $('page-title').textContent ?? 'Worksheet';
  download(`${title.replace(/[^\w -]+/g, '').slice(0, 60).trim() || 'Worksheet'} (Plain Page).html`, offlineHtml($('page'), title));
});
$('restart').addEventListener('click', () => {
  stopSpeaking();
  show('start');
});
