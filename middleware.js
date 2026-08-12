import { NextResponse } from 'next/server';

/**
 * /api/v1 is handled by app/api/v1/[[...path]]/route.js (session-aware).
 * Keep matcher empty of rewrites so we don't bypass that route.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
