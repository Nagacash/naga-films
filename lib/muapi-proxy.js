import { auth } from '@/lib/auth';
import { getBalance } from '@/lib/credits';

const MUAPI_BASE = 'https://api.muapi.ai';

/**
 * Resolve which MuAPI key to use.
 * Logged-in SaaS users → server MUAPI_API_KEY.
 * Otherwise → client header / cookie / env fallback (BYO key).
 */
export async function resolveMuApiKey(request) {
  try {
    const session = await auth();
    if (session?.user?.id && process.env.MUAPI_API_KEY) {
      return { apiKey: process.env.MUAPI_API_KEY, mode: 'saas', userId: session.user.id };
    }
  } catch {
    // fall through
  }

  const headerKey = request.headers.get('x-api-key');
  if (headerKey && headerKey !== 'session') {
    return { apiKey: headerKey, mode: 'byo', userId: null };
  }

  const cookieKey = request.cookies.get('muapi_key')?.value;
  if (cookieKey) {
    return { apiKey: cookieKey, mode: 'byo', userId: null };
  }

  if (process.env.MUAPI_API_KEY) {
    return { apiKey: process.env.MUAPI_API_KEY, mode: 'env', userId: null };
  }

  return { apiKey: null, mode: 'none', userId: null };
}

export function stripHopHeaders(request) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('cookie');
  headers.delete('content-length');
  return headers;
}

export async function proxyToMuApi(request, { upstreamPath }) {
  const { apiKey, mode, userId } = await resolveMuApiKey(request);
  if (!apiKey) {
    return Response.json(
      { error: 'Unauthorized — log in or provide an API key' },
      { status: 401 }
    );
  }

  if (mode === 'saas' && userId && request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const bal = await getBalance(userId);
      if (bal <= 0) {
        return Response.json(
          { error: 'Insufficient credits — buy a pack to continue', code: 'NO_CREDITS' },
          { status: 402 }
        );
      }
    } catch (err) {
      console.error('[proxy] credit check', err);
    }
  }

  const { search } = new URL(request.url);
  const targetUrl = `${MUAPI_BASE}${upstreamPath}${search}`;
  const headers = stripHopHeaders(request);
  headers.set('x-api-key', apiKey);

  const method = request.method;
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await request.arrayBuffer();
  }

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: body?.byteLength ? body : undefined,
  });
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    return Response.json(data, { status: response.status });
  }

  const buf = await response.arrayBuffer();
  return new Response(buf, {
    status: response.status,
    headers: {
      'content-type': contentType || 'application/octet-stream',
    },
  });
}
