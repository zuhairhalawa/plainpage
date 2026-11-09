/** Calls to the site's own server function. */
import type { Reading } from '../types.ts';

export async function readWorksheet(text: string): Promise<Reading & { model: string }> {
  let res: Response;
  try {
    res = await fetch('/api/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status}). Please try again.`);
  return data as Reading & { model: string };
}
