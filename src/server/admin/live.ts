import "server-only"
import { revalidatePath } from "next/cache"
import { DEFAULT_ADDON_MARGIN, DEFAULT_PLAN_MARGIN, type ParsedCatalog } from "@ola/core"
import { inngest } from "@/inngest/client"
import { env, providerMocked } from "@/lib/env"
import { diffOf, recordAudit } from "@/server/audit"
import { requireAdmin, requestMeta } from "@/server/auth/session"
import { loadCatalog } from "@/server/catalog/service"
import { assertOvhOrdersEnabled } from "@/server/providers"
import { chargeRenewal, refundOrder, toAdminChargeResult } from "@/server/billing"
import { raiseAlert } from "@/server/jobs/alerts"
import type {
  AdminActor,
  AdminAlertsPort,
  AdminAuditEntry,
  AdminBillingPort,
  AdminCachePort,
  AdminCatalogPort,
  AdminDeps,
  AdminEventsPort,
  AdminLinksPort,
  AdminSafetyPort,
} from "./deps"
import { DrizzleAdminStore } from "./drizzle-store"
import { impersonationCookies } from "./impersonation"
import { DEFAULT_MARGIN_FLOOR_BP, ratioToBasisPoints } from "./pricing"

/**
 * The real wiring of `AdminDeps`.
 *
 * This is the ONLY file in `src/server/admin/**` that imports the database, the session,
 * the providers, Inngest or `next/*`. When a module being written in parallel lands with
 * a name that differs from the one documented in `docs/architecture.md`, this file is the
 * only place that has to change.
 */

async function liveActor(): Promise<AdminActor> {
  // FIXED contract: redirects to /login, requires role `admin` AND a TOTP-verified session.
  const session = await requireAdmin()
  const meta = await requestMeta()
  return {
    userId: session.user.id,
    email: session.user.email,
    ip: meta.ip,
    userAgent: meta.userAgent,
  }
}

async function liveAudit(actor: AdminActor, entry: AdminAuditEntry): Promise<void> {
  const changes =
    entry.before && entry.after ? diffOf(entry.before, entry.after) : {}
  const diff: Record<string, unknown> = {
    ...changes,
    ...(entry.context ? { context: entry.context } : {}),
  }

  await recordAudit({
    actorId: actor.userId,
    actorType: "admin",
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    action: entry.action,
    ...(Object.keys(diff).length > 0 ? { diff } : {}),
    ip: actor.ip,
    userAgent: actor.userAgent,
    correlationId: entry.correlationId ?? null,
  })
}

function liveEvents(): AdminEventsPort {
  return {
    async retryProvision({ orderId, correlationId }) {
      await inngest.send({
        name: "ola/order.provision",
        data: { orderId, resume: true, correlationId },
      })
    },
    async syncCatalog({ correlationId }) {
      await inngest.send({ name: "ola/catalog.sync", data: { reason: "manual", correlationId } })
    },
    async syncService({ serviceId, correlationId }) {
      await inngest.send({ name: "ola/service.sync", data: { serviceId, correlationId } })
    },
  }
}

function liveSafety(): AdminSafetyPort {
  return {
    ovhOrdersEnabledInEnv() {
      try {
        return env().OVH_ORDERS_ENABLED
      } catch {
        // A half-configured environment is treated as "off": refusing an order is always
        // the safe failure.
        return false
      }
    },
    usingMocks() {
      try {
        // The retry gate is about OVH orders, so the OVH switch is the one that counts.
        return providerMocked("ovh")
      } catch {
        return false
      }
    },
    assertOvhOrdersEnabled,
  }
}

/** `refundOrder` and `chargeRenewal` are the billing layer's; nothing here moves money itself. */
function liveBilling(): AdminBillingPort {
  return {
    async refundOrder(orderId, reason) {
      const result = await refundOrder(orderId, reason)
      return { refunded: result.refunded }
    },
    async chargeRenewal(serviceId) {
      const result = await chargeRenewal(serviceId)
      const flat = toAdminChargeResult(result)
      return {
        ...flat,
        declined: result.ok
          ? null
          : result.failure.stripeDeclineCode ?? result.failure.stripeCode ?? result.failure.reason,
      }
    },
  }
}

/** `raiseAlert` from `src/server/jobs/alerts.ts`: audit row + email + Slack, never throws. */
function liveAlerts(): AdminAlertsPort {
  return {
    async raiseAlert(input) {
      await raiseAlert(input)
    },
  }
}

function liveCatalog(): AdminCatalogPort {
  return {
    load(): Promise<ParsedCatalog> {
      return loadCatalog()
    },
    defaults() {
      try {
        const current = env()
        return {
          plan: current.PRICING_DEFAULT_MARGIN,
          addon: current.ADDON_DEFAULT_MARGIN,
          marginFloorBasisPoints: ratioToBasisPoints(current.CATALOG_MARGIN_FLOOR),
        }
      } catch {
        return {
          plan: DEFAULT_PLAN_MARGIN,
          addon: DEFAULT_ADDON_MARGIN,
          marginFloorBasisPoints: DEFAULT_MARGIN_FLOOR_BP,
        }
      }
    },
  }
}

function liveLinks(): AdminLinksPort {
  return {
    whmcsBaseUrl() {
      try {
        const url = env().WHMCS_API_URL
        // `WHMCS_API_URL` points at includes/api.php; the admin area lives at the origin.
        return url ? new URL(url).origin : null
      } catch {
        return null
      }
    },
  }
}

function liveCache(): AdminCachePort {
  return {
    revalidate(path) {
      revalidatePath(path)
    },
  }
}

export function liveAdminDeps(): AdminDeps {
  return {
    store: new DrizzleAdminStore(),
    actor: liveActor,
    audit: liveAudit,
    events: liveEvents(),
    safety: liveSafety(),
    billing: liveBilling(),
    alerts: liveAlerts(),
    catalog: liveCatalog(),
    links: liveLinks(),
    impersonation: impersonationCookies(),
    cache: liveCache(),
    now: () => new Date(),
  }
}
