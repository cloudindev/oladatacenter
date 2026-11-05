# oladc.com

The OLA Datacenter website and the **OLA VPS Cloud** platform, in one Next.js application.

## OLA VPS Cloud

A VPS reseller platform on top of OVHcloud: public plans and a configurator, a customer area where
a server can be rebooted, snapshotted, reinstalled or put in rescue mode, and an admin panel for
orders, services and margins. Billing runs through WHMCS, payments through Stripe, and everything
slow — provisioning, delivery polling, renewals, dunning, catalog sync — through Inngest jobs that
are idempotent and resumable.

It is **not selling yet**. Both kill switches default to off and the checklist that has to pass
before go-live is in [`docs/operations.md`](./docs/operations.md).

### Repository layout

The Next.js app lives at the repository root (not in `apps/web`), with the domain code in npm
workspaces. [`docs/decisions.md`](./docs/decisions.md) explains why.

```
/                     Next.js app (App Router)
  src/app/cloud/vps   public plans + configurator
  src/app/app         customer area      (auth required)
  src/app/admin       admin panel        (admin role + 2FA)
  src/app/api         route handlers, webhooks, Inngest endpoint
  src/server/*        server-only services; the only place adapters are constructed
  src/components/*    UI
  src/lib/*           env, logging, utilities
packages/core         pure domain: pricing, state machines, credit, dunning. NO io.
packages/db           Drizzle schema + client
packages/ovh          OvhClient port + HTTP adapter + MockOvhClient
packages/whmcs        WhmcsClient port + HTTP adapter + MockWhmcsClient
packages/email        React Email templates
e2e/                  Playwright specs, written against the mock providers
docs/                 architecture, decisions, verified OVH reference, operations, runbooks
```

Nothing outside `packages/ovh` may reference an OVH URL, nothing outside `packages/whmcs` may
reference a WHMCS action, and `packages/core` touches neither the network nor the database.
The full contract is [`docs/architecture.md`](./docs/architecture.md) — read it before writing code.

### Running it locally, with mocks

> **Node 22 is required, and on the development machine it has to be put on `PATH` by hand.**
> The default `node` there is v10.5.0, which breaks both Next.js and TypeScript: Turbopack spawns
> its PostCSS worker with whatever `node` it finds and panics with
> `node: --enable-source-maps is not allowed in NODE_OPTIONS`, 500-ing every page. Run this in the
> shell first — it is also why `.claude/launch.json` pins the dev server's PATH.

```bash
unset NODE_OPTIONS
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"
```

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL and AUTH_SECRET
```

`.env.example` ships with `USE_MOCK_PROVIDERS=true`, which swaps in `MockOvhClient`,
`MockWhmcsClient` and the mock email sender. **No money moves and no real server is ordered.**
Keep `OVH_ORDERS_ENABLED` and `WHMCS_WRITE_ENABLED` at `false`; they are the two kill switches and
`false` is their safe value. You need a real `DATABASE_URL` (a Neon branch) and an `AUTH_SECRET` of
at least 32 characters — `openssl rand -base64 32`.

```bash
npm run db:migrate              # apply migrations to that branch
npm run db:seed                 # load plans, addons and commercial identity
npm run dev                     # http://localhost:3000
```

### Tests

```bash
npm run verify                  # typecheck + lint + unit tests — run this before committing
npm run test                    # vitest, unit and domain tests
npm run test:coverage           # with the thresholds that gate CI (90 % over packages/core)
npm run e2e                     # Playwright, against the mock providers
```

Playwright browsers are **not** installed by `npm install`:

```bash
npx playwright install chromium
```

The end-to-end suite runs in two viewports, desktop and 360 px wide, because the UI contract
promises the customer area works down to 360 px. Most specs are currently `test.fixme` with a
one-line note naming the feature they are waiting for: they are the specification of done, written
before the screens. The exception is `e2e/contract-ovh.spec.ts`, which needs neither a browser nor
the app and passes today:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --project=contract
```

It fetches the live public OVH catalog and compares it with the committed fixture, failing with
the plan name and the old and new price when OVH moves one. It also runs daily in GitHub Actions —
that is the early warning that our margins have changed.

### Documentation

| Document | What it is for |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | The code contract: layout, ports and adapters, fixed server-side signatures, UI rules. Read first. |
| [`docs/operations.md`](./docs/operations.md) | The operator's map: environments, kill switches, logs and alerts, migrations, catalog seeding, go-live checklist. |
| [`docs/decisions.md`](./docs/decisions.md) | Every non-obvious choice, with its date and reason. |
| [`docs/ovh-api-verified.md`](./docs/ovh-api-verified.md) | The only OVH routes this codebase may call, and the price units that cost money if ignored. |
| [`docs/runbooks/`](./docs/runbooks/) | Six Spanish on-call runbooks: stuck order, failed charge, OVH down, WHMCS unreachable, key rotation, abuse and fraud. |
| [`CHANGELOG.md`](./CHANGELOG.md) | What has been built so far. |

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
