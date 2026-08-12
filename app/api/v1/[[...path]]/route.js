import { proxyToMuApi } from '@/lib/muapi-proxy';

async function handle(request, context) {
  const { path } = await context.params;
  const segments = path || [];
  const upstreamPath = `/api/v1/${segments.join('/')}`;
  try {
    return await proxyToMuApi(request, { upstreamPath });
  } catch (err) {
    console.error('[api/v1 proxy]', err);
    return Response.json({ error: err.message || 'Proxy failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
