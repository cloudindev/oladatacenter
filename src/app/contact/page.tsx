"use client"

/**
 * ContactPage (`/contact`) — Diseño editorial minimalista adaptado al sistema
 * visual de OLA Datacenter (inspirado en integratedbio.com):
 *  - Hero tipográfico bitono con cortina por palabra (`.text-reveal-overlay`).
 *  - Formulario abierto sobre el lienzo `bg-bg-light` (`#f7f7f5`) sin tarjetas,
 *    sin cajas ni sombras: líneas inferiores puras (`border-b border-bg-dark/20`),
 *    etiquetas técnicas `font-mono` en mayúsculas y botón paralelogramo `ArrowCta`.
 */

import React, { useEffect, useState } from "react"
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

interface TopicOption {
  id: string
  labelEs: string
  labelEn: string
}

interface ContactChannel {
  code: string
  labelEs: string
  labelEn: string
  valueEs: string
  valueEn: string
  href?: string
}

// ─── 2. Constants & Helpers ─────────────────────────────────────────────────
const TOPICS: TopicOption[] = [
  { id: "colocation", labelEs: "Colocation", labelEn: "Colocation" },
  { id: "ia-cloud", labelEs: "IA Cloud & GPUs", labelEn: "AI Cloud & GPUs" },
  { id: "dedicated", labelEs: "Servidores Dedicados", labelEn: "Dedicated Servers" },
  { id: "connectivity", labelEs: "Conectividad", labelEn: "Connectivity" },
  { id: "other", labelEs: "Consulta General", labelEn: "General Inquiry" },
]

const CHANNELS: ContactChannel[] = [
  {
    code: "01",
    labelEs: "INGENIERÍA Y VENTAS",
    labelEn: "ENGINEERING & SALES",
    valueEs: "sales@oladc.com",
    valueEn: "sales@oladc.com",
    href: "mailto:sales@oladc.com",
  },
  {
    code: "02",
    labelEs: "SOPORTE NOC 24×7",
    labelEn: "24×7 NOC SUPPORT",
    valueEs: "support@oladc.com",
    valueEn: "support@oladc.com",
    href: "mailto:support@oladc.com",
  },
  {
    code: "03",
    labelEs: "CAMPUS Y SEDE TÉCNICA",
    labelEn: "CAMPUS & HEADQUARTERS",
    valueEs: "Madrid, España · Operación Europea Soberana",
    valueEn: "Madrid, Spain · Sovereign European Operations",
  },
  {
    code: "04",
    labelEs: "TIEMPO DE RESPUESTA",
    labelEn: "RESPONSE SLA",
    valueEs: "< 15 min · Acceso directo a ingenieros de sistemas",
    valueEn: "< 15 min · Direct access to systems engineers",
  },
]

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
export default function ContactPage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<string>("colocation")
  const [submitted, setSubmitted] = useState(false)

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
    setSubmitted(true)
  }

  const heroTitleWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Habla" },
          { text: "con", breakAfter: true },
          { text: "nuestro", muted: true },
          { text: "equipo.", muted: true },
        ]
      : [
          { text: "Talk" },
          { text: "to", breakAfter: true },
          { text: "our", muted: true },
          { text: "team.", muted: true },
        ]

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── Cabecera Editorial ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[132px] md:pt-[156px] pb-12 md:pb-16">
        <div className="inline-flex items-center gap-2 font-mono uppercase text-[12px] tracking-[0.04em] text-text-base mb-7">
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{t("DIRECT CONTACT · SPAIN", "CONTACTO DIRECTO · ESPAÑA")}</span>
        </div>

        <h1 className="text-[clamp(3rem,calc(3rem+0.075*(100vw-27.5rem)),7.5rem)] font-normal tracking-[-0.03em] leading-[1.02] pb-12 md:pb-16 border-b border-bg-dark/12">
          <WordRevealText words={heroTitleWords} revealed={revealed} staggerMs={95} />
        </h1>
      </section>

      {/* ── Cuerpo Principal: Información Directa + Formulario Abierto (Sin Cards) ── */}
      <section className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pb-24 md:pb-36">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-16 lg:gap-x-16 items-start">
          {/* Columna Izquierda: Contexto y Canales Directos */}
          <div className="lg:col-span-5 lg:pr-6">
            <p className="text-[clamp(1.0625rem,calc(1.0625rem+0.005*(100vw-27.5rem)),1.375rem)] font-normal tracking-[-0.015em] leading-[1.38] text-text-base/80 mb-12 max-w-[46ch]">
              {t(
                "Whether you are planning a single rack deployment, a private cage, or a dedicated sovereign AI cluster, you will speak directly with the engineers who design and operate our infrastructure.",
                "Tanto si proyectas desplegar un único rack, una jaula privada o un clúster de IA soberana a medida, hablarás directamente con los ingenieros que diseñan y operan nuestra infraestructura."
              )}
            </p>

            <div className="divide-y divide-bg-dark/12 border-t border-b border-bg-dark/12">
              {CHANNELS.map((ch) => (
                <div key={ch.code} className="py-5 flex items-baseline justify-between gap-6">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/45 mb-1.5">
                      {ch.code} / {lang === "es" ? ch.labelEs : ch.labelEn}
                    </div>
                    {ch.href ? (
                      <a
                        href={ch.href}
                        className="text-[18px] md:text-[20px] font-normal tracking-[-0.02em] text-text-base hover:text-accent-ink transition-colors underline decoration-bg-dark/25 underline-offset-4 hover:decoration-bg-dark"
                      >
                        {lang === "es" ? ch.valueEs : ch.valueEn}
                      </a>
                    ) : (
                      <div className="text-[16px] md:text-[17px] font-normal tracking-[-0.01em] text-text-base">
                        {lang === "es" ? ch.valueEs : ch.valueEn}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Columna Derecha: Formulario Limpio Directamente Sobre el Fondo (Sin Card) */}
          <div className="lg:col-span-7">
            {submitted ? (
              <div className="py-12 border-t border-b border-bg-dark/15">
                <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-4">
                  <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
                  <span>{t("REQUEST RECEIVED", "SOLICITUD RECIBIDA")}</span>
                </div>
                <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] font-normal tracking-[-0.03em] leading-[1.1] text-text-base mb-4">
                  {t(
                    "Thank you. An infrastructure engineer will contact you shortly.",
                    "Gracias. Un ingeniero de infraestructura contactará contigo en breve."
                  )}
                </h2>
                <p className="text-[16px] text-text-base/70 mb-8 max-w-[52ch]">
                  {t(
                    "We have logged your technical inquiry and assigned it directly to our engineering desk in Spain.",
                    "Hemos registrado tu consulta técnica y la hemos asignado directamente a nuestro equipo de ingeniería en España."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="font-mono text-[12px] uppercase tracking-[0.05em] text-text-base underline underline-offset-4 hover:text-accent-ink transition-colors cursor-pointer"
                >
                  {t("Send another message", "Enviar otra consulta")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-12" noValidate>
                {/* Selector minimalista de área de interés */}
                <div>
                  <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-4">
                    01 / {t("AREA OF INTEREST", "ÁREA DE INTERÉS")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((topic) => {
                      const active = selectedTopic === topic.id
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => setSelectedTopic(topic.id)}
                          aria-pressed={active}
                          className={cn(
                            "px-4 py-2 rounded-[8px] font-mono text-[12px] uppercase tracking-[0.03em] transition-colors duration-200 cursor-pointer border",
                            active
                              ? "bg-bg-dark text-white border-bg-dark"
                              : "bg-transparent text-text-base/75 border-bg-dark/18 hover:border-bg-dark/45 hover:text-text-base"
                          )}
                        >
                          {lang === "es" ? topic.labelEs : topic.labelEn}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Fila 1: Nombre y Empresa */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2"
                    >
                      02 / {t("FULL NAME *", "NOMBRE Y APELLIDOS *")}
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder={t("Alex Rivera", "Alex Rivera")}
                      className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[18px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors rounded-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-company"
                      className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2"
                    >
                      03 / {t("COMPANY / ORGANIZATION", "EMPRESA / ORGANIZACIÓN")}
                    </label>
                    <input
                      id="contact-company"
                      name="company"
                      type="text"
                      autoComplete="organization"
                      placeholder={t("Company Ltd.", "Empresa S.L.")}
                      className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[18px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors rounded-none"
                    />
                  </div>
                </div>

                {/* Fila 2: Email Corporativo y Teléfono */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2"
                    >
                      04 / {t("WORK EMAIL *", "EMAIL CORPORATIVO *")}
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="nombre@empresa.com"
                      className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[18px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors rounded-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-phone"
                      className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2"
                    >
                      05 / {t("PHONE (OPTIONAL)", "TELÉFONO (OPCIONAL)")}
                    </label>
                    <input
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+34 600 000 000"
                      className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[18px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors rounded-none"
                    />
                  </div>
                </div>

                {/* Fila 3: Mensaje / Requisitos Técnicos */}
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2"
                  >
                    06 / {t("PROJECT OR TECHNICAL REQUIREMENTS *", "PROYECTO O REQUISITOS TÉCNICOS *")}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={3}
                    required
                    placeholder={t(
                      "Tell us about your power density, rack count, GPU requirements, or connectivity needs...",
                      "Cuéntanos la potencia requerida, número de U/racks, necesidades de GPU o conectividad..."
                    )}
                    className="w-full bg-transparent border-0 border-b border-bg-dark/25 pb-3 pt-1 text-[18px] text-text-base placeholder:text-text-base/25 focus:outline-none focus:border-bg-dark transition-colors resize-y rounded-none"
                  />
                </div>

                {/* Pie del formulario: Botón Paralelogramo + Nota de Privacidad */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <ArrowCta type="submit">
                    {t("Send Message", "Enviar consulta")}
                  </ArrowCta>

                  <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-text-base/45 max-w-[34ch] leading-relaxed">
                    {t(
                      "100% confidential · Processed in Spain under GDPR & ENS High.",
                      "100% confidencial · Tratado en España bajo RGPD y ENS Alto."
                    )}
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

/*
 * ─── 5. Documentación de Memoria ────────────────────────────────────────────
 * - Decisión técnica: Se eliminó por completo el contenedor `.bg-white.shadow-lg`
 *   (card) que encerraba el formulario y el `PageHero` oscuro. En su lugar se
 *   adoptó la arquitectura editorial de OLA Datacenter sobre `bg-bg-light` (`#f7f7f5`),
 *   con campos de línea inferior (`border-b border-bg-dark/25`), numeración técnica
 *   `01..06` en `font-mono` y el botón paralelogramo `ArrowCta` en modo `submit`.
 * - Edge cases cubiertos:
 *   1. `rounded-none` en inputs y textarea evita que iOS Safari aplique bordes
 *      redondeados nativos a la línea inferior.
 *   2. Atributos `autoComplete` estándar (`name`, `organization`, `email`, `tel`)
 *      y asociación explícita `htmlFor`/`id` para accesibilidad AA.
 */
