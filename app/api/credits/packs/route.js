import { NextResponse } from 'next/server';
import { listPublicPacks } from '@/lib/packs';

export async function GET() {
  return NextResponse.json({ packs: listPublicPacks() });
}
