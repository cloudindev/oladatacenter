import {
  DomainError,
  FRAUD_LOOKBACK_DAYS,
  WELCOME_CREDIT_CENTS,
  WELCOME_CREDIT_DAYS,
  availableCredit,
  decideWelcomeCredit,
  expiringSoon,
  type Cents,
  type CreditDecision,
  type CreditEntry,
  type FraudSignals,
  type PriorGrant,
} from "@ola/core"

import { resolveDeps } from "./deps"
import type { CreditRecord } from "./data"
import type { BillingDepsOverride } from "./ports"

/**
 * Promotional credit.
 *
 * Credit is a **discount**, never money: `checkoutTotals` applies it to the net amount
 * before VAT and never lets it produce a negative charge, and an order it fully covers is
 * invoiced with the credit as a discount line rather than as a separate credit invoice.
 * None of that arithmetic lives here — it is all `@ola/core`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** `CreditRecord` carries everything `availableCredit` needs; this just narrows it. */
function toEntries(records: readonly CreditRecord[]): CreditEntry[] {
  return records.map((record) => ({
    amount: record.amount,
    reason: record.reason,
    expiresAt: record.expiresAt,
    consumed: record.consumed,
  }))
}

/**
 * FIXED CONTRACT (`docs/architecture.md`): credit still usable right now, in integer cents.
 * Expired entries and already-consumed amounts are excluded.
 */
export async function customerCredit(
  customerId: string,
  override: BillingDepsOverride = {},
): Promise<number> {
  const deps = await resolveDeps(override)
  const records = await deps.store.listCredits(customerId)
  return availableCredit(toEntries(records), deps.now())
}

export interface CreditSummary {
  /** Usable right now, in cents. */
  balance: Cents
  /** Earliest expiry among the entries that still have a balance. */
  expiresAt: Date | null
  /** Amount that expires within `withinDays`. Zero when nothing does. */
  expiringAmount: Cents
  expiringAt: Date | null
  /** True when some of the balance disappears within the window. */
  expiringSoon: boolean
  entries: readonly CreditRecord[]
}

/** Everything the billing page shows about credit, in one read. */
export async function creditSummary(
  customerId: string,
  override: BillingDepsOverride = {},
  withinDays = 7,
): Promise<CreditSummary> {
  const deps = await resolveDeps(override)
  const now = deps.now()
  const records = await deps.store.listCredits(customerId)
  const entries = toEntries(records)

  const balance = availableCredit(entries, now)
  const soon = expiringSoon(entries, now, withinDays)
  const expiringAmount = soon.reduce((total, entry) => total + (entry.amount - entry.consumed), 0)

  const live = records.filter(
    (record) =>
      record.amount - record.consumed > 0 &&
      (record.expiresAt === null || record.expiresAt.getTime() > now.getTime()),
  )
  const expiries = live
    .map((record) => record.expiresAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  const soonExpiries = soon
    .map((entry) => entry.expiresAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  return {
    balance,
    expiresAt: expiries[0] ?? null,
    expiringAmount,
    expiringAt: soonExpiries[0] ?? null,
    expiringSoon: expiringAmount > 0,
    entries: records,
  }
}

/**
 * Spends `amount` cents of credit on one order.
 *
 * Writes the consumption against the individual entries, oldest expiry first, in a way that
 * two concurrent orders cannot both spend: the store updates each row conditionally on the
 * `consumed` value it was read with. Returns what was actually taken, which may be less than
 * asked for when a parallel order got there first — the caller must re-price in that case.
 */
export async function consumeCredit(
  customerId: string,
  cents: Cents,
  orderId: string,
  override: BillingDepsOverride = {},
): Promise<Cents> {
  if (!Number.isInteger(cents)) {
    throw new DomainError("internal", { detail: `credit must be integer cents: ${cents}` })
  }
  if (cents < 0) {
    throw new DomainError("internal", { detail: "cannot consume a negative amount of credit" })
  }
  if (cents === 0) return 0

  const deps = await resolveDeps(override)
  const taken = await deps.store.consumeCredit(customerId, cents, orderId)

  await deps.audit.record({
    actorType: "system",
    entity: "credit",
    entityId: customerId,
    action: "credit_consumed",
    diff: { requested: cents, taken, orderId },
  })

  return taken
}

export interface WelcomeCreditResult {
  decision: CreditDecision
  credit: CreditRecord | null
}

/**
 * Grants the welcome credit, once per person.
 *
 * `decideWelcomeCredit` owns the rule: the account must be fully verified, and a match on
 * card fingerprint, phone, device or IP against any grant in the look-back window counts as
 * the same person. Idempotent — a second call sees the first grant and returns
 * `already_granted` without writing anything.
 */
export async function grantWelcomeCredit(
  customerId: string,
  signals: FraudSignals,
  override: BillingDepsOverride = {},
  options: { amount?: Cents; validDays?: number } = {},
): Promise<WelcomeCreditResult> {
  const deps = await resolveDeps(override)
  const now = deps.now()

  const customer = await deps.store.getCustomer(customerId)
  if (!customer) throw new DomainError("internal", { detail: `unknown customer ${customerId}` })

  const methods = await deps.store.listPaymentMethods(customerId)
  const priorGrantsForCustomer = await deps.store.countCreditsByReason(customerId, "welcome")
  const since = new Date(now.getTime() - FRAUD_LOOKBACK_DAYS * MS_PER_DAY)
  const grants = await deps.store.listWelcomeGrants(since)

  const priorGrants: PriorGrant[] = grants
    .filter((grant) => grant.customerId !== customerId)
    .map((grant) => ({ grantedAt: grant.grantedAt, signals: toSignals(grant.signals) }))

  const decision = decideWelcomeCredit({
    verification: {
      emailVerifiedAt: customer.emailVerifiedAt,
      phoneVerifiedAt: customer.phoneVerifiedAt,
      hasVerifiedCard: methods.some(
        (method) => method.verifiedAt !== null && method.detachedAt === null,
      ),
      billingComplete: customer.billingComplete,
    },
    signals,
    priorGrantsForCustomer,
    priorGrants,
    now,
    amount: options.amount ?? WELCOME_CREDIT_CENTS,
    validDays: options.validDays ?? WELCOME_CREDIT_DAYS,
  })

  if (!decision.granted) {
    await deps.audit.record({
      actorType: "system",
      entity: "credit",
      entityId: customerId,
      action: "welcome_credit_refused",
      diff: { reason: decision.reason },
    })
    return { decision, credit: null }
  }

  const credit = await deps.store.insertCredit({
    customerId,
    amount: decision.amount,
    reason: "welcome",
    note: "Crédito de bienvenida",
    expiresAt: decision.expiresAt,
    signals: { ...signals },
  })

  await deps.audit.record({
    actorType: "system",
    entity: "credit",
    entityId: credit.id,
    action: "welcome_credit_granted",
    diff: { amount: credit.amount, expiresAt: credit.expiresAt?.toISOString() ?? null },
  })

  return { decision, credit }
}

/** Stored signals come back as a loose record; narrow them to the domain shape. */
function toSignals(stored: Record<string, string | null> | null): FraudSignals {
  return {
    cardFingerprint: stored?.cardFingerprint ?? null,
    phoneNumber: stored?.phoneNumber ?? null,
    deviceFingerprint: stored?.deviceFingerprint ?? null,
    ipAddress: stored?.ipAddress ?? null,
  }
}
