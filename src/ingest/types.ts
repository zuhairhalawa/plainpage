/** A worksheet turned into text, with page images and word boxes when it came from a photo. */
export interface Page {
  /** An image of the page (photo or rendered PDF page), as an object URL. */
  imageUrl: string;
  width: number;
  height: number;
  /** Each word's place in `Doc.text` and its box on this page image. */
  words: { start: number; end: number; x: number; y: number; w: number; h: number }[];
}

export interface Doc {
  text: string;
  source: 'pdf' | 'photo' | 'paste' | 'sample';
  /** Page images with word boxes, when the worksheet came from a photo or scanned PDF. */
  pages: Page[];
  /** OCR confidence 0–100, when OCR was used. */
  ocrConfidence?: number;
}

export type Progress = (message: string, fraction?: number) => void;
