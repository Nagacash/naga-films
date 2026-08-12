import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getStripe, getAppUrl } from '@/lib/stripe';
import { getPack, getPackPriceId } from '@/lib/packs';

const bodySchema = z.object({
  packId: z.enum(['starter', 'creator', 'pro']),
});

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 });
    }

    const pack = getPack(parsed.data.packId);
    const priceId = getPackPriceId(pack);
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for pack "${pack.id}". Set ${pack.priceEnv}.` },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    const appUrl = getAppUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/credits?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/credits?canceled=1`,
      customer_email: session.user.email || undefined,
      client_reference_id: session.user.id,
      metadata: {
        userId: session.user.id,
        packId: pack.id,
        credits: String(pack.credits),
      },
      // Do not set payment_method_types — let Stripe Dashboard control methods
    });

    return NextResponse.json({ checkoutUrl: checkout.url, sessionId: checkout.id });
  } catch (err) {
    console.error('[credits/topup]', err);
    return NextResponse.json({ error: err.message || 'Checkout failed' }, { status: 500 });
  }
}
