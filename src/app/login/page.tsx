"use client"

/**
 * LoginPage (`/login`) — Portal de Clientes con diseño editorial minimalista
 * adaptado al sistema visual de OLA Datacenter:
 *  - Sin `PageHero` oscuro ni tarjeta blanca con sombra (`shadow-2xl`).
 *  - Estructura limpia en dos columnas sobre el lienzo `bg-bg-light` (`#f7f7f5`).
 *  - Campos de formulario desnudos con línea inferior (`border-b border-bg-dark/25`),
 *    etiquetas técnicas `font-mono` y botón paralelogramo `ArrowCta`.
 */

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface RevealWord {
  text: string
  muted?: boolean
  breakAfter?: boolean
}

interface WordRevealTextProps {
  words: RevealWord[]
  revealed: boolean
  staggerMs?: number
  baseDelayMs?: number
}

// ─── 2. Helper Components ───────────────────────────────────────────────────
/**
 * Renderiza palabras con el efecto de cortina `.text-reveal-overlay`
 * animado por compositor GPU (`transform: scaleY`).
 */
function WordRevealText({
  words,
  revealed,
  staggerMs = 85,
  baseDelayMs = 0,
}: WordRevealTextProps) {
  return (
    <>
      {words.map((w, idx) => (
        <React.Fragment key={`${w.text}-${idx}`}>
          <span
            className={cn(
              "relative inline-block align-bottom",
              w.muted ? "text-[#c9cbbe]" : "text-text-base"
            )}
            style={{ clipPath: "inset(-0.12em)" }}
          >
            {w.text}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-[0.12em] bottom-[-0.12em] bg-current origin-bottom transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: revealed ? "scaleY(0)" : "scaleY(1)",
                transitionDelay: `${baseDelayMs + idx * staggerMs}ms`,
              }}
            />
          </span>{" "}
          {w.breakAfter && <br className="hidden md:inline" />}
        </React.Fragment>
      ))}
    </>
  )
}

// ─── 3. Component Logic ─────────────────────────────────────────────────────
export default function LoginPage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setRevealed(true)
      return
    }
    const timer = window.setTimeout(() => setRevealed(true), 60)
    return () => window.clearTimeout(timer)
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
  }

  const heroTitleWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Portal" },
          { text: "de", breakAfter: true },
          { text: "clientes.", muted: true },
        ]
      : [
          { text: "Client", breakAfter: true },
          { text: "portal.", muted: true },
        ]

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      <section className="flex-1 flex items-center w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[136px] md:pt-[164px] pb-24 md:pb-32">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-y-14 lg:gap-x-16 items-start pt-8 border-t border-bg-dark/12">
          {/* Columna Izquierda: Titular Editorial y Estado Operativo */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 font-mono uppercase text-[12px] tracking-[0.04em] text-text-base mb-7">
              <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
              <span>{t("OLA CONSOLE · CLIENT ACCESS", "CONSOLA OLA · ACCESO CLIENTES")}</span>
            </div>

            <h1 className="text-[clamp(3rem,calc(3rem+0.07*(100vw-27.5rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.02] mb-8">
              <WordRevealText words={heroTitleWords} revealed={revealed} staggerMs={95} />
            </h1>

            <p className="text-[clamp(1.0625rem,calc(1.0625rem+0.005*(100vw-27.5rem)),1.3125rem)] font-normal tracking-[-0.015em] leading-[1.4] text-text-base/75 max-w-[42ch] mb-12">
              {t(
                "Manage your colocation telemetry, out-of-band KVM/IPMI consoles, sovereign GPU clusters, and direct 24×7 NOC tickets.",
                "Gestiona la telemetría de tus racks de colocation, consolas KVM/IPMI fuera de banda, clústeres GPU soberanos y tickets directos con el NOC 24×7."
              )}
            </p>

            <div className="inline-flex items-center gap-3 pt-6 border-t border-bg-dark/12 font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55">
              <span className="w-2 h-2 rounded-full bg-primary-hover animate-pulse" aria-hidden />
              <span>
                {t(
                  "ALL SYSTEMS OPERATIONAL",
                  "TODOS LOS SISTEMAS OPERATIVOS"
                )}
              </span>
            </div>
          </div>

          {/* Columna Derecha: Formulario Desnudo Desplazado a la Izquierda para Respirar a la Derecha */}
          <div className="lg:col-span-5 lg:col-start-7 lg:pt-12">
            <form onSubmit={handleSubmit} className="space-y-10" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2"
                >
                  01 / {t("WORK EMAIL", "CORREO ELECTRÓNICO")}
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@empresa.com"
                  className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[19px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors rounded-none"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <label
                    htmlFor="login-password"
                    className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55"
                  >
                    02 / {t("PASSWORD", "CONTRASEÑA")}
                  </label>
                  <Link
                    href="/contact"
                    className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/50 hover:text-text-base transition-colors"
                  >
                    {t("Forgot password?", "¿Has olvidado tu contraseña?")}
                  </Link>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[19px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors rounded-none"
                />
              </div>

              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <ArrowCta type="submit">
                  {t("Sign in", "Iniciar sesión")}
                </ArrowCta>

                <div className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/55">
                  {t("Need credentials?", "¿Necesitas acceso?")}{" "}
                  <Link
                    href="/contact"
                    className="text-text-base underline decoration-bg-dark/30 underline-offset-4 hover:decoration-bg-dark transition-colors ml-1"
                  >
                    {t("Contact engineering", "Contactar con ingeniería")}
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

/*
 * ─── 5. Documentación de Memoria ────────────────────────────────────────────
 * - Decisión técnica: Se eliminaron tanto el `PageHero` oscuro como la tarjeta
 *   blanca con sombra (`bg-white rounded-xl shadow-2xl p-8`). El acceso al portal
 *   se presenta directamente sobre el lienzo `bg-bg-light` (`#f7f7f5`) con campos
 *   de línea inferior (`border-b border-bg-dark/25`), etiquetas técnicas `font-mono`
 *   y el botón paralelogramo `ArrowCta`.
 * - Edge cases cubiertos:
 *   1. `autoComplete="username"` y `autoComplete="current-password"` para soporte
 *      óptimo de gestores de contraseñas (1Password, Keychain, Bitwarden).
 *   2. `rounded-none` previene bordes redondeados por defecto en iOS Safari.
 */
