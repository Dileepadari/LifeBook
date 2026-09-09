/**
 * Gemini provider. Same capabilities as the Claude provider, over the REST API,
 * with the shared JSON schemas translated to Gemini's OpenAPI dialect.
 */
import * as P from './prompts.js';

export const DEFAULT_MODEL = 'gemini-2.5-flash';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini's responseSchema is OpenAPI-flavoured, not full JSON Schema: it does
// not accept `additionalProperties`, and a nullable field is expressed with
// `nullable: true` rather than a type union. Rather than maintain two copies of
// every schema, translate the shared ones here.
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);

  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties') continue;
    if (key === 'type' && Array.isArray(value)) {
      out.type = value.find((t) => t !== 'null') || 'string';
      if (value.includes('null')) out.nullable = true;
      continue;
    }
    if (key === 'properties') {
      out.properties = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toGeminiSchema(v)]));
      continue;
    }
    if (key === 'items') {
      out.items = toGeminiSchema(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

// Gemini counts thinking tokens against maxOutputTokens, so the budget a
// caller picks for the *answer* is not the budget the request needs. Every
// call site here sizes maxTokens for the JSON it wants back; this is the extra
// room the model gets to think in first, so a caller never has to reason about
// whether the model it was pointed at happens to be a thinking one.
const THINKING_HEADROOM = 4000;

async function complete({ apiKey, model, system, prompt, schema, maxTokens = 4000 }) {
  const url = `${BASE}/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens + THINKING_HEADROOM,
      ...(schema
        ? { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) }
        : { responseMimeType: 'text/plain' }),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini request failed (${res.status}).`);
  }

  const candidate = json.candidates?.[0];
  if (!candidate) throw new Error('Gemini returned no candidates.');
  if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
    throw new Error('Gemini declined this request. The built-in engine was used instead.');
  }

  const text = candidate.content?.parts?.map((p) => p.text).filter(Boolean).join('');

  // Thinking-capable models (the 3.x families) spend part of the output budget
  // on thoughts before they write a single visible token, so a budget that
  // looks generous for the answer can be consumed entirely by reasoning and
  // come back with an empty `content` and no error at all. Say which it was -
  // "returned no text" sends people hunting for a parsing bug that isn't there.
  if (!text) {
    const thoughts = json.usageMetadata?.thoughtsTokenCount;
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new Error(
        `Gemini hit its output limit${thoughts ? ` after spending ${thoughts} tokens on thinking` : ''} and returned nothing. This model needs more room than ${maxTokens + THINKING_HEADROOM} tokens for this request.`,
      );
    }
    throw new Error(`Gemini returned no text (finishReason: ${candidate.finishReason || 'unknown'}).`);
  }
  return schema ? JSON.parse(text) : text;
}

export async function generateLifePage(snapshot, { apiKey, model }) {
  return complete({ apiKey, model, system: P.SYSTEM, prompt: P.lifePagePrompt(snapshot), schema: P.LIFEPAGE_SCHEMA });
}

export async function generateInsights(analytics, { apiKey, model }) {
  return complete({ apiKey, model, system: P.SYSTEM, prompt: P.insightsPrompt(analytics), schema: P.INSIGHTS_SCHEMA });
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

/**
 * The models this key can actually call. Google ships and retires Gemini model
 * names quickly enough that any list hard-coded here would be wrong within
 * months - and a wrong model name is the single easiest way to end up with a
 * valid key that still fails on every request. So ask.
 */
export async function listModels({ apiKey }) {
  const res = await fetch(`${BASE}?key=${encodeURIComponent(apiKey)}&pageSize=200`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Gemini returned ${res.status}.`);
    err.status = res.status;
    throw err;
  }
  return (body.models || [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    // Plenty of models answer generateContent but cannot do what this app asks
    // of them - image, speech and music models cannot return the JSON these
    // features need, and the robotics/computer-use/deep-research families are
    // built for a different job entirely. Offering any of them would be a trap.
    .filter((n) => !/(image|tts|lyria|nano-banana|embedding|omni|robotics|computer-use|deep-research|antigravity)/i.test(n))
    .sort();
}

export async function testConnection({ apiKey, model }) {
  const text = await complete({
    apiKey,
    model,
    prompt: 'Reply with the single word: ready',
    maxTokens: 16,
  });
  return { ok: true, model: model || DEFAULT_MODEL, reply: text.trim() };
}
