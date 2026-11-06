import Link from "next/link"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { ArrowSubmit } from "@/components/auth/ArrowSubmit"
import { AuthMessage, AuthScreen } from "@/components/auth/AuthScreen"
import { PasswordField } from "@/components/auth/PasswordField"
import { authError, firstParam } from "@/components/auth/messages"
import { resetPasswordAction } from "../actions"

/**
 * Sets a new password from a reset link. The token is spent when the form is submitted,
 * not while rendering, so opening the page twice does not waste it. Saving a new
 * password closes every session the account had open.
 */

export const metadata = { title: "Nueva contraseña · OLA VPS Cloud" }

export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const token = firstParam(params.token)
  const error = authError(firstParam(params.error))

  if (!token) {
    return (
      <AuthScreen
        eyebrow="Consola OLA · contraseña"
        title="Enlace no"
        titleMuted="válido."
        lead="Falta el código del enlace, o se ha cortado al copiarlo. Pide uno nuevo y vuelve a intentarlo."
      >
        <ArrowCta href="/recuperar">Pedir otro enlace</ArrowCta>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      eyebrow="Consola OLA · contraseña"
      title="Elige una"
      titleMuted="nueva."
      lead="Al guardarla cerraremos la sesión en todos los dispositivos, así que tendrás que volver a entrar."
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
      <form action={resetPasswordAction} className="space-y-10" noValidate>
        <input type="hidden" name="token" value={token} />

        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

        <PasswordField
          name="password"
          label="Contraseña nueva"
          autoComplete="new-password"
          withMeter
          bare
          index={1}
          autoFocus
        />
        <PasswordField
          name="password2"
          label="Repite la contraseña"
          autoComplete="new-password"
          bare
          index={2}
        />

        <div className="pt-4">
          <ArrowSubmit pendingLabel="Guardando">Guardar contraseña</ArrowSubmit>
        </div>
      </form>
    </AuthScreen>
  )
}
