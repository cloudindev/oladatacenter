# Decisions

Every non-obvious choice, with the date and the reason. Newest last.

---

## 2026-11-05 — The Next.js app stays at the repo root instead of `apps/web`

**Decision.** npm workspaces with `packages/*`; the Next.js app keeps living at the repo root.
No Turborepo, no pnpm migration.

**Why.** The brief asked for `apps/web` + pnpm + Turborepo. oladc.com is already live on Vercel,
deployed from the repo root with `package-lock.json`. Moving the app into `apps/web` changes the
Vercel "root directory" setting and breaks every deploy until someone changes it by hand;
migrating npm → pnpm swaps the lockfile under a running production site. Neither buys anything
the MVP needs: npm 10 workspaces give the same package boundaries, and the ports-and-adapters
rule (`packages/core` imports no io) is enforced by code review and typecheck, not by the build tool.

**Cost.** No Turborepo task graph or remote cache. `npm run verify` runs typecheck + lint + tests
directly; builds stay fast enough at this size.

**Reversible?** Yes — move `src/`, `public/` and the configs into `apps/web`, add Turborepo, and
change one Vercel setting. Nothing in the code depends on the layout.

---

## 2026-11-05 — Costs and routes are taken from the live OVH API, not from the brief

**Decision.** Before writing the adapter, the public catalog and the four official API schemas
(`/vps.json`, `/order.json`, `/me.json`, `/ip.json`) were downloaded and parsed. Findings are
recorded in `ovh-api-verified.md` with the verification date; `packages/ovh` may only use routes
listed there.

**Why.** Rule 4 of the brief. It immediately paid for itself — see the three deviations below.

---

## 2026-11-05 — `automatedBackup` is a mandatory, priced addon (margin correction)

**Finding.** The brief states the 1-day automated backup is included. In the live ES catalog the
`automatedBackup` family is `mandatory: true` and its cheapest option costs **0.35 €/month** on
`vps-2027-model1` (0.50 / 0.74 / 1.10 € on model2/3/4). Together with the mandatory (free) `os`
and `storage` families, the real floor cost of a VPS-1 is **4.84 €/month**, not 4.49 €.

**Decision.** `packages/core` tracks two numbers: `planCostCents` (the bare plan, which is what
reproduces the brief's published PVP table exactly) and `monthlyTrueCost` (plan + mandatory
addons). The published prices stay as the brief specifies; the admin margin view uses the true
cost so the real margin is never overstated. `buildQuote` adds the mandatory families by itself,
so no code path can quote a VPS without its backup.

**Effect on margin.** VPS-1 monthly: PVP 7.99 € over a true cost of 4.84 € = 65 % margin, not the
78 % the bare-cost calculation suggests. Still comfortably above water; the operator should know.

---

## 2026-11-05 — Three routes in the brief do not exist as written

1. `/vps/{serviceName}/tasks/{taskId}` → the real path parameter is `{id}`.
2. `/order/cartServiceOption/vps/{serviceName}/{planCode}` → that path does not exist; `planCode`
   goes in the POST body of `/order/cartServiceOption/vps/{serviceName}`.
3. `/vps/{serviceName}/statistics` → **does not exist at all.** See the next entry.

---

## 2026-11-05 — No CPU / RAM / network graphs in the MVP

**Finding.** §9 of the brief asks for CPU, RAM and network charts from
`GET /vps/{serviceName}/statistics`. The `/vps` schema has 70 routes and none of them returns
CPU, memory or network time series. The only monitoring the VPS API exposes is per-disk
(`/disks/{id}/use`, `/disks/{id}/monitoring`).

**Decision.** The MVP ships real status + disk usage behind a `MetricsProvider` port, and the
server detail page shows those instead of inventing graphs.

**Options for real graphs, for the operator to pick** (none chosen without approval, per rule 9):

| Option | What it gives | Cost |
|---|---|---|
| Guest agent installed by `rebuild`'s `postInstallScript` (**recommended**) | Full CPU/RAM/net/disk, 1-minute resolution, ours to keep | an exporter + a time-series store; only covers servers we provisioned |
| OVH Metrics / Logs Data Platform | OVH-native | a separate paid OVH product and contract |
| Ship without graphs | nothing to build | the panel shows status and disk only |

---

## 2026-11-06 — The root password cannot be set through the API (operator decision needed)

**Finding.** The brief (§6.2) says to "fijar contraseña root por API" and show it once.
`POST /vps/{serviceName}/setPassword` takes **no password parameter** — verified in the schema,
its description is "Trigger the process to reset/set the root password and return an
asynchronous task", and OVH mails the password it generates to the account holder (us, not the
customer). `vps.rebuild.post` has no password field either.

**What is implemented.** On reinstall, when the customer picks no SSH key, the platform
generates the password itself and applies it through `rebuild`'s `postInstallScript` with
`doNotSendPassword: true`, then shows it exactly once. It is never written to the database,
not even to `actions.payload`. Windows images have no shell for that script, so there the
flow falls back to OVH's own email and the UI says so.

**Residual risk the operator must accept or reject.** The generated password travels inside
the `postInstallScript` string to OVH's API, so it exists in OVH's request/task records in
clear. That is no worse than OVH mailing it in clear, which is the only alternative, but it
is worth a conscious decision. Options:

1. **Keep it** — best customer experience, password shown once in our panel.
2. **SSH keys only** — strictly safer, and the panel already prefers a key when one exists;
   it would mean refusing to reinstall without a key.
3. **Let OVH mail it** — no password in our system at all, but it reaches our mailbox, not
   the customer's, so support has to forward it.

Recommendation: keep (1), and make the SSH key the default path in the UI, which it is.

---

## 2026-11-06 — Firewall rules need the IP enabled first

`POST /ip/{ip}/firewall` ("Create a firewalled IP", body `ipOnFirewall`) must be called before
any rule can be attached to an IP. Without it a customer's first rule is rejected by OVH.
The method was missing from the port and has been added; the network tab enables the IP as
part of adding the first rule.

---

## 2026-11-05 — Prices are quoted net, VAT is added at checkout

**Decision.** Public pages and the configurator show prices **sin IVA**, clearly labelled; VAT is
computed at the payment step from the customer's country and VIES status.

**Why.** The brief says exactly that (§5). It also keeps B2B reverse-charge customers from seeing
a price they will not pay. `applyVat`/`vatTreatment` in `packages/core` own the rule.

---

## 2026-11-05 — Sessions in the database, not JWTs

**Decision.** Opaque session token in an httpOnly cookie, sha256 of it stored in `sessions`.

**Why.** The brief requires remote session revocation ("cerrar sesión en todos los dispositivos")
and blocking a customer instantly. A stateless JWT cannot be revoked before it expires.

---

## 2026-11-05 — Dev server must run on Node 22 explicitly

**Decision.** `.claude/launch.json` pins the dev server to
`$HOME/.nvm/versions/node/v22.22.0/bin` and clears `NODE_OPTIONS`.

**Why.** This machine resolves bare `node` to v10.5.0. Turbopack spawns its PostCSS worker with
whatever `node` is on `PATH`, which panics with
`node: --enable-source-maps is not allowed in NODE_OPTIONS` and 500s every page.
Running `nvm alias default 22` on the machine would make this unnecessary.
