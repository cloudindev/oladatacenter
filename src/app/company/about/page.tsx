"use client"

/**
 * AboutPage (`/company/about`) — Réplica 1:1 de `https://integratedbio.com/company/`
 * adaptada a la identidad visual de OLA Datacenter:
 *  - Tipografía Aspekta + Roboto Mono (`font-mono`).
 *  - Paleta oficial: `#f7f7f5` (`bg-bg-light`), `#222f30` (`text-text-base` / `bg-bg-dark`),
 *    `#c9cbbe` (sage mist para palabras secundarias), `#cef79e` (`bg-primary`) y `#e7e8e0` (`bg-surface-beige`).
 *  - Animaciones de entrada idénticas a la Home (`IntegratedPlatformSection`):
 *    1. Cortina por palabra (`.text-reveal-overlay` con `scaleY(1 -> 0)` en `800ms`, `cubic-bezier(0.16,1,0.3,1)`).
 *    2. Bloques `.inview-element` (`opacity: 0 -> 1`, `translateY(20px -> 0)`).
 *    3. Tarjetas a sangre con barrido `clip-path` horizontal (`polygon(0 0, 100% 0, 100% 100%, 0 100%)`).
 *    4. Tarjetas con muesca orgánica inferior derecha (`viewBox="0 0 87 90"`) y botón paralelogramo `u-btn--2`.
 */

import React, { useEffect, useRef, useState } from "react"
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

interface PillarCardDef {
  index: string
  bgClass: string
  textClass: string
  headingEn: string
  headingEs: string
  bodyEn: string
  bodyEs: string
  icon: React.ReactNode
}

interface FacilityCardDef {
  imageSrc: string
  imageAltEn: string
  imageAltEs: string
  titleEn: string
  titleEs: string
  tagEn: string
  tagEs: string
  ctaLabelEn: string
  ctaLabelEs: string
  href: string
}

interface MetricDef {
  value: string
  labelEn: string
  labelEs: string
}

// ─── 2. Constants & Vector Graphics ─────────────────────────────────────────
const PILLAR_CARDS: PillarCardDef[] = [
  {
    index: "01.",
    bgClass: "bg-primary",
    textClass: "text-bg-dark",
    headingEn: "European Data Sovereignty",
    headingEs: "Soberanía Europea del Dato",
    bodyEn:
      "100% European capital and physical facilities in Spain compliant with GDPR, ISO 27001, and ENS High frameworks. Your data never leaves our borders.",
    bodyEs:
      "Capital 100% europeo e infraestructura física en España bajo normativas RGPD, ISO 27001 y ENS Alto. Tus datos nunca salen de nuestras fronteras.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 * Math.PI) / 180
          const x1 = 57 + Math.cos(angle) * 16
          const y1 = 57 + Math.sin(angle) * 16
          const x2 = 57 + Math.cos(angle) * 52
          const y2 = 57 + Math.sin(angle) * 52
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )
        })}
      </svg>
    ),
  },
  {
    index: "02.",
    bgClass: "bg-bg-dark",
    textClass: "text-text-dark",
    headingEn: "Renewable Edge Architecture",
    headingEs: "Arquitectura Edge Renovable",
    bodyEn:
      "Powered by renewable energy with redundant precision cooling, optimized PUE, and carrier-neutral dark fiber rings.",
    bodyEs:
      "Alimentado por energía renovable con climatización de precisión redundante, PUE optimizado y anillos de fibra oscura neutra.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {[48, 39, 30, 21, 12].map((r, i) => (
          <polygon
            key={i}
            points={[0, 1, 2, 3, 4, 5]
              .map((k) => {
                const a = ((k * 60 - 90) * Math.PI) / 180
                return `${57 + Math.cos(a) * r},${57 + Math.sin(a) * r}`
              })
              .join(" ")}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    ),
  },
  {
    index: "03.",
    bgClass: "bg-surface-beige",
    textClass: "text-bg-dark",
    headingEn: "Full Vertical Integration",
    headingEs: "Integración Vertical Propia",
    bodyEn:
      "We engineer our own server hardware, virtualization stack, and high-density GPU clusters with direct 24×7 engineering support.",
    bodyEs:
      "Diseñamos nuestro propio hardware, capa de virtualización y clústeres GPU de alta densidad con soporte de ingeniería 24×7.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {[0, 1, 2].map((layer) => {
          const offset = (layer - 1) * 14
          const r = 34
          const pts = [0, 1, 2, 3, 4, 5].map((k) => {
            const a = ((k * 60 - 90) * Math.PI) / 180
            return [57 + Math.cos(a) * r, 57 + offset + Math.sin(a) * (r * 0.55)] as const
          })
          return (
            <g key={layer}>
              <polygon
                points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                stroke="currentColor"
                strokeWidth="1.15"
              />
              {pts.map(([x, y], idx) => (
                <line
                  key={idx}
                  x1={57}
                  y1={57 + offset}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  opacity="0.65"
                />
              ))}
            </g>
          )
        })}
      </svg>
    ),
  },
]

const FACILITY_CARDS: FacilityCardDef[] = [
  {
    imageSrc: "/ola-datacenter-racks.jpg",
    imageAltEn: "OLA high-density server corridors",
    imageAltEs: "Pasillos de servidores de alta densidad en OLA",
    titleEn: "High-Density Technical Suites",
    titleEs: "Salas Técnicas de Alta Densidad",
    tagEn: "COLOCATION & AI RACKS",
    tagEs: "COLOCATION Y RACKS IA",
    ctaLabelEn: "Explore Colocation",
    ctaLabelEs: "Explorar Colocation",
    href: "/datacenter/colocation",
  },
  {
    imageSrc: "/ola-datacenter-hall.jpg",
    imageAltEn: "OLA glass-partitioned data hall and fire suppression systems",
    imageAltEs: "Sala técnica acristalada y sistemas de seguridad en OLA",
    titleEn: "Security & Continuity by Design",
    titleEs: "Seguridad y Continuidad por Diseño",
    tagEn: "24×7 OPERATIONS & COMPLIANCE",
    tagEs: "OPERACIÓN 24×7 Y CUMPLIMIENTO",
    ctaLabelEn: "View Operations",
    ctaLabelEs: "Ver Operaciones",
    href: "/datacenter/operations",
  },
  {
    imageSrc: "/ola-ai-datacenter.jpg",
    imageAltEn: "OLA Datacenter facility surrounded by nature in Spain",
    imageAltEs: "Edificio de OLA Datacenter rodeado de naturaleza en España",
    titleEn: "Green Edge Campus in Spain",
    titleEs: "Campus Edge Green en España",
    tagEn: "RENEWABLE ENERGY & CARRIER NEUTRAL",
    tagEs: "ENERGÍA RENOVABLE Y RED NEUTRA",
    ctaLabelEn: "Discover Connectivity",
    ctaLabelEs: "Descubrir Conectividad",
    href: "/datacenter/connectivity",
  },
]

const METRICS: MetricDef[] = [
  {
    value: "100%",
    labelEn: "RENEWABLE ENERGY",
    labelEs: "ENERGÍA RENOVABLE",
  },
  {
    value: "< 2 ms",
    labelEn: "LATENCY IN SPAIN",
    labelEs: "LATENCIA EN ESPAÑA",
  },
  {
    value: "99.99%",
    labelEn: "INFRASTRUCTURE SLA",
    labelEs: "SLA DE INFRAESTRUCTURA",
  },
  {
    value: "24×7",
    labelEn: "ON-SITE NOC ENGINEERS",
    labelEs: "INGENIERÍA NOC PROPIA",
  },
]

/**
 * Renderiza una secuencia de palabras con el efecto de cortina `.text-reveal-overlay`
 * idéntico al motor `text-reveal.BAzZnHIM.js` de integratedbio.com.
 * Impacto en rendimiento: O(N) spans ligeros animados exclusivamente por compositor GPU (`transform: scaleY`).
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
export default function AboutPage() {
  const { lang, t } = useLanguage()

  const heroRef = useRef<HTMLElement>(null)
  const mediaBannerRef = useRef<HTMLElement>(null)
  const missionRef = useRef<HTMLElement>(null)
  const multicolRef = useRef<HTMLElement>(null)
  const pillarsRef = useRef<HTMLDivElement>(null)
  const infraHeadingRef = useRef<HTMLElement>(null)
  const facilitiesRef = useRef<HTMLElement>(null)

  const [heroRevealed, setHeroRevealed] = useState(false)
  const [mediaRevealed, setMediaRevealed] = useState(false)
  const [missionRevealed, setMissionRevealed] = useState(false)
  const [multicolRevealed, setMulticolRevealed] = useState(false)
  const [pillarsRevealed, setPillarsRevealed] = useState(false)
  const [infraHeadingRevealed, setInfraHeadingRevealed] = useState(false)
  const [facilitiesRevealed, setFacilitiesRevealed] = useState(false)

  /**
   * Activa cada bloque cuando cruza el 80% superior del viewport (`rootMargin: "0px 0px -18% 0px"`),
   * replicando el comportamiento `ScrollTrigger({ start: "top 80%", once: true })` de integratedbio.com.
   */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setHeroRevealed(true)
      setMediaRevealed(true)
      setMissionRevealed(true)
      setMulticolRevealed(true)
      setPillarsRevealed(true)
      setInfraHeadingRevealed(true)
      setFacilitiesRevealed(true)
      return
    }

    // El hero superior se revela inmediatamente tras montar
    const heroTimer = window.setTimeout(() => setHeroRevealed(true), 60)

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target
          if (target === mediaBannerRef.current) setMediaRevealed(true)
          else if (target === missionRef.current) setMissionRevealed(true)
          else if (target === multicolRef.current) setMulticolRevealed(true)
          else if (target === pillarsRef.current) setPillarsRevealed(true)
          else if (target === infraHeadingRef.current) setInfraHeadingRevealed(true)
          else if (target === facilitiesRef.current) setFacilitiesRevealed(true)
          obs.unobserve(target)
        })
      },
      { threshold: 0, rootMargin: "0px 0px -15% 0px" }
    )

    const targets = [
      mediaBannerRef.current,
      missionRef.current,
      multicolRef.current,
      pillarsRef.current,
      infraHeadingRef.current,
      facilitiesRef.current,
    ]
    targets.forEach((el) => {
      if (el) obs.observe(el)
    })

    return () => {
      window.clearTimeout(heroTimer)
      obs.disconnect()
    }
  }, [])

  const handleScrollToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById("content")
    if (target) {
      target.scrollIntoView({ behavior: "smooth" })
    }
  }

  // Palabras del Hero H1 (`Sobre / OLA Datacenter`)
  const heroTitleWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Sobre", breakAfter: true },
          { text: "OLA", muted: true },
          { text: "Datacenter", muted: true },
        ]
      : [
          { text: "About", breakAfter: true },
          { text: "OLA", muted: true },
          { text: "Datacenter", muted: true },
        ]

  // Palabras del subtítulo del Hero H2
  const heroSubWords: RevealWord[] =
    lang === "es"
      ? "En OLA Datacenter diseñamos y operamos la próxima generación de infraestructura cloud, colocation e IA soberana desde España."
          .split(" ")
          .map((text) => ({ text }))
      : "At OLA Datacenter, we engineer and operate the next generation of sovereign cloud, colocation, and AI infrastructure from Spain."
          .split(" ")
          .map((text) => ({ text }))

  // Palabras del bloque `c-hgroup` ("QUÉ HACEMOS")
  const missionWords: RevealWord[] =
    lang === "es"
      ? [
          ..."En OLA Datacenter impulsamos la infraestructura digital crítica en la intersección de energía renovable, conectividad neutra e inteligencia artificial, garantizando el máximo rendimiento y"
            .split(" ")
            .map((text) => ({ text })),
          ...["la", "soberanía", "total", "de", "tus", "datos."].map((text) => ({
            text,
            muted: true,
          })),
        ]
      : [
          ..."At OLA Datacenter, we advance critical digital infrastructure at the intersection of renewable energy, carrier-neutral connectivity, and artificial intelligence, ensuring peak performance and"
            .split(" ")
            .map((text) => ({ text })),
          ...["complete", "data", "sovereignty."].map((text) => ({
            text,
            muted: true,
          })),
        ]

  // Palabras del titular gigante `Nuestra Infraestructura`
  const infraTitleWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Nuestra" },
          { text: "Infraestructura", muted: true },
        ]
      : [
          { text: "Our" },
          { text: "Infrastructure", muted: true },
        ]

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: c-hero (Réplica 1:1 de integratedbio.com/company/) ── */}
      <section
        ref={heroRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[132px] md:pt-[148px] pb-[50px]"
      >
        <div className="flex flex-col gap-y-9 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,482px)] md:gap-x-[60px] md:gap-y-9">
          {/* Titular H1 bicolor con corchete arquitectónico inferior */}
          <h1 className="md:col-span-2 text-[clamp(3.125rem,calc(3.125rem+0.09*(100vw-27.5rem)),8.75rem)] font-normal tracking-[-0.03em] leading-[1.02] md:min-h-[380px] lg:min-h-[425px] pb-12 md:pb-[125px] relative after:content-[''] after:absolute after:bottom-0 after:inset-x-0 after:h-3 after:rounded-t-[8px] after:border-t after:border-l after:border-r after:border-bg-dark/10">
            <WordRevealText words={heroTitleWords} revealed={heroRevealed} staggerMs={110} />
          </h1>

          {/* Botón Scroll `.scroll-btn` en la esquina inferior izquierda del hero */}
          <div className="hidden md:flex items-start">
            <a
              href="#content"
              onClick={handleScrollToContent}
              aria-label={t("Scroll to section", "Ir al contenido")}
              className="group relative flex items-center justify-center w-12 h-12 rounded-[16px] bg-bg-dark text-white border border-bg-dark/10 overflow-hidden transition-colors duration-300 hover:bg-primary hover:border-primary hover:text-bg-dark"
            >
              {/* Flecha blanca inicial que baja al hacer hover */}
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:translate-y-8"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="rotate-180">
                  <path
                    fill="currentColor"
                    d="M5.25 2.869V12h1.5V2.869l4.2 4.2L12 6 6 0 0 6l1.05 1.069 4.2-4.2Z"
                  />
                </svg>
              </span>
              {/* Cortina lima con flecha oscura que entra desde arriba */}
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center bg-primary text-bg-dark rounded-[inherit] -translate-y-[110%] transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:translate-y-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="rotate-180">
                  <path
                    fill="currentColor"
                    d="M5.25 2.869V12h1.5V2.869l4.2 4.2L12 6 6 0 0 6l1.05 1.069 4.2-4.2Z"
                  />
                </svg>
              </span>
            </a>
          </div>

          {/* Subtítulo H2 a la derecha con cortina por palabra */}
          <h2 className="text-[clamp(1.0625rem,calc(1.0625rem+0.007*(100vw-27.5rem)),1.5rem)] font-normal tracking-[-0.02em] leading-[1.22] max-w-[482px] text-pretty">
            <WordRevealText
              words={heroSubWords}
              revealed={heroRevealed}
              staggerMs={38}
              baseDelayMs={220}
            />
          </h2>
        </div>
      </section>

      {/* ── SECCIÓN 2: c-fs-media (Foto Panorámica del Edificio OLA Datacenter) ── */}
      <section
        ref={mediaBannerRef}
        className="w-full max-w-[1624px] mx-auto px-3 pb-3"
      >
        <figure className="relative w-full aspect-[16/9] md:aspect-[1596/680] rounded-[12px] lg:rounded-[30px] overflow-hidden bg-bg-dark">
          <img
            src="/ola-building-exterior.jpg"
            alt={t(
              "OLA Datacenter headquarters and technical building in Spain",
              "Edificio y sede técnica de OLA Datacenter en España"
            )}
            fetchPriority="high"
            decoding="async"
            width={1024}
            height={495}
            className={cn(
              "w-full h-full object-cover object-center transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              mediaRevealed ? "scale-100" : "scale-[1.06]"
            )}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-dark/35 via-transparent to-transparent" />
          <figcaption className="absolute bottom-4 left-4 md:bottom-7 md:left-7 inline-flex items-center gap-2.5 bg-surface-light/90 backdrop-blur-md text-text-base rounded-[8px] py-2 px-3 font-mono uppercase text-[11px] tracking-[0.02em] leading-none">
            <span aria-hidden className="w-2 h-2 bg-primary-hover shrink-0" />
            {t("SPAIN · EDGE GREEN CAMPUS", "ESPAÑA · CAMPUS EDGE GREEN")}
          </figcaption>
        </figure>
      </section>

      {/* ── SECCIÓN 3: c-hgroup ("QUÉ HACEMOS" + Manifiesto Bicolor) ── */}
      <div id="content" className="w-full">
        <section
          ref={missionRef}
          className="max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[60px] pb-[clamp(80px,calc(51.5px+7vw),165px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-11 lg:gap-x-10 items-start"
        >
          <aside className="w-full">
            <div
              className={cn(
                "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                missionRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
              {t("WHAT WE DO", "QUÉ HACEMOS")}
            </div>
          </aside>

          <div className="w-full">
            <h3 className="text-[clamp(1.625rem,calc(1.625rem+0.02*(100vw-26.25rem)),3.125rem)] font-normal tracking-[-0.02em] leading-[1.12] text-balance">
              <WordRevealText
                words={missionWords}
                revealed={missionRevealed}
                staggerMs={42}
              />
            </h3>
          </div>
        </section>

        <div className="max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <hr className="border-t border-bg-dark/10 m-0" />
        </div>

        {/* ── SECCIÓN 4: c-media-wi-multicol (Foto Sala Técnica + 2 Columnas + ArrowCta) ── */}
        <section
          ref={multicolRef}
          className="max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(48px,calc(40px+3vw),96px)] pb-[clamp(72px,calc(60px+4vw),128px)] grid grid-cols-1 lg:grid-cols-2 gap-11 lg:gap-x-12 items-start"
        >
          {/* Imagen izquierda (`aspect-ratio: 623 / 500`, `border-radius: 12px`) */}
          <aside className="w-full">
            <figure
              className={cn(
                "relative w-full max-w-[623px] aspect-[623/500] rounded-[12px] overflow-hidden bg-bg-dark",
                "transition-all duration-[900ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                multicolRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
            >
              <img
                src="/ola-datacenter-hall.jpg"
                alt={t(
                  "Interior view of OLA Datacenter technical hall",
                  "Vista interior de la sala técnica de OLA Datacenter"
                )}
                loading="lazy"
                decoding="async"
                width={1024}
                height={682}
                className="w-full h-full object-cover object-center"
              />
            </figure>
          </aside>

          {/* Contenido derecho: 2 columnas de texto + botón `ArrowCta` */}
          <div className="w-full flex flex-col items-start gap-y-[clamp(24px,calc(20px+0.03*(100vw-440px)),52px)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 max-w-[752px] text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35]">
              <p
                className={cn(
                  "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[120ms]",
                  multicolRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
              >
                {t(
                  "We build and operate our own critical infrastructure from the ground up: from glass-enclosed technical suites and redundant cooling systems to our own carrier-neutral fiber rings and virtualization platform.",
                  "Construimos y operamos nuestra propia infraestructura crítica desde cero: desde salas técnicas acristaladas y sistemas de climatización redundantes hasta nuestra propia red de fibra neutra y plataforma de virtualización."
                )}
              </p>
              <p
                className={cn(
                  "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[220ms]",
                  multicolRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
              >
                {t(
                  "Today, we empower enterprises, AI innovators, and public institutions to deploy everything from a single rack unit (1U) to dedicated private suites and high-density GPU clusters with predictable costs and local 24×7 support.",
                  "Hoy acompañamos a empresas, proyectos de IA y administraciones públicas para desplegar desde una U hasta suites privadas completas y clústeres GPU de alta densidad, con costes predecibles y soporte experto cercano 24×7."
                )}
              </p>
            </div>

            <div
              className={cn(
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[320ms]",
                multicolRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <ArrowCta href="/contact">
                {t("TALK TO OUR TEAM", "HABLA CON NOSOTROS")}
              </ArrowCta>
            </div>
          </div>
        </section>
      </div>

      {/* ── SECCIÓN 5: c-usp-cards (3 Tarjetas de Pilares a Sangre con Barrido Clip-Path) ── */}
      <div ref={pillarsRef} className="w-full grid grid-cols-1 lg:grid-cols-3">
        {PILLAR_CARDS.map((card, cardIdx) => {
          const cardDelayMs = cardIdx * 150
          const contentBaseMs = 600 + cardIdx * 150
          return (
            <div
              key={card.index}
              className={cn(
                "relative flex flex-col justify-between min-h-[280px] lg:min-h-[420px] p-6 lg:p-10 overflow-hidden",
                "transition-[clip-path] duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                card.bgClass,
                card.textClass
              )}
              style={{
                clipPath: pillarsRevealed
                  ? "polygon(0 0, 100% 0, 100% 100%, 0% 100%)"
                  : "polygon(0 0, 0% 0, 0% 100%, 0% 100%)",
                transitionDelay: `${cardDelayMs}ms`,
              }}
            >
              <div
                className={cn(
                  "absolute top-6 right-6 lg:top-10 lg:right-10 font-mono text-[13px] tracking-[-0.02em] leading-none uppercase",
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  pillarsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${contentBaseMs}ms` }}
              >
                {card.index}
              </div>

              <div
                className={cn(
                  "flex items-start justify-start",
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  pillarsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${contentBaseMs + 160}ms` }}
              >
                {card.icon}
              </div>

              <div className="flex flex-col gap-4 mt-10">
                <h3
                  className={cn(
                    "text-[clamp(1.625rem,calc(1.625rem+0.002*(100vw-27.5rem)),1.75rem)] font-normal tracking-[-0.02em] leading-[1.1]",
                    "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    pillarsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${contentBaseMs + 320}ms` }}
                >
                  {t(card.headingEn, card.headingEs)}
                </h3>
                <p
                  className={cn(
                    "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] tracking-[-0.02em] leading-[1.3] opacity-75",
                    "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    pillarsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${contentBaseMs + 480}ms` }}
                >
                  {t(card.bodyEn, card.bodyEs)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── SECCIÓN 6: Titular Monumental (`Nuestra Infraestructura`) + Grid de Instalaciones (`c-team-grid`) ── */}
      <section
        ref={infraHeadingRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(72px,calc(48px+5vw),140px)] pb-4"
      >
        <h2 className="text-[clamp(2.375rem,calc(2.375rem+0.068*(100vw-26.25rem)),7.5rem)] font-normal tracking-[-0.03em] leading-[1.05]">
          <WordRevealText
            words={infraTitleWords}
            revealed={infraHeadingRevealed}
            staggerMs={120}
          />
        </h2>
      </section>

      <section
        ref={facilitiesRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[35px] pb-[clamp(70px,calc(40px+5vw),130px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-12 lg:gap-x-10 items-start"
      >
        {/* Columna izquierda con corchete superior (`block_sidebar`) + métricas OLA en cifras */}
        <aside className="relative w-full pt-12 flex flex-col gap-y-8 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
          <div>
            <div
              className={cn(
                "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                facilitiesRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
              {t("OLA BY THE NUMBERS", "OLA EN CIFRAS")}
            </div>
          </div>

          <p
            className={cn(
              "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35] lg:max-w-[370px]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[100ms]",
              facilitiesRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            {t(
              "Our datacenter is located in Spain, powered by renewable energy and built to the highest standards of physical security, electrical redundancy, and regulatory compliance.",
              "Nuestro datacenter están ubicado en España, alimentados por energía renovable y construidos con los más altos estándares de seguridad y cumplimiento normativo."
            )}
          </p>

          {/* Cuadrícula de métricas clave con tipografía limpia y etiquetas Roboto Mono */}
          <div className="grid grid-cols-2 gap-4 pt-2 lg:max-w-[370px]">
            {METRICS.map((m, idx) => (
              <div
                key={m.value}
                className={cn(
                  "bg-surface-light rounded-[12px] p-5 border border-bg-dark/5",
                  "transition-all duration-[700ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  facilitiesRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${180 + idx * 80}ms` }}
              >
                <div className="text-[clamp(1.75rem,2.4vw,2.375rem)] font-normal tracking-[-0.03em] leading-none text-text-base mb-2">
                  {m.value}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.02em] text-text-base/55 leading-tight">
                  {t(m.labelEn, m.labelEs)}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Columna derecha con corchete superior (`block_grid`) y tarjetas con muesca `integratedbio.com` */}
        <div className="relative w-full pt-12 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
          {FACILITY_CARDS.map((item, idx) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex flex-col min-h-[260px] p-3 rounded-t-[24px] rounded-bl-[24px] overflow-hidden text-text-base no-underline",
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                facilitiesRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
              style={{ transitionDelay: `${150 + idx * 130}ms` }}
            >
              {/* Fondo blanco con recorte en esquina inferior derecha idéntico a `.c-team-grid .item_background` */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-surface-light rounded-t-[24px] rounded-bl-[24px] z-0"
                style={{
                  clipPath:
                    "polygon(100% 0, 100% calc(100% - 75px), calc(100% - 75px) calc(100% - 75px), calc(100% - 75px) 100%, 0 100%, 0 0)",
                }}
              />

              {/* Imagen superior con zoom suave en hover (`aspect-ratio: 470 / 340`) */}
              <figure className="relative z-10 w-full aspect-[470/340] rounded-[16px] overflow-hidden mb-[18px] bg-bg-dark">
                <img
                  src={item.imageSrc}
                  alt={t(item.imageAltEn, item.imageAltEs)}
                  loading="lazy"
                  decoding="async"
                  width={940}
                  height={680}
                  className="w-full h-full object-cover object-center transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
                />
              </figure>

              {/* Contenido de la tarjeta */}
              <div className="relative z-10 flex flex-col flex-1 gap-3 p-3 min-h-[160px]">
                <h3 className="text-[24px] font-normal tracking-[-0.02em] leading-none text-text-base">
                  {t(item.titleEn, item.titleEs)}
                </h3>
                <div className="font-mono text-[12px] md:text-[13px] tracking-[-0.02em] leading-[1.1] uppercase text-text-base/50">
                  {t(item.tagEn, item.tagEs)}
                </div>
                <div className="mt-auto pt-6 font-mono text-[12px] md:text-[13px] tracking-[-0.02em] leading-none uppercase text-text-base pr-16">
                  {t(item.ctaLabelEn, item.ctaLabelEs)}
                </div>
              </div>

              {/* Esquina curva SVG (`87x90`) + botón paralelogramo `.u-btn--2` (`51x48`) */}
              <div className="pointer-events-none absolute right-0 bottom-0 w-[87px] h-[90px] z-10 flex items-end justify-end">
                <svg
                  className="absolute inset-0 w-full h-full"
                  xmlns="http://www.w3.org/2000/svg"
                  width="87"
                  height="90"
                  fill="none"
                  viewBox="0 0 87 90"
                >
                  <path
                    fill="#ffffff"
                    d="M35.43 45.104 23.71 81.57A12.146 12.146 0 0 1 12.145 90C5.438 90 0 84.562 0 77.854V16C0 7.163 7.163 0 16 0h55c8.837 0 16 7.163 16 16v2c0 8.837-7.163 16-16 16H50.663a16 16 0 0 0-15.232 11.104Z"
                  />
                </svg>

                <div className="relative z-10 w-[51px] h-[48px] flex items-center justify-center text-primary transition-all duration-300 group-hover:text-bg-dark group-hover:scale-[0.94]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="51"
                    height="48"
                    fill="none"
                    viewBox="0 0 51 48"
                    className="w-full h-full"
                  >
                    <path
                      fill="currentColor"
                      className="transition-colors duration-300"
                      d="M6.728 9.09A12 12 0 0 1 18.369 0H39c6.627 0 12 5.373 12 12v24c0 6.627-5.373 12-12 12H12.37C4.561 48-1.167 40.663.727 33.09l6-24Z"
                    />
                  </svg>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="absolute text-bg-dark transition-colors duration-300 group-hover:text-white rotate-90"
                  >
                    <path
                      fill="currentColor"
                      d="M5.25 2.869V12h1.5V2.869l4.2 4.2L12 6 6 0 0 6l1.05 1.069 4.2-4.2Z"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario solicitó transformar `/company/about` al nivel PRO de
 * `https://integratedbio.com/company/`, integrando los efectos de texto de la Home
 * (`WordRevealText` con cortinas `scaleY`, titulares bicolores `#222f30` + `#c9cbbe`),
 * la gama de colores (`#f7f7f5`, `#cef79e`, `#222f30`, `#e7e8e0`) y las 3 fotografías
 * reales del centro de datos OLA subidas por el usuario.
 * Edge cases:
 *  - `prefers-reduced-motion: reduce`: desactiva las cortinas y desplazamientos,
 *    mostrando todos los bloques inmediatamente.
 *  - `fetchPriority="high"` aplicado únicamente a la imagen LCP (`/ola-building-exterior.jpg`)
 *    y `loading="lazy"` en las imágenes bajo el pliegue según la guía `optimize-image-priority`.
 */
