import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowSubmit } from "@/components/auth/ArrowSubmit"
import { AuthMessage, AuthScreen, BareField } from "@/components/auth/AuthScreen"
import { PasswordField } from "@/components/auth/PasswordField"
import { authError, firstParam } from "@/components/auth/messages"
import { bareInputClass } from "@/components/auth/styles"
import { currentSession } from "@/server/auth/session"
import { registerAction } from "../actions"

/**
 * Sign-up: an address and a password, nothing else. Billing details, phone and card are
 * asked for later in the onboarding wizard, so this first step stays short.
 */

export const metadata = { title: "Crear cuenta · OLA VPS Cloud" }

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const error = authError(firstParam(params.error))

  const session = await currentSession()
  if (session) redirect("/onboarding")

  return (
    <AuthScreen
      eyebrow="Consola OLA · cuenta nueva"
      title="Crea tu"
      titleMuted="cuenta."
      lead="Crear la cuenta es gratis y solo pagas cuando contratas un servidor. Al verificarla recibes el crédito de bienvenida."
      aside={
        <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark transition-colors ml-1"
          >
            Entrar
          </Link>
        </div>
      }
    >
      <form action={registerAction} className="space-y-10" noValidate>
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}

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

        <BareField
          label="Nombre o razón social"
          htmlFor="nombre"
          index={2}
          hint="Lo podrás completar después, con el resto de los datos de facturación"
        >
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="organization"
            placeholder="Mi empresa, S.L."
            className={bareInputClass}
          />
        </BareField>

        <PasswordField
          name="password"
          label="Contraseña"
          autoComplete="new-password"
          withMeter
          bare
          index={3}
        />

        <PasswordField
          name="password2"
          label="Repite la contraseña"
          autoComplete="new-password"
          bare
          index={4}
        />

        <label className="flex items-start gap-3 text-sm text-text-base/70 leading-relaxed">
          <input
            type="checkbox"
            name="condiciones"
            value="si"
            required
            className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--ag-sys-color-accent-ink)]"
          />
          <span>
            He leído los{" "}
            <Link
              href="/legal/terms"
              className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark"
            >
              términos del servicio
            </Link>{" "}
            y la{" "}
            <Link
              href="/legal/privacy"
              className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark"
            >
              política de privacidad
            </Link>
            .
          </span>
        </label>

        <div className="pt-4">
          <ArrowSubmit pendingLabel="Creando la cuenta">Crear cuenta</ArrowSubmit>
        </div>
      </form>
    </AuthScreen>
  )
}
