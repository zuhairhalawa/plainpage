/** Instructions and JSON schema for the reader. The model only restructures and rewrites; code checks the result. */

const str = { type: 'string' };

export const READ_SCHEMA = {
  type: 'object',
  properties: {
    isWorksheet: { type: 'boolean', description: 'True for school learning material: a worksheet, handout, quiz, lesson text or homework sheet.' },
    title: str,
    subject: { type: 'string', description: 'For example Science, Maths, History, English.' },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['heading', 'instructions', 'text', 'question', 'note'] },
          number: { type: ['string', 'null'] },
          original: str,
          plain: str,
          answer: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['none', 'short', 'long', 'number', 'choice'] },
              choices: { type: 'array', items: str },
            },
            required: ['type', 'choices'],
          },
          keyTerms: {
            type: 'array',
            items: { type: 'object', properties: { term: str, meaning: str }, required: ['term', 'meaning'] },
          },
        },
        required: ['kind', 'number', 'original', 'plain', 'answer', 'keyTerms'],
      },
    },
  },
  required: ['isWorksheet', 'title', 'subject', 'blocks'],
};

export const READ_SYSTEM = `You turn the text of a school worksheet into an accessible page for learners who struggle with dense text: learners with low vision who use a screen reader, dyslexic learners, and learners still building their English.

The text came from a photo, a PDF or a paste, so it may have OCR mistakes, broken lines and page furniture (page numbers, "Name: ____", "Date: ____", school logos).

Split the worksheet into blocks in reading order. The first block is the worksheet's printed title as a heading (copy the title lines word for word).
- heading: a title or section heading.
- instructions: what the learner must do.
- text: reading passages, facts, tables written as text, worked examples.
- question: one question or task the learner answers. Keep sub-parts (a, b, c) as separate question blocks, numbered "2a", "2b".
- note: tips, hints, word banks, reminders.

For every block:
- original: copy the block's text WORD FOR WORD from the worksheet, including every number and unit. Fix only line breaks and obvious OCR letter slips. Never shorten, merge distant parts, or add words. Skip "Name:", "Date:", "Class:" lines and page numbers.
- plain: the same content in plain English for a reading age of about 9: short sentences (under 15 words), common words, active voice, one idea per sentence. Keep EVERY number with its unit exactly as written, including small ones ("1 minute", "2 methods", "10 cm", "3/4", "25%"); write numbers as digits. Keep every name and every technical term word for word (for example "reactants", "variable", "photosynthesis", "limiting factor"): do not swap a technical term for an easier word; keep it and explain it in keyTerms instead. Every term you put in keyTerms must appear unchanged in plain. Keep mark allocations such as "[3 marks]" at the end. Do not repeat the printed question number or the answer choices in plain. Never answer a question, never add hints that give the answer, never add facts. For headings, plain is "".
- number: the printed question number, or null.
- answer: for questions, the kind of answer expected: number (a numeric answer), choice (with the printed options, word for word, without their letters), short (a word or sentence), long (a paragraph); "none" for other blocks.
- keyTerms: up to 3 technical or difficult words from this block that a learner might not know, each with a simple meaning of at most 12 words that does not give away any answer.

If the text is not school learning material, set isWorksheet to false and return no blocks. A recipe, letter, advert, menu, form or news article is not a worksheet unless it comes with tasks or questions for a learner.
English only.`;
