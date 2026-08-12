# Thin Admin Console — Design

**Date:** 2026-08-12  
**Status:** Approved  
**Approach:** Thin admin + Stripe/Neon for deep history (Approach 2)  
**Security posture:** Safe-side defaults (caps, confirm, audit, kill switches)

## Goal

Give operators a minimal `/admin` to run prepaid SaaS safely: see MuAPI float, support a user (lookup / disable / capped credit adjust), pause all generations, and leave a short audit trail. Full analytics and pack editing stay outside the app.

## Scope

### In

- Live **MuAPI float** (server `MUAPI_API_KEY`) + admin’s **Naga balance**
- **User lookup** by email → wallet, disabled status, light activity snippet
- **Disable / enable user** (blocks login + all SaaS generation)
- **Global kill switch** (pause all SaaS generations; packs/checkout remain available)
- **Credit adjust** (+/−) with reason, typed confirm on subtract, per-action + daily caps, immutable audit
- Short **admin audit log** on the page (last ~50 actions)

### Out

- Full ledger / BI / analytics UI
- Pack / Price ID editor (Stripe + env)
- Stripe cash refunds from admin
- Promoting admins in UI (`ADMIN_EMAILS` remains source of truth)
- Impersonation / “login as user”

## Architecture

### UI

Single `/admin` page with three blocks:

1. **Operator** — MuAPI float, global kill status + toggle  
2. **Support** — email search → user card (balance, status, adjust, disable)  
3. **Audit** — last ~50 admin actions (read-only)

### Data

| Change | Purpose |
|--------|---------|
| `users.disabled_at` (nullable timestamp) | Soft disable |
| `app_settings` (key/value) | e.g. `generations_paused` |
| `admin_audit_log` | actorId, action, targetUserId, amount, reason, metadata, createdAt |

Credit adjusts reuse `credit_transactions` with reason `admin_adjust` and write a matching audit row in the same DB transaction.

### Enforcement points

- `requireAdmin()` on every `/api/admin/*` mutation and sensitive read
- Generate + MuAPI proxy: if global pause → `503`; if user `disabled_at` → `403`
- Auth/session: disabled users cannot establish a usable session for SaaS gen

### Trust boundary

- `MUAPI_API_KEY` / Stripe secrets never sent to the browser
- Admin API responses are field-allowlisted (no password hashes, no raw secret material)
- MuAPI balance fetch has timeout; failures degrade only the Operator MuAPI card

## Security controls

### Authorization

- Server-side `requireAdmin()` (session + `ADMIN_EMAILS` / DB role)
- No “make admin” UI; admin list stays env-driven

### Credit adjust

- Zod body: `email`, `amount` (int ≠ 0), `reason` (min length), `confirm` required when `amount < 0`
- Subtract confirm: must type target email (or agreed token `SUBTRACT`)
- Caps (env-tunable, conservative defaults): max **±500** per action; max **±2000** net per admin per 24h
- Wallet balance never &lt; 0
- No Stripe refunds from this surface
- `credit_transactions` + `admin_audit_log` in one transaction; rollback on any failure

### Kill switches

- Disable user → set `disabled_at`; block gen/proxy; refuse new effective access
- Global pause → `app_settings.generations_paused`; gen/proxy refuse; checkout allowed
- Toggle on/off requires confirm + audit row

### Abuse & disclosure

- Rate-limit admin mutations (~30/min per admin session)
- Generic short client errors; no stack traces / upstream dumps
- Never log API keys or full Stripe payloads

## Error model

| Case | Status | Code (example) |
|------|--------|----------------|
| Cap exceeded | 400 | `CAP_EXCEEDED` |
| Missing/invalid confirm | 400 | `CONFIRM_REQUIRED` |
| User not found | 404 | `NOT_FOUND` |
| Global pause on gen | 503 | `GENERATIONS_PAUSED` |
| Disabled user on gen | 403 | `USER_DISABLED` |
| MuAPI balance fail | 502 (admin MuAPI only) | short message |

## Test plan (manual)

- [ ] Non-admin cannot call `/api/admin/*`
- [ ] Lookup by email works for admin
- [ ] Disable user → cannot generate; enable → can
- [ ] Global pause → all SaaS gen blocked; unpause restores
- [ ] Add under cap works; over per-action / daily cap rejected
- [ ] Subtract without confirm rejected; with confirm works; balance ≥ 0
- [ ] Audit shows actor, action, target, amount, reason
- [ ] MuAPI balance loads without key in response bodies / client network

## Non-goals reminder

Stripe Dashboard for payments; Neon/SQL for deep ledger queries; MuAPI dashboard for provider spend detail beyond the float card.
