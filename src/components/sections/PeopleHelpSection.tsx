"use client"

/**
 * PeopleHelpSection — Sección final de acompañamiento cercano en la Home.
 * Inspirada en el bloque de asesoramiento personal ("Nos gusta ayudarte con tus
 * nuevos proyectos") y adaptada al lenguaje editorial de OLA Datacenter:
 *  - Fotografía `ola-people.jpg` con etiquetas flotantes minimalistas junto a
 *    cada persona (**Álvaro Vallina** y **Raquel Sanz**) usando el mismo estilo
 *    tipográfico `font-mono` + indicador cuadrado verde lima del sistema.
 *  - Titular bitono con revelación por cortina (`WordRevealText`), textos limpios
 *    y botón paralelogramo `ArrowCta`.
 */

import React, { useEffect, useRef, useState } from "react"
import Image from "next/image"
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

interface PersonBadgeDef {
  id: string
  name: string
  roleEs: string
  roleEn: string
  positionClass: string
  pointerSide: "left" | "right"
  delayMs: number
}

// ─── 2. Constants & Helpers ─────────────────────────────────────────────────
const PEOPLE_BADGES: PersonBadgeDef[] = [
  {
    id: "alvaro",
    name: "Álvaro Vallina",
    roleEs: "Guía OLA",
    roleEn: "OLA Guide",
    positionClass: "left-[3.5%] top-[24%] sm:left-[4.5%] sm:top-[26%]",
    pointerSide: "right",
    delayMs: 220,
  },
  {
    id: "raquel",
    name: "Raquel Sanz",
    roleEs: "Guía OLA",
    roleEn: "OLA Guide",
    positionClass: "right-[4%] top-[43%] sm:right-[6%] sm:top-[44%]",
    pointerSide: "left",
    delayMs: 380,
  },
]

/**
 * Renderiza una secuencia de palabras con el efecto de cortina `.text-reveal-overlay`
 * animado por compositor GPU (`transform: scaleY`).
 */
function WordRevealText({
  words,
  revealed,
  staggerMs = 80,
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
      { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
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
      className="bg-bg-light pt-4 pb-24 md:pb-32 text-text-base overflow-hidden"
    >
      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-14 items-center pt-14 md:pt-20 border-t border-bg-dark/12">
          {/* Columna Izquierda: Imagen `ola-people.jpg` con etiquetas junto a cada persona */}
          <div className="lg:col-span-7">
            <figure className="relative w-full aspect-[3/2] rounded-[14px] lg:rounded-[24px] overflow-hidden bg-bg-dark border border-bg-dark/10">
              <Image
                src="/ola-people.jpg"
                alt={t(
                  "Álvaro Vallina and Raquel Sanz at OLA Datacenter",
                  "Álvaro Vallina y Raquel Sanz en OLA Datacenter"
                )}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 58vw"
                className={cn(
                  "object-cover object-center transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                  revealed ? "scale-100" : "scale-[1.05]"
                )}
              />

              {/* Sutil viñeteado inferior para dar profundidad sin tapar las figuras */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-dark/20 via-transparent to-transparent"
              />

              {/* Etiquetas flotantes en pequeño al lado de cada persona */}
              {PEOPLE_BADGES.map((person) => (
                <figcaption
                  key={person.id}
                  style={{ transitionDelay: `${person.delayMs}ms` }}
                  className={cn(
                    "absolute z-10 inline-flex items-center gap-2 bg-surface-light/92 backdrop-blur-md text-text-base rounded-[8px] px-2.5 py-1.5 sm:px-3 sm:py-2 border border-bg-dark/10 shadow-[0_8px_24px_-8px_rgba(34,47,48,0.22)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    person.positionClass,
                    revealed
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-3"
                  )}
                >
                  {person.pointerSide === "left" && (
                    <span
                      aria-hidden
                      className="w-1.5 h-1.5 bg-primary-hover shrink-0"
                    />
                  )}

                  <div className="leading-none">
                    <div className="text-[11px] sm:text-[12px] font-medium tracking-[-0.01em] text-text-base">
                      {person.name}
                    </div>
                    <div className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.05em] text-text-base/60 mt-1">
                      {lang === "es" ? person.roleEs : person.roleEn}
                    </div>
                  </div>

                  {person.pointerSide === "right" && (
                    <span
                      aria-hidden
                      className="w-1.5 h-1.5 bg-primary-hover shrink-0"
                    />
                  )}
                </figcaption>
              ))}
            </figure>
          </div>

          {/* Columna Derecha: Mensaje Editorial + CTA */}
          <div className="lg:col-span-5 lg:pl-2">
            <div
              className={cn(
                "inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.05em] text-text-base mb-5 transition-all duration-700 ease-out",
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
            >
              <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
              <span>{t("HUMAN ENGINEERING TEAM", "EQUIPO CERCANO · GUÍA OLA")}</span>
            </div>

            <h2 className="text-[clamp(2rem,calc(2rem+0.028*(100vw-27.5rem)),3.75rem)] font-normal tracking-[-0.03em] leading-[1.06] mb-7">
              <WordRevealText words={headlineWords} revealed={revealed} staggerMs={75} />
            </h2>

            <div
              style={{ transitionDelay: "220ms" }}
              className={cn(
                "space-y-4 text-[16px] md:text-[17px] text-text-base/75 leading-[1.52] max-w-[46ch] mb-9 transition-all duration-700 ease-out",
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

            <div
              style={{ transitionDelay: "340ms" }}
              className={cn(
                "transition-all duration-700 ease-out",
                revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <ArrowCta href="/contact">
                {t("Get help", "Obtener ayuda")}
              </ArrowCta>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/*
 * ─── 5. Documentación de Memoria ────────────────────────────────────────────
 * - Decisión técnica: Se integró la imagen `ola-people.jpg` en una sección
 *   editorial de 12 columnas al cierre de la Home, posicionando las etiquetas
 *   flotantes de **Álvaro Vallina** (`left-[4.5%] top-[26%]`) y **Raquel Sanz**
 *   (`right-[6%] top-[44%]`) en las zonas limpias junto a cada persona para no
 *   solapar ni sus rostros ni el logotipo luminoso de OLA en la pared.
 * - Edge cases cubiertos:
 *   1. En pantallas móviles (`<640px`), las etiquetas reducen su padding y
 *      tamaño tipográfico (`text-[11px]` / `text-[9px]`) manteniendo sus
 *      coordenadas porcentuales relativas al aspect-ratio `3/2`.
 *   2. Soporte completo para `prefers-reduced-motion: reduce`.
 */
