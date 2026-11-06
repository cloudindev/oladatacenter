import "server-only"
import { DomainError } from "@ola/core"
import { isOvhApiError } from "@ola/ovh"
import { ovh } from "@/server/providers"
import type { FirewallActivation } from "@/components/servers/types"
import type {
  BackupView,
  DiskUsageView,
  FirewallRuleView,
  LiveIp,
  LiveServerState,
  NetworkView,
  RenewalView,
  SnapshotView,
} from "./types"

/**
 * Reads from OVH, mapped onto the view models in `./types`.
 *
 * Everything here throws on failure; the caller wraps it in `load()` so a provider
 * outage renders a notice instead of an error page.
 *
 * What is deliberately absent: CPU, RAM and network graphs. `GET /vps/{serviceName}/statistics`
 * does not exist in the current OVH API (docs/ovh-api-verified.md §3). The panel shows the
 * real power state and real disk usage, and says so. No fabricated charts.
 */

function requireOvhName(ovhServiceName: string | null): string {
  if (!ovhServiceName) throw new DomainError("service_not_found")
  return ovhServiceName
}

function isNotFound(error: unknown): boolean {
  return isOvhApiError(error) && error.httpStatus === 404
}

/** A single IPv4 is addressed as a /32 block on the `/ip` routes. */
export function toIpBlock(address: string): string {
  return address.includes("/") ? address : `${address}/32`
}

export async function fetchLiveState(ovhServiceName: string | null): Promise<LiveServerState> {
  const name = requireOvhName(ovhServiceName)
  const client = ovh()
  const [vps, ips] = await Promise.all([client.getVps(name), client.getVpsIps(name)])
  return {
    state: vps.state,
    rescueMode: vps.netbootMode === "rescue",
    ips: ips.map(
      (ip): LiveIp => ({ address: ip.address, version: ip.version, isBlock: ip.isBlock }),
    ),
  }
}

/**
 * Real disk usage — the only capacity metric OVH exposes for a VPS.
 * `max` and `used` come back as `{ unit, value }`; OVH reports GB for VPS disks.
 */
export async function fetchDiskUsage(ovhServiceName: string | null): Promise<DiskUsageView[]> {
  const name = requireOvhName(ovhServiceName)
  const client = ovh()
  const diskIds = await client.listDisks(name)

  const usage = await Promise.all(
    diskIds.map(async (diskId): Promise<DiskUsageView> => {
      const [used, max] = await Promise.all([
        client.getDiskUse(name, diskId, "used"),
        client.getDiskUse(name, diskId, "max"),
      ])
      const usedGb = toGb(used.value, used.unit)
      const maxGb = toGb(max.value, max.unit)
      return {
        diskId,
        usedGb,
        maxGb,
        percent: maxGb > 0 ? Math.min(100, Math.round((usedGb / maxGb) * 100)) : 0,
      }
    }),
  )
  return usage
}

/** OVH returns a unit with the value. Normalise to GB without guessing. */
function toGb(value: number, unit: string): number {
  const normalised = unit.trim().toUpperCase()
  if (normalised === "GB" || normalised === "GIB") return Math.round(value * 10) / 10
  if (normalised === "MB" || normalised === "MIB") return Math.round((value / 1024) * 10) / 10
  if (normalised === "TB" || normalised === "TIB") return Math.round(value * 1024 * 10) / 10
  if (normalised === "B" || normalised === "BYTES") {
    return Math.round((value / 1024 ** 3) * 10) / 10
  }
  return Math.round(value * 10) / 10
}

/**
 * Image ids available for a reinstall.
 *
 * `GET /vps/{serviceName}/images/available` returns **ids only** (verified: `string[]`).
 * The per-image detail route is not in `docs/ovh-api-verified.md`, so there is no
 * provider-supplied display name. The UI formats the id as best it can and shows the
 * raw value when it cannot.
 */
export async function fetchAvailableImages(
  ovhServiceName: string | null,
): Promise<readonly string[]> {
  const name = requireOvhName(ovhServiceName)
  return ovh().listAvailableImages(name)
}

export async function fetchCurrentImage(ovhServiceName: string | null): Promise<string | null> {
  const name = requireOvhName(ovhServiceName)
  try {
    const image = await ovh().getCurrentImage(name)
    return image.name
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** The single snapshot slot, or `null` when it is empty. */
export async function fetchSnapshot(ovhServiceName: string | null): Promise<SnapshotView | null> {
  const name = requireOvhName(ovhServiceName)
  try {
    const snapshot = await ovh().getSnapshot(name)
    return { description: snapshot.description, createdAt: snapshot.creationDate }
  } catch (error) {
    // No snapshot taken yet, or the option is not active: both answer 404.
    if (isNotFound(error)) return null
    throw error
  }
}

/** True when the paid snapshot option is active on the service. */
export async function fetchSnapshotOptionActive(ovhServiceName: string | null): Promise<boolean> {
  const name = requireOvhName(ovhServiceName)
  const options = await ovh().listOptions(name)
  return options.includes("snapshot")
}

export async function fetchBackup(ovhServiceName: string | null): Promise<BackupView> {
  const name = requireOvhName(ovhServiceName)
  const client = ovh()
  let enabled = false
  let rotation: number | null = null
  let schedule: string | null = null

  try {
    const backup = await client.getAutomatedBackup(name)
    enabled = backup.state === "enabled"
    rotation = backup.rotation ?? null
    schedule = backup.schedule ?? null
  } catch (error) {
    if (!isNotFound(error)) throw error
  }

  if (!enabled) return { enabled: false, rotation, schedule, restorePoints: [] }

  const restorePoints = await client.listRestorePoints(name, "available")
  return { enabled, rotation, schedule, restorePoints }
}

export async function fetchRenewal(ovhServiceName: string | null): Promise<RenewalView> {
  const name = requireOvhName(ovhServiceName)
  const infos = await ovh().getServiceInfos(name)
  return {
    expiresAt: infos.expiration,
    automatic: infos.renew?.automatic ?? false,
    deleteAtExpiration: infos.renew?.deleteAtExpiration ?? false,
  }
}

/**
 * OVH plan codes this service can be upgraded to.
 *
 * `vps.Model.name` is the OVH plan code, which is how we match the offer onto one of
 * our own plans. The code itself never reaches the browser: the UI renders our plan
 * name, taken from the `plans` row we matched.
 */
export async function fetchAvailableUpgradePlanCodes(
  ovhServiceName: string | null,
): Promise<readonly string[]> {
  const name = requireOvhName(ovhServiceName)
  const models = await ovh().listAvailableUpgrades(name)
  return models.map((model) => model.name)
}

/**
 * Whether one IP is on the OVH network firewall.
 *
 * Read from `GET /ip/{ip}/firewall` (`listFirewalledIps`): an IP absent from the list is
 * `off`; listed and `state: ok, enabled: true` is `on`; anything else is still moving
 * (`enableFirewallPending` / `disableFirewallPending`) and is reported as `pending`.
 */
export async function fetchFirewallActivation(
  ipBlock: string,
  address: string,
): Promise<FirewallActivation> {
  const client = ovh()
  const [listed, ready] = await Promise.all([
    client.listFirewalledIps(ipBlock).catch(absentOn404<readonly string[]>([])),
    client
      .listFirewalledIps(ipBlock, { enabled: true, state: "ok" })
      .catch(absentOn404<readonly string[]>([])),
  ])
  if (!listed.includes(address)) return "off"
  return ready.includes(address) ? "on" : "pending"
}

/**
 * Network state for the `red` tab: IPs, their reverses, the firewall state and rules of
 * the main IPv4, and the anti-DDoS state of that IP.
 *
 * A 404 on a reverse or a mitigation lookup is a normal state ("nothing configured")
 * rather than a failure. Whether the firewall is on comes from `listFirewalledIps`, not
 * from guessing at a 404 on the rules list.
 */
export async function fetchNetwork(ovhServiceName: string | null): Promise<NetworkView> {
  const name = requireOvhName(ovhServiceName)
  const client = ovh()
  const ips = await client.getVpsIps(name)
  const mainIpv4 = ips.find((ip) => ip.version === 4 && !ip.isBlock) ?? null

  const view: NetworkView = {
    ips: ips.map((ip) => ({ address: ip.address, version: ip.version, isBlock: ip.isBlock })),
    reverses: [],
    firewall: "off",
    firewallRuleSequences: [],
    firewallRules: [],
    mitigation: { active: false, auto: true, permanent: false, state: null },
  }

  if (!mainIpv4) return view

  const block = toIpBlock(mainIpv4.address)
  const address = mainIpv4.address

  const [configuredReverses, firewall, mitigation] = await Promise.all([
    client.listReverseIps(block).catch(absentOn404<readonly string[]>([])),
    fetchFirewallActivation(block, address),
    client
      .getMitigation(block)
      .catch(absentOn404({ ipBlock: block, mitigatedIps: [] as readonly string[] })),
  ])

  // Rules only exist on an IP that is on the firewall.
  const sequences: readonly number[] =
    firewall === "on" ? await client.listFirewallRules(block, address) : []

  const reverses = await Promise.all(
    configuredReverses.map(async (ip) => {
      const reverse = await client.getReverse(block, ip).catch(absentOn404(null))
      return { ip, hostname: reverse?.reverse ?? null }
    }),
  )

  const rules = await Promise.all(
    sequences.map((sequence) =>
      client.getFirewallRule(block, address, sequence).catch(absentOn404(null)),
    ),
  )

  const mitigationActive = mitigation.mitigatedIps.includes(address)
  const detail = mitigationActive
    ? await client.getMitigationIp(block, address).catch(absentOn404(null))
    : null

  return {
    ips: view.ips,
    reverses,
    firewall,
    firewallRuleSequences: sequences,
    firewallRules: rules.filter((rule): rule is NonNullable<typeof rule> => rule !== null).map(
      (rule): FirewallRuleView => ({
        sequence: rule.sequence,
        action: rule.action,
        protocol: rule.protocol,
        source: rule.source,
        destinationPort: rule.destinationPort ?? null,
        state: rule.state,
      }),
    ),
    mitigation: {
      active: mitigationActive,
      auto: detail?.auto ?? true,
      permanent: detail?.permanent ?? false,
      state: detail?.state ?? null,
    },
  }
}

/** Turns "the provider has nothing for this id" into a value instead of a failure. */
function absentOn404<T>(fallback: T): (error: unknown) => T {
  return (error: unknown) => {
    if (isNotFound(error)) return fallback
    throw error
  }
}
