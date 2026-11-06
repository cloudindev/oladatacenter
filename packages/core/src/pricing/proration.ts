import { type Cents } from "../money"

export const MS_PER_DAY = 24 * 60 * 60 * 1000

export class ProrationError extends Error {}

/** Whole days remaining between two instants, never negative. */
export function daysBetween(from: Date, to: Date): number {
  const diff = to.getTime() - from.getTime()
  if (diff <= 0) return 0
  return Math.ceil(diff / MS_PER_DAY)
}

export interface ProrationInput {
  /** Monthly price of the plan the customer has today. */
  currentMonthlyPrice: Cents
  /** Monthly price of the plan they are moving to. */
  targetMonthlyPrice: Cents
  /** Start of the cycle already paid for. */
  cycleStart: Date
  /** End of the cycle already paid for (next_due_at). */
  cycleEnd: Date
  /** When the upgrade happens. */
  now: Date
}

export interface ProrationResult {
  /** Days left in the paid cycle. */
  remainingDays: number
  /** Total days in the cycle. */
  cycleDays: number
  /** Unused value of the current plan. */
  unusedCredit: Cents
  /** Value of the new plan for the remaining days. */
  remainingCharge: Cents
  /** What to charge now. Never negative: a cheaper target yields 0, not a refund. */
  amountDue: Cents
}

/**
 * Prorated charge for an upgrade in the middle of a paid cycle.
 *
 * Downgrades are not offered (OVH does not support them), so a target cheaper than the
 * current plan yields `amountDue = 0` rather than a refund.
 */
export function prorateUpgrade(input: ProrationInput): ProrationResult {
  const { currentMonthlyPrice, targetMonthlyPrice, cycleStart, cycleEnd, now } = input
  if (cycleEnd.getTime() <= cycleStart.getTime()) {
    throw new ProrationError("cycleEnd must be after cycleStart")
  }
  const cycleDays = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / MS_PER_DAY)
  const remainingDays = Math.min(daysBetween(now, cycleEnd), cycleDays)
  if (cycleDays === 0) throw new ProrationError("cycle must span at least one day")

  const monthsInCycle = cycleDays / 30
  const dailyCurrent = (currentMonthlyPrice * monthsInCycle) / cycleDays
  const dailyTarget = (targetMonthlyPrice * monthsInCycle) / cycleDays

  const unusedCredit = Math.round(dailyCurrent * remainingDays)
  const remainingCharge = Math.round(dailyTarget * remainingDays)

  return {
    remainingDays,
    cycleDays,
    unusedCredit,
    remainingCharge,
    amountDue: Math.max(0, remainingCharge - unusedCredit),
  }
}

/** Prorated charge for adding an addon mid-cycle. Always a charge, never a credit. */
export function prorateAddon(
  monthlyPrice: Cents,
  cycleStart: Date,
  cycleEnd: Date,
  now: Date,
): ProrationResult {
  return prorateUpgrade({
    currentMonthlyPrice: 0,
    targetMonthlyPrice: monthlyPrice,
    cycleStart,
    cycleEnd,
    now,
  })
}
