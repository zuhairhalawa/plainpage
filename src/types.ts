/** What the reader returns for one worksheet. */

export type BlockKind = 'heading' | 'instructions' | 'text' | 'question' | 'note';
export type AnswerType = 'none' | 'short' | 'long' | 'number' | 'choice';

export interface KeyTerm {
  term: string;
  meaning: string;
}

export interface Block {
  kind: BlockKind;
  /** The question number as printed ("3", "2b"), or null. */
  number: string | null;
  /** The block's text, copied word for word from the worksheet. */
  original: string;
  /** The same content in plain English. Empty for headings. */
  plain: string;
  answer: { type: AnswerType; choices: string[] };
  keyTerms: KeyTerm[];
}

export interface Reading {
  isWorksheet: boolean;
  title: string;
  subject: string;
  blocks: Block[];
}

/** One block after the checks in src/check. */
export interface CheckedBlock extends Block {
  id: string;
  /** Where `original` sits in the source text, or null when it could not be found. */
  span: { start: number; end: number; exact: boolean } | null;
  /** Numbers and key terms from the original that the plain version keeps or drops. */
  kept: string[];
  missing: string[];
  /** True when the plain version is safe to show by default. */
  plainOk: boolean;
  gradeOriginal: number | null;
  gradePlain: number | null;
}

export interface CheckedPage {
  title: string;
  subject: string;
  blocks: CheckedBlock[];
  /** Share of the worksheet's words that made it onto the page (0–1). */
  coverage: number;
  /** Source text the page left out, so it can be shown as-is. */
  leftOut: string[];
  /** Blocks dropped because their text is not on the worksheet. */
  invented: number;
  gradeOriginal: number | null;
  gradePlain: number | null;
}
