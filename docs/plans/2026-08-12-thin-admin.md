# Thin Admin Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a launch-minimum `/admin` for operator float + support (lookup, disable, capped credit adjust, global gen pause) with safe-side audit and enforcement.

**Architecture:** Extend schema (`disabled_at`, `app_settings`, `admin_audit_log`); harden `/api/admin/*` behind `requireAdmin()`; gate SaaS generate/proxy on pause + user disable; rebuild `/admin` as three blocks (Operator / Support / Audit). Design: `docs/plans/2026-08-12-thin-admin-design.md`.

**Tech Stack:** Next.js App Router, Drizzle + Neon, NextAuth, Zod, existing `lib/credits.js` / `lib/admin.js` / `lib/muapi-proxy.js`

**Reference:** @docs/plans/2026-08-12-thin-admin-design.md · @security-and-hardening

---

### Task 1: Schema + migration for admin controls

**Files:**
- Modify: `lib/db/schema.js`
- Modify: `scripts/migrate-saas.js`
- Create: `scripts/migrate-admin-controls.js` (or append to migrate-saas and document in `docs/SAAS-SETUP.md`)

**Step 1: Add schema fields/tables**

In `lib/db/schema.js`:

```js
// on users table — add:
disabledAt: timestamp('disabled_at', { mode: 'date' }),

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id),
    amount: integer('amount'),
    reason: text('reason'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index('admin_audit_created_idx').on(t.createdAt),
  })
);
```

Export new tables from `lib/db` index if there is one.

**Step 2: Migration SQL**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL,
  target_user_id uuid REFERENCES users(id),
  amount integer,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log (created_at DESC);
```

**Step 3: Run migration**

Run: `node scripts/migrate-saas.js` (or dedicated script) with `DATABASE_URL` set  
Expected: tables/columns exist; no error

**Step 4: Commit**

```bash
git add lib/db/schema.js scripts/migrate-saas.js docs/SAAS-SETUP.md
git commit -m "feat(admin): schema for disable, settings, audit log"
```

---

### Task 2: Pure helpers — caps, confirm, settings, audit

**Files:**
- Create: `lib/admin-controls.js`
- Create: `scripts/test-admin-controls.mjs` (node:test — no new test runner dep)

**Step 1: Write failing tests**

```js
// scripts/test-admin-controls.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAdjustConfirm,
  assertWithinActionCap,
  ADMIN_ACTION_CAP,
} from '../lib/admin-controls.js';

test('subtract requires confirm matching email', () => {
  assert.throws(
    () => validateAdjustConfirm({ amount: -10, email: 'a@b.com', confirm: '' }),
    /CONFIRM/
  );
  assert.doesNotThrow(() =>
    validateAdjustConfirm({ amount: -10, email: 'a@b.com', confirm: 'a@b.com' })
  );
});

test('action cap rejects oversize', () => {
  assert.throws(() => assertWithinActionCap(ADMIN_ACTION_CAP + 1), /CAP/);
});
```

**Step 2: Run — expect FAIL**

Run: `node --test scripts/test-admin-controls.mjs`  
Expected: FAIL (module/exports missing)

**Step 3: Implement `lib/admin-controls.js`**

```js
export const ADMIN_ACTION_CAP = Number(process.env.ADMIN_CREDIT_ACTION_CAP || 500);
export const ADMIN_DAILY_CAP = Number(process.env.ADMIN_CREDIT_DAILY_CAP || 2000);

export function validateAdjustConfirm({ amount, email, confirm }) {
  if (amount >= 0) return;
  const ok =
    String(confirm || '').trim().toLowerCase() === String(email).trim().toLowerCase() ||
    String(confirm || '').trim() === 'SUBTRACT';
  if (!ok) {
    const err = new Error('Confirm required for subtract');
    err.code = 'CONFIRM_REQUIRED';
    err.status = 400;
    throw err;
  }
}

export function assertWithinActionCap(amount) {
  if (!Number.isInteger(amount) || amount === 0) {
    const err = new Error('Invalid amount');
    err.status = 400;
    throw err;
  }
  if (Math.abs(amount) > ADMIN_ACTION_CAP) {
    const err = new Error(`Amount exceeds per-action cap (${ADMIN_ACTION_CAP})`);
    err.code = 'CAP_EXCEEDED';
    err.status = 400;
    throw err;
  }
}

// Also export: getSetting, setSetting, writeAudit, sumAdminAdjustments24h,
// assertWithinDailyCap, isGenerationsPaused, isUserDisabled — used by routes.
```

Implement DB-backed helpers using `getDb()` + schema (same file or split if preferred). Keep responses free of secrets.

**Step 4: Run tests — expect PASS**

Run: `node --test scripts/test-admin-controls.mjs`  
Expected: PASS for pure validators

**Step 5: Commit**

```bash
git add lib/admin-controls.js scripts/test-admin-controls.mjs
git commit -m "feat(admin): safe-side credit confirm and cap helpers"
```

---

### Task 3: Harden credit adjust API

**Files:**
- Modify: `app/api/admin/credits/route.js`
- Modify: `.env.example` (document `ADMIN_CREDIT_ACTION_CAP`, `ADMIN_CREDIT_DAILY_CAP`)

**Step 1: Update POST body schema**

Require `reason` min 3 chars; add optional `confirm`; reject amount `0`; call `assertWithinActionCap`, `validateAdjustConfirm`, `assertWithinDailyCap(admin.id, amount)`.

**Step 2: Single DB transaction**

Wallet update + `credit_transactions` (`reason: 'admin_adjust'`) + `writeAudit({ action: 'credit_adjust', ... })` must succeed together. On failure, rollback / no partial credit.

**Step 3: Manual check**

- Subtract without confirm → 400 `CONFIRM_REQUIRED`
- Amount 501 → 400 `CAP_EXCEEDED`
- Valid add → balance + audit row

**Step 4: Commit**

```bash
git add app/api/admin/credits/route.js .env.example
git commit -m "fix(admin): harden credit adjust with caps, confirm, audit"
```

---

### Task 4: User lookup + disable APIs

**Files:**
- Create: `app/api/admin/users/route.js` (GET `?email=`)
- Create: `app/api/admin/users/disable/route.js` (POST `{ email, disabled: boolean, confirm }`)

**Step 1: GET lookup**

`requireAdmin()` → find user by email → return allowlisted:

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "role": "user",
    "disabledAt": null,
    "createdAt": "..."
  },
  "wallet": { "balance": 0 },
  "recentGenerations": [ /* max 5: id, status, model, createdAt — no full prompts if sensitive */ ]
}
```

**Step 2: POST disable**

- `disabled: true` requires `confirm` === email
- Set / clear `users.disabled_at`
- Audit `user_disable` / `user_enable`
- Do not return passwordHash

**Step 3: Commit**

```bash
git add app/api/admin/users/
git commit -m "feat(admin): user lookup and disable endpoints"
```

---

### Task 5: Global kill switch API + enforcement

**Files:**
- Create: `app/api/admin/settings/route.js` (GET status; POST `{ generationsPaused, confirm }`)
- Modify: `lib/muapi-proxy.js` — before SaaS mutating proxy, check pause + disabled
- Modify: `app/api/generate/route.js` — same checks early
- Modify: `lib/auth.js` — if `disabledAt`, fail credentials / empty session role path with clear error

**Step 1: Settings API**

- GET: `{ generationsPaused: boolean }`
- POST: require confirm string `PAUSE` or `RESUME`; write `app_settings`; audit

**Step 2: Enforcement helper**

```js
// lib/admin-controls.js
export async function assertSaaSGenerationAllowed(userId) {
  if (await isGenerationsPaused()) {
    const err = new Error('Generations are temporarily paused');
    err.code = 'GENERATIONS_PAUSED';
    err.status = 503;
    throw err;
  }
  if (await isUserDisabled(userId)) {
    const err = new Error('Account disabled');
    err.code = 'USER_DISABLED';
    err.status = 403;
    throw err;
  }
}
```

Call from `proxyToMuApi` (saas + non-GET) and `POST /api/generate`.

**Step 3: Auth**

On login, if `disabledAt` set → return CredentialsSignin / 403 style failure. Disabled users must not keep generating via existing session: check `disabledAt` in generate/proxy (authoritative), not only at login.

**Step 4: Commit**

```bash
git add app/api/admin/settings/route.js lib/muapi-proxy.js app/api/generate/route.js lib/auth.js lib/admin-controls.js
git commit -m "feat(admin): global pause and disable enforcement on gen paths"
```

---

### Task 6: Audit list API + rate limit stub

**Files:**
- Create: `app/api/admin/audit/route.js`
- Create or extend: `lib/admin-rate-limit.js` (in-memory Map per admin id; fine for single-instance; document limitation)

**Step 1: GET audit**

Last 50 rows joined with actor email (allowlisted fields only).

**Step 2: Rate limit**

Wrap admin POST handlers: max 30 mutations / 60s / admin id → 429.

**Step 3: Commit**

```bash
git add app/api/admin/audit/route.js lib/admin-rate-limit.js
git commit -m "feat(admin): audit feed and mutation rate limit"
```

---

### Task 7: Rebuild `/admin` UI (three blocks)

**Files:**
- Modify: `app/admin/page.js`

**Step 1: Layout**

Keep existing MuAPI + Naga cards in **Operator**; add pause toggle with confirm.  
**Support:** email input → lookup → show balance/status → adjust form (confirm field when amount &lt; 0) → disable button.  
**Audit:** table of last actions; Refresh button.

**Step 2: Wire fetches**

- `/api/admin/muapi`, `/api/me`, `/api/admin/settings`
- `/api/admin/users?email=`
- POST credits / disable / settings
- `/api/admin/audit`

Never display raw env keys. Show error codes as short toasts/text.

**Step 3: Manual UI pass**

Run through design test checklist in `docs/plans/2026-08-12-thin-admin-design.md`.

**Step 4: Commit**

```bash
git add app/admin/page.js
git commit -m "feat(admin): thin operator, support, and audit UI"
```

---

### Task 8: Docs + final verification

**Files:**
- Modify: `docs/SAAS-SETUP.md` — admin routes, caps env vars, kill switches
- Modify: `.env.example` if any vars missed

**Step 1: Document**

List endpoints and safe-side defaults.

**Step 2: Verification checklist**

- [ ] Non-admin → 403 on all `/api/admin/*`
- [ ] Disable / pause block gen; enable / unpause restore
- [ ] Caps + confirm behave as designed
- [ ] Audit rows present
- [ ] MuAPI card works; key not in client JSON

**Step 3: Commit**

```bash
git add docs/SAAS-SETUP.md .env.example
git commit -m "docs: thin admin setup and security defaults"
```

---

## Execution notes

- Do **not** add pack editors, Stripe refunds, or admin-promotion UI.
- Prefer extending existing `requireAdmin` / credits paths over new frameworks.
- If Neon migration already applied in prod-like env, run additive SQL only (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).
