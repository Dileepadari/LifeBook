import * as builtin from './deterministic.js';
import * as anthropic from './anthropic.js';
import * as gemini from './gemini.js';
import { db } from '../db.js';

// Provider dispatch.
//
// Resolution order for a given user: their explicit choice in Settings, then
// whichever key they saved, then the process-level env keys, then 'builtin'.
// Every capability degrades to the deterministic engine on any provider error,
// so a bad key, a rate limit or an outage costs prose quality and never
// functionality. The provider that actually produced the result is returned
// alongside it and stored on the row, so a page always says who wrote it.

const PROVIDERS = { anthropic, gemini };

export function resolveProvider(userId) {
  const s = db.prepare('SELECT ai_provider, ai_key, ai_model FROM settings WHERE user_id = ?').get(userId) || {};
  const choice = s.ai_provider || 'auto';

  if (choice === 'builtin') return { name: 'builtin' };

  if (choice === 'anthropic' || choice === 'gemini') {
    const envKey = choice === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY;
    const apiKey = s.ai_key || envKey;
    if (!apiKey) return { name: 'builtin', reason: `No ${choice} key saved.` };
    return { name: choice, apiKey, model: s.ai_model || undefined };
  }

  // auto: a saved key wins over env, Anthropic wins over Gemini when both exist.
  if (s.ai_key) {
    const guess = s.ai_key.startsWith('sk-ant-') ? 'anthropic' : 'gemini';
    return { name: guess, apiKey: s.ai_key, model: s.ai_model || undefined };
  }
  if (process.env.ANTHROPIC_API_KEY) return { name: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY, model: s.ai_model || undefined };
  if (process.env.GEMINI_API_KEY) return { name: 'gemini', apiKey: process.env.GEMINI_API_KEY, model: s.ai_model || undefined };
  return { name: 'builtin' };
}

/**
 * Runs `capability` on the resolved provider, falling back to the built-in
 * engine on any failure. Returns { result, provider, degradedFrom, error }.
 */
async function run(userId, capability, llmArgs, builtinFn) {
  const provider = resolveProvider(userId);

  if (provider.name === 'builtin') {
    return { result: builtinFn(), provider: 'builtin' };
  }

  const impl = PROVIDERS[provider.name];
  try {
    const result = await impl[capability](...llmArgs, { apiKey: provider.apiKey, model: provider.model });
    return { result, provider: provider.name };
  } catch (err) {
    console.warn(`[ai] ${provider.name}.${capability} failed, falling back to builtin:`, err.message);
    return {
      result: builtinFn(),
      provider: 'builtin',
      degradedFrom: provider.name,
      error: err.message,
    };
  }
}

export function generateLifePage(userId, snapshot) {
  return run(userId, 'generateLifePage', [snapshot], () => builtin.generateLifePage(snapshot));
}

export function generateInsights(userId, analytics) {
  return run(userId, 'generateInsights', [analytics], () => builtin.generateInsights(analytics));
}

export function generateFlashcards(userId, text, count) {
  return run(userId, 'generateFlashcards', [text, count], () => builtin.generateFlashcards(text, count));
}

export function generateQuiz(userId, text, count) {
  return run(userId, 'generateQuiz', [text, count], () => builtin.generateQuiz(text, count));
}

export function generateMindMap(userId, text, title) {
  return run(userId, 'generateMindMap', [text, title], () => builtin.generateMindMap(text, title));
}

export function parseDayBrief(userId, message, context) {
  return run(userId, 'parseDayBrief', [message, context], () => builtin.parseDayBrief(message, context));
}

export function coachChat(userId, message, context) {
  return run(userId, 'coachChat', [message, context], () => builtin.coachChat(message, context));
}

/** Settings > Test connection. Unlike the capabilities, this does not fall
 *  back - the whole point is to surface whether the key actually works. */
export async function testConnection(userId, override) {
  let provider;

  if (override?.apiKey) {
    // The user typed a key and pressed Test before saving - that key is what
    // they want tested, even on 'auto', where we infer the provider from its
    // shape exactly as resolveProvider does.
    const name = override.provider && override.provider !== 'auto'
      ? override.provider
      : override.apiKey.startsWith('sk-ant-') ? 'anthropic' : 'gemini';
    provider = { name, apiKey: override.apiKey, model: override.model };
  } else if (override?.provider && override.provider !== 'auto') {
    provider = { name: override.provider, apiKey: resolveProvider(userId).apiKey, model: override.model };
  } else {
    provider = resolveProvider(userId);
  }

  if (provider.name === 'builtin') {
    return { ok: true, provider: 'builtin', detail: 'Using the built-in engine - no key needed.' };
  }
  if (!provider.apiKey) {
    return { ok: false, provider: provider.name, detail: 'No API key saved for this provider.' };
  }

  const result = await PROVIDERS[provider.name].testConnection({ apiKey: provider.apiKey, model: provider.model });
  return { ok: true, provider: provider.name, detail: `Connected to ${result.model}.` };
}

/**
 * The models the resolved (or supplied) key can actually call. Same resolution
 * rules as testConnection, so pressing Test and opening the model list agree
 * about which key is in play.
 */
export async function listModels(userId, override) {
  const provider = override?.apiKey
    ? {
        name: override.provider && override.provider !== 'auto'
          ? override.provider
          : override.apiKey.startsWith('sk-ant-') ? 'anthropic' : 'gemini',
        apiKey: override.apiKey,
      }
    : override?.provider && override.provider !== 'auto'
      ? { name: override.provider, apiKey: resolveProvider(userId).apiKey }
      : resolveProvider(userId);

  if (provider.name === 'builtin' || !provider.apiKey) return { provider: provider.name, models: [] };
  return { provider: provider.name, models: await PROVIDERS[provider.name].listModels({ apiKey: provider.apiKey }) };
}

export const DEFAULT_MODELS = {
  anthropic: anthropic.DEFAULT_MODEL,
  gemini: gemini.DEFAULT_MODEL,
};
