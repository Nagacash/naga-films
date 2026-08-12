/**
 * One-time credit packs (no subscriptions).
 * Stripe Price IDs come from env; amounts are authoritative in app code.
 */
export const CREDIT_PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: Number(process.env.CREDITS_PACK_STARTER || 500),
    priceEnv: 'STRIPE_PRICE_STARTER',
    priceUsd: 9,
    blurb: 'Enough for a handful of images',
  },
  {
    id: 'creator',
    name: 'Creator',
    credits: Number(process.env.CREDITS_PACK_CREATOR || 1000),
    priceEnv: 'STRIPE_PRICE_CREATOR',
    priceUsd: 15,
    blurb: 'Best for regular studio work',
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: Number(process.env.CREDITS_PACK_PRO || 5000),
    priceEnv: 'STRIPE_PRICE_PRO',
    priceUsd: 59,
    blurb: 'Volume pack for production days',
  },
];

export function getPack(packId) {
  return CREDIT_PACKS.find((p) => p.id === packId) || null;
}

export function getPackPriceId(pack) {
  const priceId = process.env[pack.priceEnv];
  if (!priceId) return null;
  return priceId;
}

export function listPublicPacks() {
  return CREDIT_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    credits: p.credits,
    priceUsd: p.priceUsd,
    blurb: p.blurb,
    configured: Boolean(process.env[p.priceEnv]),
  }));
}
