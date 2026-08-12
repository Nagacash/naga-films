import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { creditFromStripeSession } from '@/lib/credits';
import { getPack } from '@/lib/packs';

export const runtime = 'nodejs';

export async function POST(req) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error('[stripe webhook] signature', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode !== 'payment' || session.payment_status !== 'paid') {
        return NextResponse.json({ received: true, skipped: true });
      }

      const userId = session.metadata?.userId || session.client_reference_id;
      const packId = session.metadata?.packId;
      const pack = getPack(packId);
      const credits = Number(session.metadata?.credits || pack?.credits || 0);

      if (!userId || !credits) {
        console.error('[stripe webhook] missing userId/credits', session.id);
        return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
      }

      // Unlock app credits only. Never issue Stripe refunds for pack purchases.
      const result = await creditFromStripeSession({
        userId,
        credits,
        stripeSessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
        packId,
      });

      console.log('[stripe webhook] credited', {
        sessionId: session.id,
        userId,
        credits,
        ...result,
      });
    }

    // Explicitly ignore refund / dispute events for auto-handling (manual review only)
    if (
      event.type === 'charge.refunded' ||
      event.type === 'charge.dispute.created'
    ) {
      console.warn('[stripe webhook] refund/dispute — no auto credit revoke', event.type, event.id);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook]', err);
    return NextResponse.json({ error: err.message || 'Handler failed' }, { status: 500 });
  }
}
