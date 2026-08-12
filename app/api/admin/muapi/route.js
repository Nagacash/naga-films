import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

/** Admin-only: real MuAPI operator wallet (server MUAPI_API_KEY). */
export async function GET() {
  try {
    await requireAdmin();
    const key = process.env.MUAPI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: 'MUAPI_API_KEY not set' }, { status: 503 });
    }

    const res = await fetch('https://api.muapi.ai/api/v1/account/balance', {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      cache: 'no-store',
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        { error: `MuAPI returned non-JSON (${res.status})`, raw: text.slice(0, 200) },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || data?.error || `MuAPI ${res.status}`, data },
        { status: 502 }
      );
    }

    // Normalize common shapes
    const balance =
      data?.balance ??
      data?.credits ??
      data?.amount ??
      data?.data?.balance ??
      null;

    return NextResponse.json({
      provider: 'muapi',
      balance,
      currency: data?.currency || 'USD',
      raw: data,
    });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || 'Failed' }, { status });
  }
}
