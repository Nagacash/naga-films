import { NextResponse } from 'next/server';
import {
  fetchOpenRouterChatCompletion,
  getOpenRouterApiKeyFromEnv,
  resolveOpenRouterModel,
} from '@/lib/openrouter-chat';

/**
 * Hyperframe Studio chat — uses OpenRouter (server-side OPENROUTER_API_KEY).
 * Body: { messages: { role, content }[], system_prompt?: string, skill?: string }
 * Response: { content: string }
 */
export async function POST(request) {
  if (!getOpenRouterApiKeyFromEnv()) {
    return NextResponse.json(
      { error: 'Set OPENROUTER_API_KEY (or OPENROUTER_KEY) in .env.local', content: null },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', content: null }, { status: 400 });
  }

  const { messages, system_prompt: systemPrompt } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: '`messages` must be a non-empty array', content: null }, { status: 400 });
  }

  const chatMessages = [];
  for (const m of messages) {
    const role = m?.role;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') continue;
    chatMessages.push({
      role,
      content: m?.content != null ? String(m.content) : '',
    });
  }

  if (chatMessages.length === 0) {
    return NextResponse.json({ error: 'No valid messages', content: null }, { status: 400 });
  }

  const model = resolveOpenRouterModel(['HYPERFRAMES_OPENROUTER_MODEL']);

  try {
    const { content } = await fetchOpenRouterChatCompletion({
      systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : '',
      messages: chatMessages,
      model,
    });
    return NextResponse.json({ content });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OpenRouter failed';
    const status = msg.includes('not set') ? 500 : 502;
    return NextResponse.json({ error: msg, content: null }, { status });
  }
}
