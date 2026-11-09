/**
 * Renders a checked worksheet as an accessible page: real headings, questions
 * as labelled groups with answer fields, key words explained in place, and
 * both wordings (plain and as printed) so the reader can switch.
 */
import { factText } from '../check/verify.ts';
import type { CheckedBlock, CheckedPage } from '../types.ts';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const KIND_LABEL: Record<string, string> = { instructions: 'Instructions', text: 'Reading', note: 'Note' };

/** Appends `text` to `parent`, marking each key term so it stands out. */
function withTerms(parent: HTMLElement, text: string, terms: string[]): void {
  if (!terms.length) {
    parent.textContent = text;
    return;
  }
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    parent.append(text.slice(last, at), el('strong', 'term', m[0]));
    last = at + m[0].length;
  }
  parent.append(text.slice(last));
}

/** The plain and the printed wording of a block; CSS shows one of them. */
function wordings(b: CheckedBlock, tag: 'p' | 'span' = 'p'): HTMLElement[] {
  const terms = b.keyTerms.map((k) => k.term);
  const orig = el(tag, 'w-orig');
  // As printed, minus the number and the choices, which the page shows on their own.
  const printed = b.kind === 'question' ? factText(b.original, b.number, b.answer.choices).replace(/\s+/g, ' ').trim() : b.original;
  withTerms(orig, printed.replace(/^\s*(?:q(?:uestion)?\s*)?\(?[0-9]{1,2}[a-z]?[.):]\s*/i, ''), terms);
  if (!b.plainOk) {
    orig.classList.add('w-both');
    return [orig];
  }
  const plain = el(tag, 'w-plain');
  withTerms(plain, b.plain, terms);
  return [plain, orig];
}

function glossary(b: CheckedBlock): HTMLElement | null {
  if (!b.keyTerms.length) return null;
  const dl = el('dl', 'glossary');
  for (const k of b.keyTerms) dl.append(el('dt', undefined, k.term), el('dd', undefined, k.meaning));
  return dl;
}

function checkNote(b: CheckedBlock): HTMLElement | null {
  if (b.kind === 'heading') return null;
  if (!b.plainOk && b.plain.trim()) {
    const p = el('p', 'check-note fallback');
    p.textContent = `Shown as printed: the plain version left out ${b.missing.map((m) => `“${m}”`).join(', ')}.`;
    return p;
  }
  if (!b.kept.length) return null;
  const p = el('p', 'check-note');
  p.append(el('span', 'kept-label', 'Checked and kept:'));
  for (const k of b.kept) p.append(el('span', 'chip', k));
  return p;
}

function sayButton(label: string, id: string): HTMLButtonElement {
  const b = el('button', 'say');
  b.type = 'button';
  b.dataset.say = id;
  b.setAttribute('aria-label', `Read ${label} aloud`);
  b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  return b;
}

function answerField(b: CheckedBlock, label: string): HTMLElement | null {
  const name = `answer-${b.id}`;
  switch (b.answer.type) {
    case 'choice': {
      const list = el('div', 'choices');
      b.answer.choices.forEach((c, i) => {
        const lab = el('label', 'choice');
        const input = el('input');
        input.type = 'radio';
        input.name = name;
        input.value = c;
        lab.append(input, el('span', 'choice-letter', `${String.fromCharCode(65 + i)}`), el('span', undefined, c));
        list.append(lab);
      });
      return list;
    }
    case 'number':
    case 'short': {
      const input = el('input', 'answer');
      input.type = 'text';
      input.name = name;
      if (b.answer.type === 'number') input.inputMode = 'decimal';
      input.setAttribute('aria-label', `Your answer to ${label}`);
      input.autocomplete = 'off';
      return input;
    }
    case 'long': {
      const ta = el('textarea', 'answer');
      ta.name = name;
      ta.rows = 4;
      ta.setAttribute('aria-label', `Your answer to ${label}`);
      return ta;
    }
    default:
      return null;
  }
}

export function renderPage(root: HTMLElement, page: CheckedPage): void {
  root.replaceChildren();
  const blocks = [...page.blocks];
  // The first heading is the page title only when it really is the title; otherwise it stays a section heading.
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const firstIsTitle = blocks[0]?.kind === 'heading' && !!page.title && squash(blocks[0].original).includes(squash(page.title).slice(0, 24));
  const first = firstIsTitle ? blocks.shift() : undefined;
  const head = el('header', 'page-head');
  const h1 = el('h1', undefined, (first?.original ?? (page.title || 'Worksheet')).replace(/\s*\n\s*/g, ' — '));
  h1.id = 'page-title';
  h1.tabIndex = -1;
  const questions = blocks.filter((b) => b.kind === 'question').length;
  head.append(h1, el('p', 'page-sub', `${page.subject ? `${page.subject} worksheet, ` : ''}${questions} ${questions === 1 ? 'question' : 'questions'}`));
  root.append(head);

  for (const b of blocks) {
    if (b.kind === 'heading') {
      const h = el('h2', 'sec', b.original);
      root.append(h);
      continue;
    }
    if (b.kind === 'question') {
      const label = b.number ? `question ${b.number}` : 'the task';
      const fs = el('fieldset', 'blk q');
      fs.dataset.id = b.id;
      const legend = el('legend');
      legend.append(
        el('span', 'qnum', b.number ? (/^\d/.test(b.number) ? `Question ${b.number}` : b.number) : 'Task'),
        el('span', 'visually-hidden', ': '),
        ...wordings(b, 'span'),
      );
      fs.append(legend);
      const g = glossary(b);
      if (g) fs.append(g);
      const field = answerField(b, label);
      if (field) fs.append(field);
      const note = checkNote(b);
      if (note) fs.append(note);
      fs.append(sayButton(label, b.id));
      root.append(fs);
      continue;
    }
    const sec = el('section', `blk ${b.kind}`);
    sec.dataset.id = b.id;
    const kindLabel = KIND_LABEL[b.kind];
    if (kindLabel) sec.append(el('p', 'kind', kindLabel));
    sec.append(...wordings(b));
    const g = glossary(b);
    if (g) sec.append(g);
    const note = checkNote(b);
    if (note) sec.append(note);
    sec.append(sayButton(kindLabel ? kindLabel.toLowerCase() : 'this part', b.id));
    root.append(sec);
  }

  if (page.leftOut.length) {
    const sec = el('section', 'blk leftout');
    sec.append(el('h2', 'sec', 'Also on the worksheet'), el('p', 'kind', 'Shown exactly as printed, because the rebuild did not include it.'));
    for (const t of page.leftOut) sec.append(el('p', undefined, t));
    root.append(sec);
  }
}

/** What a screen reader would announce, walked from the page's structure (a simulation, not a real screen reader). */
export function screenReaderOutline(root: HTMLElement, limit = 9): string[] {
  const out: string[] = [];
  const visible = (e: Element) => !(e as HTMLElement).closest('[hidden]') && getComputedStyle(e).display !== 'none';
  for (const e of root.querySelectorAll('h1, h2, fieldset, section.blk > p.w-plain, section.blk > p.w-orig')) {
    if (!visible(e)) continue;
    const text = (e.textContent ?? '').replace(/\s+/g, ' ').trim();
    const short = text.length > 70 ? `${text.slice(0, 68)}…` : text;
    if (e.tagName === 'H1') out.push(`Heading level 1: ${short}`);
    else if (e.tagName === 'H2') out.push(`Heading level 2: ${short}`);
    else if (e.tagName === 'FIELDSET') {
      // Only the wording on screen: the hidden one is not read either.
      const parts = [...(e.querySelector('legend')?.children ?? [])].filter((c) => getComputedStyle(c).display !== 'none');
      const legend = parts.map((c) => c.textContent ?? '').join('').replace(/\s+/g, ' ').trim();
      const radios = e.querySelectorAll('input[type=radio]').length;
      const field = radios ? `radio group, ${radios} options` : e.querySelector('textarea, input') ? 'edit text' : 'no answer box';
      out.push(`Group: ${(legend.length > 60 ? `${legend.slice(0, 58)}…` : legend).replace(/[.?!]$/, '')}. ${field}`);
    } else out.push(short);
    if (out.length >= limit) break;
  }
  return out;
}
