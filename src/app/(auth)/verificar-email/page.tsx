import Link from "next/link"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db, users } from "@ola/db"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { ArrowSubmit } from "@/components/auth/ArrowSubmit"
import { AuthMessage, AuthScreen } from "@/components/auth/AuthScreen"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { currentSession } from "@/server/auth/session"
import { confirmEmailAction, resendVerificationAction } from "../actions"

/**
 * Three states in one route:
 *  - a link was opened (`?token=…`): one button spends the token. It is spent on submit
 *    and never on render, so a link preview or a corporate mail scanner fetching the URL
 *    cannot burn it before the customer clicks;
 *  - no token, signed in and unverified: "check your inbox" plus a resend button;
 *  - already verified: straight on to the wizard.
 */

export const metadata = { title: "Verificar correo · OLA VPS Cloud" }

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const token = firstParam(params.token)
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))

  const session = await currentSession()
  let alreadyVerified = false
  if (session) {
    const rows = await db()
      .select({ emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
    alreadyVerified = Boolean(rows[0]?.emailVerifiedAt)
  }
  if (alreadyVerified && !token) redirect("/onboarding")

  const lead = token
    ? "Confirma que esta dirección es tuya y activamos la cuenta al momento."
    : session
      ? "Te hemos enviado un enlace. Ábrelo desde este dispositivo o desde cualquier otro: el enlace caduca en 24 horas y solo se puede usar una vez."
      : "Entra en tu cuenta para pedir un enlace de verificación nuevo."

  return (
    <AuthScreen
      eyebrow="Consola OLA · paso 1 de 4"
      title="Verifica tu"
      titleMuted="correo."
      lead={lead}
    >
      <div className="space-y-10">
        {error ? <AuthMessage tone="error">{error}</AuthMessage> : null}
        {notice && !error ? <AuthMessage tone="ok">{notice}</AuthMessage> : null}

        {token ? (
          <form action={confirmEmailAction}>
            <input type="hidden" name="token" value={token} />
            <ArrowSubmit pendingLabel="Confirmando">Confirmar correo</ArrowSubmit>
          </form>
        ) : session ? (
          <>
            <dl className="border-t border-bg-dark/12 pt-6">
              <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2">
                Enviado a
              </dt>
              <dd className="text-[19px] text-text-base break-all">{session.user.email}</dd>
            </dl>
            <form action={resendVerificationAction}>
              <ArrowSubmit pendingLabel="Enviando">Enviar otro enlace</ArrowSubmit>
            </form>
            <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55">
              Revisa también la carpeta de correo no deseado
            </p>
          </>
        ) : (
          <ArrowCta href="/login">Entrar</ArrowCta>
        )}

        <div className="pt-6 border-t border-bg-dark/12">
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55">
            ¿Problemas con el enlace?{" "}
            <Link
              href="/contact"
              className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark transition-colors ml-1"
            >
              Escríbenos
            </Link>
          </p>
        </div>
      </div>
    </AuthScreen>
  )
}
