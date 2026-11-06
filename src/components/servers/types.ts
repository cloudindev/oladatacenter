/**
 * Types shared by the Server Actions and the Client Components that call them.
 *
 * They live outside `src/server` on purpose: a `"use server"` module may only export
 * async functions, and a Client Component may not import a `server-only` module.
 */

export type ActionStatusName = "queued" | "running" | "done" | "error"

/** Every Server Action in `src/server/services/actions.ts` returns this shape. */
export type ActionResult =
  | { ok: true; actionId: string | null }
  | { ok: false; message: string }

export type ConsoleResult =
  | { ok: true; actionId: string | null; url: string }
  | { ok: false; message: string }

export type ReinstallResult =
  | {
      ok: true
      actionId: string | null
      /** Shown exactly once, only when no SSH key was chosen. */
      rootPassword: string | null
      /** True when the provider mails the password instead of us setting it. */
      passwordByEmail: boolean
    }
  | { ok: false; message: string }

export type UpgradeQuoteResult =
  | {
      ok: true
      planId: string
      planName: string
      /** Our monthly price for the target plan, cents. */
      monthlyPrice: number
      /** Prorated amount due now, cents. */
      amountDue: number
      remainingDays: number
    }
  | { ok: false; message: string }

/**
 * One OVH firewall rule. Declared here because the client list renders it, and the
 * server types re-export it so there is a single definition.
 */
export interface FirewallRuleView {
  sequence: number
  action: "permit" | "deny"
  protocol: string
  source: string
  destinationPort: string | null
  state: string
}

/**
 * Whether an IP is on the OVH network firewall, as `GET /ip/{ip}/firewall` reports it.
 * `pending` covers both `enableFirewallPending` and `disableFirewallPending`.
 */
export type FirewallActivation = "off" | "pending" | "on"

export type FirewallStatusResult =
  | { ok: true; activation: FirewallActivation }
  | { ok: false; message: string }

/** What the polling endpoint answers, i.e. the real state of the OVH task. */
export interface TaskStateView {
  actionId: string
  type: string
  status: ActionStatusName
  terminal: boolean
  /** Customer-facing error, only when `status` is `error`. */
  message: string | null
}
