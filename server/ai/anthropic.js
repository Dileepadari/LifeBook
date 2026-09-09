/**
 * Claude provider. Structured output through one shared call helper, so JSON
 * parsing and refusal handling live in a single place.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as P from './prompts.js';

export const DEFAULT_MODEL = 'claude-opus-5';

function client(apiKey) {
  return new Anthropic({ apiKey });
}

/**
 * One call, structured output, no streaming. Every capability below funnels
 * through here so refusal handling and JSON parsing live in one place.
 *
 * `output_config.format` constrains the response to the schema, so the first
 * text block is guaranteed-parseable JSON. Effort is 'medium' - these are
 * short, well-specified writing tasks, not agentic work, and medium is
 * measurably enough while keeping a page generation sub-10-seconds.
 */
async function complete({ apiKey, model, system, prompt, schema, maxTokens = 4000 }) {
  const res = await client(apiKey).messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: maxTokens,
    system,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      ...(schema ? { format: { type: 'json_schema', schema } } : {}),
    },
    messages: [{ role: 'user', content: prompt }],
  });

  // Safety classifiers can decline with HTTP 200 - check before reading content,
  // or `content[0]` is undefined and the failure reads as a parse bug.
  if (res.stop_reason === 'refusal') {
    const category = res.stop_details?.category ? ` (${res.stop_details.category})` : '';
    throw new Error(`Claude declined this request${category}. The built-in engine was used instead.`);
  }

  const text = res.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no text.');
  return schema ? JSON.parse(text) : text;
}

export async function generateLifePage(snapshot, { apiKey, model }) {
  return complete({
    apiKey,
    model,
    system: P.SYSTEM,
    prompt: P.lifePagePrompt(snapshot),
    schema: P.LIFEPAGE_SCHEMA,
  });
}

export async function generateInsights(analytics, { apiKey, model }) {
  return complete({
    apiKey,
    model,
    system: P.SYSTEM,
    prompt: P.insightsPrompt(analytics),
    schema: P.INSIGHTS_SCHEMA,
  });
}

export async function generateFlashcards(text, count, { apiKey, model }) {
  const out = await complete({
    apiKey,
    model,
    system: 'You write precise, atomic study flashcards. One fact per card.',
    prompt: P.flashcardsPrompt(text, count),
    schema: P.FLASHCARDS_SCHEMA,
    maxTokens: 8000,
  });
  return out.cards;
}

export async function generateQuiz(text, count, { apiKey, model }) {
  const out = await complete({
    apiKey,
    model,
    system: 'You write fair, unambiguous multiple-choice exam questions.',
    prompt: P.quizPrompt(text, count),
    schema: P.QUIZ_SCHEMA,
    maxTokens: 8000,
  });
  return out.questions;
}

export async function generateMindMap(text, title, { apiKey, model }) {
  return complete({
    apiKey,
    model,
    system: 'You structure study material into clear conceptual hierarchies.',
    prompt: P.mindMapPrompt(text, title),
    schema: P.MINDMAP_SCHEMA,
    maxTokens: 6000,
  });
}

export async function parseDayBrief(message, context, { apiKey, model }) {
  return complete({
    apiKey,
    model,
    system: P.DAYBRIEF_SYSTEM,
    prompt: P.dayBriefPrompt(message, context),
    schema: P.DAYBRIEF_SCHEMA,
    maxTokens: 4000,
  });
}

export async function coachChat(message, context, { apiKey, model }) {
  return complete({
    apiKey,
    model,
    system: P.COACH_SYSTEM,
    prompt: P.coachPrompt(message, context),
    maxTokens: 1500,
  });
}

/** See the note in gemini.js - same reasoning, and the SDK already has a
 *  paginated models endpoint. */
export async function listModels({ apiKey }) {
  const page = await client(apiKey).models.list({ limit: 100 });
  return page.data.map((m) => m.id).sort();
}

/** Cheapest possible round-trip, used by Settings > Test connection. */
export async function testConnection({ apiKey, model }) {
  const res = await client(apiKey).messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
  });
  return { ok: true, model: res.model };
}
