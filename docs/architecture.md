# OLA VPS Cloud — architecture contract

Read this before touching any file. It is the shared contract every module codes against.

## Repo layout (deviation from the brief — see `decisions.md`)

The brief asked for `apps/web` + Turborepo. The Next.js app **stays at the repo root** and the
domain packages are npm workspaces under `packages/*`. Reason: oladc.com is already live on
Vercel from the repo root; moving it would break deploys until the Vercel "root directory"
setting is changed by hand. Ports-and-adapters separation is unaffected.

```
/                     oladc.com Next.js app (App Router)
  src/app/cloud/vps   public plans + configurator
  src/app/app         customer area       (auth required)
  src/app/admin       admin panel         (admin role + 2FA)
  src/app/api         route handlers, webhooks, Inngest endpoint
  src/server/*        server-only services; the only place adapters are constructed
  src/components/*    UI
  src/lib/*           env, logging, utilities
packages/core         pure domain: pricing, state machines, credit, dunning. NO io.
packages/db           Drizzle schema + client
packages/ovh          OvhClient port + HTTP adapter + MockOvhClient
packages/whmcs        WhmcsClient port + HTTP adapter + MockWhmcsClient
packages/email        React Email templates
```

**Hard rule:** nothing outside `packages/ovh` imports an OVH URL; nothing outside
`packages/whmcs` imports a WHMCS action name. `packages/core` imports neither, and has no
network, no database and no `process.env`.

## Import aliases

`@/…` → `src/…` · `@ola/core` · `@ola/db` · `@ola/ovh` · `@ola/whmcs` · `@ola/email`

## `@ola/core` — what already exists (do not re-implement)

Money is **always integer cents**.

| Export | Purpose |
|---|---|
| `catalogPriceToCents`, `formatCents`, `sumCents`, `multiplyCents` | money |
| `parseCatalog(raw)` → `ParsedCatalog` | turns the OVH catalog into plans/addons with costs per term |
| `cheapestAddonOfFamily` | resolves a mandatory family |
| `ceilTo99`, `priceFromCost`, `resolvePrice`, `marginOf` | the margin rule |
| `buildQuote(catalog, request, overrides)` → `Quote` | full price breakdown of one configuration |
| `checkoutTotals(quote, credit, vatContext)` | subtotal → credit → VAT → total |
| `vatTreatment`, `applyVat` | 21 % / reverse charge / out of scope |
| `prorateUpgrade`, `prorateAddon` | mid-cycle charges |
| `ORDER_STATUSES`, `canTransitionOrder`, `assertOrderTransition`, `isTerminalOrderStatus` | order machine |
| `PROVISION_STEPS`, `nextProvisionStep`, `isProvisionComplete` | resumable provisioning |
| `deliveryState` | on_time / late / timed_out |
| `SERVICE_STATUSES`, `canTransitionService`, `allowedActions`, `isActionAllowed` | service machine |
| `actionStatusFromOvhTask`, `isOvhTaskTerminal` | OVH task mapping |
| `decideWelcomeCredit`, `availableCredit`, `expiringSoon`, `checkTrialLimits` | credit + antifraud |
| `dunningSchedule`, `pendingStep`, `nextDueDate`, `canReactivate` | renewals |
| `DomainError`, `customerMessageFor` | errors with Spanish customer messages |
| `PLAN_BRANDING`, `MVP_PLAN_CODES`, `SELLABLE_DATACENTERS` | commercial identity |

`Term` is `"P1M" | "P12M"`. `OVH_PRICING_MODE` maps it to OVH's `default` / `upfront12`.

### Two verified facts that cost money if ignored

1. OVH catalog prices are in **1e-8 EUR** and `interval` is the number of months a price
   covers (Plesk publishes a yearly figure). `parseCatalog` already normalises both.
2. `automatedBackup` is **mandatory and priced** (0.35 €/month on the entry plan). A VPS can
   never be sold at its bare plan cost. `buildQuote` adds mandatory families automatically.

See `ovh-api-verified.md` for the full verification log.

## `@ola/db`

`db()` returns the Drizzle client. Tables: `users`, `sessions`, `verificationTokens`,
`sshKeys`, `customers`, `paymentMethods`, `plans`, `addons`, `ovhCatalogSnapshots`, `orders`,
`services`, `serviceAddons`, `invoices`, `credits`, `payments`, `actions`, `auditLog`,
`webhookEvents`, `featureFlags`, `outboundEmails`. Read `packages/db/src/schema.ts` for columns.

Rules: never delete a row from `orders`, `services`, `invoices` or `auditLog` — use statuses.
Every write with an effect also writes one `auditLog` row.

## Server-side contracts other modules may rely on

These signatures are fixed. Import them, do not redefine them.

```ts
// src/server/auth/session.ts
export async function currentSession(): Promise<SessionContext | null>
export async function requireUser(): Promise<SessionContext>      // redirects to /login
export async function requireAdmin(): Promise<SessionContext>     // redirects to /login, needs 2FA
export interface SessionContext {
  user: { id: string; email: string; role: "customer" | "admin" }
  customer: { id: string; status: string; whmcsClientId: number | null;
              stripeCustomerId: string | null; country: string | null;
              kind: "company" | "individual"; taxIdValidated: boolean } | null
}

// src/server/audit.ts
export async function recordAudit(entry: {
  actorId?: string | null; actorType?: "user" | "admin" | "system" | "webhook"
  entity: string; entityId?: string | null; action: string
  diff?: Record<string, unknown>; correlationId?: string | null
}): Promise<void>

// src/server/providers.ts   (the ONLY place adapters are constructed)
export function ovh(): OvhClient
export function whmcs(): WhmcsClient

// src/server/catalog/service.ts
export async function loadCatalog(): Promise<ParsedCatalog>        // cached, from DB snapshot
export async function listSellablePlans(): Promise<SellablePlan[]>

// src/server/billing/credit.ts
export async function customerCredit(customerId: string): Promise<number>  // cents

// src/lib/env.ts
export function env(): ServerEnv        // validated, server-only
export function useMocks(): boolean
```

## UI rules (non-negotiable)

The customer area and admin use the oladc.com design language that already exists in
`src/components/layout/*` and `src/app/globals.css`: white space, large type, monospace
uppercase labels, one lime accent (`--ag-sys-color-primary`), black buttons with an arrow,
no drop shadows on cards, no gradients.

- Spanish UI copy, sentence case, no exclamation marks.
- One primary button per screen.
- Explicit confirmation before reinstall, snapshot revert, stop and cancel.
- Long actions show the real OVH task state, never a fake spinner.
- Empty states: one sentence plus one button.
- Responsive to 360 px, focus visible, AA contrast, keyboard reachable.
- **Never** show the customer an OVH `serviceName`, an OVH plan name, or our cost.

Shared primitives live in `src/components/app/ui.tsx` — use them, do not invent a second kit.

## Jobs

Inngest owns everything slow: provisioning, delivery polling, renewals, dunning, catalog sync,
and every server action that returns an OVH task. A job is idempotent and resumable: it writes
its completed step to `orders.completedSteps` / `services.dunningCompleted` before moving on.

## Safety rails

- `OVH_ORDERS_ENABLED` must be `true` for a real order to leave the building.
- `WHMCS_WRITE_ENABLED` must be `true` for any WHMCS write.
- `USE_MOCK_PROVIDERS=true` swaps both adapters for their mocks.
- Secrets never reach a Client Component, a log line or a commit.
