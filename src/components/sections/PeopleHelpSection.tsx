"use client"

/**
 * PeopleHelpSection — Banda full-width de cierre en la Home con estética
 * techie/editorial minimalista:
 *  - Banda a sangre (`w-full bg-surface-beige`) con retícula técnica CAD sutil,
 *    marcas de registro (`+`) y rieles de telemetría superior/inferior.
 *  - Recorte tipo collage geométrico sobre `ola-people.jpg` mediante `<clipPath>`
 *    arquitectónico en 3 módulos sincronizados (Álvaro, Raquel + logo OLA en
 *    pared, y detalle inferior de marca) con contornos técnicos 1px desplazados.
 *  - Nombres de **Álvaro Vallina** y **Raquel Sanz** sin cards (`cardless`),
 *    integrados directamente sobre el fondo en los espacios negativos del
 *    collage y conectados mediante líneas guía CAD ortogonales y nodos lima.
 */

import React, { useEffect, useRef, useState } from "react"
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
  staggerMs = 75,
  baseDelayMs = 0,
}: WordRevealTextProps) {
  return (
    <>
      {words.map((w, idx) => (
        <React.Fragment key={`${w.text}-${idx}`}>
          <span
            className={cn(
              "relative inline-block align-bottom",
              w.muted ? "text-[#9a9c8e]" : "text-text-base"
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

/**
 * Cruce técnico de registro CAD (`+`) para las esquinas de la banda.
 */
function Crosshair({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none select-none font-mono text-[13px] leading-none text-bg-dark/30",
        className
      )}
    >
      +
    </span>
  )
}

// ─── 3. Component Logic ─────────────────────────────────────────────────────
export function PeopleHelpSection() {
  const { lang, t } = useLanguage()
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const headlineWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Nos" },
          { text: "gusta" },
          { text: "ayudarte" },
          { text: "con", breakAfter: true },
          { text: "tus", muted: true },
          { text: "nuevos", muted: true },
          { text: "proyectos.", muted: true },
        ]
      : [
          { text: "We" },
          { text: "love" },
          { text: "helping" },
          { text: "you", breakAfter: true },
          { text: "with", muted: true },
          { text: "new", muted: true },
          { text: "projects.", muted: true },
        ]

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      className="relative w-full bg-surface-beige text-text-base border-t border-bg-dark/12 overflow-hidden"
    >
      {/* Retícula técnica CAD de fondo a ancho completo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(34,47,48,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,47,48,0.045)_1px,transparent_1px)] bg-[size:56px_56px]"
      />

      {/* Riel superior de telemetría full-width */}
      <div className="relative z-10 w-full border-b border-bg-dark/10">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] h-9 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/45">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-primary-hover inline-block" />
            <span>SYS.HUMAN_DESK // DIRECT_ACCESS</span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <span>LATENCY: 0_INTERMEDIARIES</span>
            <span>LOC: ES_MAD</span>
          </div>
        </div>
      </div>

      {/* Cuerpo principal dentro del contenedor de 1600px sobre la banda full-width */}
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 md:px-[44px] py-16 md:py-24">
        <Crosshair className="absolute top-4 left-6 md:left-[44px]" />
        <Crosshair className="absolute top-4 right-6 md:right-[44px]" />
        <Crosshair className="absolute bottom-4 left-6 md:left-[44px]" />
        <Crosshair className="absolute bottom-4 right-6 md:right-[44px]" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-center">
          {/* ── COLUMNA IZQUIERDA (7 cols): Collage Geométrico + Nombres Sin Cards ── */}
          <div className="lg:col-span-7">
            <div
              className={cn(
                "relative w-full transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
            >
              <svg
                viewBox="0 0 1060 690"
                fill="none"
                role="img"
                aria-label={t(
                  "Álvaro Vallina and Raquel Sanz — OLA Datacenter team",
                  "Álvaro Vallina y Raquel Sanz — Equipo de OLA Datacenter"
                )}
                className="w-full h-auto block overflow-visible"
              >
                <defs>
                  {/*
                   * Máscara de collage en 4 paneles geométricos escalonados que
                   * comparten la misma proyección continua de `ola-people.jpg`:
                   *  - Panel 1 (Izquierda vertical): Álvaro Vallina.
                   *  - Panel 2 (Centro): Raquel Sanz con su portátil.
                   *  - Panel 3 (Arriba derecha): Logotipo verde OLA iluminado en pared.
                   *  - Panel 4 (Abajo derecha): Detalle de botella/cuaderno OLA.
                   * Esto libera dos grandes espacios negativos (arriba-izquierda y
                   * centro-derecha) donde viven los nombres desnudos (sin cards).
                   */}
                  <clipPath id="ola-people-collage-clip">
                    {/* Panel 1: Álvaro Vallina (columna vertical izquierda) */}
                    <rect x="186" y="14" width="248" height="612" rx="16" />
                    {/* Panel 2: Raquel Sanz (módulo central escalonado) */}
                    <rect x="444" y="188" width="298" height="482" rx="16" />
                    {/* Panel 3: Puente superior + Logo OLA en la pared */}
                    <rect x="596" y="58" width="392" height="176" rx="16" />
                    {/* Panel 4: Muesca inferior derecha (detalle mesa OLA) */}
                    <rect x="752" y="488" width="236" height="182" rx="14" />
                  </clipPath>
                </defs>

                {/* ── 1. Contornos CAD desplazados (wireframes técnicos detrás del collage) ── */}
                <g
                  stroke="#222f30"
                  strokeOpacity="0.22"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                >
                  <rect x="176" y="24" width="248" height="612" rx="16" />
                  <rect x="454" y="198" width="298" height="482" rx="16" />
                  <rect x="606" y="48" width="392" height="176" rx="16" />
                  <rect x="762" y="498" width="236" height="182" rx="14" />
                </g>

                {/* Líneas técnicas de cota y registro del collage */}
                <g stroke="#222f30" strokeOpacity="0.18" strokeWidth="1">
                  {/* Escuadra superior izquierda sobre el panel de Álvaro */}
                  <path d="M186 4 H434 M186 0 V8 M434 0 V8" />
                  {/* Escuadra inferior izquierda */}
                  <path d="M186 646 H434" strokeDasharray="2 3" />
                  {/* Cruces de registro en las intersecciones del collage */}
                  <path d="M439 170 V182 M433 176 H445" />
                  <path d="M747 240 V252 M741 246 H753" />
                  <path d="M747 472 V484 M741 478 H753" />
                </g>

                {/* Etiqueta técnica de coordenadas del recorte */}
                <text
                  x="188"
                  y="664"
                  fill="#222f30"
                  fillOpacity="0.45"
                  fontSize="10"
                  fontFamily="var(--font-mono), monospace"
                  letterSpacing="0.08em"
                >
                  FIG.04 // MULTI-FRAME COLLAGE [1024×682]
                </text>

                {/* ── 2. Fotografía `ola-people.jpg` proyectada dentro del Collage ── */}
                <g clipPath="url(#ola-people-collage-clip)">
                  <image
                    href="/ola-people.jpg"
                    x="0"
                    y="0"
                    width="1024"
                    height="682"
                    preserveAspectRatio="xMidYMid slice"
                  />
                  {/* Sutil borde interno sobre cada pieza del collage */}
                  <rect
                    x="186"
                    y="14"
                    width="248"
                    height="612"
                    rx="16"
                    stroke="#222f30"
                    strokeOpacity="0.18"
                    strokeWidth="2"
                  />
                  <rect
                    x="444"
                    y="188"
                    width="298"
                    height="482"
                    rx="16"
                    stroke="#222f30"
                    strokeOpacity="0.18"
                    strokeWidth="2"
                  />
                  <rect
                    x="596"
                    y="58"
                    width="392"
                    height="176"
                    rx="16"
                    stroke="#222f30"
                    strokeOpacity="0.18"
                    strokeWidth="2"
                  />
                  <rect
                    x="752"
                    y="488"
                    width="236"
                    height="182"
                    rx="14"
                    stroke="#222f30"
                    strokeOpacity="0.18"
                    strokeWidth="2"
                  />
                </g>

                {/* ── 3. Callout Techie SIN CARD: ÁLVARO VALLINA (Espacio negativo izquierdo) ── */}
                <g>
                  {/* Línea guía ortogonal desde el hombro de Álvaro (x=236, y=210) hacia la izquierda (x=8, y=170) */}
                  <polyline
                    points="236,210 156,210 138,184 8,184"
                    stroke="#222f30"
                    strokeWidth="1.1"
                    strokeOpacity="0.55"
                    fill="none"
                  />
                  {/* Nodo de anclaje sobre Álvaro */}
                  <circle
                    cx="236"
                    cy="210"
                    r="6"
                    stroke="#CEF79E"
                    strokeWidth="1.2"
                    fill="#222f30"
                  />
                  <rect x="233.5" y="207.5" width="5" height="5" fill="#CEF79E" />

                  {/* Indicador cuadrado verde + Índice técnico (sin caja ni card) */}
                  <rect x="8" y="132" width="7" height="7" fill="#a7e26e" />
                  <text
                    x="22"
                    y="139"
                    fill="#222f30"
                    fillOpacity="0.5"
                    fontSize="10"
                    fontFamily="var(--font-mono), monospace"
                    letterSpacing="0.08em"
                  >
                    ID.01 // OLA_TEAM
                  </text>

                  {/* Nombre desnudo al lado de Álvaro */}
                  <text
                    x="8"
                    y="160"
                    fill="#222f30"
                    fontSize="15"
                    fontWeight="500"
                    fontFamily="var(--font-sans), sans-serif"
                    letterSpacing="-0.02em"
                  >
                    Álvaro Vallina
                  </text>

                  {/* Rol en monospace debajo de la línea guía */}
                  <text
                    x="8"
                    y="202"
                    fill="#222f30"
                    fillOpacity="0.6"
                    fontSize="10.5"
                    fontFamily="var(--font-mono), monospace"
                    letterSpacing="0.08em"
                  >
                    {lang === "es" ? "GUÍA OLA · CLOUD & IA" : "OLA GUIDE · CLOUD & AI"}
                  </text>
                </g>

                {/* ── 4. Callout Techie SIN CARD: RAQUEL SANZ (Espacio negativo derecho) ── */}
                <g>
                  {/* Línea guía ortogonal desde Raquel (x=632, y=365) hacia la muesca derecha (x=1048, y=340) */}
                  <polyline
                    points="632,365 768,365 786,340 1048,340"
                    stroke="#222f30"
                    strokeWidth="1.1"
                    strokeOpacity="0.55"
                    fill="none"
                  />
                  {/* Nodo de anclaje sobre Raquel */}
                  <circle
                    cx="632"
                    cy="365"
                    r="6"
                    stroke="#CEF79E"
                    strokeWidth="1.2"
                    fill="#222f30"
                  />
                  <rect x="629.5" y="362.5" width="5" height="5" fill="#CEF79E" />

                  {/* Indicador cuadrado verde + Índice técnico (sin caja ni card) */}
                  <rect x="792" y="288" width="7" height="7" fill="#a7e26e" />
                  <text
                    x="806"
                    y="295"
                    fill="#222f30"
                    fillOpacity="0.5"
                    fontSize="10"
                    fontFamily="var(--font-mono), monospace"
                    letterSpacing="0.08em"
                  >
                    ID.02 // OLA_TEAM
                  </text>

                  {/* Nombre desnudo al lado de Raquel */}
                  <text
                    x="792"
                    y="316"
                    fill="#222f30"
                    fontSize="15"
                    fontWeight="500"
                    fontFamily="var(--font-sans), sans-serif"
                    letterSpacing="-0.02em"
                  >
                    Raquel Sanz
                  </text>

                  {/* Rol en monospace debajo de la línea guía */}
                  <text
                    x="792"
                    y="358"
                    fill="#222f30"
                    fillOpacity="0.6"
                    fontSize="10.5"
                    fontFamily="var(--font-mono), monospace"
                    letterSpacing="0.08em"
                  >
                    {lang === "es" ? "GUÍA OLA · PROYECTOS" : "OLA GUIDE · PROJECTS"}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* ── COLUMNA DERECHA (5 cols): Editorial Techie + CTA ── */}
          <div className="lg:col-span-5 lg:pl-4">
            <div
              className={cn(
                "inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-5 transition-all duration-700 ease-out",
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
              <span>{t("HUMAN ENGINEERING TEAM", "INGENIERÍA CERCANA · GUÍA OLA")}</span>
            </div>

            <h2 className="text-[clamp(2.15rem,calc(2.15rem+0.03*(100vw-27.5rem)),3.85rem)] font-normal tracking-[-0.03em] leading-[1.04] mb-7">
              <WordRevealText words={headlineWords} revealed={revealed} staggerMs={75} />
            </h2>

            <div
              style={{ transitionDelay: "220ms" }}
              className={cn(
                "space-y-4 text-[16px] md:text-[17px] text-text-base/75 leading-[1.52] max-w-[44ch] mb-9 transition-all duration-700 ease-out",
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <p>
                {t(
                  "Not sure exactly what you need or how to start online? Send us an email or call us. We will be delighted to help you, even if you are not a client yet.",
                  "¿No sabes exactamente qué necesitas o cómo empezar online? Escríbenos un email o llámanos. Estaremos encantados de ayudarte, aunque no seas nuestro cliente."
                )}
              </p>
              <p className="text-text-base font-normal">
                {t(
                  "We will assist you directly or get back to you as soon as possible.",
                  "Te atenderemos o nos pondremos en contacto contigo cuanto antes."
                )}
              </p>
            </div>

            {/* Línea técnica divisoria + Botón paralelogramo */}
            <div
              style={{ transitionDelay: "340ms" }}
              className={cn(
                "pt-6 border-t border-bg-dark/12 flex flex-wrap items-center justify-between gap-6 transition-all duration-700 ease-out",
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <ArrowCta href="/contact">
                {t("Get help", "Obtener ayuda")}
              </ArrowCta>

              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/45">
                {t("DIRECT_CHANNEL // 24×7", "CANAL_DIRECTO // 24×7")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/*
 * ─── 5. Documentación de Memoria ────────────────────────────────────────────
 * - Decisión técnica: Se rediseñó la sección como una banda full-width (`w-full
 *   bg-surface-beige`) con retícula CAD, riel superior de telemetría y un
 *   collage geométrico SVG de 4 paneles (`#ola-people-collage-clip`) que recorta
 *   `ola-people.jpg` de forma asimétrica. Los nombres de **Álvaro Vallina** y
 *   **Raquel Sanz** se renderizan sin cards (`cardless`) directamente sobre el
 *   fondo en las muescas negativas del collage, unidos a cada persona mediante
 *   líneas guía ortogonales de 1px y nodos en verde lima.
 * - Edge cases cubiertos:
 *   1. Al formar parte del mismo coordinate space (`viewBox="0 0 1060 690"`),
 *      los paneles del collage y las líneas guía hacia Álvaro y Raquel mantienen
 *      su alineación milimétrica en cualquier resolución de pantalla.
 *   2. Soporte completo para `prefers-reduced-motion: reduce`.
 */
