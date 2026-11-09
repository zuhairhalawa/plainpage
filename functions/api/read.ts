/**
 * POST /api/read  { text }  →  { model, isWorksheet, title, subject, blocks }
 * The browser checks the result against the worksheet before showing it.
 */
import { GeminiError, geminiJson } from '../../src/read/gemini.ts';
import { READ_SCHEMA, READ_SYSTEM } from '../../src/read/prompts.ts';
import { type Env, MAX_CHARS, guard, json, models } from '../../src/server/guard.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const blocked = guard(request, 'read', 30, env);
  if (blocked) return blocked;
  let text: unknown;
  try {
    ({ text } = (await request.json()) as { text?: unknown });
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (typeof text !== 'string' || text.trim().length < 40) return json({ error: 'There is not enough text on this page to rebuild. Try a clearer photo.' }, 400);
  if (text.length > MAX_CHARS) return json({ error: 'This worksheet is longer than Plain Page can rebuild at once (about 8 pages).' }, 413);
  try {
    const { data, model } = await geminiJson<Record<string, unknown>>({
      apiKey: env.GEMINI_API_KEY,
      models: models(env),
      system: READ_SYSTEM,
      user: text,
      schema: READ_SCHEMA,
      rounds: 2,
      timeoutMs: 25_000,
    });
    return json({ model, ...data });
  } catch (e) {
    const status = e instanceof GeminiError && e.status === 429 ? 429 : 502;
    return json({ error: status === 429 ? 'The free AI quota is busy. Please try again in a minute.' : 'The page builder is busy right now. Please try again in a minute.' }, status);
  }
};
