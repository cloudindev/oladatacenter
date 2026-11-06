import Link from "next/link"
import { ButtonLink, Field, Input, Notice, Panel, SectionTitle } from "@/components/app/ui"
import { PasswordField } from "@/components/auth/PasswordField"
import { SubmitButton } from "@/components/auth/SubmitButton"
import { authError, firstParam } from "@/components/auth/messages"
import { requireUser } from "@/server/auth/session"
import { activeServiceCount, loadCustomer } from "@/server/auth/verification"
import { closeAccountAction } from "../actions"

/**
 * Closing an account, under the RGPD: personal data is anonymised and the invoices stay,
 * because Spanish law requires us to keep them. The form asks for the password and for
 * the exact phrase, and refuses while any service is still alive.
 */
export default async function CerrarCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  const params = await searchParams
  const error = authError(firstParam(params.error))

  const customer = await loadCustomer(session.user.id)
  const active = customer ? await activeServiceCount(customer.id) : 0

  return (
    <div className="space-y-8">
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Panel>
        <SectionTitle>Cerrar la cuenta</SectionTitle>
        <div className="text-sm text-text-muted leading-relaxed space-y-3 mb-6">
          <p>Al cerrar la cuenta, de forma inmediata y sin vuelta atrás:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>anonimizamos tu nombre, identificador fiscal, dirección y teléfono;</li>
            <li>borramos tus claves SSH y cerramos todas las sesiones;</li>
            <li>pierdes el crédito que te quede sin usar;</li>
            <li>
              conservamos tus facturas y el registro de actividad, porque la normativa fiscal nos
              obliga a guardarlos.
            </li>
          </ul>
          <p>
            Si solo quieres dejar de recibir correos o cambiar tus datos, no hace falta cerrar la
            cuenta:{" "}
            <Link href="/contact" className="text-accent-ink hover:underline">
              escríbenos
            </Link>
            .
          </p>
        </div>

        {active > 0 ? (
          <Notice tone="warn" title="Tienes servidores sin cancelar">
            No podemos cerrar la cuenta mientras haya {active}{" "}
            {active === 1 ? "servidor activo" : "servidores activos"}. Cancélalos primero y vuelve
            aquí.
            <div className="mt-4">
              <ButtonLink href="/app/servers" variant="secondary">
                Ver mis servidores
              </ButtonLink>
            </div>
          </Notice>
        ) : (
          <form action={closeAccountAction}>
            <PasswordField
              name="password"
              label="Tu contraseña"
              autoComplete="current-password"
            />
            <Field
              label="Escribe CERRAR CUENTA para confirmar"
              htmlFor="confirmacion"
              hint="En mayúsculas, tal cual"
            >
              <Input
                id="confirmacion"
                name="confirmacion"
                autoComplete="off"
                className="font-mono"
                required
              />
            </Field>
            <div className="pt-2">
              <SubmitButton variant="danger" withArrow={false} pendingLabel="Cerrando la cuenta">
                Cerrar mi cuenta definitivamente
              </SubmitButton>
            </div>
          </form>
        )}
      </Panel>
    </div>
  )
}
