import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowSubmit } from "@/components/auth/ArrowSubmit"
import { AuthMessage, AuthScreen, BareField } from "@/components/auth/AuthScreen"
import { PasswordField } from "@/components/auth/PasswordField"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { bareInputClass } from "@/components/auth/styles"
import { currentSession, readPendingMfa } from "@/server/auth/session"
import { cancelPendingMfaAction, loginAction, loginTotpAction } from "../actions"

/**
 * Two steps in one route: credentials, then the second factor when the account has one.
 *
 * The second step is driven by a signed, short-lived cookie, never by the query string,
 * so `?paso=2fa` on its own proves nothing. Its field takes either a six-digit code or
 * a recovery code, which is why it is a plain text input and not the digit boxes.
 */

export const metadata = { title: "Entrar · OLA VPS Cloud" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))
  const next = firstParam(params.next) ?? "/app"

  const pending = await readPendingMfa()
  if (!pending) {
    const session = await currentSession()
    if (session && !firstParam(params.ok)) redirect(next.startsWith("/") ? next : "/app")
  }

  if (pending) {
    return (
      <AuthScreen
        eyebrow="Consola OLA · verificación"
        title="Segundo"
        titleMuted="factor."
        lead="Introduce el código de 6 dígitos de tu aplicación de autenticación. Si no tienes acceso al móvil, sirve uno de tus códigos de recuperación."
      >
        <form action={loginTotpAction} className="space-y-10">
          {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

          <BareField label="Código de verificación" htmlFor="codigo" index={1}>
            <input
              id="codigo"
              name="codigo"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              spellCheck={false}
              placeholder="123456"
              className={`${bareInputClass} font-mono tracking-[0.3em]`}
            />
          </BareField>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <ArrowSubmit pendingLabel="Comprobando">Continuar</ArrowSubmit>
          </div>
        </form>

        <div className="mt-12 pt-6 border-t border-bg-dark/12">
          <form action={cancelPendingMfaAction}>
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55 hover:text-text-base transition-colors"
            >
              Volver a empezar
            </button>
          </form>
        </div>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      eyebrow="Consola OLA · acceso clientes"
      title="Portal de"
      titleMuted="clientes."
      lead="Gestiona tus servidores, sus copias de seguridad, tus facturas y los datos de facturación de tu empresa."
      status="Todos los sistemas operativos"
      aside={
        <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55">
          ¿Todavía no tienes cuenta?{" "}
          <Link
            href="/registro"
            className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark transition-colors ml-1"
          >
            Crear una cuenta
          </Link>
        </div>
      }
    >
      <form action={loginAction} className="space-y-10" noValidate>
        <input type="hidden" name="next" value={next} />

        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {notice && !error ? <AuthMessage tone="ok">{notice}</AuthMessage> : null}

        <BareField label="Correo electrónico" htmlFor="email" index={1}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            placeholder="admin@empresa.com"
            className={bareInputClass}
          />
        </BareField>

        <PasswordField
          name="password"
          label="Contraseña"
          autoComplete="current-password"
          bare
          index={2}
          labelAction={
            <Link
              href="/recuperar"
              className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/50 hover:text-text-base transition-colors"
            >
              ¿Has olvidado tu contraseña?
            </Link>
          }
        />

        <div className="pt-4">
          <ArrowSubmit pendingLabel="Entrando">Iniciar sesión</ArrowSubmit>
        </div>
      </form>
    </AuthScreen>
  )
}
