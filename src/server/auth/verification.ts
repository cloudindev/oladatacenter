import "server-only"
import { eq } from "drizzle-orm"
import {
  type FraudSignals,
  isAccountVerified,
  isPhoneStepDone,
  taxIdRequiredFor,
  type VerificationState,
} from "@ola/core"
import { env } from "@/lib/env"
import { customers, db, services, users } from "@ola/db"
import { grantWelcomeCredit, listPaymentMethods } from "@/server/billing"
import { recordAudit } from "@/server/audit"
import { absoluteUrl, baseEmailProps, sendTemplateEmail } from "./mailer"
import { enforceRateLimit, RateLimitedError } from "./rate-limit"
import { readDeviceFingerprint, requestMeta } from "./session"
import { checkVies, viesAppliesTo } from "./vies"

/**
 * The four-step verification gate, and the hand-off to billing for the credit that
 * follows it.
 *
 * `isAccountVerified` in `@ola/core` owns the gate. The welcome credit has exactly one
 * implementation, `grantWelcomeCredit` in `src/server/billing` — it is idempotent, it is
 * tested, and it belongs to the half that persists `payment_methods.fingerprint`, the
 * strongest of the four fraud signals. This module gathers the signals billing cannot
 * see from a request (phone, device cookie, IP), calls it, and audits the outcome from
 * the onboarding side.
 */

export interface CustomerRow {
  id: string
  kind: "company" | "individual"
  legalName: string | null
  taxId: string | null
  taxIdValidated: boolean
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  phoneVerifiedAt: Date | null
  status: string
  stripeCustomerId: string | null
}

export interface VerificationSnapshot {
  userId: string
  email: string
  emailVerifiedAt: Date | null
  customer: CustomerRow | null
  hasVerifiedCard: boolean
  /** Step completion, in wizard order. */
  steps: { email: boolean; billing: boolean; phone: boolean; card: boolean }
  state: VerificationState
  complete: boolean
  /** False while there is no SMS provider: the phone step only asks for a contact number. */
  phoneCodeRequired: boolean
}

/** Billing details are complete when an invoice could legally be issued. */
export function isBillingComplete(customer: CustomerRow | null): boolean {
  if (!customer) return false
  const taxIdOk = Boolean(customer.taxId) || !taxIdRequiredFor(customer.country)
  return Boolean(
    customer.legalName &&
      taxIdOk &&
      customer.addressLine1 &&
      customer.city &&
      customer.postalCode &&
      customer.country,
  )
}

const CUSTOMER_COLUMNS = {
  id: customers.id,
  kind: customers.kind,
  legalName: customers.legalName,
  taxId: customers.taxId,
  taxIdValidated: customers.taxIdValidated,
  addressLine1: customers.addressLine1,
  addressLine2: customers.addressLine2,
  city: customers.city,
  postalCode: customers.postalCode,
  country: customers.country,
  phone: customers.phone,
  phoneVerifiedAt: customers.phoneVerifiedAt,
  status: customers.status,
  stripeCustomerId: customers.stripeCustomerId,
} as const

export async function loadCustomer(userId: string): Promise<CustomerRow | null> {
  const rows = await db()
    .select(CUSTOMER_COLUMNS)
    .from(customers)
    .where(eq(customers.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

/** Everything the onboarding wizard and the account area need to decide what is left. */
export async function verificationSnapshot(userId: string): Promise<VerificationSnapshot> {
  const userRows = await db()
    .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const user = userRows[0]
  const customer = await loadCustomer(userId)
  const cardOk = customer ? await customerHasVerifiedCard(customer.id) : false

  const policy = { requirePhoneCode: env().REQUIRE_PHONE_VERIFICATION }
  const state: VerificationState = {
    emailVerifiedAt: user?.emailVerifiedAt ?? null,
    phoneVerifiedAt: customer?.phoneVerifiedAt ?? null,
    phoneOnFile: Boolean(customer?.phone),
    hasVerifiedCard: cardOk,
    billingComplete: isBillingComplete(customer),
  }

  return {
    userId,
    email: user?.email ?? "",
    emailVerifiedAt: state.emailVerifiedAt,
    customer,
    hasVerifiedCard: cardOk,
    steps: {
      email: state.emailVerifiedAt !== null,
      billing: state.billingComplete,
      phone: isPhoneStepDone(state, policy),
      card: cardOk,
    },
    state,
    complete: isAccountVerified(state, policy),
    phoneCodeRequired: policy.requirePhoneCode,
  }
}

/**
 * A card counts only once the billing module has confirmed it and while it is still
 * attached. Read through billing's own API, so the card tables have one reader.
 */
export async function customerHasVerifiedCard(customerId: string): Promise<boolean> {
  const methods = await listPaymentMethods(customerId)
  return methods.some((method) => method.verifiedAt !== null && method.detachedAt === null)
}

/** Fingerprint of the usable card, the strongest of the four fraud signals. */
async function cardFingerprintOf(customerId: string): Promise<string | null> {
  const methods = await listPaymentMethods(customerId)
  const usable = methods.find(
    (method) => method.verifiedAt !== null && method.detachedAt === null,
  )
  return usable?.fingerprint ?? null
}

export type WelcomeCreditOutcome =
  | { granted: true; amount: number; expiresAt: Date }
  | { granted: false; reason: "not_verified" | "already_granted" | "duplicate_signal" }

export interface CompletionResult {
  verified: boolean
  credit: WelcomeCreditOutcome | null
}

/**
 * Called after every onboarding step. Once the four are done it flips
 * `customers.status` to `verified` and hands the credit decision to billing.
 *
 * It stays safe to call repeatedly: the status write is guarded, and billing's
 * `grantWelcomeCredit` is idempotent — a second call sees the first grant and answers
 * `already_granted` without writing anything.
 */
export async function maybeCompleteVerification(userId: string): Promise<CompletionResult> {
  const snapshot = await verificationSnapshot(userId)
  if (!snapshot.customer) return { verified: false, credit: null }
  if (!snapshot.complete) return { verified: false, credit: null }

  const customer = snapshot.customer
  const customerId = customer.id

  if (customer.status === "unverified") {
    await db().update(customers).set({ status: "verified" }).where(eq(customers.id, customerId))
    await recordAudit({
      actorId: userId,
      actorType: "user",
      entity: "customer",
      entityId: customerId,
      action: "customer_verified",
      diff: { status: { from: customer.status, to: "verified" } },
    })
  }

  const credit = await requestWelcomeCredit({
    userId,
    customerId,
    email: snapshot.email,
    legalName: customer.legalName,
    phone: customer.phone,
  })

  return { verified: true, credit }
}

/**
 * Collects the signals only a live request can see and lets billing decide.
 *
 * The card fingerprint comes from billing's own `listPaymentMethods`; the phone, the
 * device cookie and the IP are gathered here because billing has no request context.
 * The audit rows written here are the onboarding-side view (customer entity, real actor,
 * client IP); billing writes its own on the credit entity.
 */
async function requestWelcomeCredit(input: {
  userId: string
  customerId: string
  email: string
  legalName: string | null
  phone: string | null
}): Promise<WelcomeCreditOutcome> {
  const meta = await requestMeta()

  const signals: FraudSignals = {
    cardFingerprint: await cardFingerprintOf(input.customerId),
    phoneNumber: input.phone,
    deviceFingerprint: await readDeviceFingerprint(),
    ipAddress: meta.ip,
  }

  const { decision } = await grantWelcomeCredit(input.customerId, signals)

  if (!decision.granted) {
    // `already_granted` is the ordinary repeat call and not worth a row; the other two
    // are what an antifraud review needs to see.
    if (decision.reason !== "already_granted") {
      await recordAudit({
        actorId: input.userId,
        actorType: "system",
        entity: "customer",
        entityId: input.customerId,
        action: "welcome_credit_denied",
        diff: { reason: decision.reason },
        ip: meta.ip,
      })
    }
    return { granted: false, reason: decision.reason }
  }

  await recordAudit({
    actorId: input.userId,
    actorType: "system",
    entity: "customer",
    entityId: input.customerId,
    action: "welcome_credit_granted",
    diff: { amount: decision.amount, expiresAt: decision.expiresAt.toISOString() },
    ip: meta.ip,
  })

  await sendTemplateEmail(
    input.email,
    "account-verified",
    {
      ...baseEmailProps(input.legalName),
      creditCents: decision.amount,
      creditExpiresAt: decision.expiresAt,
      shopUrl: absoluteUrl("/vps"),
    },
    { customerId: input.customerId },
  )

  return { granted: true, amount: decision.amount, expiresAt: decision.expiresAt }
}

// ─── tax id validation ───────────────────────────────────────────────────────
export type TaxIdOutcome = "not_applicable" | "valid" | "invalid" | "unavailable"

/**
 * Asks VIES about a customer's tax id and writes the flag.
 *
 * Deliberately not a Server Action: it takes a `customerId`, and a Server Action is a
 * public endpoint. The wizard and the account area call it from their own actions, after
 * they have checked who is asking.
 *
 * `taxIdValidated` is only ever set by a `valid` answer. Anything else leaves it false,
 * because that flag decides reverse charge and therefore how much VAT we collect.
 */
export async function validateTaxIdWithVies(input: {
  customerId: string
  actorId: string
  kind: "company" | "individual"
  country: string
  taxId: string
}): Promise<TaxIdOutcome> {
  if (!viesAppliesTo(input.kind, input.country)) return "not_applicable"

  try {
    enforceRateLimit("viesCheck", input.customerId)
  } catch (error) {
    if (error instanceof RateLimitedError) return "unavailable"
    throw error
  }

  const result = await checkVies(input.country, input.taxId)

  if (result.status === "valid") {
    await db()
      .update(customers)
      .set({ taxIdValidated: true, taxIdValidatedAt: result.checkedAt })
      .where(eq(customers.id, input.customerId))
    await recordAudit({
      actorId: input.actorId,
      actorType: "system",
      entity: "customer",
      entityId: input.customerId,
      action: "tax_id_validated",
      diff: { queried: result.queried, name: result.name },
    })
    return "valid"
  }

  await recordAudit({
    actorId: input.actorId,
    actorType: "system",
    entity: "customer",
    entityId: input.customerId,
    action: "tax_id_not_validated",
    diff: { queried: result.queried, status: result.status, detail: result.detail ?? null },
  })
  return result.status === "unavailable" ? "unavailable" : "invalid"
}

/** Notice code for the UI after a validation attempt. */
export function taxIdNotice(outcome: TaxIdOutcome): string {
  switch (outcome) {
    case "valid":
      return "nif_validado"
    case "invalid":
      return "nif_no_encontrado"
    case "unavailable":
      return "nif_sin_validar"
    default:
      return "datos_guardados"
  }
}

/** Services that block closing an account. Terminated ones do not count. */
export async function activeServiceCount(customerId: string): Promise<number> {
  const rows = await db()
    .select({ id: services.id, status: services.status })
    .from(services)
    .where(eq(services.customerId, customerId))
  return rows.filter((row) => row.status !== "terminated").length
}
