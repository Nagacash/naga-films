const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** @returns {string|null} */
export function getOpenRouterApiKeyFromEnv() {
  return process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || null;
}

/**
 * Resolve model ID for a feature-specific env prefix.
 * Checks env keys in order, then OPENROUTER_MODEL, then fallback.
 *
 * @param {string[]} [featureEnvKeys]
 * @param {string} [fallback]
 */
export function resolveOpenRouterModel(featureEnvKeys = [], fallback = 'openai/gpt-4o-mini') {
  for (const key of featureEnvKeys) {
    if (key && process.env[key]) return process.env[key];
  }
  if (process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL;
  return fallback;
}

/**
 * Chat completion via OpenRouter (OpenAI-compatible).
 *
 * @param {{ systemPrompt?: string, messages: Array<{ role: string, content: string }>, model?: string }} opts
 */
export async function fetchOpenRouterChatCompletion({ systemPrompt = '', messages, model }) {
  const apiKey = getOpenRouterApiKeyFromEnv();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY (or OPENROUTER_KEY) is not set');
  }

  const openrouterMessages = [];
  const hasServerSystem = typeof systemPrompt === 'string' && Boolean(systemPrompt.trim());
  if (hasServerSystem) {
    openrouterMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  for (const m of messages) {
    const role = m?.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') continue;
    if (hasServerSystem && role === 'system') continue;
    const content = m?.content != null ? String(m.content) : '';
    openrouterMessages.push({ role, content });
  }

  if (openrouterMessages.length === 0) {
    throw new Error('No valid messages for OpenRouter');
  }

  const referer = process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000';
  const title = process.env.OPENROUTER_APP_NAME || 'Open Generative AI';

  let res;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': title,
      },
      body: JSON.stringify({ model, messages: openrouterMessages }),
    });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'OpenRouter request failed');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText || 'OpenRouter error';
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (content == null || content === '') {
    throw new Error('Empty model response');
  }

  return { content };
}
