# OVH API — verified reference

> Every route below was verified against the **official OVH API schemas** published at
> `https://eu.api.ovh.com/1.0/{vps,order,me,ip}.json`, downloaded and parsed on **2026-11-05**.
> Exact operation signatures (params, body models, return types) live in
> [`ovh-api-signatures.md`](./ovh-api-signatures.md), generated from those same schemas.
>
> Rule: never add a route to `packages/ovh` that is not listed here. To add one, re-download
> the schema, confirm the path and method, and extend this file with the verification date.

## 1. Catalog (public, unauthenticated)

`GET /order/catalog/public/vps?ovhSubsidiary=ES` — verified 2026-11-05, HTTP 200, ~6.3 MB.

### Price units (verified, non-obvious)

Catalog prices are integers in **units of 1e-8 EUR**:

```
449000000 / 1e8 = 4.49 EUR     -> cents = price / 1e6
```

Each `pricings[]` entry carries `mode`, `capacities`, `interval` and `commitment`:

- The **recurring** price is the entry whose `capacities` contains `"renew"`.
  Entries with `"installation"` / `"upgrade"` are setup fees and are `0` for every VPS plan.
- **`interval` is the number of months the price covers.** This is the trap:
  - plans and most addons publish `upfront12` with `interval: 1` → the price is **per month**
    (e.g. `vps-2027-model1` upfront12 = 3.81 EUR/month, billed 12 months up front);
  - Plesk publishes `upfront12` with `interval: 12` → the price is **for the whole period**
    (107.88 EUR = 8.99 EUR/month).

  Normalise always: `monthlyCents = renewPriceCents / interval`.

### Plans in the MVP — verified 2026-11-05

| Plan | planCode | default (monthly) | upfront12 (per month) | upfront6 |
|---|---|---|---|---|
| VPS-1 2027 | `vps-2027-model1` | 4.49 € | 3.81 € | 4.26 € |
| VPS-2 2027 | `vps-2027-model2` | 8.49 € | 7.21 € | 8.06 € |
| VPS-3 2027 | `vps-2027-model3` | 12.24 € | 10.40 € | 11.62 € |
| VPS-4 2027 | `vps-2027-model4` | 23.49 € | 19.96 € | 22.31 € |

All four `planCode`s exist and every cost matches the brief exactly.
`vps-2027-model1.LZ`, `vps-2027-model2.LZ` (Local Zone) also exist — out of MVP scope.

### Configurations (verified)

- `vps_datacenter` (**required**): `BHS`, `DE`, `EU-SOUTH-MIL`, `EU-WEST-RBX`, `GRA`, `SBG`,
  `SGP`, `SYD`, `UK`, `WAW`, `YNM`
- `vps_os` (optional): 22 values on model1, 26 on model2+ (the 4 extra are Windows Server
  2016/2019/2022/2025 Standard Desktop)
- `region`: `canada`, `europe` · `infrastructure`: `preproduction`, `production`

### Addon families (verified)

| Family | Mandatory | Notes |
|---|---|---|
| `os` | **yes** | `option-linux` = 0 €. `option-windows-2027-modelN` only from model2 (8 €/month) |
| `storage` | **yes** | `option-storage-local-2027-modelN` = 0 € |
| `automatedBackup` | **yes** | **not free** — see warning below |
| `snapshot` | no | 0.30 / 0.50 / … €/month depending on model |
| `additionalDisk` | no | 50 GB 2.15 € · 100 GB 4.31 € · 200 GB 8.60 € · 500 GB 21.54 € · 1 TB 43.10 € · 5 TB 215.50 € · 10 TB 431.00 € |
| `plesk` | no | Web Admin 8.99 € · Web Pro 15.09 € · Web Host 30.99 € (per month) |
| `cpanel` | no | 16 options — out of MVP scope |

> **⚠ Margin warning — differs from the brief.** The brief says the 1-day automated backup is
> "incluido". In the live catalog `automatedBackup` is a **mandatory, priced** family:
> `option-auto-backup-2027-1-model1` costs **0.35 €/month** (model2: 0.50 €, model3: 0.74 €,
> model4: 1.10 €) and the 7-day option costs 1.10 € (model1) / 1.84 € (model2).
> The real floor cost of a VPS-1 is therefore **4.49 + 0.35 = 4.84 €/month**, not 4.49 €.
> `packages/core` exposes both `planCostCents` and `trueCostCents` so the admin margin view
> never lies. The published PVP table is derived from the plan cost alone (that is what
> reproduces the brief's numbers exactly).

## 2. Routes used by `packages/ovh`

All verified present in the schemas on 2026-11-05 with the methods shown.

### Ordering
| Purpose | Route | Methods |
|---|---|---|
| Create cart | `/order/cart` | POST |
| Attach cart to account | `/order/cart/{cartId}/assign` | POST |
| Offers / add VPS item | `/order/cart/{cartId}/vps` | GET, POST |
| Item configuration | `/order/cart/{cartId}/item/{itemId}/configuration` | GET, POST |
| Options (addons) | `/order/cart/{cartId}/vps/options` | GET, POST |
| Price summary | `/order/cart/{cartId}/summary` | GET |
| Checkout preview / confirm | `/order/cart/{cartId}/checkout` | GET, POST |
| Upgrade | `/order/upgrade/vps/{serviceName}/{planCode}` | GET, POST |
| Option on live service | `/order/cartServiceOption/vps/{serviceName}` | GET, POST |

`POST /order/cart/{cartId}/checkout` body is `order.cart.Checkout`:
`{ autoPayWithPreferredPaymentMethod: boolean, waiveRetractationPeriod: boolean }` — matches the brief.

> **Deviation:** the brief lists `/order/cartServiceOption/vps/{serviceName}/{planCode}`.
> That path **does not exist**; the `{planCode}` goes in the POST body of the parent route.

### Order tracking
`/me/order/{orderId}` (GET) · `/me/order/{orderId}/status` (GET) ·
`/me/order/{orderId}/details` (GET) · `/me/order/{orderId}/payWithRegisteredPaymentMean` (POST)

### Service lifecycle
| Purpose | Route | Methods |
|---|---|---|
| List / read VPS | `/vps`, `/vps/{serviceName}` | GET, (PUT) |
| IPs | `/vps/{serviceName}/ips` | GET |
| Billing info / renewal | `/vps/{serviceName}/serviceInfos` | GET, PUT |
| Power | `/vps/{serviceName}/{start,stop,reboot}` | POST |
| Task polling | `/vps/{serviceName}/tasks/{id}` | GET |
| Images | `/vps/{serviceName}/images/available`, `/images/current` | GET |
| Reinstall | `/vps/{serviceName}/rebuild` | POST |
| Root password | `/vps/{serviceName}/setPassword` | POST |
| Console | `/vps/{serviceName}/getConsoleUrl` | POST |
| Snapshot | `/createSnapshot` (POST), `/snapshot` (GET, DELETE), `/snapshot/revert` (POST) | |
| Automated backup | `/automatedBackup` (GET), `/automatedBackup/restorePoints` (GET), `/automatedBackup/restore` (POST) | |
| Disks | `/vps/{serviceName}/disks`, `/disks/{id}/use`, `/disks/{id}/monitoring` | GET |
| Upgrade options | `/vps/{serviceName}/availableUpgrade` | GET |
| Options in use | `/vps/{serviceName}/option`, `/option/{option}` | GET, DELETE |
| Termination | `/vps/{serviceName}/terminate`, `/confirmTermination` | POST |

> **Deviation:** the brief writes `/vps/{serviceName}/tasks/{taskId}`. The real path parameter
> is `{id}` — `/vps/{serviceName}/tasks/{id}`.

Rescue mode is `PUT /vps/{serviceName}` with `netbootMode` (`vps.VpsNetbootEnum`), then a reboot —
confirmed: `vps.VPS` carries `netbootMode`.

`vps.Task.state` enum (verified): `blocked`, `cancelled`, `doing`, `done`, `error`, `paused`,
`todo`, `waitingAck`. Terminal success = `done`; terminal failure = `error` / `cancelled`.

`POST /vps/{serviceName}/rebuild` body (`vps.rebuild.post`): `imageId`, `sshKey`, `publicSshKey`,
`doNotSendPassword`, `installRTM`, `postInstallScript`.
`POST /vps/{serviceName}/createSnapshot` body: `{ description }`.
`POST /vps/{serviceName}/automatedBackup/restore` body: `{ restorePoint, type, changePassword }`.

### Network
`/ip/{ip}/reverse` (GET, POST) · `/ip/{ip}/firewall` (GET, POST) ·
`/ip/{ip}/firewall/{ipOnFirewall}/rule` (GET, POST) · `/ip/{ip}/mitigation` (GET, POST)

### Per-entity routes — verified 2026-11-06 (second pass)

The collection routes above only return identifiers; reading or deleting one entity needs
these. All four confirmed present in the same downloaded schemas.

| Route | Methods | Returns | Path params |
|---|---|---|---|
| `/order/cart/{cartId}/item/{itemId}/requiredConfiguration` | GET | `order.cart.ConfigurationRequirements[]` | `cartId: string`, `itemId: long` |
| `/ip/{ip}/firewall/{ipOnFirewall}/rule/{sequence}` | GET, DELETE | `ip.FirewallNetworkRule` | `ip: ipBlock`, `ipOnFirewall: ipv4`, `sequence: long` |
| `/ip/{ip}/reverse/{ipReverse}` | GET, DELETE | `ip.ReverseIp` / void | `ip: ipBlock`, `ipReverse: ip` |
| `/ip/{ip}/mitigation/{ipOnMitigation}` | GET, PUT, DELETE | `ip.MitigationIp` | `ip: ipBlock`, `ipOnMitigation: ipv4` |

Note the distinction that caused the first pass to stop: `GET …/item/{itemId}/configuration`
returns the ids of configurations **already set** on the item, while
`…/requiredConfiguration` returns the ones the item **still requires**. Both are needed and
they are not interchangeable.

## 3. ⚠ CPU / RAM / network metrics are NOT available

The brief (§9) asks for CPU, RAM and network graphs from
`GET /vps/{serviceName}/statistics`. **That route does not exist** in the current API —
the `/vps` schema has 70 routes and none of them serves CPU/RAM/network time series.

What the API does offer: `GET /vps/{serviceName}/disks/{id}/use` (disk usage) and
`/disks/{id}/monitoring` (disk monitoring flag).

Implemented for the MVP: real **status + disk usage**, read directly through the port's
`listDisks` / `getDiskUse`. There is no separate metrics port; one should be introduced together
with whichever source below is chosen.
Options for real CPU/RAM/network graphs, for the operator to decide:

1. **Guest agent at provisioning** (recommended) — a small exporter installed by the
   `postInstallScript` of `rebuild`, pushing to a time-series store. Full metrics, costs an
   agent + storage, and only works on servers we provisioned.
2. **OVH Metrics / Logs Data Platform** — a separate paid OVH product, extra contract.
3. **Ship without graphs** — status + disk only, which is what the MVP does today.

## 4. Authentication

Signed with `X-Ovh-Application-Key`, `X-Ovh-Timestamp`, `X-Ovh-Consumer`, `X-Ovh-Signature`
where `signature = "$1$" + sha1(appSecret + "+" + consumerKey + "+" + method + "+" + url + "+" + body + "+" + timestamp)`.
Clock skew is corrected from `GET /auth/time` (unauthenticated) — see `packages/ovh/src/signer.ts`.
