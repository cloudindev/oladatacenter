import { z } from "zod"
import { MS_PER_DAY } from "../pricing/proration.js"

/**
 * Renewal and dunning calendar, relative to `next_due_at` (T).
 *
 *   T-7  invoice issued in WHMCS + email
 *   T-0  off-session charge
 *   T+1  retry 1 + warning email
 *   T+3  retry 2; if it fails the server is STOPPED (suspended)
 *   T+10 marked at OVH for non-renewal and deletion at expiry (terminating)
 *
 * Paying at any point before T+10 reactivates the server immediately.
 */
export const INVOICE_LEAD_DAYS = 7
export const RETRY_DAYS = [1, 3] as const
export const SUSPEND_DAY = 3
export const TERMINATE_DAY = 10

export const DUNNING_STAGES = [
  "scheduled",
  "invoiced",
  "charging",
  "retry_1",
  "retry_2",
  "suspended",
  "terminating",
  "paid",
] as const
export type DunningStage = (typeof DUNNING_STAGES)[number]
export const dunningStageSchema = z.enum(DUNNING_STAGES)

export interface DunningStep {
  stage: DunningStage
  at: Date
  /** What the job must do when it fires. */
  action: "issue_invoice" | "charge" | "retry_charge" | "suspend" | "terminate"
  /** Email template to send, if any. */
  email: "renewal_upcoming" | "payment_failed" | "service_suspended" | "service_terminating" | null
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

/** Full calendar for one renewal cycle, in chronological order. */
export function dunningSchedule(dueAt: Date): readonly DunningStep[] {
  return [
    {
      stage: "invoiced",
      at: addDays(dueAt, -INVOICE_LEAD_DAYS),
      action: "issue_invoice",
      email: "renewal_upcoming",
    },
    { stage: "charging", at: dueAt, action: "charge", email: null },
    {
      stage: "retry_1",
      at: addDays(dueAt, RETRY_DAYS[0]),
      action: "retry_charge",
      email: "payment_failed",
    },
    {
      stage: "retry_2",
      at: addDays(dueAt, RETRY_DAYS[1]),
      action: "retry_charge",
      email: "payment_failed",
    },
    {
      stage: "suspended",
      at: addDays(dueAt, SUSPEND_DAY),
      action: "suspend",
      email: "service_suspended",
    },
    {
      stage: "terminating",
      at: addDays(dueAt, TERMINATE_DAY),
      action: "terminate",
      email: "service_terminating",
    },
  ]
}

/** The step that should have fired by `now` and has not been done yet. */
export function pendingStep(
  dueAt: Date,
  now: Date,
  completed: readonly DunningStage[],
): DunningStep | null {
  const done = new Set(completed)
  return (
    dunningSchedule(dueAt).find(
      (step) => !done.has(step.stage) && step.at.getTime() <= now.getTime(),
    ) ?? null
  )
}

/** Next due date after a successful renewal. */
export function nextDueDate(currentDueAt: Date, months: number): Date {
  const next = new Date(currentDueAt.getTime())
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

/** A suspended service can still be saved; a terminating one cannot. */
export function canReactivate(stage: DunningStage): boolean {
  return stage !== "terminating"
}
