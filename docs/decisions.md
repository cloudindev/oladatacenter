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

**Decision.** The MVP ships real status + disk usage, read straight from `listDisks` /
`getDiskUse` in `src/server/services/provider.ts`, and the server detail page shows those plus
one honest line saying the provider does not serve CPU/RAM/network — no invented graphs.
There is no dedicated metrics port yet; adding one is part of whichever option below is chosen.

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

## 2026-11-06 — OPEN: is the mandatory backup charged on top of the published price?

**Not decided — this is a pricing call for the operator (rule 9).** The modules are consistent
with each other today, but the two documents that describe the price are not.

What the code does now: `buildQuote` adds the mandatory 1-day backup as its own line and
applies the addon margin rule, so its 0.35 € cost is sold at **0.99 €**. The entry plan is
therefore charged **7.99 € + 0.99 € = 8.98 €/month** net, and the public page shows 8.98 € as
the headline (so the card matches the checkout).

What the earlier entry above says: "the published prices stay as the brief specifies" —
i.e. 7.99 €.

| Option | Headline price | Real margin on true cost (4.84 €) | What changes |
|---|---|---|---|
| **A. Backup on top** (current) | 8.98 € | 85 % | nothing |
| **B. Backup absorbed** | 7.99 € | 65 % | price the 1-day backup line at 0 € (a manual addon price of 0 in `/admin/planes` per model), keep 7-day as a paid upgrade |
| **C. Rebase the plan** | e.g. 7.99 € incl. backup | depends | set manual plan PVPs so plan + backup lands where you want |

Note also that the ,99 rounding turns a 0.35 € cost into 0.99 € (+183 %), and the same happens
to every small addon (snapshot 0.30 € → 0.99 €). Whichever option is picked, the admin panel's
"margen real" column already computes against the true cost and the margin floor.

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

---

## 2026-11-06 — Database on Supabase instead of Neon

**Decision.** Postgres is hosted on Supabase. `@ola/db` uses `drizzle-orm/postgres-js` with the
`postgres` driver instead of `@neondatabase/serverless` + `neon-http`.

**Why.** Operator preference: Supabase is the provider the team already uses. The schema and the
migrations are plain Postgres and did not change.

**How it connects.** The app's `DATABASE_URL` is Supabase's **transaction pooler** (port 6543),
which is what serverless functions on Vercel need; it does not support prepared statements, so
the client runs with `prepare: false`. Migrations run through `DIRECT_URL` (session pooler or
direct connection, port 5432), which `drizzle.config.ts` prefers when set.

**Not used.** Supabase Auth, Storage and the auto-generated REST API: auth stays in our own
tables (see "Sessions in the database"). Turn off the Data API in the project, or keep RLS
enabled with no policies on every table, so nothing is reachable through the anon key.

**Reversible?** Yes — swap the driver back in `packages/db/src/index.ts`; nothing else depends on it.

---

## 2026-11-06 — DECIDED: the mandatory backup is charged on top (option A)

The operator chose option A of the open entry above: the 1-day backup stays its own line at
0.99 € (cost 0.35 € × the 1.5 addon margin, rounded to ,99). VPS S is advertised and charged
at **8.98 €/month** net, or 7.98 €/month on the 12-month commitment. Plans keep the 1.75
margin (`PRICING_DEFAULT_MARGIN=0.75`), addons 1.5 (`ADDON_DEFAULT_MARGIN=0.5`).

---

## 2026-11-06 — Datacenters are offered only where OVH has stock right now

**Decision.** Every plan's datacenters are filtered by `GET /vps/order/rule/datacenter`
(cached 5 minutes). The configurator only lists datacenters with Linux stock; a plan with
none in a sellable European datacenter is shown as "Sin stock ahora mismo" and cannot
continue. The checkout re-reads stock without cache before charging and refuses with
`out_of_stock`.

**Why.** Selling a datacenter OVH cannot deliver means charging a customer and then
refunding when the OVH checkout fails.

**Real even with mocks on.** The stock route is public and read-only, so `ovhPublic()` in
`providers.ts` always uses the real API (except under the test runner). Mocked stock would
show everything in stock, which is the bug this fixes.

**Fails open.** If OVH cannot be reached the public pages show every datacenter; the fresh
read at checkout still protects the charge, and if that also fails the order proceeds as it
did before and provisioning's own error handling applies.

---

## 2026-11-06 — Plan margin lowered from 1.75 to 1.70

**Decision (operator).** VPS plans are priced at `ceilTo99(cost × 1.70)`; addons stay at
×1.5. Changed in `DEFAULT_PLAN_MARGIN`, the `PRICING_DEFAULT_MARGIN` default, the
`plans.margin_basis_points` column default and, through migration `0003`, every plan row
still on the old 7500 (a margin set by hand in `/admin` is left alone).

**Effect (net, plan + mandatory 1-day backup).** Monthly: S 8.98 · M 15.98 · L 21.98 ·
XL 41.98 €. 12-month commitment: 7.98 · 13.98 · 18.98 · 35.98 € per month. S and M are
unchanged because ,99 rounding absorbs the difference; L and XL drop. The public page's
"Desde" now quotes the monthly (no commitment) price: 8.98 €.

The brief's published PVP table (7.99 / 14.99 / 21.99 / 41.99) was reproduced with 1.75; it
no longer is, by decision.

---

## 2026-11-06 — Datacenters outside Europe are offered when they have stock

**Decision (operator).** The configurator lists every datacenter with stock for the chosen
plan, Europe first, then Beauharnois (Canada), Singapore, Sydney and Mumbai. Non-European
ones are labelled "fuera de la Unión Europea". When no European datacenter has stock, a note
says so under the list.

**Why.** With Europe out of stock for most plans, hiding the only deliverable locations
stops every sale.

**To check before selling outside the EU.** GDPR: a customer who stores personal data on a
server in Canada, Singapore, Australia or India is transferring it outside the EEA; Canada
has an adequacy decision, the others do not. The label makes the location explicit; the
terms of service should say who is responsible for that choice.

Also corrected: the OVH `DE` site is in Limburg (was labelled Frankfurt); its URL slug is
now `limburgo`.

## 2026-11-06 — Email is real whenever a Resend key exists, even with mocked providers

**Decision.** `emailSender()` uses Resend whenever `RESEND_API_KEY` is set, regardless of
`USE_MOCK_PROVIDERS`. The mock sender remains only when no key is set or under the test
runner.

**Why.** Production runs with `USE_MOCK_PROVIDERS=true` until the OVH and WHMCS
credentials exist. That flag also silenced email, so sign-ups received no verification
link (`outbound_emails.provider_id = mock-0001`) and could not finish onboarding. Email
has no money at stake, so it does not need the same gate as OVH orders.

**Consequence.** Local dev with a key in `.env.local` sends real email to whatever address
you register with; leave the key blank there to keep the old behaviour (links are then
logged to the console).

## 2026-11-06 — Matching a delivered order to its VPS: inventory, plan and datacenter, never a guess

**Context.** OVH's order details return ids, not the delivered server's name, so the job
identifies the server by inventory: a VPS we have no row for. The production OVH account
also holds the operator's own servers (6 on this date), which made every one of them a
candidate and left "pick the newest" as the tie-break: one VPS created by hand during an
order could have been handed, with a fresh root password, to a customer.

**Decision.** Three layers, all in `src/inngest/jobs/provision.ts`:
1. The VPS list is stored in the `ovh.checkout.attempt` audit row right before the checkout
   POST (`inventoryBefore`). Nothing in it can ever be this order's server.
2. A remaining server is ruled out when it provably differs from the order: vCores or RAM
   other than the plan's, or a zone in another datacenter. Zones are mapped only for the
   prefixes seen on real servers (`os-gra*`, `os-sbg*`, `os-de*`, `os-uk*`); an unknown zone
   never rules a server out.
3. Exactly one candidate must remain. With more, the order stops with `delivery_review`
   (customer sees "lo estamos revisando") and a critical alert; an admin writes the right
   VPS name on the order page (`ovh.delivery.assigned`), and the job re-checks that it exists
   and belongs to no other service before continuing.

**Also fixed.** `failed` was terminal, so an admin retry of a failed order could never reach
`delivered`. `failed -> provisioning` is now allowed; only the admin retry triggers it.

**Still to verify.** `billing.OrderDetail` has a `domain` field that may carry the
delivered service name. Check it on the first real order; if it does, use it first and keep
these layers as the fallback.

## 2026-11-06 — Fase 5: WHMCS es el sistema financiero, OLA la experiencia del cliente

Decidido con el operador (prompt completo en `docs/prompts/fase-5-whmcs-y-panel-cliente.md`):

1. Las facturas son las de WHMCS, con su numeración; OLA no tiene serie propia.
2. El cliente se identifica por email: si existe en WHMCS se le asigna el pedido, si no se
   crea. Es seguro porque el checkout exige email verificado.
3. Con un cliente existente mandan sus datos de WHMCS; OLA se los enseña para confirmar y
   los cambios hechos en OLA se envían a WHMCS.
4. Las renovaciones las cobra OLA con Stripe y las registra en WHMCS; WHMCS no cobra.
5. El panel de OLA lista solo las facturas de servicios OLA y las abre en WHMCS por SSO; los
   avisos los envía OLA. WHMCS no envía ningún email al cliente.
6. Cancelación desde el panel al final del periodo pagado (o del compromiso), sin reembolso
   y reversible hasta esa fecha.
7. Calendario: T-7 factura y aviso, T-3 recordatorio, T-0 cobro, T+1 y T+3 reintentos,
   T+3 parada, T+7 aviso de borrado, T+10 baja.
8. Solo empresas por ahora (razón social y NIF/VAT obligatorios); particulares preparado
   pero desactivado hasta tener textos legales y desistimiento.
9. Panel del VPS v1: básico, copias y snapshots, red y seguridad, gráficas y ampliación.

## 2026-11-06 — Interruptores de simulación por proveedor

**Decisión.** `USE_MOCK_PROVIDERS` fija el valor por defecto y `MOCK_OVH`, `MOCK_WHMCS` y
`MOCK_STRIPE` lo sobrescriben uno a uno (vacío = seguir el general).

**Por qué.** Hay que poner WHMCS en real antes que los pedidos a OVH, y el interruptor único
lo impedía.

**Salvaguardas.** Con escrituras en WHMCS activadas y Stripe simulado, el adaptador de WHMCS
se niega a arrancar: registraría pagos inexistentes en la contabilidad real. Un pedido real a
OVH con Stripe simulado también se rechaza.

**Corrección.** La API de WHMCS está en `https://panel.cloudin.pro/includes/api.php`; `/cdin/`
es la carpeta del panel de administración (la ruta documentada respondía 404). Verificado el
2026-11-06 con `GetClients` (éxito) y `GetAdminDetails` (rechazada por el rol, como debe).

## 2026-11-07 — Teléfono sin código SMS mientras no haya proveedor

**Decisión (operador).** `REQUIRE_PHONE_VERIFICATION` (apagado por defecto): el paso 3 del
alta pide el teléfono como dato de contacto, sin código. Encendido, vuelve el código SMS.

**Por qué.** No hay proveedor de SMS contratado, así que nadie podía terminar la
verificación ni contratar. Como solo vendemos a empresas, email verificado + NIF + tarjeta
verificada ya filtran.

**Consecuencia.** El saldo de bienvenida sigue exigiendo teléfono verificado
(`decideWelcomeCredit` usa la regla estricta por defecto), así que queda en pausa hasta que
haya proveedor de SMS.

## 2026-11-07 — Nunca escribir en WHMCS con claves de prueba de Stripe

`whmcs()` se niega a arrancar con `WHMCS_WRITE_ENABLED=true` y una clave `sk_test_`: los
cobros de prueba no mueven dinero y acabarían como facturas pagadas en la contabilidad real.
Mientras se prueba con Stripe en modo test, WHMCS va simulado (`MOCK_WHMCS=true`).

El reenviador de IP fija (`proxy.oladc.com`, 54.37.17.20) quedó verificado el 2026-11-07 con
`GetClients` a través de él. El token viaja en `X-Ola-Token` y además en el cuerpo
(`ola_proxy_token`), porque el Plesk de srv008 elimina las cabeceras personalizadas.

## 2026-11-07 — El pedido a medias pertenece a quien lo configuró, no al navegador

**Problema.** La cookie `ola_pending_order` era del navegador: un cliente que entraba
después en el mismo navegador veía el servidor que había configurado otra cuenta.

**Decisión.** La cookie guarda `<dueño>|<url>`, donde el dueño es el sha256 del token de la
sesión que lo configuró (el mismo valor que guarda `sessions.token`, nunca el token). Se
muestra solo a esa sesión, al mismo usuario en una sesión posterior (al entrar, se pasa a
la nueva sesión) o, si se configuró sin sesión, a quien entre a continuación. Otra cuenta no
lo ve y tampoco lo borra. Las cookies antiguas sin dueño se descartan.
Comprobado de punta a punta con dos cuentas en el mismo navegador.

## 2026-11-07 — NIF obligatorio solo en la UE

`taxIdRequiredFor(country)`: obligatorio en la UE (incluida España), opcional fuera, donde no
repercutimos IVA y muchas empresas no tienen un identificador que nos sirva (p. ej. una LLC
de EE. UU.). Sin NIF no se consulta VIES.

## 2026-11-07 — El panel muestra los productos y dominios que el cliente ya tiene en WHMCS

**Decisión.** El área de cliente lee de WHMCS, en solo lectura y a través del reenviador, los
productos del cliente enlazado y los clasifica por id de producto (catálogo del operador):

| Tipo | Ids de WHMCS | Dónde se ve |
|---|---|---|
| Alojamiento web | 1, 2, 3, 284, 4, 125, 8, 9, 10 | Web Cloud → Alojamiento web |
| VPS | 85, 14, 15, 5, 41, 42, 63 | Bare Metal → VPS («Otros VPS de tu cuenta») |
| Licencia Plesk | 88 | Bare Metal → Licencias |
| IP | 64 | Bare Metal → IP |

Los dominios salen de `GetClientsDomains` (Web Cloud → Dominios). El resto de productos
(diseño web, SEO, snapshots…) no se muestran. Todos cuentan en el panel de inicio.

**Por qué solo lectura.** Los gestiona el equipo de Cloudin fuera de OLA; aquí no hay
acciones. `whmcsReader()` es real siempre que haya credenciales, con escrituras desactivadas,
aunque `MOCK_WHMCS` esté activo. WHMCS devuelve en cada producto su contraseña y usuario: el
esquema de zod los descarta y nunca salen del servidor (hay un test).

**Requiere** `GetClientsDomains` en el rol de API (pestaña Client). Sin él, Dominios lo dice y
el resto funciona.
