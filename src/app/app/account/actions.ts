"use server"

import { redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { taxIdMatchesCustomerKind } from "@ola/core/identity/index"
import { customers, db, sshKeys, users } from "@ola/db"
import { diffOf, recordAudit } from "@/server/audit"
import { fieldRaw, fieldText, joinCode } from "@/server/auth/form"
import { isKnownCountry } from "@/components/auth/countries"
import { normalizeSshKey, sshKeyFingerprint } from "@/lib/crypto"
import {
  assertStrongPassword,
  hashPassword,
  verifyPassword,
  WeakPasswordError,
} from "@/server/auth/password"
import {
  destroyAllSessions,
  destroySession,
  requestMeta,
  requireUser,
} from "@/server/auth/session"
import {
  beginTotpEnrolment,
  clearEnrolmentSecret,
  generateRecoveryCodes,
  readEnrolmentSecret,
  storeEnrolmentSecret,
  storeFreshRecoveryCodes,
  verifySecondFactor,
  verifyTotp,
} from "@/server/auth/totp"
import { invalidateTokens, TOKEN_PURPOSES } from "@/server/auth/tokens"
import {
  activeServiceCount,
  loadCustomer,
  maybeCompleteVerification,
  taxIdNotice,
  validateTaxIdWithVies,
} from "@/server/auth/verification"

/**
 * Server Actions for the account area. Each one re-reads the session: a Server Action is
 * reachable by a direct POST, so the form that rendered it proves nothing.
 *
 * Every security-relevant branch writes one audit row, and nothing here ever returns a
 * hash, a secret or a token to the caller.
 */

const SECURITY = "/app/account/seguridad"
const KEYS = "/app/account/claves-ssh"
const CLOSE = "/app/account/cerrar-cuenta"
const CLOSE_PHRASE = "CERRAR CUENTA"

const text = fieldText
const raw = fieldRaw

// ─── billing details ─────────────────────────────────────────────────────────
const billingSchema = z.object({
  kind: z.enum(["company", "individual"]),
  legalName: z.string().trim().min(2).max(200),
  taxId: z.string().trim().min(5).max(32),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().min(3).max(20),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().length(2),
})

/** Saves the billing identity and re-runs the VIES check, as the tax id may have changed. */
export async function updateBillingAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/login")

  const parsed = billingSchema.safeParse({
    kind: text(form, "kind"),
    legalName: text(form, "legalName"),
    taxId: text(form, "taxId"),
    addressLine1: text(form, "addressLine1"),
    addressLine2: text(form, "addressLine2") || undefined,
    postalCode: text(form, "postalCode"),
    city: text(form, "city"),
    country: text(form, "country").toUpperCase(),
  })
  if (!parsed.success) redirect("/app/account?error=campos")
  const data = parsed.data

  if (!isKnownCountry(data.country)) redirect("/app/account?error=pais_invalido")
  if (data.country === "ES" && !taxIdMatchesCustomerKind(data.taxId, data.kind)) {
    redirect("/app/account?error=nif_tipo")
  }

  const before = {
    kind: customer.kind,
    legalName: customer.legalName,
    taxId: customer.taxId,
    addressLine1: customer.addressLine1,
    addressLine2: customer.addressLine2,
    postalCode: customer.postalCode,
    city: customer.city,
    country: customer.country,
  }
  const taxIdChanged = (customer.taxId ?? "") !== data.taxId.toUpperCase()

  await db()
    .update(customers)
    .set({
      kind: data.kind,
      legalName: data.legalName,
      taxId: data.taxId.toUpperCase(),
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 ?? null,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      ...(taxIdChanged ? { taxIdValidated: false, taxIdValidatedAt: null } : {}),
    })
    .where(eq(customers.id, customer.id))

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "customer",
    entityId: customer.id,
    action: "billing_details_updated",
    diff: diffOf(before, { ...data, taxId: data.taxId.toUpperCase() }),
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  let notice = "datos_guardados"
  if (taxIdChanged || !customer.taxIdValidated) {
    const outcome = await validateTaxIdWithVies({
      customerId: customer.id,
      actorId: session.user.id,
      kind: data.kind,
      country: data.country,
      taxId: data.taxId,
    })
    notice = taxIdNotice(outcome)
  }

  await maybeCompleteVerification(session.user.id)
  redirect(`/app/account?ok=${notice}`)
}

// ─── password ────────────────────────────────────────────────────────────────
export async function changePasswordAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const current = raw(form, "actual")
  const next = raw(form, "nueva")
  const repeat = raw(form, "nueva2")

  if (next !== repeat) redirect(`${SECURITY}?error=contrasenas_distintas`)

  const rows = await db()
    .select({ passwordHash: users.passwordHash, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const user = rows[0]
  if (!user) redirect("/login")

  const ok = await verifyPassword(user.passwordHash, current)
  if (!ok) {
    await recordAudit({
      actorId: session.user.id,
      actorType: "user",
      entity: "user",
      entityId: session.user.id,
      action: "password_change_failed",
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    redirect(`${SECURITY}?error=contrasena_actual`)
  }

  try {
    assertStrongPassword(next, user.email)
  } catch (error) {
    if (error instanceof WeakPasswordError) redirect(`${SECURITY}?error=contrasena_debil`)
    throw error
  }

  await db()
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, session.user.id))

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "user",
    entityId: session.user.id,
    action: "password_changed",
    diff: { via: "account" },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  // Changing a password logs every device out, this one included.
  await destroyAllSessions(session.user.id)
  redirect("/login?ok=contrasena_cambiada")
}

// ─── two-factor authentication ───────────────────────────────────────────────
/** Step one: generate a secret and park it in a signed cookie. Nothing is stored yet. */
export async function startTotpAction(): Promise<never> {
  const session = await requireUser()
  const enrolment = beginTotpEnrolment(session.user.email)
  await storeEnrolmentSecret(session.user.id, enrolment.secret)
  redirect(`${SECURITY}?2fa=enrolar`)
}

export async function cancelTotpAction(): Promise<never> {
  await requireUser()
  await clearEnrolmentSecret()
  redirect(SECURITY)
}

/** Step two: a correct code proves the secret arrived intact, so it can be stored. */
export async function confirmTotpAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const code = joinCode(form)
  const secret = await readEnrolmentSecret(session.user.id)
  if (!secret) redirect(`${SECURITY}?error=sesion_expirada`)
  if (!verifyTotp(secret, code)) redirect(`${SECURITY}?2fa=enrolar&error=2fa_invalido`)

  await db()
    .update(users)
    .set({ totpSecret: secret, totpEnabledAt: new Date() })
    .where(eq(users.id, session.user.id))

  const codes = await generateRecoveryCodes(session.user.id)
  await storeFreshRecoveryCodes(session.user.id, codes)
  await clearEnrolmentSecret()

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "user",
    entityId: session.user.id,
    action: "2fa_enabled",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  redirect(`${SECURITY}?ok=2fa_activado&codigos=1`)
}

/** Turning 2FA off asks for a current code, so a borrowed session cannot do it. */
export async function disableTotpAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const code = text(form, "codigo")

  const rows = await db()
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const secret = rows[0]?.totpSecret
  if (!secret) redirect(SECURITY)

  const result = await verifySecondFactor({ userId: session.user.id, secret, code })
  if (!result.ok) redirect(`${SECURITY}?error=2fa_invalido`)

  await db()
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null })
    .where(eq(users.id, session.user.id))
  await invalidateTokens(session.user.id, TOKEN_PURPOSES.totpRecovery)

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "user",
    entityId: session.user.id,
    action: "2fa_disabled",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  redirect(`${SECURITY}?ok=2fa_desactivado`)
}

/** Replaces the recovery codes, for instance after using or losing some. */
export async function regenerateRecoveryCodesAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const code = joinCode(form)

  const rows = await db()
    .select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const secret = rows[0]?.totpSecret
  if (!secret) redirect(SECURITY)
  if (!verifyTotp(secret, code)) redirect(`${SECURITY}?error=2fa_invalido`)

  const codes = await generateRecoveryCodes(session.user.id)
  await storeFreshRecoveryCodes(session.user.id, codes)
  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "user",
    entityId: session.user.id,
    action: "2fa_recovery_codes_regenerated",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  redirect(`${SECURITY}?ok=2fa_activado&codigos=1`)
}

// ─── sessions ────────────────────────────────────────────────────────────────
export async function closeAllSessionsAction(): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  await destroyAllSessions(session.user.id)
  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "session",
    entityId: session.user.id,
    action: "sessions_revoked_all",
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  redirect("/login?ok=sesiones_cerradas")
}

export async function closeThisSessionAction(): Promise<never> {
  await requireUser()
  await destroySession()
  redirect("/login?ok=sesion_cerrada")
}

// ─── SSH keys ────────────────────────────────────────────────────────────────
export async function addSshKeyAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/login")

  const name = text(form, "nombre")
  const publicKey = text(form, "clave")
  if (name.length === 0 || name.length > 120) redirect(`${KEYS}?error=clave_nombre`)

  const normalized = normalizeSshKey(publicKey)
  const fingerprint = normalized ? sshKeyFingerprint(normalized) : null
  if (!normalized || !fingerprint) redirect(`${KEYS}?error=clave_ssh_invalida`)

  const existing = await db()
    .select({ id: sshKeys.id })
    .from(sshKeys)
    .where(and(eq(sshKeys.customerId, customer.id), eq(sshKeys.fingerprint, fingerprint)))
    .limit(1)
  if (existing.length > 0) redirect(`${KEYS}?error=clave_ssh_duplicada`)

  await db()
    .insert(sshKeys)
    .values({ customerId: customer.id, name, publicKey: normalized, fingerprint })

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "ssh_key",
    entityId: customer.id,
    action: "ssh_key_added",
    diff: { name, fingerprint },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  redirect(`${KEYS}?ok=clave_anadida`)
}

export async function deleteSshKeyAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/login")

  const id = text(form, "id")
  if (!id) redirect(`${KEYS}?error=campos`)

  // Scoped to the customer: an id from another account matches nothing.
  const rows = await db()
    .select({ id: sshKeys.id, fingerprint: sshKeys.fingerprint })
    .from(sshKeys)
    .where(and(eq(sshKeys.id, id), eq(sshKeys.customerId, customer.id)))
    .limit(1)
  const key = rows[0]
  if (!key) redirect(`${KEYS}?error=campos`)

  await db().delete(sshKeys).where(eq(sshKeys.id, key.id))
  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "ssh_key",
    entityId: customer.id,
    action: "ssh_key_deleted",
    diff: { fingerprint: key.fingerprint },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  redirect(`${KEYS}?ok=clave_eliminada`)
}

// ─── closing the account ─────────────────────────────────────────────────────
/**
 * Closes the account under the RGPD: personal data is anonymised, the invoices are not.
 *
 * Spanish law requires invoices to be kept for years, and `orders`, `services`,
 * `invoices` and `audit_log` rows are never deleted, so the customer row survives with
 * its identifying fields emptied, blocked, and with no way back in.
 *
 * It refuses while any service is not terminated: cancelling those is a billing
 * decision, not something to do silently here.
 */
export async function closeAccountAction(form: FormData): Promise<never> {
  const session = await requireUser()
  const meta = await requestMeta()
  const customer = await loadCustomer(session.user.id)
  if (!customer) redirect("/login")

  const password = raw(form, "password")
  const confirmation = text(form, "confirmacion")
  if (confirmation !== CLOSE_PHRASE) redirect(`${CLOSE}?error=confirmacion`)

  const rows = await db()
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const ok = await verifyPassword(rows[0]?.passwordHash ?? null, password)
  if (!ok) redirect(`${CLOSE}?error=contrasena_actual`)

  const active = await activeServiceCount(customer.id)
  if (active > 0) redirect(`${CLOSE}?error=servicios_activos`)

  const closedAt = new Date()
  const anonymousEmail = `cerrada+${session.user.id.toLowerCase()}@oladc.invalid`

  await db()
    .update(users)
    .set({
      email: anonymousEmail,
      passwordHash: null,
      totpSecret: null,
      totpEnabledAt: null,
    })
    .where(eq(users.id, session.user.id))

  await db()
    .update(customers)
    .set({
      status: "blocked",
      legalName: null,
      taxId: null,
      taxIdValidated: false,
      taxIdValidatedAt: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      phone: null,
      phoneVerifiedAt: null,
      riskNotes: `Cuenta cerrada por el cliente el ${closedAt.toISOString()}. Datos personales anonimizados; facturas conservadas por obligación legal.`,
    })
    .where(eq(customers.id, customer.id))

  // Keys are credentials, not records: they go.
  await db().delete(sshKeys).where(eq(sshKeys.customerId, customer.id))
  await invalidateTokens(session.user.id, TOKEN_PURPOSES.totpRecovery)
  await invalidateTokens(session.user.id, TOKEN_PURPOSES.emailVerify)
  await invalidateTokens(session.user.id, TOKEN_PURPOSES.passwordReset)

  await recordAudit({
    actorId: session.user.id,
    actorType: "user",
    entity: "customer",
    entityId: customer.id,
    action: "account_closed",
    diff: { anonymised: true, invoicesKept: true },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  await destroyAllSessions(session.user.id)
  redirect("/login?ok=cuenta_cerrada")
}
