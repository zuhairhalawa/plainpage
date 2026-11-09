/**
 * Read-aloud with the browser's own voices. The word being spoken is
 * highlighted, which helps readers follow along.
 */

let current: { el: HTMLElement; text: string } | null = null;

function stop(): void {
  window.speechSynthesis?.cancel();
  if (current) {
    current.el.textContent = null;
    current.el.append(...restore.get(current.el)!);
    current.el.closest('.blk')?.classList.remove('speaking');
  }
  current = null;
}

const restore = new WeakMap<HTMLElement, Node[]>();

export function speaking(): boolean {
  return !!window.speechSynthesis?.speaking;
}

/** Speaks the visible wording of each element in turn. */
export function speak(els: HTMLElement[], onEnd?: () => void): void {
  const synth = window.speechSynthesis;
  if (!synth) return;
  stop();
  const queue = [...els];
  const next = () => {
    const el = queue.shift();
    if (!el) {
      current = null;
      onEnd?.();
      return;
    }
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return next();
    restore.set(el, [...el.childNodes].map((n) => n.cloneNode(true)));
    // One span per word, so the spoken word can be highlighted.
    const spans: { start: number; span: HTMLElement }[] = [];
    el.textContent = null;
    for (const m of text.matchAll(/\S+|\s+/g)) {
      if (/^\s/.test(m[0])) {
        el.append(m[0]);
        continue;
      }
      const s = document.createElement('span');
      s.textContent = m[0];
      el.append(s);
      spans.push({ start: m.index ?? 0, span: s });
    }
    current = { el, text };
    el.closest('.blk')?.classList.add('speaking');
    el.closest('.blk')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    u.rate = 0.92;
    u.onboundary = (e) => {
      for (const { span } of spans) span.classList.remove('now');
      const hit = [...spans].reverse().find((w) => w.start <= e.charIndex);
      hit?.span.classList.add('now');
    };
    u.onend = () => {
      if (current?.el === el) {
        el.textContent = null;
        el.append(...restore.get(el)!);
        el.closest('.blk')?.classList.remove('speaking');
      }
      next();
    };
    synth.speak(u);
  };
  next();
}

export function stopSpeaking(): void {
  stop();
}
