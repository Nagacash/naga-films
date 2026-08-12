import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb, schema } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(schema.generations)
      .where(eq(schema.generations.userId, session.user.id))
      .orderBy(desc(schema.generations.createdAt))
      .limit(50);

    return NextResponse.json({ generations: rows });
  } catch (err) {
    console.error('[generations]', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
