"use server"

import { randomInt } from "node:crypto"
import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import {
  DomainError,
  TERM_MONTHS,
  customerMessageFor,
  isActionAllowed,
  isDomainError,
  prorateUpgrade,
  type ServiceAction,
} from "@ola/core"
import { toDomainError, type OvhClient, type VpsTask } from "@ola/ovh"
import { recordAudit } from "@/server/audit"
import { ovh } from "@/server/providers"
import type { SessionContext } from "@/server/auth/session"
import { requireUser } from "@/server/auth/session"
import { logger } from "@/lib/logger"
import { fetchFirewallActivation, toIpBlock } from "./provider"
import {
  completeAction,
  failAction,
  getServiceForCustomer,
  listPlansAbove,
  listSshKeysForCustomer,
  recordAction,
  renameService,
  setServiceAutoRenew,
  setServiceRescueMode,
  updateActionFromTask,
} from "./repository"
import type { ServiceRecord } from "./types"
import type {
  ActionResult,
  ConsoleResult,
  FirewallStatusResult,
  ReinstallResult,
  UpgradeQuoteResult,
} from "@/components/servers/types"

/**
 * Every operation a customer can trigger on their own server.
 *
 * The shape of each one is identical and deliberate:
 *
 *   authorise (session + ownership)  →  isActionAllowed(status, action)  →  recordAudit
 *   →  append the `actions` row  →  call OVH  →  store the real `ovhTaskId`  →  revalidate
 *
 * Authorisation is by id **and** customer id: a service that belongs to somebody else
 * is reported as missing, never as forbidden, so the panel cannot be used to discover
 * which ids exist. A suspended server allows no action at all — that rule lives in
 * `allowedActions` in `@ola/core`, not here.
 *
 * Long operations never fake progress. The `actions` row carries the OVH task id and the
 * UI polls the real task state until `isOvhTaskTerminal`.
 */

interface Authorised {
  session: SessionContext
  service: ServiceRecord
  /** OVH service identifier. Used here, never returned to the caller. */
  ovhName: string
}

/** Actions we log that are not OVH operations. */
type LocalAction = "rename" | "auto_renew"

async function authorise(serviceId: string, action: ServiceAction | null): Promise<Authorised> {
  const session = await requireUser()
  if (!session.customer) throw new DomainError("not_verified")

  const service = await getServiceForCustomer(serviceId, session.customer.id)
  if (!service) throw new DomainError("service_not_found")

  if (action && !isActionAllowed(service.status, action)) {
    throw new DomainError("action_not_allowed")
  }
  if (!service.ovhServiceName) {
    // Still provisioning: we do not have the provider identifier yet.
    throw new DomainError("action_not_allowed")
  }
  return { session, service, ovhName: service.ovhServiceName }
}

function failure(error: unknown): { ok: false; message: string } {
  const domain = isDomainError(error) ? error : toDomainError(error)
  logger.error(
    { code: domain.code, detail: domain.detail },
    "customer server action failed",
  )
  return { ok: false, message: customerMessageFor(domain) }
}

function detailOf(error: unknown): string {
  const domain = isDomainError(error) ? error : toDomainError(error)
  return domain.detail ?? domain.code
}

function revalidateService(serviceId: string): void {
  revalidatePath(`/app/servers/${serviceId}`, "layout")
  revalidatePath("/app")
}

async function auditService(
  session: SessionContext,
  service: ServiceRecord,
  action: ServiceAction | LocalAction,
  diff?: Record<string, unknown>,
): Promise<void> {
  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "service",
    entityId: service.id,
    action: `service.${action}`,
    diff,
  })
}

/** Best effort: a failure to mark the row must not hide the original error. */
async function markFailed(actionId: string | null, error: unknown): Promise<void> {
  if (!actionId) return
  try {
    await failAction(actionId, detailOf(error))
  } catch {
    // The row stays "running"; the poller will keep reporting the provider state.
  }
}

/**
 * The shared body of every operation that returns an OVH task.
 */
async function taskAction(
  serviceId: string,
  action: ServiceAction,
  payload: Record<string, unknown>,
  call: (client: OvhClient, ovhName: string) => Promise<VpsTask>,
  afterOvh?: (service: ServiceRecord) => Promise<void>,
): Promise<ActionResult> {
  let actionId: string | null = null
  try {
    const { session, service, ovhName } = await authorise(serviceId, action)
    await auditService(session, service, action, payload)
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: action,
      payload,
    })

    const task = await call(ovh(), ovhName)
    // The real task id and the real task state, never an invented "in progress".
    await updateActionFromTask(actionId, { id: task.id, state: task.state })
    if (afterOvh) await afterOvh(service)

    revalidateService(serviceId)
    return { ok: true, actionId }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

// ─── power ───────────────────────────────────────────────────────────────────

export async function startServer(serviceId: string): Promise<ActionResult> {
  return taskAction(serviceId, "start", {}, (client, name) => client.start(name))
}

/** Destructive enough to need a confirmation step in the UI: the services stop answering. */
export async function stopServer(serviceId: string): Promise<ActionResult> {
  return taskAction(serviceId, "stop", {}, (client, name) => client.stop(name))
}

export async function rebootServer(serviceId: string): Promise<ActionResult> {
  return taskAction(serviceId, "reboot", {}, (client, name) => client.reboot(name))
}

// ─── console ─────────────────────────────────────────────────────────────────

/**
 * A short-lived KVM console URL. There is no task: OVH answers with the URL.
 * The URL is a credential, so it is returned once and never stored on the action row.
 */
export async function openConsole(serviceId: string): Promise<ConsoleResult> {
  let actionId: string | null = null
  try {
    const { session, service, ovhName } = await authorise(serviceId, "console")
    await auditService(session, service, "console")
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: "console",
    })

    const url = await ovh().getConsoleUrl(ovhName)
    await completeAction(actionId)
    return { ok: true, actionId, url }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

// ─── reinstall ───────────────────────────────────────────────────────────────

const reinstallSchema = z.object({
  serviceId: z.string().min(1),
  imageId: z.string().min(1).max(200),
  /** Empty string means "no key, generate a password". */
  sshKeyId: z.string().max(26),
  /** The customer must type the server name to confirm. */
  confirmation: z.string().min(1).max(80),
})

const PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const PASSWORD_SYMBOLS = "#%+=?@"

/**
 * A 20-character password with no ambiguous glyphs and no shell metacharacters,
 * so it can be applied by the post-install script without quoting surprises.
 */
function generateRootPassword(): string {
  const pool = PASSWORD_ALPHABET + PASSWORD_SYMBOLS
  let password = ""
  for (let index = 0; index < 20; index += 1) {
    password += pool[randomInt(pool.length)]
  }
  // Guarantee one symbol and one digit without reducing entropy meaningfully.
  const symbol = PASSWORD_SYMBOLS[randomInt(PASSWORD_SYMBOLS.length)] ?? "#"
  const digit = String(randomInt(10))
  return `${password.slice(0, 18)}${symbol}${digit}`
}

/**
 * Reinstall. The disk is wiped, which is why the UI requires the server name typed out.
 *
 * On the password: `POST /vps/{serviceName}/rebuild` has no password field — OVH either
 * mails one or installs an SSH key. To be able to show the password exactly once, we
 * generate it here and apply it with `postInstallScript`, and tell OVH not to send its
 * own (`doNotSendPassword: true`). Windows images have no shell to run that script, so
 * there we fall back to OVH's own email and say so.
 */
export async function reinstallServer(input: {
  serviceId: string
  imageId: string
  sshKeyId: string
  confirmation: string
}): Promise<ReinstallResult> {
  let actionId: string | null = null
  try {
    const parsed = reinstallSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: "Revisa los datos del formulario de reinstalación." }
    }
    const { serviceId, imageId, sshKeyId, confirmation } = parsed.data

    const { session, service, ovhName } = await authorise(serviceId, "reinstall")
    if (confirmation.trim() !== service.name.trim()) {
      return {
        ok: false,
        message: "El nombre que has escrito no coincide con el del servidor.",
      }
    }

    const keys = sshKeyId
      ? await listSshKeysForCustomer(service.customerId)
      : []
    const key = sshKeyId ? keys.find((candidate) => candidate.id === sshKeyId) : undefined
    if (sshKeyId && !key) {
      return { ok: false, message: "No encontramos esa clave SSH en tu cuenta." }
    }

    const isWindows = /win/i.test(imageId)
    const usePassword = !key
    const password = usePassword && !isWindows ? generateRootPassword() : null

    await auditService(session, service, "reinstall", {
      imageId,
      withSshKey: Boolean(key),
      passwordByEmail: usePassword && isWindows,
    })
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: "reinstall",
      // The password is never persisted, not even in the payload.
      payload: { imageId, withSshKey: Boolean(key) },
    })

    const task = await ovh().rebuild({
      serviceName: ovhName,
      imageId,
      publicSshKey: key?.publicKey,
      doNotSendPassword: password !== null,
      postInstallScript: password ? rootPasswordScript(password) : undefined,
    })

    await updateActionFromTask(actionId, { id: task.id, state: task.state })
    revalidateService(serviceId)

    return {
      ok: true,
      actionId,
      rootPassword: password,
      passwordByEmail: usePassword && password === null,
    }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

/** Single-quoted so nothing in the password can be interpreted by the shell. */
function rootPasswordScript(password: string): string {
  return ["#!/bin/sh", "set -e", `echo 'root:${password}' | chpasswd`, ""].join("\n")
}

// ─── rescue mode ─────────────────────────────────────────────────────────────

/**
 * Rescue mode is `netbootMode = rescue` plus a reboot. The disk is untouched: the
 * server simply boots a maintenance system instead of its own.
 */
export async function enableRescueMode(serviceId: string): Promise<ActionResult> {
  return taskAction(
    serviceId,
    "rescue_on",
    { netbootMode: "rescue" },
    async (client, name) => {
      await client.setNetbootMode(name, "rescue")
      return client.reboot(name)
    },
    (service) => setServiceRescueMode(service.id, true),
  )
}

export async function disableRescueMode(serviceId: string): Promise<ActionResult> {
  return taskAction(
    serviceId,
    "rescue_off",
    { netbootMode: "local" },
    async (client, name) => {
      await client.setNetbootMode(name, "local")
      return client.reboot(name)
    },
    (service) => setServiceRescueMode(service.id, false),
  )
}

// ─── snapshots ───────────────────────────────────────────────────────────────

const snapshotSchema = z.object({
  serviceId: z.string().min(1),
  description: z.string().trim().max(120),
})

export async function createSnapshot(input: {
  serviceId: string
  description: string
}): Promise<ActionResult> {
  const parsed = snapshotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "La descripción no es válida." }
  const description = parsed.data.description || "Snapshot manual"

  return taskAction(
    parsed.data.serviceId,
    "snapshot_create",
    { description },
    (client, name) => client.createSnapshot(name, description),
  )
}

/** Destructive: everything written after the snapshot is lost. */
export async function revertSnapshot(serviceId: string): Promise<ActionResult> {
  return taskAction(serviceId, "snapshot_revert", {}, (client, name) =>
    client.revertSnapshot(name),
  )
}

export async function deleteSnapshot(serviceId: string): Promise<ActionResult> {
  return taskAction(serviceId, "snapshot_delete", {}, (client, name) =>
    client.deleteSnapshot(name),
  )
}

// ─── automated backup ────────────────────────────────────────────────────────

const restoreSchema = z.object({
  serviceId: z.string().min(1),
  /** Returned verbatim by `listRestorePoints`; OVH wants it back byte for byte. */
  restorePoint: z.string().min(1).max(64),
})

/** Destructive: the disk goes back to the chosen point in time. */
export async function restoreBackup(input: {
  serviceId: string
  restorePoint: string
}): Promise<ActionResult> {
  const parsed = restoreSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "El punto de restauración no es válido." }

  return taskAction(
    parsed.data.serviceId,
    "backup_restore",
    { restorePoint: parsed.data.restorePoint },
    (client, name) =>
      client.restoreBackup({
        serviceName: name,
        restorePoint: parsed.data.restorePoint,
        type: "full",
        changePassword: false,
      }),
  )
}

// ─── network ─────────────────────────────────────────────────────────────────

/** A hostname, not a URL: letters, digits, hyphens and dots, ending in a TLD. */
const hostnameSchema = z
  .string()
  .trim()
  .min(4)
  .max(253)
  .regex(/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\.?$/i, {
    message: "hostname",
  })

const rdnsSchema = z.object({
  serviceId: z.string().min(1),
  ip: z.string().min(3).max(45),
  hostname: hostnameSchema,
})

export async function setRdns(input: {
  serviceId: string
  ip: string
  hostname: string
}): Promise<ActionResult> {
  const parsed = rdnsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Escribe un nombre de host completo, por ejemplo servidor.midominio.com.",
    }
  }
  const { serviceId, ip, hostname } = parsed.data

  let actionId: string | null = null
  try {
    const { session, service, ovhName } = await authorise(serviceId, "rdns_set")
    const ips = await ovh().getVpsIps(ovhName)
    const target = ips.find((candidate) => candidate.address === ip)
    if (!target) throw new DomainError("conflict")

    await auditService(session, service, "rdns_set", { ip, hostname })
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: "rdns_set",
      payload: { ip, hostname },
    })

    await ovh().setReverse(toIpBlock(ip), ip, hostname.replace(/\.$/, "") + ".")
    await completeAction(actionId, { ip, hostname })
    revalidateService(serviceId)
    return { ok: true, actionId }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

const firewallRuleSchema = z.object({
  serviceId: z.string().min(1),
  ip: z.string().min(3).max(45),
  /** `ip.FirewallSequenceRangeEnum` is 0..19. */
  sequence: z.number().int().min(0).max(19),
  action: z.enum(["permit", "deny"]),
  protocol: z.enum(["ah", "esp", "gre", "icmp", "ipv4", "tcp", "udp"]),
  /** Empty means "any source". */
  source: z.string().trim().max(43),
  /** 0 means "any port". Only meaningful for TCP/UDP. */
  destinationPort: z.number().int().min(0).max(65535),
})

export async function addFirewallRule(input: {
  serviceId: string
  ip: string
  sequence: number
  action: "permit" | "deny"
  protocol: "ah" | "esp" | "gre" | "icmp" | "ipv4" | "tcp" | "udp"
  source: string
  destinationPort: number
}): Promise<ActionResult> {
  const parsed = firewallRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Revisa los datos de la regla." }
  const rule = parsed.data

  let actionId: string | null = null
  try {
    const { session, service, ovhName } = await authorise(rule.serviceId, "firewall_rule_add")
    const ips = await ovh().getVpsIps(ovhName)
    const target = ips.find((candidate) => candidate.address === rule.ip)
    if (!target) throw new DomainError("conflict")

    const payload = {
      ip: rule.ip,
      sequence: rule.sequence,
      action: rule.action,
      protocol: rule.protocol,
      source: rule.source || null,
      destinationPort: rule.destinationPort || null,
    }
    await auditService(session, service, "firewall_rule_add", payload)
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: "firewall_rule_add",
      payload,
    })

    const supportsPorts = rule.protocol === "tcp" || rule.protocol === "udp"
    await ovh().addFirewallRule({
      ipBlock: toIpBlock(rule.ip),
      ipOnFirewall: rule.ip,
      sequence: rule.sequence,
      action: rule.action,
      protocol: rule.protocol,
      source: rule.source ? rule.source : undefined,
      destinationPort:
        supportsPorts && rule.destinationPort > 0 ? rule.destinationPort : undefined,
    })

    await completeAction(actionId, payload)
    revalidateService(rule.serviceId)
    return { ok: true, actionId }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

const firewallIpSchema = z.object({
  serviceId: z.string().min(1),
  ip: z.string().min(3).max(45),
})

/**
 * Puts the IP on the OVH network firewall — the step OVH requires before any rule.
 *
 * There is no OVH task for this: the provider answers with the IP in
 * `enableFirewallPending` and later `ok`. The UI follows that real state with
 * `getFirewallStatus`. Idempotent on OVH's side, so a double click is harmless.
 */
export async function enableFirewall(input: { serviceId: string; ip: string }): Promise<ActionResult> {
  const parsed = firewallIpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "La dirección no es válida." }
  const { serviceId, ip } = parsed.data

  let actionId: string | null = null
  try {
    const { session, service, ovhName } = await authorise(serviceId, "firewall_rule_add")
    const client = ovh()
    const ips = await client.getVpsIps(ovhName)
    const target = ips.find((candidate) => candidate.address === ip && candidate.version === 4)
    if (!target) throw new DomainError("conflict")

    await auditService(session, service, "firewall_rule_add", { ip, enableFirewall: true })
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: "firewall_rule_add",
      payload: { ip, step: "enable_firewall" },
    })

    const result = await client.enableFirewall(toIpBlock(ip), ip)
    await completeAction(actionId, { ip, state: result.state, enabled: result.enabled })
    revalidateService(serviceId)
    return { ok: true, actionId }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

/**
 * Read-only: the live firewall state of one IP of the customer's server, polled by the
 * UI while OVH moves it from `enableFirewallPending` to `ok`.
 */
export async function getFirewallStatus(input: {
  serviceId: string
  ip: string
}): Promise<FirewallStatusResult> {
  const parsed = firewallIpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "La dirección no es válida." }
  try {
    const session = await requireUser()
    if (!session.customer) throw new DomainError("not_verified")
    const service = await getServiceForCustomer(parsed.data.serviceId, session.customer.id)
    if (!service?.ovhServiceName) throw new DomainError("service_not_found")
    const ips = await ovh().getVpsIps(service.ovhServiceName)
    if (!ips.some((candidate) => candidate.address === parsed.data.ip)) {
      throw new DomainError("service_not_found")
    }
    const activation = await fetchFirewallActivation(
      toIpBlock(parsed.data.ip),
      parsed.data.ip,
    )
    return { ok: true, activation }
  } catch (error) {
    unstable_rethrow(error)
    return failure(error)
  }
}

/**
 * Removing a rule is itself a security change, so the UI confirms it and names what
 * stops being filtered. OVH answers with the rule in `removalPending`.
 */
export async function deleteFirewallRule(input: {
  serviceId: string
  ip: string
  sequence: number
}): Promise<ActionResult> {
  let actionId: string | null = null
  try {
    const { session, service, ovhName } = await authorise(input.serviceId, "firewall_rule_delete")
    const client = ovh()
    const ips = await client.getVpsIps(ovhName)
    const target = ips.find((candidate) => candidate.address === input.ip)
    if (!target) throw new DomainError("conflict")

    await auditService(session, service, "firewall_rule_delete", {
      ip: input.ip,
      sequence: input.sequence,
    })
    actionId = await recordAction({
      serviceId: service.id,
      userId: session.user.id,
      type: "firewall_rule_delete",
      payload: { ip: input.ip, sequence: input.sequence },
    })

    await client.deleteFirewallRule(toIpBlock(input.ip), input.ip, input.sequence)
    await completeAction(actionId)
    revalidateService(input.serviceId)
    return { ok: true, actionId }
  } catch (error) {
    unstable_rethrow(error)
    await markFailed(actionId, error)
    return failure(error)
  }
}

// ─── our own record ──────────────────────────────────────────────────────────

const renameSchema = z.object({
  serviceId: z.string().min(1),
  displayName: z.string().trim().min(2).max(80),
})

/**
 * The display name is ours only: it is never pushed to OVH, so there is no task and no
 * status gate beyond the service still existing.
 */
export async function renameServer(input: {
  serviceId: string
  displayName: string
}): Promise<ActionResult> {
  try {
    const parsed = renameSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, message: "El nombre debe tener entre 2 y 80 caracteres." }
    }

    const session = await requireUser()
    if (!session.customer) throw new DomainError("not_verified")
    const service = await getServiceForCustomer(parsed.data.serviceId, session.customer.id)
    if (!service) throw new DomainError("service_not_found")

    await auditService(session, service, "rename", {
      from: service.name,
      to: parsed.data.displayName,
    })
    await renameService(service.id, parsed.data.displayName)
    revalidateService(service.id)
    return { ok: true, actionId: null }
  } catch (error) {
    unstable_rethrow(error)
    return failure(error)
  }
}

/**
 * Auto-renew. Turning it off is how a customer cancels: the server runs until the end
 * of the paid period and is then released. It is destructive, so the UI confirms.
 */
export async function setAutoRenew(input: {
  serviceId: string
  autoRenew: boolean
}): Promise<ActionResult> {
  try {
    const session = await requireUser()
    if (!session.customer) throw new DomainError("not_verified")
    const service = await getServiceForCustomer(input.serviceId, session.customer.id)
    if (!service) throw new DomainError("service_not_found")
    if (service.status === "terminated" || service.status === "terminating") {
      throw new DomainError("action_not_allowed")
    }
    if (!service.ovhServiceName) throw new DomainError("action_not_allowed")

    await auditService(session, service, "auto_renew", {
      from: service.autoRenew,
      to: input.autoRenew,
    })

    await ovh().updateServiceInfos(service.ovhServiceName, {
      renew: {
        automatic: input.autoRenew,
        deleteAtExpiration: !input.autoRenew,
        forced: false,
      },
    })
    await setServiceAutoRenew(service.id, input.autoRenew)
    revalidateService(service.id)
    return { ok: true, actionId: null }
  } catch (error) {
    unstable_rethrow(error)
    return failure(error)
  }
}

// ─── upgrade preview ─────────────────────────────────────────────────────────

/**
 * Prorated price of moving to a bigger plan, computed from **our** prices with
 * `prorateUpgrade`. Nothing is ordered here and no OVH cost is ever involved: placing
 * the order belongs to the checkout flow.
 *
 * A downgrade is not offered at all — OVH does not support shrinking a VPS.
 */
export async function requestUpgradeQuote(input: {
  serviceId: string
  planId: string
}): Promise<UpgradeQuoteResult> {
  try {
    const { session, service } = await authorise(input.serviceId, "upgrade")

    const candidates = await listPlansAbove(service.monthlyPrice)
    const target = candidates.find((plan) => plan.id === input.planId)
    if (!target) throw new DomainError("conflict")

    const cycleEnd = service.nextDueAt
    if (!cycleEnd) throw new DomainError("conflict")
    const months = TERM_MONTHS[service.term]
    const cycleStart = new Date(cycleEnd)
    cycleStart.setMonth(cycleStart.getMonth() - months)

    const proration = prorateUpgrade({
      currentMonthlyPrice: service.monthlyPrice,
      targetMonthlyPrice: target.monthlyPrice,
      cycleStart,
      cycleEnd,
      now: new Date(),
    })

    // A quote changes nothing, so there is no `actions` row — only the audit trail.
    await auditService(session, service, "upgrade", {
      quoteFor: target.id,
      amountDue: proration.amountDue,
    })

    return {
      ok: true,
      planId: target.id,
      planName: target.name,
      monthlyPrice: target.monthlyPrice,
      amountDue: proration.amountDue,
      remainingDays: proration.remainingDays,
    }
  } catch (error) {
    unstable_rethrow(error)
    return failure(error)
  }
}
