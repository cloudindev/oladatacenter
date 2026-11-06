"use client"

import * as React from "react"
import { Notice } from "@/components/app/ui"

/**
 * TOTP enrolment panel: the QR to scan, plus the secret in groups of four for anyone
 * who cannot scan it (desktop authenticator, camera denied, screen reader).
 *
 * `qrSvg` is rendered on the server by `qrSvgFor` in `src/server/auth/totp.ts`, from a
 * URL this codebase built. It is injected as markup because that is how an inline SVG
 * arrives: it is never user input, and the `otpauth://` URL — which contains the shared
 * secret — never leaves our own server for a QR service.
 */
export function TotpQr({
  qrSvg,
  otpauthUrl,
  formattedSecret,
}: {
  qrSvg: string
  otpauthUrl: string
  formattedSecret: string
}) {
  const [copied, setCopied] = React.useState<"secreto" | "enlace" | null>(null)

  async function copy(value: string, what: "secreto" | "enlace") {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm text-text-muted leading-relaxed list-decimal pl-5">
        <li>Abre tu aplicación de autenticación (Google Authenticator, 1Password, Aegis).</li>
        <li>Escanea este código, o introduce la clave a mano si no puedes escanearlo.</li>
        <li>Escribe abajo el código de 6 dígitos que aparezca.</li>
      </ol>

      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div
          className="shrink-0 border border-border-base rounded-xl p-3 bg-surface-light [&>svg]:block [&>svg]:w-[180px] [&>svg]:h-[180px]"
          role="img"
          aria-label="Código QR para configurar la verificación en dos pasos"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <div className="min-w-0 flex-1">
          <p className="label-mono text-text-muted mb-2">Clave secreta</p>
          <p className="font-mono text-base tracking-wider break-all text-text-base">
            {formattedSecret}
          </p>
          <div className="flex flex-wrap gap-4 mt-3">
            <button
              type="button"
              onClick={() => void copy(formattedSecret.replace(/\s/g, ""), "secreto")}
              className="label-mono text-accent-ink hover:underline"
            >
              {copied === "secreto" ? "clave copiada" : "copiar clave"}
            </button>
            <button
              type="button"
              onClick={() => void copy(otpauthUrl, "enlace")}
              className="label-mono text-accent-ink hover:underline"
            >
              {copied === "enlace" ? "enlace copiado" : "copiar enlace otpauth"}
            </button>
            <a href={otpauthUrl} className="label-mono text-accent-ink hover:underline">
              abrir en la app
            </a>
          </div>
        </div>
      </div>

      <Notice tone="neutral">
        Guarda la clave en un lugar seguro. Si pierdes el acceso a la aplicación solo podrás
        entrar con uno de tus códigos de recuperación.
      </Notice>
    </div>
  )
}
