import Link from "next/link"
import { redirect } from "next/navigation"
import { maskPhone } from "@ola/core/identity/index"
import {
  DataRow,
  Field,
  Input,
  Notice,
  Panel,
  SectionTitle,
  Select,
  StatusBadge,
} from "@/components/app/ui"
import { SubmitButton } from "@/components/auth/SubmitButton"
import { COUNTRIES, countryName } from "@/components/auth/countries"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { requireUser } from "@/server/auth/session"
import { verificationSnapshot } from "@/server/auth/verification"
import { updateBillingAction } from "./actions"

/** Profile and billing details. Editing the tax id triggers a fresh VIES check. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  const params = await searchParams
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))

  const snapshot = await verificationSnapshot(session.user.id)
  const customer = snapshot.customer
  if (!customer) redirect("/onboarding")

  const statusTone =
    customer.status === "verified" ? "ok" : customer.status === "blocked" ? "danger" : "warn"
  const statusLabel =
    customer.status === "verified"
      ? "Verificada"
      : customer.status === "blocked"
        ? "Bloqueada"
        : customer.status === "review"
          ? "En revisión"
          : "Sin verificar"

  return (
    <div className="space-y-8">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice && !error ? <Notice tone="ok">{notice}</Notice> : null}

      {!snapshot.complete ? (
        <Notice tone="warn" title="Verificación pendiente">
          Te faltan pasos para poder contratar servidores.{" "}
          <Link href="/onboarding" className="underline">
            Terminar la verificación
          </Link>
        </Notice>
      ) : null}

      <Panel>
        <SectionTitle>Perfil</SectionTitle>
        <dl>
          <DataRow label="Correo">{session.user.email}</DataRow>
          <DataRow label="Estado de la cuenta">
            <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          </DataRow>
          <DataRow label="Teléfono" mono>
            {customer.phone ? maskPhone(customer.phone) : "—"}
          </DataRow>
          <DataRow label="Identificador fiscal" mono>
            {customer.taxId ?? "—"}
            {customer.taxId ? (
              <span className="ml-2">
                <StatusBadge tone={customer.taxIdValidated ? "ok" : "neutral"}>
                  {customer.taxIdValidated ? "Validado en VIES" : "Sin validar"}
                </StatusBadge>
              </span>
            ) : null}
          </DataRow>
          <DataRow label="País">{countryName(customer.country)}</DataRow>
        </dl>
        <p className="mt-4 text-sm text-text-muted">
          Para cambiar el correo de acceso o el teléfono verificado, escríbenos desde{" "}
          <Link href="/contact" className="text-accent-ink hover:underline">
            soporte
          </Link>
          .
        </p>
      </Panel>

      <Panel>
        <SectionTitle>Datos de facturación</SectionTitle>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          Aparecen tal cual en tus facturas. Si cambias el identificador fiscal lo volvemos a
          comprobar en VIES.
        </p>

        <form action={updateBillingAction}>
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

          <Field label="NIF, CIF o NIE" htmlFor="taxId">
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
            <SubmitButton pendingLabel="Guardando">Guardar cambios</SubmitButton>
          </div>
        </form>
      </Panel>
    </div>
  )
}
