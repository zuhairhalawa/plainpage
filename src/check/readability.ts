/**
 * Flesch–Kincaid grade level: roughly the US school grade needed to read a
 * text. A rough guide only, but the same formula on both versions makes the
 * before-and-after fair.
 */

export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function gradeLevel(text: string): number | null {
  const words = text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  if (words.length < 5) return null;
  const sentences = Math.max(1, (text.match(/[.!?]+(?=\s|$)/g) ?? []).length);
  const syl = words.reduce((s, w) => s + syllables(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
  return Math.round(Math.max(0, grade) * 10) / 10;
}
