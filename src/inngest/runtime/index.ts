import "server-only"
import { CUSTOMER_AREA_URL } from "@ola/email"
import { recordAudit } from "@/server/audit"
import {
  assertOvhOrdersEnabled,
  ovh as ovhProvider,
  whmcs as whmcsProvider,
} from "@/server/providers"
import { adminBaseUrl, raiseAlert } from "@/server/jobs/alerts"
import { sendEmail } from "@/server/jobs/mailer"
import { generateRootPassword, storeRootPasswordOnce } from "@/server/jobs/secrets"
import { env } from "@/lib/env"
import { withCorrelation } from "@/lib/logger"
import { inngest, type OlaEvents } from "../client"
import type { JobDeps } from "../ports"
import { createJobDb } from "./db"

/**
 * Production wiring of `JobDeps`: the only file that knows where the real adapters come
 * from. `ovh()` and `whmcs()` come straight from `src/server/providers.ts`, the single
 * place adapters are constructed, and satisfy the `OvhJobs` / `WhmcsJobs` picks directly.
 */

let cached: JobDeps | null = null

export function runtimeDeps(): JobDeps {
  if (cached) return cached

  const config = env()
  const deps: JobDeps = {
    db: createJobDb(),
    ovh: ovhProvider,
    whmcs: whmcsProvider,
    email: {
      async send(input) {
        await sendEmail({
          message: input.message,
          to: input.to,
          customerId: input.customerId ?? null,
          correlationId: input.correlationId ?? null,
        })
      },
    },
    audit: {
      async record(entry) {
        await recordAudit(entry)
      },
    },
    alerts: {
      async raise(input) {
        await raiseAlert(input)
      },
    },
    events: {
      async send<K extends keyof OlaEvents>(name: K, data: OlaEvents[K]["data"]): Promise<void> {
        // The typed client narrows `name` and `data` together; here the pair is generic,
        // so it is re-assembled as one payload and validated by the client at runtime.
        await inngest.send({ name, data } as Parameters<typeof inngest.send>[0])
      },
    },
    log: (correlationId, extra) => withCorrelation(correlationId, extra),
    assertOvhOrdersEnabled,
    ovhSubsidiary: config.OVH_SUBSIDIARY,
    customerAreaUrl: CUSTOMER_AREA_URL,
    adminUrl: adminBaseUrl(),
    now: () => new Date(),
    generatePassword: generateRootPassword,
    storeRootPasswordOnce,
  }

  cached = deps
  return deps
}

/** Test seam for anything that imports the runtime directly. */
export function resetRuntimeDeps(): void {
  cached = null
}
