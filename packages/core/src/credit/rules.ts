import { z } from "zod"
import { type Cents } from "../money.js"
import { MS_PER_DAY } from "../pricing/proration.js"

export const WELCOME_CREDIT_CENTS = 1000
export const WELCOME_CREDIT_DAYS = 30

/** Window in which a repeated fraud signal blocks a second welcome credit. */
export const FRAUD_LOOKBACK_DAYS = 90

export const CREDIT_REASONS = ["welcome", "manual", "refund"] as const
export type CreditReason = (typeof CREDIT_REASONS)[number]
export const creditReasonSchema = z.enum(CREDIT_REASONS)

export interface CreditEntry {
  amount: Cents
  reason: CreditReason
  expiresAt: Date | null
  consumed: Cents
}

/** Credit still usable at `now`: granted minus consumed, ignoring expired entries. */
export function availableCredit(entries: readonly CreditEntry[], now: Date): Cents {
  return entries.reduce((total, entry) => {
    if (entry.expiresAt && entry.expiresAt.getTime() <= now.getTime()) return total
    return total + Math.max(0, entry.amount - entry.consumed)
  }, 0)
}

export function expiringSoon(
  entries: readonly CreditEntry[],
  now: Date,
  withinDays = 7,
): readonly CreditEntry[] {
  const limit = now.getTime() + withinDays * MS_PER_DAY
  return entries.filter(
    (entry) =>
      entry.expiresAt !== null &&
      entry.expiresAt.getTime() > now.getTime() &&
      entry.expiresAt.getTime() <= limit &&
      entry.amount - entry.consumed > 0,
  )
}

/** Account state that decides whether the welcome credit may be granted. */
export interface VerificationState {
  emailVerifiedAt: Date | null
  phoneVerifiedAt: Date | null
  hasVerifiedCard: boolean
  billingComplete: boolean
}

export function isAccountVerified(state: VerificationState): boolean {
  return (
    state.emailVerifiedAt !== null &&
    state.phoneVerifiedAt !== null &&
    state.hasVerifiedCard &&
    state.billingComplete
  )
}

/** Signals that must be unique per person for a welcome credit. */
export interface FraudSignals {
  cardFingerprint: string | null
  phoneNumber: string | null
  deviceFingerprint: string | null
  ipAddress: string | null
}

export interface PriorGrant {
  grantedAt: Date
  signals: FraudSignals
}

export type CreditDecision =
  | { granted: true; amount: Cents; expiresAt: Date }
  | { granted: false; reason: "not_verified" | "already_granted" | "duplicate_signal" }

/**
 * One welcome credit per person. A match on card, phone, device or IP within the
 * look-back window counts as the same person.
 */
export function decideWelcomeCredit(input: {
  verification: VerificationState
  signals: FraudSignals
  priorGrantsForCustomer: number
  priorGrants: readonly PriorGrant[]
  now: Date
  amount?: Cents
  validDays?: number
}): CreditDecision {
  const {
    verification,
    signals,
    priorGrantsForCustomer,
    priorGrants,
    now,
    amount = WELCOME_CREDIT_CENTS,
    validDays = WELCOME_CREDIT_DAYS,
  } = input

  if (!isAccountVerified(verification)) return { granted: false, reason: "not_verified" }
  if (priorGrantsForCustomer > 0) return { granted: false, reason: "already_granted" }

  const cutoff = now.getTime() - FRAUD_LOOKBACK_DAYS * MS_PER_DAY
  const duplicate = priorGrants.some((grant) => {
    if (grant.grantedAt.getTime() < cutoff) return false
    return matchesAnySignal(grant.signals, signals)
  })
  if (duplicate) return { granted: false, reason: "duplicate_signal" }

  return {
    granted: true,
    amount,
    expiresAt: new Date(now.getTime() + validDays * MS_PER_DAY),
  }
}

function matchesAnySignal(a: FraudSignals, b: FraudSignals): boolean {
  const keys = ["cardFingerprint", "phoneNumber", "deviceFingerprint", "ipAddress"] as const
  return keys.some((key) => a[key] !== null && b[key] !== null && a[key] === b[key])
}

/** Limits that apply until the customer has made a real (non-credit) payment. */
export interface TrialLimits {
  maxServices: number
  allowedPlanCodes: readonly string[]
  allowAdditionalDisk: boolean
  blockSmtpPort: boolean
}

export const TRIAL_LIMITS: TrialLimits = {
  maxServices: 1,
  allowedPlanCodes: ["vps-2027-model1"],
  allowAdditionalDisk: false,
  blockSmtpPort: true,
}

export type TrialCheck = { allowed: true } | { allowed: false; reason: string }

export function checkTrialLimits(input: {
  hasPaidRealMoney: boolean
  currentServiceCount: number
  planCode: string
  addonFamilies: readonly string[]
  limits?: TrialLimits
}): TrialCheck {
  const limits = input.limits ?? TRIAL_LIMITS
  if (input.hasPaidRealMoney) return { allowed: true }

  if (input.currentServiceCount >= limits.maxServices) {
    return {
      allowed: false,
      reason: `Hasta tu primer pago solo puedes tener ${limits.maxServices} servidor.`,
    }
  }
  if (!limits.allowedPlanCodes.includes(input.planCode)) {
    return {
      allowed: false,
      reason: "Hasta tu primer pago solo puedes contratar el plan de entrada.",
    }
  }
  if (!limits.allowAdditionalDisk && input.addonFamilies.includes("additionalDisk")) {
    return {
      allowed: false,
      reason: "El disco adicional no está disponible hasta tu primer pago.",
    }
  }
  return { allowed: true }
}
