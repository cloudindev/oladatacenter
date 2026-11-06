import { eq } from "drizzle-orm"
import { db, users } from "@ola/db"
import {
  DataRow,
  Divider,
  Field,
  Input,
  Notice,
  Panel,
  SectionTitle,
  StatusBadge,
} from "@/components/app/ui"
import { OtpInput } from "@/components/auth/OtpInput"
import { PasswordField } from "@/components/auth/PasswordField"
import { SubmitButton } from "@/components/auth/SubmitButton"
import { TotpQr } from "@/components/auth/TotpQr"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { currentSessionDetails, listActiveSessions, requireUser } from "@/server/auth/session"
import {
  formatSecret,
  otpauthUrlFor,
  qrSvgFor,
  readEnrolmentSecret,
  readFreshRecoveryCodes,
  remainingRecoveryCodes,
} from "@/server/auth/totp"
import {
  cancelTotpAction,
  changePasswordAction,
  closeAllSessionsAction,
  closeThisSessionAction,
  confirmTotpAction,
  disableTotpAction,
  regenerateRecoveryCodesAction,
  startTotpAction,
} from "../actions"

/**
 * Password, second factor and active sessions.
 *
 * The TOTP secret and the recovery codes reach this page from a signed, httpOnly cookie
 * written by the action that generated them, and only for the user they belong to. The
 * stored secret is never rendered: once 2FA is on, this screen only knows that it is on.
 */
export default async function SeguridadPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  const params = await searchParams
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))
  const enrolling = firstParam(params["2fa"]) === "enrolar"
  const showCodes = firstParam(params.codigos) === "1"

  const rows = await db()
    .select({ totpEnabledAt: users.totpEnabledAt, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  const totpEnabled = rows[0]?.totpEnabledAt !== null && rows[0]?.totpEnabledAt !== undefined

  const details = await currentSessionDetails()
  const activeSessions = await listActiveSessions(session.user.id)
  const codesLeft = totpEnabled ? await remainingRecoveryCodes(session.user.id) : 0
  const freshCodes = showCodes ? await readFreshRecoveryCodes(session.user.id) : null

  // During enrolment the secret comes from the cookie; the otpauth URL is rebuilt here
  // so the secret never travels through the query string.
  const pendingSecret = enrolling ? await readEnrolmentSecret(session.user.id) : null
  const enrolmentUrl = pendingSecret ? otpauthUrlFor(session.user.email, pendingSecret) : null
  const enrolment =
    pendingSecret && enrolmentUrl
      ? {
          otpauthUrl: enrolmentUrl,
          formattedSecret: formatSecret(pendingSecret),
          qrSvg: await qrSvgFor(enrolmentUrl),
        }
      : null

  return (
    <div className="space-y-8">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice && !error ? <Notice tone="ok">{notice}</Notice> : null}

      {freshCodes && freshCodes.length > 0 ? (
        <Panel>
          <SectionTitle>Códigos de recuperación</SectionTitle>
          <p className="text-sm text-text-muted mb-5 leading-relaxed">
            Guárdalos ahora en un gestor de contraseñas. Cada uno sirve una sola vez y no
            volveremos a mostrarlos. Son la única forma de entrar si pierdes el móvil.
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {freshCodes.map((code) => (
              <li
                key={code}
                className="font-mono text-sm text-text-base border border-border-base rounded-lg px-3 py-2 text-center"
              >
                {code}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <SectionTitle>Contraseña</SectionTitle>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          Al cambiarla cerraremos la sesión en todos los dispositivos, incluido este.
        </p>
        <form action={changePasswordAction}>
          <PasswordField name="actual" label="Contraseña actual" autoComplete="current-password" />
          <PasswordField
            name="nueva"
            label="Contraseña nueva"
            autoComplete="new-password"
            withMeter
            email={session.user.email}
          />
          <PasswordField name="nueva2" label="Repite la nueva" autoComplete="new-password" />
          <div className="pt-2">
            <SubmitButton pendingLabel="Guardando">Cambiar contraseña</SubmitButton>
          </div>
        </form>
      </Panel>

      <Panel>
        <SectionTitle>Verificación en dos pasos</SectionTitle>
        <dl className="mb-6">
          <DataRow label="Estado">
            <StatusBadge tone={totpEnabled ? "ok" : "neutral"}>
              {totpEnabled ? "Activada" : "Desactivada"}
            </StatusBadge>
          </DataRow>
          {totpEnabled ? (
            <DataRow label="Códigos de recuperación sin usar">{codesLeft}</DataRow>
          ) : null}
        </dl>

        {!totpEnabled && !enrolment ? (
          <>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              Añade un código temporal de tu móvil al entrar. Es obligatoria para las cuentas de
              administración.
            </p>
            <form action={startTotpAction}>
              <SubmitButton pendingLabel="Preparando">Activar</SubmitButton>
            </form>
          </>
        ) : null}

        {enrolment ? (
          <div className="space-y-6">
            <TotpQr
              qrSvg={enrolment.qrSvg}
              otpauthUrl={enrolment.otpauthUrl}
              formattedSecret={enrolment.formattedSecret}
            />
            <form action={confirmTotpAction}>
              <OtpInput name="codigo" label="Código de la aplicación" autoFocus />
              <SubmitButton pendingLabel="Comprobando">Confirmar y activar</SubmitButton>
            </form>
            <Divider />
            <form action={cancelTotpAction}>
              <SubmitButton variant="ghost" withArrow={false}>
                Cancelar
              </SubmitButton>
            </form>
          </div>
        ) : null}

        {totpEnabled ? (
          <div className="space-y-6">
            <Divider />
            <form action={regenerateRecoveryCodesAction}>
              <p className="text-sm text-text-muted mb-3 leading-relaxed">
                Genera códigos de recuperación nuevos. Los anteriores dejarán de valer.
              </p>
              <OtpInput name="codigo" label="Código de la aplicación" />
              <SubmitButton variant="secondary" withArrow={false} pendingLabel="Generando">
                Generar códigos nuevos
              </SubmitButton>
            </form>
            <Divider />
            <form action={disableTotpAction}>
              <p className="text-sm text-text-muted mb-3 leading-relaxed">
                Para desactivarla, confirma con un código de la aplicación o con uno de
                recuperación.
              </p>
              {/* Free text, not the digit boxes: a recovery code is also valid here. */}
              <Field label="Código de confirmación" htmlFor="codigo-desactivar">
                <Input
                  id="codigo-desactivar"
                  name="codigo"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  className="font-mono"
                  required
                />
              </Field>
              <SubmitButton variant="danger" withArrow={false} pendingLabel="Desactivando">
                Desactivar
              </SubmitButton>
            </form>
          </div>
        ) : null}
      </Panel>

      <Panel>
        <SectionTitle>Sesiones activas</SectionTitle>
        <ul className="mb-6">
          {activeSessions.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-3 border-b border-border-base last:border-b-0"
            >
              <div>
                <p className="text-sm text-text-base">
                  {describeAgent(item.userAgent)}
                  {item.id === details?.sessionId ? (
                    <span className="ml-2">
                      <StatusBadge tone="ok">Esta sesión</StatusBadge>
                    </span>
                  ) : null}
                </p>
                <p className="label-mono text-text-muted mt-1">
                  {item.ip ?? "IP desconocida"} · desde {formatDate(item.createdAt)}
                  {item.totpVerifiedAt
                    ? ` · dos pasos el ${formatDate(item.totpVerifiedAt)}`
                    : null}
                </p>
              </div>
            </li>
          ))}
          {activeSessions.length === 0 ? (
            <li className="text-sm text-text-muted py-3">No hay otras sesiones abiertas.</li>
          ) : null}
        </ul>

        <div className="flex flex-wrap gap-4">
          <form action={closeAllSessionsAction}>
            <SubmitButton variant="danger" withArrow={false} pendingLabel="Cerrando">
              Cerrar sesión en todos los dispositivos
            </SubmitButton>
          </form>
          <form action={closeThisSessionAction}>
            <SubmitButton variant="secondary" withArrow={false}>
              Cerrar esta sesión
            </SubmitButton>
          </form>
        </div>
      </Panel>
    </div>
  )
}

/** Browser and platform from the user agent, with no fingerprinting pretensions. */
function describeAgent(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido"
  const browser = /Edg/.test(userAgent)
    ? "Edge"
    : /Chrome/.test(userAgent)
      ? "Chrome"
      : /Safari/.test(userAgent)
        ? "Safari"
        : /Firefox/.test(userAgent)
          ? "Firefox"
          : "Navegador"
  const platform = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "otro sistema"
  return `${browser} · ${platform}`
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date)
}
