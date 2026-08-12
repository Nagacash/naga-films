import { eq, and, gte, sql } from 'drizzle-orm';
import { getDb, schema } from './db';

const { creditWallets, creditTransactions, generations } = schema;

export async function ensureWallet(userId) {
  const db = getDb();
  const existing = await db.query.creditWallets.findFirst({
    where: eq(creditWallets.userId, userId),
  });
  if (existing) return existing;
  const [row] = await db
    .insert(creditWallets)
    .values({ userId, balance: 0 })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  return db.query.creditWallets.findFirst({
    where: eq(creditWallets.userId, userId),
  });
}

export async function getBalance(userId) {
  const wallet = await ensureWallet(userId);
  return wallet?.balance ?? 0;
}

/** Idempotent pack unlock after Stripe Checkout */
export async function creditFromStripeSession({
  userId,
  credits,
  stripeSessionId,
  paymentIntentId,
  packId,
}) {
  const db = getDb();
  await ensureWallet(userId);

  try {
    await db.insert(creditTransactions).values({
      userId,
      amount: credits,
      reason: 'topup',
      stripeSessionId,
      stripePaymentIntentId: paymentIntentId || null,
      metadata: { packId },
    });
  } catch (err) {
    if (
      String(err?.message || err).includes('credit_tx_stripe_session_uniq') ||
      String(err?.code) === '23505'
    ) {
      return { alreadyProcessed: true };
    }
    throw err;
  }

  await db
    .update(creditWallets)
    .set({
      balance: sql`${creditWallets.balance} + ${credits}`,
      updatedAt: new Date(),
    })
    .where(eq(creditWallets.userId, userId));

  return { alreadyProcessed: false, credited: credits };
}

/** Hold credits before calling MuAPI (atomic). Returns false if insufficient. */
export async function holdCredits(userId, amount, generationId) {
  if (amount <= 0) return true;
  const db = getDb();
  await ensureWallet(userId);

  const updated = await db
    .update(creditWallets)
    .set({
      balance: sql`${creditWallets.balance} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(and(eq(creditWallets.userId, userId), gte(creditWallets.balance, amount)))
    .returning();

  if (!updated.length) return false;

  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    reason: 'generation',
    generationId,
    metadata: { hold: true },
  });

  return true;
}

export async function releaseHold(userId, amount, generationId) {
  if (amount <= 0) return;
  const db = getDb();
  await db
    .update(creditWallets)
    .set({
      balance: sql`${creditWallets.balance} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(creditWallets.userId, userId));

  // App-credit restore only — NEVER a Stripe money refund.
  // Matches MuAPI: failed tasks are not charged (cost.refunded / 0% on failed).
  await db.insert(creditTransactions).values({
    userId,
    amount,
    reason: 'generation_failed',
    generationId,
    metadata: { restoredCredits: true, stripeRefund: false },
  });

  await db
    .update(generations)
    .set({ heldCredits: 0 })
    .where(eq(generations.id, generationId));
}

export async function captureHold(generationId) {
  const db = getDb();
  await db
    .update(generations)
    .set({ heldCredits: 0 })
    .where(eq(generations.id, generationId));
}

export function estimateImageCredits({ model } = {}) {
  const perUsd = Number(process.env.CREDITS_PER_USD || 100);
  const markup = Number(process.env.MARKUP_MULT || 1.6);
  const usd = Number(process.env.DEFAULT_IMAGE_USD_COST || 0.04);
  void model;
  return Math.max(1, Math.ceil(usd * perUsd * markup));
}
