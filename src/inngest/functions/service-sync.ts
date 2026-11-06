import { inngest } from "../client"
import { jobDeps } from "../deps"
import { runServiceSync } from "../jobs/service-sync"
import { stepTools } from "../steps"

/**
 * Hourly reconciliation with OVH. One run at a time; a single service can also be
 * reconciled on demand with `ola/service.sync` and a `serviceId`.
 */
export const serviceSync = inngest.createFunction(
  {
    id: "service-sync",
    name: "Reconciliar servicios con OVH",
    concurrency: { limit: 1 },
    retries: 2,
  },
  [{ cron: "TZ=Europe/Madrid 7 * * * *" }, { event: "ola/service.sync" }],
  async ({ event, step }) => {
    const deps = jobDeps()
    const data = "data" in event ? event.data : undefined
    const serviceId = data && "serviceId" in data ? data.serviceId : undefined
    const correlationId =
      (data && "correlationId" in data ? data.correlationId : undefined) ??
      `service-sync-${deps.now().toISOString()}`

    return runServiceSync(deps, stepTools(step), { serviceId, correlationId })
  },
)
