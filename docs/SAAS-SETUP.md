# SaaS setup (auth · credits · Stripe · MuAPI)

Functional backend for pack-only prepaid credits. Visual redesign comes later.

## 1. Env

Copy `.env.example` → `.env.local` and fill:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Stripe secret (test `sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI or Dashboard webhook |
| `STRIPE_PRICE_STARTER` / `_CREATOR` / `_PRO` | One-time Price IDs (mode=payment) |
| `MUAPI_API_KEY` | Your server MuAPI key |
| `NEXT_PUBLIC_APP_URL` | e.g. `http://localhost:3000` |

## 2. Database

```bash
pnpm db:migrate
```

## 3. Stripe packs

Create three **one-time** Prices in Stripe (not recurring). Put Price IDs in env.

Local webhook:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 4. Run

```bash
pnpm install
pnpm dev
```

## Routes

- `/` landing (signup / credits CTAs)
- `/signup` `/login` auth
- `/credits` pack checkout
- `/studio` session or BYO key
- `POST /api/auth/signup` — create account + empty wallet
- `GET /api/me` — user + credit balance
- `POST /api/credits/topup` — Stripe Checkout
- `POST /api/webhooks/stripe` — unlock credits after payment
- `POST /api/generate` — image gen with credit hold
- `GET /api/generations` — history
- `/api/v1/*` — session-aware MuAPI proxy

## Auth modes in Studio

1. **SaaS** — log in → server uses `MUAPI_API_KEY`; header shows credits; empty wallet blocks POST (402).
2. **BYO key** — paste MuAPI key (legacy); shows MuAPI USD balance.

Fine-grained credit debit for all studio models continues via `POST /api/generate` (image MVP first).
