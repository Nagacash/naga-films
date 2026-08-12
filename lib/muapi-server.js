const MUAPI_BASE = 'https://api.muapi.ai';

function getKey() {
  const key = process.env.MUAPI_API_KEY;
  if (!key) throw new Error('MUAPI_API_KEY is not set');
  return key;
}

async function muapiFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${MUAPI_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `MuAPI ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Submit image generation. Endpoint path is model-specific (same as studio).
 * Default: flux / generic text-to-image style path from studio conventions.
 */
export async function submitImageGeneration({ model, prompt, params = {} }) {
  const endpoint = params.endpoint || model || 'flux';
  const payload = {
    prompt,
    ...params,
  };
  delete payload.endpoint;

  const data = await muapiFetch(`/api/v1/${endpoint}`, {
    method: 'POST',
    body: payload,
  });

  const requestId =
    data?.request_id || data?.id || data?.prediction_id || data?.data?.request_id;
  if (!requestId) {
    throw new Error('MuAPI did not return a request_id');
  }
  return { requestId, raw: data };
}

export async function getPredictionResult(requestId) {
  return muapiFetch(`/api/v1/predictions/${requestId}/result`);
}

export function extractResultUrls(result) {
  if (!result) return [];
  if (Array.isArray(result.outputs)) {
    return result.outputs.map((o) => (typeof o === 'string' ? o : o?.url)).filter(Boolean);
  }
  if (Array.isArray(result.output)) {
    return result.output.map((o) => (typeof o === 'string' ? o : o?.url)).filter(Boolean);
  }
  if (typeof result.url === 'string') return [result.url];
  if (typeof result.image_url === 'string') return [result.image_url];
  return [];
}

export function isPredictionDone(result) {
  const status = String(result?.status || result?.state || '').toLowerCase();
  if (['completed', 'succeeded', 'success', 'done'].includes(status)) return 'completed';
  if (['failed', 'error', 'cancelled'].includes(status)) return 'failed';
  const urls = extractResultUrls(result);
  if (urls.length) return 'completed';
  return 'pending';
}
