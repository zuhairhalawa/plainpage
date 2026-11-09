/**
 * Saves the rebuilt page as one HTML file that works offline on any device:
 * the same headings, labelled answer boxes and both wordings, with any
 * answers typed so far, and a small script for the wording switch and read-aloud.
 */

const CSS = `
:root{--ink:#102a26;--paper:#fff;--accent:#1f6b52;--focus:#ffd43b;--muted:#4a5f59;--flag:#a4262c}
body{margin:0;background:#e9f0ec;color:var(--ink);font:1.25rem/1.65 "Atkinson Hyperlegible",Verdana,system-ui,sans-serif}
main{max-width:46rem;margin:0 auto;padding:1.5rem 1rem 4rem;background:var(--paper)}
h1{font-size:1.9rem;line-height:1.25;margin:.5rem 0}h2{font-size:1.4rem;margin:2rem 0 .5rem}
.page-sub,.kind{color:var(--muted);font-size:1rem}
.blk{margin:1.25rem 0;padding:1rem 1.25rem;border:2px solid #d5e1db;border-radius:12px}
fieldset{min-width:0}legend{padding:0 .25rem;font-weight:700}.qnum{display:block;color:var(--accent);font-size:1rem}
.term{background:#fff3bf;padding:0 .15em;border-radius:3px}
.glossary{display:grid;grid-template-columns:auto 1fr;gap:.25rem 1rem;font-size:1.05rem;margin:.75rem 0}.glossary dt{font-weight:700}.glossary dd{margin:0}
input.answer,textarea.answer{width:100%;box-sizing:border-box;font:inherit;padding:.5rem;border:2px solid var(--ink);border-radius:8px;margin-top:.5rem}
.choice{display:flex;gap:.6rem;align-items:center;padding:.35rem 0}.choice input{width:1.3rem;height:1.3rem}.choice-letter{font-weight:700}
.check-note{font-size:.95rem;color:var(--muted)}.fallback{color:var(--flag)}.chip{display:inline-block;margin:0 .3rem .3rem 0;padding:0 .5rem;border-radius:99px;background:#e3f1ea}
.blk{position:relative;padding-right:3.4rem}.say{position:absolute;top:.6rem;right:.6rem}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
fieldset.blk>legend{float:left;width:100%;padding:0}fieldset.blk>legend+*{clear:both}.kept-label{margin-right:.3rem}
button{font:inherit;font-size:1rem;padding:.4rem .8rem;border-radius:8px;border:2px solid var(--ink);background:#fff;color:var(--ink);cursor:pointer}
:focus-visible{outline:4px solid var(--focus);outline-offset:2px}
[data-wording=plain] .w-orig:not(.w-both){display:none}[data-wording=original] .w-plain{display:none}
.bar{position:sticky;top:0;display:flex;gap:.5rem;flex-wrap:wrap;padding:.75rem 1rem;background:var(--ink)}
.bar button{border-color:#fff}.bar button[aria-pressed=true]{background:var(--focus)}
.now{background:var(--focus)}
@media print{.bar,.say{display:none}body{background:#fff}}
`;

const SCRIPT = `
document.querySelectorAll('[data-w]').forEach(function(b){b.addEventListener('click',function(){
document.getElementById('page').dataset.wording=b.dataset.w;
document.querySelectorAll('[data-w]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});});});
document.querySelectorAll('.say').forEach(function(b){b.addEventListener('click',function(){
if(!window.speechSynthesis)return;speechSynthesis.cancel();var blk=b.closest('.blk');
var t=Array.prototype.filter.call(blk.querySelectorAll('.w-plain,.w-orig'),function(e){return e.offsetParent!==null}).map(function(e){return e.textContent}).join(' ');
var u=new SpeechSynthesisUtterance(t);u.lang='en-GB';u.rate=.92;speechSynthesis.speak(u);});});
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function offlineHtml(page: HTMLElement, title: string): string {
  const clone = page.cloneNode(true) as HTMLElement;
  // Carry typed answers into the file.
  const live = page.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((c, i) => {
    const src = live[i];
    if (!src) return;
    if (c instanceof HTMLTextAreaElement) c.textContent = src.value;
    else if (c.type === 'radio') {
      if ((src as HTMLInputElement).checked) c.setAttribute('checked', '');
    } else c.setAttribute('value', src.value);
  });
  clone.querySelectorAll('.now').forEach((n) => n.classList.remove('now'));
  clone.removeAttribute('class');
  clone.id = 'page';
  const wording = page.dataset.wording ?? 'plain';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><div class="bar" role="toolbar" aria-label="Wording"><button type="button" data-w="plain" aria-pressed="${wording === 'plain'}">Plain English</button><button type="button" data-w="original" aria-pressed="${wording !== 'plain'}">As printed</button></div>
<main>${clone.outerHTML.replace(/^<article/, '<div').replace(/<\/article>$/, '</div>')}</main>
<script>${SCRIPT}</script></body></html>`;
}

export function download(name: string, html: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
