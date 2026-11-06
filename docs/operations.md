# Operations — OLA VPS Cloud

The operator's map: what runs where, what to switch off when things go wrong, where to look, and
what has to be true before the platform takes a real customer's money.

Companion documents: [`architecture.md`](./architecture.md) (the code contract),
[`decisions.md`](./decisions.md) (why things are the way they are),
[`ovh-api-verified.md`](./ovh-api-verified.md) (the only OVH routes we may call).

> **State of the platform (2026-11-06).** F0 is done: verified OVH integration data, the pricing
> engine and the database schema. The application surfaces this document refers to — the
> configurator, the customer area, the admin panel, the Inngest jobs — are being built. Where a
> procedure depends on a screen that does not exist yet, it is marked **[pending]**. The
> environments, the switches, the migrations and the catalog sync are real today.

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| Host | `next dev` on `localhost:3000` | Vercel preview | Vercel production (oladc.com) |
| Database | Supabase project `ola-dev` | Supabase project `ola-staging` | Supabase project `ola-prod` |
| OVH | **mock** (`MockOvhClient`) | **real API, orders OFF** | **real** |
| WHMCS | **mock** (`MockWhmcsClient`) | **real API, writes OFF** | **real** |
| Stripe | test keys | test keys | live keys |
| Email | **mock sender** (recorded, not sent) | Resend, to internal addresses only | Resend |
| SMS (phone OTP) | console | console | provider TBD — see `decisions.md` |
| `USE_MOCK_PROVIDERS` | `true` | `false` | `false` |
| `OVH_ORDERS_ENABLED` | `false` | `false` (`true` only for a supervised test) | `true` |
| `WHMCS_WRITE_ENABLED` | `false` | `false` (`true` only for a supervised test) | `true` |

The environment contract is [`.env.example`](../.env.example); the schema that validates it is
`src/lib/env.ts`. A missing or malformed value makes the server throw on first use, loudly, instead
of half-working.

Staging points at the **real** OVH and WHMCS APIs with both write switches off: that is how an
integration problem is found without spending money. Turning either switch on in staging is a
deliberate, supervised act, and it is turned back off the same day.

## The two kill switches

Both are environment variables, and both default to **false** — the safe value.

| Switch | False means | Turn it off when |
|---|---|---|
| `OVH_ORDERS_ENABLED` | `assertOvhOrdersEnabled()` refuses to place a real OVH order. Everything else (panel, actions, renewals) keeps working. | OVH is down, or the catalog drifted and we would be selling below cost. See [`runbooks/ovh-caido.md`](./runbooks/ovh-caido.md). |
| `WHMCS_WRITE_ENABLED` | The WHMCS adapter refuses every write. Reads still work. | WHMCS is unreachable or mid-rotation. Orders are **not** lost: see [`runbooks/whmcs-inaccesible.md`](./runbooks/whmcs-inaccesible.md). |

A third, broader switch is `USE_MOCK_PROVIDERS=true`, which replaces both adapters and the email
sender with their mocks. It belongs in local development and tests, never in production.

**Vercel environment variables are not hot-reloaded.** Changing a switch requires a redeploy.
Budget for that when planning an intervention.

## Where logs and alerts land

| What | Where |
|---|---|
| Application and job logs | Vercel runtime logs (structured JSON via pino, `src/lib/logger.ts`). Every external call and job step carries a `correlationId`, so one order can be followed across Stripe, WHMCS and OVH. Secrets are redacted by the logger as a safety net — the first rule is not to pass them in. |
| Exceptions | Sentry, if `SENTRY_DSN` is set |
| Job runs, retries, failures | The Inngest dashboard. This is the first place to look for a stuck order. |
| Audit trail | The `audit_log` table. Every write with an effect records one row (actor, entity, action, diff, correlationId). It is never deleted. |
| Emails actually sent | The `outbound_emails` table (recipient, template, subject, provider id, error). Use it to prove whether the customer was told. |
| Inbound webhooks | The `webhook_events` table, which is also what makes retries idempotent. |
| OVH catalog drift | The daily **OVH catalog contract** GitHub Action, plus Slack if `ALERTS_SLACK_WEBHOOK` is configured. |
| Operational alerts | `ALERTS_EMAIL` and `ALERTS_SLACK_WEBHOOK` |

## Running a migration

Migrations are generated from `packages/db/src/schema.ts` by drizzle-kit and committed to
`packages/db/migrations`. CI fails a pull request whose schema changed without a committed
migration (the `migrations in sync` job).

On this machine, prefix every command with the Node 22 PATH — the default `node` is v10 and
breaks both Next.js and TypeScript:

```bash
unset NODE_OPTIONS
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"
```

1. Change `packages/db/src/schema.ts`.
2. `npm run db:generate` — writes the SQL into `packages/db/migrations`. **Read the SQL.** If it
   drops or renames a column, stop and think: `orders`, `services`, `invoices` and `audit_log` rows
   are never deleted, and a rename on a live table needs a two-step migration.
3. Commit the migration together with the schema change. They travel as one commit.
4. Apply it, lowest environment first, with `DIRECT_URL` (session connection, port 5432) pointing at that environment:
   `DIRECT_URL=... npm run db:migrate`
5. Verify on the dev project, then repeat for staging and production.

Apply the migration **before** deploying code that depends on it. For a destructive change, use
two deploys: add the new shape, move the code over, remove the old shape later.

## Seeding the catalog

Plans and addons shown on the public pages come from a snapshot in the database
(`ovh_catalog_snapshots`), not from a live OVH call. That is why the website keeps selling while
the OVH API is down — and why a stale snapshot silently sells at yesterday's price.

```bash
DATABASE_URL=... npm run db:seed
```

The seed loads the verified plan/addon data and the commercial identity (`PLAN_BRANDING`,
`MVP_PLAN_CODES`, `SELLABLE_DATACENTERS`). Afterwards, run the catalog sync job
(`catalog.sync`) **[pending]** against the live OVH catalog so the snapshot carries real costs
and a fresh timestamp.

After any catalog change, check the published prices against the approved table and make sure the
margin view (which uses the *true* cost, plan + mandatory addons) still looks right. The
`automatedBackup` family is mandatory and priced: see `decisions.md`, 2026-11-05.

## CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every pull request, push to `main` | `lint`, `typecheck` (after `next typegen`, which Next 16 needs to produce `next-env.d.ts` and the route types), `test` (via `test:coverage`, so the vitest thresholds gate the build), `build` (with dummy env vars — no real secret is ever needed to build), and `migrations in sync`. All in parallel; a superseded run is cancelled. |
| `.github/workflows/contract.yml` | daily at 06:17 UTC, manual, and on changes to the fixture | Fetches the **live** public OVH catalog and compares it with `packages/core/test/fixtures/ovh-catalog-vps-es.json`. Fails naming the plan and the old and new price. No credentials, no browser, no app. |

### What the operator has to configure

**GitHub repository**
- Nothing is required for `ci.yml`: the build uses dummy values committed in the workflow.
- Optional secret `ALERTS_SLACK_WEBHOOK` — the contract workflow posts there when the OVH catalog
  drifts. Without it the job still fails visibly and GitHub emails watchers for failed scheduled
  runs.
- Branch protection on `main`: require the **`ci`** check (one gate job that depends on all the
  others, so adding a check later needs no settings change).
- Scheduled workflows are paused by GitHub after 60 days without repository activity. If the
  contract job goes quiet, check that first.

**Vercel**
- Root directory stays the **repository root** (the app is not in `apps/web` — see
  `decisions.md`). Changing it breaks every deploy.
- Node 22 as the build Node version.
- Every variable in `.env.example` set per environment, with `USE_MOCK_PROVIDERS=false`,
  `OVH_ORDERS_ENABLED` and `WHMCS_WRITE_ENABLED` as in the table above.
- `WHMCS_PROXY_URL` must point at the fixed-IP proxy: WHMCS allowlists IPs and Vercel has no
  static egress IP. This is the single most common cause of "billing is broken".
- Webhook endpoints registered and their signing secrets set: Stripe (`STRIPE_WEBHOOK_SECRET`),
  WHMCS (`WHMCS_WEBHOOK_SECRET`), Inngest (`INNGEST_SIGNING_KEY`).

**End-to-end tests** are not part of `ci.yml` yet, on purpose: most of them are `test.fixme`
until the feature work lands, and they need browsers (`npx playwright install chromium`) and a
database. Wire `npm run e2e` into CI when the suite is green locally.

## Go-live checklist

Nothing below is optional. Tick it in order; each line is verifiable.

**Secrets and access**
- [ ] Every credential rotated away from whatever was used in development, and the development
      ones revoked — procedure in [`runbooks/rotacion-claves.md`](./runbooks/rotacion-claves.md).
- [ ] The OVH consumer key has only the minimum rights (`/vps/*`, `/order/*`, `/me/order/*`,
      `/ip/*`, `GET /me`) and no expiry.
- [ ] The WHMCS API credential has a restricted role, and the proxy IP is allowlisted.
- [ ] **2FA enabled on every admin account**, in our panel and in the OVH, WHMCS, Stripe, Supabase
      and Vercel accounts. `requireAdmin()` demands 2FA; confirm no admin can get in without it.
- [ ] No secret in the repository, in a log line or in any Client Component bundle.
- [ ] `AUTH_SECRET` is unique to production.

**Guards**
- [ ] `USE_MOCK_PROVIDERS=false` in production, and `true` nowhere in production.
- [ ] `OVH_ORDERS_ENABLED=true` only after a supervised real order has been placed and delivered.
- [ ] `WHMCS_WRITE_ENABLED=true` and a write verified.
- [ ] **Rate limits on** for login, registration, password reset, email verification, phone OTP
      and the order endpoint. Verify one of them by hand: repeated attempts must be refused.
- [ ] Antifraud limits on the welcome credit active (`checkTrialLimits`), and the credit amount
      and window set (`WELCOME_CREDIT_CENTS`, `WELCOME_CREDIT_DAYS`).

**Integrations**
- [ ] **Webhooks verified**: a Stripe test event accepted with a valid signature; the WHMCS hook
      (`includes/hooks/ola_vps.php`) reaching `/api/webhooks/whmcs` with a valid HMAC; Inngest
      signing key in place. A row appears in `webhook_events` for each, with no signature error.
- [ ] A real order placed end to end: paid, provisioned, delivered, with an IP and the
      `server_ready` email.
- [ ] A renewal charge exercised off-session in staging, including one declined attempt, so the
      dunning calendar is known to fire.
- [ ] The catalog snapshot is fresh and the contract workflow is green.

**Legal and tax**
- [ ] **GDPR texts published** and reachable from the footer: privacy policy, cookie policy,
      terms of service, and the data-processing terms a business customer will ask for. They must
      name the sub-processors actually in use (OVHcloud, Supabase, Vercel, Stripe, Resend) and the
      regions where data is held.
- [ ] Cookie consent working, with no non-essential cookie set before consent.
- [ ] The customer can exercise access and deletion, and the procedure is written down —
      remembering that `orders`, `invoices` and `audit_log` are kept for tax reasons.
- [ ] **VAT configured in WHMCS**: 21 % for Spain, reverse charge for a validated EU VAT number,
      out of scope outside the EU. Matches `vatTreatment` in `@ola/core`. Issue one invoice of
      each kind and check it.
- [ ] Invoice numbering, company details and the fiscal series correct in WHMCS.
- [ ] Prices shown net on public pages, clearly labelled, with VAT added at checkout.

**Operations**
- [ ] The on-call operator has read the six runbooks and knows where the two kill switches live.
- [ ] `ALERTS_EMAIL` and `ALERTS_SLACK_WEBHOOK` set, and an alert actually received by someone.
- [ ] Sentry receiving events.
- [ ] A restore rehearsed: a Supabase point-in-time restore (or daily backup restore) into a scratch project, and an OVH automated-backup
      restore on a test VPS.

## Runbooks

| Incident | Runbook |
|---|---|
| Order stuck in provisioning, or delayed | [`pedido-atascado.md`](./runbooks/pedido-atascado.md) |
| Renewal charge failed, server suspended | [`cobro-fallido.md`](./runbooks/cobro-fallido.md) |
| OVH API down, or catalog prices drifted | [`ovh-caido.md`](./runbooks/ovh-caido.md) |
| WHMCS unreachable | [`whmcs-inaccesible.md`](./runbooks/whmcs-inaccesible.md) |
| Rotating a credential | [`rotacion-claves.md`](./runbooks/rotacion-claves.md) |
| Abuse report or suspicious signup | [`abuso-y-fraude.md`](./runbooks/abuso-y-fraude.md) |

The runbooks are written in Spanish, for the person on call.
