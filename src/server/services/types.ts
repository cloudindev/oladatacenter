import "server-only"
import type { ActionStatus, ServiceStatus, Term } from "@ola/core"
import type { FirewallActivation, FirewallRuleView } from "@/components/servers/types"

/**
 * View models for the customer server area.
 *
 * Everything the customer may read lives here. Three fields are deliberately
 * server-side only and are never part of a props object sent to the browser:
 * `ovhServiceName`, `ovhPlanCode` and anything cost related. The customer sees
 * their own display name, our plan name, IPs, OS and the datacenter city.
 */

export interface PlanSpecsView {
  vcores: number
  ramGb: number
  nvmeGb: number
  bandwidthMbps: number
}

/** One row of the server list. Safe to render. */
export interface ServiceListItem {
  id: string
  /** Customer-chosen label, or our plan name when they never set one. */
  name: string
  planName: string
  planSlug: string
  specs: PlanSpecsView
  os: string
  /** "Gravelines, Francia" — never an OVH datacenter code. */
  datacenterLabel: string
  ipv4: string | null
  ipv6: string | null
  status: ServiceStatus
  term: Term
  /** Our price, cents per month. Never a cost, never a margin. */
  monthlyPrice: number
  nextDueAt: Date | null
  autoRenew: boolean
  dunningStage: string
  rescueMode: boolean
  createdAt: Date
}

/**
 * A single service with the fields the server layer needs to talk to OVH.
 * Never pass this whole object to a Client Component.
 */
export interface ServiceRecord extends ServiceListItem {
  customerId: string
  planId: string
  /** OVH service identifier. Never rendered. */
  ovhServiceName: string | null
  /** OVH plan code. Never rendered. */
  ovhPlanCode: string
  ovhExpiresAt: Date | null
}

export interface ServiceAddonView {
  id: string
  name: string
  family: string
  monthlyPrice: number
  status: "pending" | "active" | "removed"
}

export interface SshKeyView {
  id: string
  name: string
  fingerprint: string
  /** The public key itself, needed by `rebuild`. */
  publicKey: string
}

/** One row of the `actions` table, as the activity tab and the poller read it. */
export interface ActionRecordView {
  id: string
  type: string
  status: ActionStatus
  error: string | null
  createdAt: Date
  finishedAt: Date | null
  /** True once the OVH task reached a terminal state (or there was no task). */
  terminal: boolean
}

/** One row of `audit_log` scoped to a service. */
export interface AuditEntryView {
  id: string
  action: string
  actorType: "user" | "admin" | "system" | "webhook"
  createdAt: Date
}

export interface DiskUsageView {
  diskId: number
  usedGb: number
  maxGb: number
  percent: number
}

/** What OVH really knows about the running machine. No CPU/RAM/network: see §3 of docs/ovh-api-verified.md. */
export interface LiveServerState {
  /** `vps.VpsStateEnum` as OVH reports it. */
  state: string
  rescueMode: boolean
  ips: readonly LiveIp[]
}

export interface LiveIp {
  address: string
  version: 4 | 6
  isBlock: boolean
}

export interface SnapshotView {
  description: string
  createdAt: Date
}

export interface BackupView {
  enabled: boolean
  /** Number of restore points OVH keeps. */
  rotation: number | null
  schedule: string | null
  restorePoints: readonly string[]
}

export interface UpgradeOptionView {
  /** Our plan id, which the order flow needs. */
  planId: string
  planName: string
  planSlug: string
  specs: PlanSpecsView
  monthlyPrice: number
  /** Prorated amount due now, cents. */
  amountDue: number
  remainingDays: number
}

export interface RenewalView {
  expiresAt: Date | null
  automatic: boolean
  deleteAtExpiration: boolean
}

export interface ReverseEntry {
  ip: string
  /** The configured hostname, or `null` when the IP has no reverse yet. */
  hostname: string | null
}

export interface MitigationView {
  /** True when this IP is currently being scrubbed. */
  active: boolean
  auto: boolean
  permanent: boolean
  state: string | null
}

export interface NetworkView {
  ips: readonly LiveIp[]
  reverses: readonly ReverseEntry[]
  /** Firewall state of the main IPv4, read from `listFirewalledIps`. */
  firewall: FirewallActivation
  /** Sequence numbers of the OVH firewall rules on the main IPv4. */
  firewallRuleSequences: readonly number[]
  firewallRules: readonly FirewallRuleView[]
  mitigation: MitigationView
}

export type { FirewallRuleView } from "@/components/servers/types"
