import { inngest } from "../client"
import { jobDeps } from "../deps"
import { runCatalogSync } from "../jobs/catalog-sync"
import { stepTools } from "../steps"

/**
 * 05:40 Europe/Madrid, daily: re-read the OVH public catalog, update our cost columns and
 * shout if a cost rose, a margin fell through the floor or an MVP plan disappeared.
 *
 * One run at a time: two concurrent syncs would write two snapshots and diff against each
 * other's.
 */
export const catalogSync = inngest.createFunction(
  {
    id: "catalog-sync",
    name: "Sincronizar catálogo de OVH",
    concurrency: { limit: 1 },
    retries: 2,
  },
  [{ cron: "TZ=Europe/Madrid 40 5 * * *" }, { event: "ola/catalog.sync" }],
  async ({ event, step }) => {
    const deps = jobDeps()
    const data = "data" in event ? event.data : undefined
    const correlationId =
      (data && "correlationId" in data ? data.correlationId : undefined) ??
      `catalog-${deps.now().toISOString().slice(0, 10)}`

    return runCatalogSync(deps, stepTools(step), correlationId)
  },
)
