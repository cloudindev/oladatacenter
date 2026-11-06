# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Nothing has been released yet: OLA VPS Cloud is pre-1.0 and not selling. The checklist that has to
pass before it does is in [`docs/operations.md`](./docs/operations.md).

## [Unreleased]

Groundwork for **OLA VPS Cloud**, a VPS reseller platform on top of OVHcloud, inside the existing
oladc.com Next.js application.

### Added

**Verified OVH integration data (F0)**
- The four official OVH API schemas (`/vps.json`, `/order.json`, `/me.json`, `/ip.json`) were
  downloaded and parsed on 2026-11-05 before any adapter code was written. Every route the
  platform is allowed to call is recorded in [`docs/ovh-api-verified.md`](./docs/ovh-api-verified.md),
  with exact operation signatures in `docs/ovh-api-signatures.md`.
- Committed catalog snapshot at `packages/core/test/fixtures/ovh-catalog-vps-es.json`: the four
  MVP plans (`vps-2027-model1` … `model4`) and their addon families, trimmed from the live ES
  public catalog.
- Three corrections found by that verification, all recorded in
  [`docs/decisions.md`](./docs/decisions.md):
  - `automatedBackup` is a **mandatory, priced** addon family (0.35 €/month on the entry plan),
    not included as previously assumed. The true floor cost of a VPS-1 is 4.84 €/month, not
    4.49 €, which moves the real margin from 78 % to 65 %.
  - `/vps/{serviceName}/tasks/{taskId}` and
    `/order/cartServiceOption/vps/{serviceName}/{planCode}` do not exist as written; the real
    forms are `{id}` and the `planCode` in the POST body.
  - `GET /vps/{serviceName}/statistics` does not exist at all. There is no CPU, RAM or network
    time series in the VPS API, so the MVP ships real status plus disk usage behind a
    `MetricsProvider` port instead of inventing graphs. Three options for real graphs are written
    up for the operator to choose from.

**Pricing engine (`@ola/core`)**
- Money is integer cents throughout. Catalog prices are normalised from OVH's 1e-8 EUR units, and
  `interval` is treated as the number of months a price covers (the trap that makes Plesk look
  twelve times cheaper than it is).
- `parseCatalog`, `buildQuote` (which adds the mandatory addon families by itself, so no code path
  can quote a VPS without its backup), `checkoutTotals`, the margin rule (`priceFromCost`,
  `ceilTo99`, `resolvePrice`, `marginOf`), VAT treatment (21 % / reverse charge / out of scope) and
  mid-cycle proration.
- Order and service state machines with explicit transitions, the resumable `PROVISION_STEPS`
  sequence, OVH task mapping, delivery SLA states, welcome-credit and antifraud rules, and the
  renewal/dunning calendar (T-7 invoice, T-0 charge, T+1 and T+3 retries, suspension at T+3,
  non-renewal at T+10).
- The package has no network, no database and no `process.env`.

**Database schema (`@ola/db`)**
- Drizzle schema and initial migration covering users, sessions, verification tokens, SSH keys,
  customers, payment methods, plans, addons, catalog snapshots, orders, services, service addons,
  invoices, credits, payments, actions, the audit log, webhook events, feature flags and outbound
  emails.
- Rows in `orders`, `services`, `invoices` and `audit_log` are never deleted — status changes only.

**Application scaffolding**
- Validated, server-only environment contract (`src/lib/env.ts`, `.env.example`) with both kill
  switches (`OVH_ORDERS_ENABLED`, `WHMCS_WRITE_ENABLED`) defaulting to off, and
  `USE_MOCK_PROVIDERS` to swap in the mock adapters.
- `src/server/providers.ts` as the only place a provider adapter is constructed, with
  `assertOvhOrdersEnabled()` as a hard gate before any real order.
- Structured logging with per-order correlation ids and secret redaction; an audit helper that
  records one row per write with an effect.
- OVH request signer with clock-skew correction from `GET /auth/time`.

**Delivery and operations**
- GitHub Actions CI: lint, typecheck, tests with the vitest coverage thresholds as the gate, a
  production build that needs no real secret, and a check that fails a pull request whose database
  schema changed without a committed migration.
- A daily **OVH catalog contract** workflow that compares the live public OVH catalog with the
  committed fixture and fails naming the plan and the old and new price. It is the early warning
  for OVH moving a price or retiring a plan code.
- Playwright configuration and an end-to-end suite written against the mock providers, covering
  signup, ordering, server actions, the renewal and dunning path, and a keyboard-only
  accessibility pass at desktop and 360 px widths. Specs that depend on unfinished features are
  marked `test.fixme` with the reason.
- Six Spanish on-call runbooks in [`docs/runbooks/`](./docs/runbooks/) (stuck order, failed
  charge, OVH down, WHMCS unreachable, key rotation, abuse and fraud) and an operations map with
  the environment table, the kill switches, migration and seeding procedures, and a go-live
  checklist.

### Changed

- The repository keeps the Next.js application at its root instead of moving to `apps/web` with
  Turborepo and pnpm; domain code lives in npm workspaces under `packages/*`. oladc.com is already
  deployed to Vercel from the root, and the move would break every deploy until a Vercel setting
  changed by hand. Reasoning and reversal path in `docs/decisions.md`.

### Security

- Sessions are opaque tokens stored in the database (sha256 of the token), not JWTs, so a session
  can be revoked immediately — required for "sign out on all devices" and for blocking a customer
  on the spot.
- Secrets never reach a Client Component, a log line or a commit. The logger's redaction list is a
  safety net, not the first line of defence.

### Notes

- Prices are quoted net on public pages and VAT is added at checkout, from the customer's country
  and VIES status.
- The platform is not yet selling: the kill switches are off and the mocks are on everywhere
  except production.
