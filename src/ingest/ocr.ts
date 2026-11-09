/**
 * Reads text from photos on the device with Tesseract (WebAssembly). Nothing
 * leaves the browser. Keeps every word's box so findings can be highlighted
 * on the photo itself.
 */
import { createWorker, type Worker } from 'tesseract.js';
import type { Doc, Page, Progress } from './types.ts';

const MAX_SIDE = 2400;

let workerPromise: Promise<Worker> | null = null;
let onProgress: Progress = () => {};

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker('eng', 1, {
    workerPath: '/vendor/tesseract/worker.min.js',
    corePath: '/vendor/tesseract/core',
    langPath: '/vendor/tesseract/lang',
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress('Reading the text on your device', m.progress);
      else if (m.progress < 1) onProgress('Loading the on-device text reader', m.progress);
    },
  });
  return workerPromise;
}

/** Scales a large photo down (faster OCR) and returns it as a canvas. */
export async function toCanvas(source: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) return source;
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  return c;
}

interface TWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface TBlock {
  paragraphs: { lines: { words: TWord[] }[] }[];
}

/** OCRs one or more page images into a single Doc. */
export async function ocrPages(images: HTMLCanvasElement[], source: Doc['source'], progress: Progress): Promise<Doc> {
  onProgress = progress;
  const worker = await getWorker();
  let text = '';
  const pages: Page[] = [];
  let confSum = 0;
  for (const [i, canvas] of images.entries()) {
    progress(images.length > 1 ? `Reading page ${i + 1} of ${images.length} on your device` : 'Reading the text on your device', 0);
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
    confSum += data.confidence;
    const words: Page['words'] = [];
    // Word positions are recorded on the final text, so nothing may be
    // removed from it afterwards; blank lines are only added when needed.
    const breakTo = (n: number) => {
      if (!text) return;
      const have = text.length - text.trimEnd().length;
      if (have < n) text += '\n'.repeat(n - have);
    };
    breakTo(2);
    for (const block of (data.blocks ?? []) as unknown as TBlock[]) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const lineWords = line.words.filter((w) => w.text.trim());
          if (!lineWords.length) continue;
          lineWords.forEach((w, k) => {
            if (k > 0) text += ' ';
            const start = text.length;
            text += w.text.trim();
            const b = w.bbox;
            words.push({ start, end: text.length, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
          });
          breakTo(1);
        }
        breakTo(2);
      }
    }
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    pages.push({ imageUrl: URL.createObjectURL(blob), width: canvas.width, height: canvas.height, words });
  }
  // trimEnd only: removing from the end leaves every word position valid.
  return { text: text.trimEnd(), source, pages, ocrConfidence: Math.round(confSum / images.length) };
}

/** Reads one photo per page, in the order given. */
export async function readPhotos(files: Blob[], progress: Progress): Promise<Doc> {
  progress(files.length > 1 ? 'Preparing the photos' : 'Preparing the photo', 0);
  const canvases: HTMLCanvasElement[] = [];
  for (const f of files) canvases.push(await toCanvas(f));
  return ocrPages(canvases, 'photo', progress);
}
