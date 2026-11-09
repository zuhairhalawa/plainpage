/**
 * Reads a PDF in the browser with pdf.js. A PDF with a text layer gives its
 * text directly; a scanned PDF (no text) is rendered page by page and read
 * with the on-device OCR.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ocrPages } from './ocr.ts';
import type { Doc, Progress } from './types.ts';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 6;

export async function readPdf(file: Blob, progress: Progress): Promise<Doc> {
  progress('Opening the PDF', 0);
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const count = Math.min(pdf.numPages, MAX_PAGES);
  let text = '';
  for (let n = 1; n <= count; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' ';
    }
    text += '\n\n';
  }
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.replace(/\s/g, '').length > 200) return { text, source: 'pdf', pages: [] };

  // No text layer: render the pages and read them with OCR.
  const canvases: HTMLCanvasElement[] = [];
  for (let n = 1; n <= count; n++) {
    progress(`Rendering page ${n} of ${count}`, n / count);
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas');
    c.width = viewport.width;
    c.height = viewport.height;
    await page.render({ canvas: c, viewport }).promise;
    canvases.push(c);
  }
  return ocrPages(canvases, 'pdf', progress);
}
