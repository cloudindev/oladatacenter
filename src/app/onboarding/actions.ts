"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { taxIdRequiredFor } from "@ola/core"
import { parsePhone, taxIdMatchesCustomerKind } from "@ola/core/identity/index"
import { customers, db } from "@ola/db"
import { diffOf, recordAudit } from "@/server/audit"
import { isKnownCountry } from "@/components/auth/countries"
import { fieldText, joinCode } from "@/server/auth/form"
import { enforceRateLimit, RateLimitedError } from "@/server/auth/rate-limit"
import { ensureDeviceCookie, requestMeta, requireUser } from "@/server/auth/session"
import { otpSmsBody, smsSender } from "@/server/auth/sms"
import { issueOtp, OTP_TTL_MINUTES, verifyOtp } from "@/server/auth/tokens"
import {
  loadCustomer,
  maybeCompleteVerification,
  taxIdNotice,
  validateTaxIdWithVies,
} from "@/server/auth/verification"

/**
 * Server Actions for the onboarding wizard.
 *
 * Every one of them starts at `requireUser`, because a Server Action is reachable by a
 * direct POST and not only through the form that renders it.
 */

const billingSchema = z.object({
  kind: z.enum(["company", "individual"]),
  legalName: z.string().trim().min(2).max(200),
  // Mandatory inside the EU only; checked after parsing, once the country is known.
  taxId: z.string().trim().max(32).optional(),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().min(3).max(20),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().length(2),
})

const text = fieldText

// ─── step 2: billing details ─────────────────────────────────────────────────
/**
 * Saves the billing identity and then asks VIES about the tax id.
 *
 * `taxIdValidated` is only ever set by a `valid` answer from VIES. A timeout or an
 * outage leaves it false and the customer continues: the flag changes how much VAT we
 * charge, so guessing it is not an option.
 */
export async function saveBillingAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/onboarding?error=interno")

  const parsed = billingSchema.safeParse({
    kind: text(form, "kind"),
    legalName: text(form, "legalName"),
    taxId: text(form, "taxId") || undefined,
    addressLine1: text(form, "addressLine1"),
    addressLine2: text(form, "addressLine2") || undefined,
    postalCode: text(form, "postalCode"),
    city: text(form, "city"),
    country: text(form, "country").toUpperCase(),
  })
  if (!parsed.success) redirect("/onboarding?paso=2&error=campos")
  const data = parsed.data

  if (!isKnownCountry(data.country)) redirect("/onboarding?paso=2&error=pais_invalido")

  // Spanish identifiers are checked by checksum; other countries only by VAT shape,
  // which VIES then confirms or denies.
  const taxId = data.taxId ? data.taxId.toUpperCase() : null
  if (taxIdRequiredFor(data.country) && (taxId === null || taxId.length < 5)) {
    redirect("/onboarding?paso=2&error=nif_obligatorio")
  }
  if (data.country === "ES" && taxId !== null && !taxIdMatchesCustomerKind(taxId, data.kind)) {
    redirect("/onboarding?paso=2&error=nif_tipo")
  }

  const before = {
    kind: customer.kind,
    legalName: customer.legalName,
    taxId: customer.taxId,
    addressLine1: customer.addressLine1,
    city: customer.city,
    postalCode: customer.postalCode,
    country: customer.country,
  }

  await db()
    .update(customers)
    .set({
      kind: data.kind,
      legalName: data.legalName,
      taxId,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 ?? null,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      // A changed tax id has to be validated again from scratch.
      taxIdValidated: false,
      taxIdValidatedAt: null,
    })
    .where(eq(customers.id, customer.id))

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "customer",
    entityId: customer.id,
    action: "billing_details_updated",
    diff: diffOf(before, { ...data, taxId }),
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  // No tax id (allowed outside the EU): nothing for VIES to check.
  const outcome =
    taxId === null
      ? "not_applicable"
      : await validateTaxIdWithVies({
          customerId: customer.id,
          actorId: session.user.id,
          kind: data.kind,
          country: data.country,
          taxId,
        })

  await ensureDeviceCookie()
  await maybeCompleteVerification(session.user.id)
  redirect(`/onboarding?ok=${taxIdNotice(outcome)}`)
}

// ─── step 3: phone ───────────────────────────────────────────────────────────
export async function sendPhoneOtpAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/onboarding?error=interno")

  const phone = parsePhone(text(form, "telefono"))
  if (!phone) redirect("/onboarding?paso=3&error=telefono_invalido")

  try {
    enforceRateLimit("otpSend", `${session.user.id}:${phone}`)
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/onboarding?paso=3&error=limite")
    throw error
  }

  await db()
    .update(customers)
    .set({ phone, phoneVerifiedAt: null })
    .where(eq(customers.id, customer.id))

  const { code } = await issueOtp({ userId: session.user.id, target: phone })
  try {
    await smsSender().send({ to: phone, body: otpSmsBody(code, OTP_TTL_MINUTES) })
  } catch (error) {
    console.error("[onboarding] sms failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    redirect("/onboarding?paso=3&error=interno")
  }

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "customer",
    entityId: customer.id,
    action: "phone_otp_sent",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  redirect("/onboarding?paso=3&ok=codigo_enviado")
}

/**
 * Step 3 while `REQUIRE_PHONE_VERIFICATION` is off: the phone is stored as a contact
 * detail, without an SMS code. It stays unverified, so it does not unlock the welcome
 * credit; turning the flag on brings the code back for everyone not yet verified.
 */
export async function savePhoneContactAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/onboarding?error=interno")

  const phone = parsePhone(text(form, "telefono"))
  if (!phone) redirect("/onboarding?paso=3&error=telefono_invalido")

  if (phone !== customer.phone) {
    await db()
      .update(customers)
      .set({ phone, phoneVerifiedAt: null })
      .where(eq(customers.id, customer.id))
    await recordAudit({
      actorId: session.user.id,
      actorType: "user",
      entity: "customer",
      entityId: customer.id,
      action: "phone_contact_saved",
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  await ensureDeviceCookie()
  const completion = await maybeCompleteVerification(session.user.id)
  redirect(completion.verified ? `/onboarding?ok=${noticeFor(completion)}` : "/onboarding?ok=telefono_guardado")
}

export async function verifyPhoneOtpAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/onboarding?error=interno")

  const code = joinCode(form)

  try {
    enforceRateLimit("otpVerify", session.user.id)
  } catch (error) {
    if (error instanceof RateLimitedError) redirect("/onboarding?paso=3&error=limite")
    throw error
  }

  const result = await verifyOtp({ userId: session.user.id, code })
  if (!result.ok) {
    const map: Record<string, string> = {
      not_found: "codigo_caducado",
      expired: "codigo_caducado",
      already_used: "codigo_caducado",
      too_many_attempts: "codigo_intentos",
      mismatch: "codigo_invalido",
    }
    redirect(`/onboarding?paso=3&error=${map[result.reason] ?? "codigo_invalido"}`)
  }

  await db()
    .update(customers)
    .set({ phoneVerifiedAt: new Date() })
    .where(eq(customers.id, customer.id))

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "customer",
    entityId: customer.id,
    action: "phone_verified",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  await ensureDeviceCookie()
  const completion = await maybeCompleteVerification(session.user.id)
  redirect(`/onboarding?ok=${noticeFor(completion)}`)
}

// ─── step 4: card ────────────────────────────────────────────────────────────
/**
 * Re-reads the card state after the customer comes back from the billing module and
 * closes the wizard when the four steps are done. The card itself is never touched
 * here: Stripe belongs to the billing module.
 */
export async function refreshVerificationAction(): Promise<never> {
  const session = await requireUser()
  await ensureDeviceCookie()
  const completion = await maybeCompleteVerification(session.user.id)
  if (!completion.verified) redirect("/onboarding?error=no_verificado")
  redirect(`/onboarding?ok=${noticeFor(completion)}`)
}

function noticeFor(completion: {
  verified: boolean
  credit: { granted: boolean } | null
}): string {
  if (!completion.verified) return "telefono_verificado"
  if (completion.credit?.granted) return "credito_concedido"
  return "cuenta_verificada"
}
