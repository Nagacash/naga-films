import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { getDb, schema } from '@/lib/db';
import { ensureWallet, getBalance } from '@/lib/credits';

const bodySchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  amount: z.number().int(),
  reason: z.string().min(1).max(200).default('admin_adjustment'),
}).refine((d) => d.email || d.userId, { message: 'email or userId required' });

/** Admin: add/remove app credits (not a Stripe refund). */
export async function POST(req) {
  try {
    const admin = await requireAdmin();
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 });
    }

    const db = getDb();
    let userId = parsed.data.userId;
    if (!userId && parsed.data.email) {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.email, parsed.data.email.trim().toLowerCase()),
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      userId = user.id;
    }

    await ensureWallet(userId);
    const amount = parsed.data.amount;

    if (amount < 0) {
      const updated = await db
        .update(schema.creditWallets)
        .set({
          balance: sql`${schema.creditWallets.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(
          sql`${schema.creditWallets.userId} = ${userId} AND ${schema.creditWallets.balance} >= ${Math.abs(amount)}`
        )
        .returning();
      if (!updated.length) {
        return NextResponse.json({ error: 'Insufficient balance to deduct' }, { status: 400 });
      }
    } else {
      await db
        .update(schema.creditWallets)
        .set({
          balance: sql`${schema.creditWallets.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.creditWallets.userId, userId));
    }

    await db.insert(schema.creditTransactions).values({
      userId,
      amount,
      reason: 'adjustment',
      metadata: {
        byAdmin: admin.id,
        adminEmail: admin.email,
        note: parsed.data.reason,
      },
    });

    const balance = await getBalance(userId);
    return NextResponse.json({ ok: true, userId, balance, amount });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || 'Failed' }, { status });
  }
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const db = getDb();
    const wallets = await db
      .select({
        userId: schema.creditWallets.userId,
        balance: schema.creditWallets.balance,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.creditWallets)
      .leftJoin(schema.users, eq(schema.users.id, schema.creditWallets.userId))
      .limit(200);

    return NextResponse.json({ admin: admin.email, wallets });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || 'Failed' }, { status });
  }
}
