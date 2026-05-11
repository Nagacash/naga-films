import { NextResponse } from 'next/server';
import {
  fetchOpenRouterChatCompletion,
  getOpenRouterApiKeyFromEnv,
  resolveOpenRouterModel,
} from '@/lib/openrouter-chat';

const MUAPI_BASE = 'https://api.muapi.ai';

function getApiKey(request) {
    // Priority 1: Direct x-api-key header
    const headerKey = request.headers.get('x-api-key');
    if (headerKey) return headerKey;

    // Priority 2: muapi_key cookie
    const cookieKey = request.cookies.get('muapi_key')?.value;
    if (cookieKey) return cookieKey;

    // Priority 3: Global environment variable fallback
    return process.env.MUAPI_API_KEY;
}

function cleanHeaders(request) {
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('cookie'); // CRITICAL: Stop forwarding browser cookies to MuAPI
    return headers;
}

// Build the target URL without a trailing slash when path is empty.
// e.g. GET /api/agents?is_template=true  → https://api.muapi.ai/agents?is_template=true
// e.g. GET /api/agents/by-slug/foo       → https://api.muapi.ai/agents/by-slug/foo
function buildTargetUrl(pathSegments, search) {
    const path = pathSegments.join('/');
    const base = `${MUAPI_BASE}/agents`;
    return path ? `${base}/${path}${search}` : `${base}${search}`;
}

function buildOpenRouterChatMessages(parsedBody) {
    let chatMessages = [];
    if (Array.isArray(parsedBody.messages)) {
        chatMessages = parsedBody.messages
            .filter((m) => {
                const r = m?.role;
                return r === 'user' || r === 'assistant' || r === 'system';
            })
            .map((m) => ({
                role: m.role,
                content: m.content != null ? String(m.content) : '',
            }));
    }

    if (chatMessages.length === 0 && parsedBody.message) {
        chatMessages = [{ role: 'user', content: String(parsedBody.message) }];
    }

    if (
        chatMessages.length > 0 &&
        Array.isArray(parsedBody.attachments) &&
        parsedBody.attachments.length > 0
    ) {
        const last = chatMessages[chatMessages.length - 1];
        if (last.role === 'user') {
            const lines = parsedBody.attachments
                .map((url, i) => `[image ${i + 1}] ${typeof url === 'string' ? url : ''}`)
                .filter(Boolean)
                .join('\n');
            if (lines) last.content = `${last.content}\n\n${lines}`;
        }
    }

    return chatMessages;
}

function buildAgentSystemPrompt(parsedBody) {
    let system = typeof parsedBody.system_prompt === 'string' ? parsedBody.system_prompt.trim() : '';
    const displayName =
        typeof parsedBody.agent_display_name === 'string'
            ? parsedBody.agent_display_name.trim()
            : '';
    if (displayName) {
        system = system
            ? `You are "${displayName}".\n\n${system}`
            : `You are "${displayName}", a helpful AI assistant.`;
    }
    return system.trim() ? system : 'You are a helpful AI assistant.';
}

export async function GET(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    console.log(`[agents proxy GET] ${targetUrl} | apiKey: ${apiKey ? apiKey.slice(0,8)+'...' : 'MISSING'}`);
    if (apiKey) headers.set('x-api-key', apiKey);

    try {
        const response = await fetch(targetUrl, { headers, method: 'GET' });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const bodyBuffer = await request.arrayBuffer();
    const isAgentChatPost =
        pathSegments.length >= 3 && pathSegments[pathSegments.length - 1] === 'chat';

    if (isAgentChatPost && getOpenRouterApiKeyFromEnv()) {
        try {
          const decoded = JSON.parse(new TextDecoder().decode(bodyBuffer));
          if (!decoded || typeof decoded !== 'object') throw new SyntaxError();

          const messages = buildOpenRouterChatMessages(decoded);
          if (!messages.length) {
            throw new Error('Chat payload missing `messages` or `message`');
          }

          const systemPrompt = buildAgentSystemPrompt(decoded);
          const model = resolveOpenRouterModel(['AGENTS_OPENROUTER_MODEL']);
          const { content } = await fetchOpenRouterChatCompletion({
            systemPrompt,
            messages,
            model,
          });

          const conversationId =
            decoded.conversation_id != null ? String(decoded.conversation_id) : undefined;

          return NextResponse.json({
            use_openrouter_completion: true,
            prediction: {
              status: 'completed',
              is_complete: true,
              conversation_id: conversationId,
              messages: [{ role: 'assistant', content }],
              suggestions: [],
            },
          });
        } catch (parseOrRunErr) {
          if (parseOrRunErr instanceof SyntaxError || parseOrRunErr instanceof TypeError) {
            console.warn('[agents proxy POST] OpenRouter branch: invalid JSON payload → MuAPI');
          } else {
            console.error('[agents proxy POST] OpenRouter chat error:', parseOrRunErr);
            const msg =
              parseOrRunErr instanceof Error ? parseOrRunErr.message : 'OpenRouter error';
            const status = msg.includes('not configured') ? 500 : 502;
            return NextResponse.json({ error: msg }, { status });
          }
        }
    }

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    console.log(`[agents proxy POST] ${targetUrl} | apiKey: ${apiKey ? apiKey.slice(0,8)+'...' : 'MISSING'}`);
    if (apiKey) headers.set('x-api-key', apiKey);

    try {
        const response = await fetch(targetUrl, { method: 'POST', headers, body: bodyBuffer });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    if (apiKey) headers.set('x-api-key', apiKey);

    try {
        const response = await fetch(targetUrl, { method: 'DELETE', headers });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    if (apiKey) headers.set('x-api-key', apiKey);

    try {
        const body = await request.arrayBuffer();
        const response = await fetch(targetUrl, { method: 'PUT', headers, body });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
