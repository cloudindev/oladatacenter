import { z } from "zod"

/**
 * Service lifecycle.
 *
 *   provisioning -> active
 *   active <-> stopped            (customer powers the server off and on)
 *   active|stopped -> suspended   (unpaid; we stop it)
 *   suspended -> active           (paid; we start it again)
 *   any -> terminating -> terminated
 *   active|suspended -> review    (abuse / fraud signal; server stopped, manual review)
 *   review -> active | terminating
 */
export const SERVICE_STATUSES = [
  "provisioning",
  "active",
  "stopped",
  "suspended",
  "review",
  "terminating",
  "terminated",
] as const
export type ServiceStatus = (typeof SERVICE_STATUSES)[number]
export const serviceStatusSchema = z.enum(SERVICE_STATUSES)

export const SERVICE_TRANSITIONS: Readonly<Record<ServiceStatus, readonly ServiceStatus[]>> = {
  provisioning: ["active", "terminating"],
  active: ["stopped", "suspended", "review", "terminating"],
  stopped: ["active", "suspended", "review", "terminating"],
  suspended: ["active", "review", "terminating"],
  review: ["active", "terminating"],
  terminating: ["terminated"],
  terminated: [],
}

export class ServiceTransitionError extends Error {
  constructor(
    readonly from: ServiceStatus,
    readonly to: ServiceStatus,
  ) {
    super(`invalid service transition: ${from} -> ${to}`)
    this.name = "ServiceTransitionError"
  }
}

export function canTransitionService(from: ServiceStatus, to: ServiceStatus): boolean {
  return SERVICE_TRANSITIONS[from].includes(to)
}

export function assertServiceTransition(from: ServiceStatus, to: ServiceStatus): void {
  if (!canTransitionService(from, to)) throw new ServiceTransitionError(from, to)
}

/** Actions the customer may trigger, and the statuses that allow them. */
export const SERVICE_ACTIONS = [
  "start",
  "stop",
  "reboot",
  "reinstall",
  "rescue_on",
  "rescue_off",
  "console",
  "snapshot_create",
  "snapshot_revert",
  "snapshot_delete",
  "backup_restore",
  "rdns_set",
  "firewall_rule_add",
  "firewall_rule_delete",
  "upgrade",
  "addon_add",
] as const
export type ServiceAction = (typeof SERVICE_ACTIONS)[number]
export const serviceActionSchema = z.enum(SERVICE_ACTIONS)

const ACTIONS_WHEN_RUNNING: readonly ServiceAction[] = [
  "stop",
  "reboot",
  "reinstall",
  "rescue_on",
  "rescue_off",
  "console",
  "snapshot_create",
  "snapshot_revert",
  "snapshot_delete",
  "backup_restore",
  "rdns_set",
  "firewall_rule_add",
  "firewall_rule_delete",
  "upgrade",
  "addon_add",
]

/**
 * A suspended server is deliberately read-only: the customer may look but not act,
 * otherwise an unpaid server could be restarted from the panel.
 */
export function allowedActions(status: ServiceStatus): readonly ServiceAction[] {
  switch (status) {
    case "active":
      return ACTIONS_WHEN_RUNNING
    case "stopped":
      return ["start", "reinstall", "console", "snapshot_revert", "backup_restore", "upgrade", "addon_add"]
    case "provisioning":
    case "suspended":
    case "review":
    case "terminating":
    case "terminated":
      return []
  }
}

export function isActionAllowed(status: ServiceStatus, action: ServiceAction): boolean {
  return allowedActions(status).includes(action)
}

/** Job status of a single action against OVH. */
export const ACTION_STATUSES = ["queued", "running", "done", "error"] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]
export const actionStatusSchema = z.enum(ACTION_STATUSES)

/** OVH task states, verified 2026-11-05 against the /vps schema (vps.TaskStateEnum). */
export const OVH_TASK_STATES = [
  "blocked",
  "cancelled",
  "doing",
  "done",
  "error",
  "paused",
  "todo",
  "waitingAck",
] as const
export type OvhTaskState = (typeof OVH_TASK_STATES)[number]

export function actionStatusFromOvhTask(state: OvhTaskState): ActionStatus {
  switch (state) {
    case "done":
      return "done"
    case "error":
    case "cancelled":
      return "error"
    case "doing":
    case "waitingAck":
      return "running"
    case "todo":
    case "paused":
    case "blocked":
      return "queued"
  }
}

export function isOvhTaskTerminal(state: OvhTaskState): boolean {
  return state === "done" || state === "error" || state === "cancelled"
}
