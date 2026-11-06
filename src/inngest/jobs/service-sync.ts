import type { ServiceStatus } from "@ola/core"
import type { StepTools } from "../steps"
import type { JobDeps, ServicePatch, ServiceRecord } from "../ports"

/**
 * Hourly reconciliation between our `services` rows and OVH.
 *
 * It fixes drift it is allowed to fix (power state, IPs, expiry) and it only ever ALERTS
 * on a contradiction: a server OVH says is expired while we bill it, or a suspended
 * service that is running, are human decisions, not automatic ones.
 */

export interface ServiceSyncIssue {
  serviceId: string
  severity: "warning" | "critical"
  title: string
  detail: string
}

export interface ServiceSyncResult {
  checked: number
  updated: number
  issues: readonly ServiceSyncIssue[]
}

/** OVH power state -> our status, only for the two states we mirror. */
function statusFromVpsState(state: string, current: ServiceStatus): ServiceStatus | null {
  if (current !== "active" && current !== "stopped") return null
  if (state === "running" && current === "stopped") return "active"
  if (state === "stopped" && current === "active") return "stopped"
  return null
}

export async function reconcileService(
  deps: JobDeps,
  service: ServiceRecord,
): Promise<{ patch: ServicePatch; issues: readonly ServiceSyncIssue[] }> {
  const issues: ServiceSyncIssue[] = []
  const patch: ServicePatch = { lastSyncedAt: deps.now() }

  if (!service.ovhServiceName) {
    if (service.status !== "provisioning") {
      issues.push({
        serviceId: service.id,
        severity: "critical",
        title: "Servicio sin identificador de OVH",
        detail: `service ${service.id} is ${service.status} but has no ovhServiceName`,
      })
    }
    return { patch, issues }
  }

  const ovh = deps.ovh()
  const serviceName = service.ovhServiceName
  const [vps, infos, ips] = await Promise.all([
    ovh.getVps(serviceName),
    ovh.getServiceInfos(serviceName),
    ovh.getVpsIps(serviceName),
  ])

  const ipv4 = ips.find((ip) => ip.version === 4 && !ip.isBlock)?.address ?? null
  const ipv6 = ips.find((ip) => ip.version === 6)?.address ?? null
  if (ipv4 !== service.ipv4) patch.ipv4 = ipv4
  if (ipv6 !== service.ipv6) patch.ipv6 = ipv6

  const expiresAt = infos.expiration
  if (service.ovhExpiresAt?.getTime() !== expiresAt.getTime()) patch.ovhExpiresAt = expiresAt

  const mapped = statusFromVpsState(vps.state, service.status)
  if (mapped !== null) patch.status = mapped

  if (infos.status === "expired" && (service.status === "active" || service.status === "stopped")) {
    issues.push({
      serviceId: service.id,
      severity: "critical",
      title: "OVH dice que el servicio ha expirado",
      detail: `ovhServiceName=${serviceName} ovhStatus=expired ourStatus=${service.status}`,
    })
  }

  if (service.status === "suspended" && vps.state === "running") {
    issues.push({
      serviceId: service.id,
      severity: "critical",
      title: "Servidor suspendido pero encendido",
      detail: `ovhServiceName=${serviceName} state=running ourStatus=suspended`,
    })
  }

  if (infos.renew?.deleteAtExpiration === true && service.status !== "terminating") {
    issues.push({
      serviceId: service.id,
      severity: "critical",
      title: "OVH borrará el servicio al expirar",
      detail: `ovhServiceName=${serviceName} deleteAtExpiration=true ourStatus=${service.status}`,
    })
  }

  if (infos.renew?.automatic === false && service.autoRenew && service.status === "active") {
    issues.push({
      serviceId: service.id,
      severity: "warning",
      title: "Renovación automática desactivada en OVH",
      detail: `ovhServiceName=${serviceName} renew.automatic=false but services.autoRenew=true`,
    })
  }

  if (
    service.nextDueAt &&
    expiresAt.getTime() < service.nextDueAt.getTime() - 24 * 60 * 60 * 1000
  ) {
    issues.push({
      serviceId: service.id,
      severity: "warning",
      title: "La expiración en OVH es anterior a nuestra fecha de cobro",
      detail: `ovhExpiration=${expiresAt.toISOString()} nextDueAt=${service.nextDueAt.toISOString()}`,
    })
  }

  return { patch, issues }
}

export async function runServiceSync(
  deps: JobDeps,
  step: StepTools,
  input: { serviceId?: string; correlationId: string },
): Promise<ServiceSyncResult> {
  const log = deps.log(input.correlationId, { job: "service-sync" })

  const services = input.serviceId
    ? await (async () => {
        const one = await deps.db.getService(input.serviceId as string)
        return one ? [one] : []
      })()
    : await deps.db.listServicesForSync()

  const issues: ServiceSyncIssue[] = []
  let updated = 0

  for (const service of services) {
    if (service.status === "terminated") continue
    try {
      const result = await step.run(`sync-${service.id}`, async () => {
        const { patch, issues: found } = await reconcileService(deps, service)
        const changed = Object.keys(patch).filter((key) => key !== "lastSyncedAt")
        await deps.db.updateService(service.id, patch)
        if (changed.length > 0) {
          await deps.audit.record({
            entity: "service",
            entityId: service.id,
            action: "service.synced",
            diff: { changed, patch: { ...patch, lastSyncedAt: undefined } },
            correlationId: input.correlationId,
          })
        }
        return { changed: changed.length, issues: found }
      })
      if (result.changed > 0) updated += 1
      issues.push(...result.issues)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      issues.push({
        serviceId: service.id,
        severity: "critical",
        title: "No se ha podido sincronizar el servicio con OVH",
        detail,
      })
    }
  }

  for (const issue of issues) {
    await deps.alerts.raise({
      severity: issue.severity,
      title: issue.title,
      entity: "service",
      entityId: issue.serviceId,
      detail: issue.detail,
      correlationId: input.correlationId,
    })
  }

  log.info({ checked: services.length, updated, issues: issues.length }, "service sync finished")
  return { checked: services.length, updated, issues }
}
