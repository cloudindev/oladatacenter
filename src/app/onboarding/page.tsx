import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { maskPhone } from "@ola/core/identity/index"
import {
  ButtonLink,
  DataRow,
  Eyebrow,
  Field,
  Input,
  Notice,
  Panel,
  Select,
  StatusBadge,
} from "@/components/app/ui"
import { OtpInput } from "@/components/auth/OtpInput"
import { SubmitButton } from "@/components/auth/SubmitButton"
import { COUNTRIES } from "@/components/auth/countries"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { requireUser } from "@/server/auth/session"
import { pendingOtpTarget } from "@/server/auth/tokens"
import { verificationSnapshot } from "@/server/auth/verification"
import { pendingOrderHref } from "@/server/pending-order"
import { cn } from "@/lib/utils"
import {
  refreshVerificationAction,
  sendPhoneOtpAction,
  verifyPhoneOtpAction,
  saveBillingAction,
} from "./actions"
import { resendVerificationAction } from "../(auth)/actions"

/**
 * The four-step verification wizard: email, billing details, phone, card.
 *
 * The step shown is derived from the database, not from the URL. `?paso=` can only move
 * backwards to a step that is already done, so nothing can be skipped by typing a URL.
 * The gate itself is `isAccountVerified` in `@ola/core`.
 */

export const metadata: Metadata = {
  title: "Verificar la cuenta · OLA VPS Cloud",
  robots: { index: false, follow: false },
}

const STEPS = [
  { number: 1, label: "Correo" },
  { number: 2, label: "Facturación" },
  { number: 3, label: "Teléfono" },
  { number: 4, label: "Tarjeta" },
] as const

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  const params = await searchParams
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))

  const snapshot = await verificationSnapshot(session.user.id)
  if (!snapshot.customer) redirect("/login")

  const done = snapshot.steps
  const naturalStep = !done.email ? 1 : !done.billing ? 2 : !done.phone ? 3 : !done.card ? 4 : 5
  const asked = Number.parseInt(firstParam(params.paso) ?? "", 10)
  const step =
    Number.isInteger(asked) && asked >= 1 && asked <= naturalStep ? asked : naturalStep

  const otpTarget = step === 3 ? await pendingOtpTarget(session.user.id) : null
  const customer = snapshot.customer
  const pendingOrder = await pendingOrderHref()

  return (
    <div className="flex-1 bg-bg-light">
      <div className="w-full max-w-[920px] mx-auto px-6 md:px-10 py-12 md:py-20">
        <Eyebrow>Verificación de la cuenta</Eyebrow>
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-text-base mb-2">
          {naturalStep > 4 ? "Cuenta verificada" : "Termina de verificar tu cuenta"}
        </h1>
        <p className="text-text-muted leading-relaxed mb-10 max-w-2xl">
          {naturalStep > 4
            ? "Ya puedes contratar servidores con tu crédito de bienvenida."
            : "Cuatro pasos. Al terminarlos podrás contratar servidores y recibirás el crédito de bienvenida."}
        </p>

        {error ? (
          <div className="mb-6">
            <Notice tone="danger">{error}</Notice>
          </div>
        ) : null}
        {notice && !error ? (
          <div className="mb-6">
            <Notice tone="ok">{notice}</Notice>
          </div>
        ) : null}

        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {STEPS.map((item) => {
            const complete = [done.email, done.billing, done.phone, done.card][item.number - 1]
            const current = item.number === step
            return (
              <li
                key={item.number}
                className={cn(
                  "border rounded-xl px-4 py-3",
                  current ? "border-text-base" : "border-border-base",
                )}
              >
                <p className="label-mono text-text-muted mb-1">Paso {item.number}</p>
                <p className="text-sm text-text-base mb-2">{item.label}</p>
                {complete ? (
                  <StatusBadge tone="ok">Hecho</StatusBadge>
                ) : current ? (
                  <StatusBadge tone="busy">Ahora</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Pendiente</StatusBadge>
                )}
              </li>
            )
          })}
        </ol>

        {step === 1 ? <StepEmail email={session.user.email} /> : null}
        {step === 2 ? <StepBilling customer={customer} /> : null}
        {step === 3 ? <StepPhone customer={customer} otpTarget={otpTarget} /> : null}
        {step === 4 ? <StepCard /> : null}
        {step > 4 ? <StepDone pendingOrder={pendingOrder} /> : null}

        {step < naturalStep ? (
          <p className="mt-6 text-sm text-text-muted">
            <Link href="/onboarding" className="text-accent-ink hover:underline">
              Ir al paso pendiente
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ─── step 1 ──────────────────────────────────────────────────────────────────
function StepEmail({ email }: { email: string }) {
  return (
    <Panel>
      <h2 className="text-xl font-normal tracking-tight text-text-base mb-3">Verifica tu correo</h2>
      <p className="text-text-muted leading-relaxed mb-6">
        Te hemos enviado un enlace a <strong className="text-text-base">{email}</strong>. Ábrelo
        para continuar. El enlace caduca en 24 horas.
      </p>
      <form action={resendVerificationAction}>
        <SubmitButton variant="secondary" withArrow={false} pendingLabel="Enviando">
          Enviar otro enlace
        </SubmitButton>
      </form>
    </Panel>
  )
}

// ─── step 2 ──────────────────────────────────────────────────────────────────
interface BillingCustomer {
  kind: "company" | "individual"
  legalName: string | null
  taxId: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  phone: string | null
  phoneVerifiedAt: Date | null
}

function StepBilling({ customer }: { customer: BillingCustomer }) {
  return (
    <Panel>
      <h2 className="text-xl font-normal tracking-tight text-text-base mb-3">
        Datos de facturación
      </h2>
      <p className="text-text-muted leading-relaxed mb-6">
        Los usamos para emitir tus facturas. Si eres empresa de la UE, validamos el número de
        IVA en VIES para aplicar la inversión del sujeto pasivo.
      </p>

      <form action={saveBillingAction}>
        <Field label="Tipo de cliente" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={customer.kind} required>
            <option value="company">Empresa o autónomo</option>
            <option value="individual">Particular</option>
          </Select>
        </Field>

        <Field label="Nombre o razón social" htmlFor="legalName">
          <Input
            id="legalName"
            name="legalName"
            defaultValue={customer.legalName ?? ""}
            autoComplete="organization"
            required
          />
        </Field>

        <Field
          label="NIF, CIF o NIE"
          htmlFor="taxId"
          hint="Para empresas de otros países de la UE, el número de IVA con prefijo"
        >
          <Input
            id="taxId"
            name="taxId"
            defaultValue={customer.taxId ?? ""}
            className="font-mono"
            required
          />
        </Field>

        <Field label="Dirección" htmlFor="addressLine1">
          <Input
            id="addressLine1"
            name="addressLine1"
            defaultValue={customer.addressLine1 ?? ""}
            autoComplete="address-line1"
            required
          />
        </Field>

        <Field label="Dirección (línea 2)" htmlFor="addressLine2">
          <Input
            id="addressLine2"
            name="addressLine2"
            defaultValue={customer.addressLine2 ?? ""}
            autoComplete="address-line2"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Código postal" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={customer.postalCode ?? ""}
              autoComplete="postal-code"
              required
            />
          </Field>
          <Field label="Ciudad" htmlFor="city">
            <Input
              id="city"
              name="city"
              defaultValue={customer.city ?? ""}
              autoComplete="address-level2"
              required
            />
          </Field>
        </div>

        <Field label="País" htmlFor="country">
          <Select id="country" name="country" defaultValue={customer.country ?? "ES"} required>
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="pt-2">
          <SubmitButton pendingLabel="Guardando y validando">Guardar y continuar</SubmitButton>
        </div>
      </form>
    </Panel>
  )
}

// ─── step 3 ──────────────────────────────────────────────────────────────────
function StepPhone({
  customer,
  otpTarget,
}: {
  customer: BillingCustomer
  otpTarget: string | null
}) {
  return (
    <Panel>
      <h2 className="text-xl font-normal tracking-tight text-text-base mb-3">
        Verifica tu teléfono
      </h2>

      {otpTarget ? (
        <>
          <p className="text-text-muted leading-relaxed mb-6">
            Hemos enviado un código a <strong className="text-text-base">{maskPhone(otpTarget)}</strong>.
            Caduca en 10 minutos y tienes 5 intentos.
          </p>
          <form action={verifyPhoneOtpAction} className="mb-6">
            <OtpInput name="codigo" label="Código recibido por SMS" autoFocus />
            <SubmitButton pendingLabel="Comprobando">Verificar teléfono</SubmitButton>
          </form>
          <form action={sendPhoneOtpAction}>
            <input type="hidden" name="telefono" value={otpTarget} />
            <SubmitButton variant="ghost" withArrow={false} pendingLabel="Enviando">
              Enviar otro código
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <p className="text-text-muted leading-relaxed mb-6">
            Te enviaremos un código de 6 dígitos por SMS. Lo usamos también para avisarte de
            incidencias graves.
          </p>
          <form action={sendPhoneOtpAction}>
            <Field
              label="Teléfono móvil"
              htmlFor="telefono"
              hint="Con prefijo del país, por ejemplo +34 600 123 456"
            >
              <Input
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={customer.phone ?? "+34"}
                required
              />
            </Field>
            <SubmitButton pendingLabel="Enviando">Enviar código</SubmitButton>
          </form>
        </>
      )}
    </Panel>
  )
}

// ─── step 4 ──────────────────────────────────────────────────────────────────
/**
 * Card step. Stripe belongs to the billing module, so this is a hand-off: the customer
 * adds the card there and comes back, and the button below re-reads `payment_methods`.
 *
 * TODO(billing): point the link at the final payment-methods route once the billing
 * module settles on one; `/app/billing` is its entry point today.
 */
function StepCard() {
  return (
    <Panel>
      <h2 className="text-xl font-normal tracking-tight text-text-base mb-3">
        Añade una tarjeta
      </h2>
      <p className="text-text-muted leading-relaxed mb-6">
        Hacemos una verificación de un euro que se anula al momento. No cobramos nada hasta que
        contratas un servidor, y el crédito de bienvenida se aplica solo.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <ButtonLink href="/app/billing" withArrow>
          Añadir tarjeta
        </ButtonLink>
        <form action={refreshVerificationAction}>
          <SubmitButton variant="secondary" withArrow={false} pendingLabel="Comprobando">
            Ya la he añadido
          </SubmitButton>
        </form>
      </div>
    </Panel>
  )
}

function StepDone({ pendingOrder }: { pendingOrder: string | null }) {
  return (
    <Panel>
      <h2 className="text-xl font-normal tracking-tight text-text-base mb-3">Todo listo</h2>
      <dl className="mb-6">
        <DataRow label="Correo">Verificado</DataRow>
        <DataRow label="Facturación">Completa</DataRow>
        <DataRow label="Teléfono">Verificado</DataRow>
        <DataRow label="Tarjeta">Verificada</DataRow>
      </dl>
      <div className="flex flex-wrap gap-4">
        {pendingOrder ? (
          <ButtonLink href={pendingOrder} withArrow>
            Continuar con tu pedido
          </ButtonLink>
        ) : (
          <ButtonLink href="/cloud/vps" withArrow>
            Configurar un servidor
          </ButtonLink>
        )}
        <ButtonLink href="/app" variant="secondary">
          Ir a mi cuenta
        </ButtonLink>
      </div>
    </Panel>
  )
}
