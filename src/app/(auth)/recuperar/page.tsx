import Link from "next/link"
import { ArrowSubmit } from "@/components/auth/ArrowSubmit"
import { AuthMessage, AuthScreen, BareField } from "@/components/auth/AuthScreen"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { bareInputClass } from "@/components/auth/styles"
import { requestPasswordResetAction } from "../actions"

/**
 * Asks for the address and always answers the same thing, whether an account exists or
 * not: this form must not tell anyone which addresses are registered.
 */

export const metadata = { title: "Recuperar contraseña · OLA VPS Cloud" }

export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))

  return (
    <AuthScreen
      eyebrow="Consola OLA · contraseña"
      title="Recupera el"
      titleMuted="acceso."
      lead="Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva. Caduca en una hora."
      aside={
        <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55">
          <Link
            href="/login"
            className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark transition-colors"
          >
            Volver a entrar
          </Link>
        </div>
      }
    >
      <form action={requestPasswordResetAction} className="space-y-10" noValidate>
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {notice && !error ? (
          <AuthMessage tone="ok">
            {notice}. Si no te llega en unos minutos, revisa el correo no deseado.
          </AuthMessage>
        ) : null}

        <BareField label="Correo electrónico" htmlFor="email" index={1}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="admin@empresa.com"
            className={bareInputClass}
          />
        </BareField>

        <div className="pt-4">
          <ArrowSubmit pendingLabel="Enviando">Enviar enlace</ArrowSubmit>
        </div>
      </form>
    </AuthScreen>
  )
}
