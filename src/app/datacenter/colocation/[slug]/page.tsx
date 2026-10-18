"use client"

/**
 * ColocationProductDetailPage (`/datacenter/colocation/[slug]`) —
 * Página individual para cada uno de los 5 productos de Colocation:
 *  - `por-u`: Colocation por U (1U a 10U)
 *  - `racks`: Medio Rack / Rack Completo (21U / 42U–48U)
 *  - `jaulas`: Jaulas Privadas (Multi-rack con cerramiento perimetral)
 *  - `suites`: Suites Privadas (Salas técnicas dedicadas de alta densidad)
 *  - `wholesale`: Housing / Wholesale (Capacidad mayorista e hiperescala)
 *
 * Mantiene la estética 1:1 de `integratedbio.com/company/` y la Home.
 */

import React, { use, useEffect, useRef, useState } from "react"
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

interface SpecItemDef {
  labelEn: string
  labelEs: string
  valueEn: string
  valueEs: string
}

interface ProductDetailDef {
  slug: string
  index: string
  badgeEn: string
  badgeEs: string
  titleDarkEn: string
  titleDarkEs: string
  titleMutedEn: string
  titleMutedEs: string
  subtitleEn: string
  subtitleEs: string
  heroImage: string
  detailImage: string
  statementDarkEn: string
  statementDarkEs: string
  statementMutedEn: string
  statementMutedEs: string
  col1En: string
  col1Es: string
  col2En: string
  col2Es: string
  specs: SpecItemDef[]
}

interface PageProps {
  params: Promise<{ slug: string }>
}

// ─── 2. Product Data Catalog ────────────────────────────────────────────────
const PRODUCTS_BY_SLUG: Record<string, ProductDetailDef> = {
  "por-u": {
    slug: "por-u",
    index: "01.",
    badgeEn: "COLOCATION · 1U TO 10U",
    badgeEs: "COLOCATION · 1U A 10U",
    titleDarkEn: "Colocation",
    titleDarkEs: "Colocation",
    titleMutedEn: "per U",
    titleMutedEs: "por U",
    subtitleEn:
      "Deploy individual servers, firewalls, or edge nodes starting from a single rack unit (1U) with enterprise-grade 2N power and carrier-neutral fiber.",
    subtitleEs:
      "Despliega servidores individuales, firewalls o nodos edge desde una sola unidad de rack (1U) con alimentación 2N y fibra neutra multi-operador.",
    heroImage: "/ola-datacenter-racks.jpg",
    detailImage: "/ola-datacenter-hall.jpg",
    statementDarkEn:
      "Enterprise colocation without the overhead of a full cabinet: ideal for edge deployments, backup nodes, and",
    statementDarkEs:
      "Toda la fiabilidad de un centro de datos Tier III+ sin necesidad de contratar un armario completo: ideal para nodos edge, copias de seguridad y",
    statementMutedEn: "modular server growth.",
    statementMutedEs: "crecimiento modular servidor a servidor.",
    col1En:
      "Each rack unit includes dual A+B power feeds protected by online double-conversion UPS systems and backup generators, ensuring continuous operation for your critical hardware.",
    col1Es:
      "Cada unidad U incluye doble línea de alimentación eléctrica A+B respaldada por sistemas SAI/UPS simétricos y grupos electrógenos, garantizando continuidad absoluta para tu servidor.",
    col2En:
      "Enjoy direct 1 Gbps or 10 Gbps ports, IPv4/IPv6 addressing, and 24×7 Remote Smart Hands so our on-site engineers can rack and maintain your equipment without travel.",
    col2Es:
      "Disfruta de puertos redundantes de 1 Gbps o 10 Gbps, direccionamiento IPv4/IPv6 y servicio Remote Smart Hands 24×7 para que nuestro equipo instale y mantenga tu servidor sin desplazamientos.",
    specs: [
      { labelEn: "SPACE", labelEs: "ESPACIO", valueEn: "1U, 2U, 4U up to 10U", valueEs: "1U, 2U, 4U hasta 10U" },
      { labelEn: "POWER", labelEs: "ENERGÍA", valueEn: "Dual A+B Redundant Feeds", valueEs: "Doble acometida A+B" },
      { labelEn: "NETWORK", labelEs: "CONECTIVIDAD", valueEn: "1 / 10 Gbps Redundant", valueEs: "1 / 10 Gbps Redundante" },
      { labelEn: "SUPPORT", labelEs: "SOPORTE", valueEn: "24×7 Smart Hands", valueEs: "Smart Hands 24×7" },
    ],
  },
  racks: {
    slug: "racks",
    index: "02.",
    badgeEn: "COLOCATION · 21U / 42U–48U",
    badgeEs: "COLOCATION · 21U / 42U–48U",
    titleDarkEn: "Half & Full",
    titleDarkEs: "Medio Rack y",
    titleMutedEn: "Dedicated Racks",
    titleMutedEs: "Rack Completo",
    subtitleEn:
      "Private lockable cabinets (21U Half Rack or 42U–48U Full Rack) with metered dual PDUs, aisle containment, and up to 40 kW power density.",
    subtitleEs:
      "Armarios privados con cerradura independiente (Medio Rack 21U o Rack Completo 42U–48U), doble PDU monitorizada y hasta 40 kW de potencia.",
    heroImage: "/ola-datacenter-racks.jpg",
    detailImage: "/ola-datacenter-hall.jpg",
    statementDarkEn:
      "Dedicated cabinets engineered for production clusters, virtualization platforms, and high-density compute with",
    statementDarkEs:
      "Armarios dedicados diseñados para clústeres de producción, plataformas de virtualización y cómputo intensivo con",
    statementMutedEn: "total physical isolation.",
    statementMutedEs: "aislamiento físico y eléctrico total.",
    col1En:
      "Choose between a 21U Half Rack with independent security division or a 42U–48U Full Rack with front/rear perforated doors, structured overhead cabling trays, and real-time power telemetry.",
    col1Es:
      "Escoge entre Medio Rack de 21U con separación física independiente o Rack Completo de 42U–48U con bandejas superiores de fibra y cobre, cerradura electrónica y telemetría eléctrica en tiempo real.",
    col2En:
      "Connect directly to our Meet-Me Room via optical cross-connects to reach carriers, cloud on-ramps, and internet exchanges with sub-2ms national latency.",
    col2Es:
      "Conecta tu armario directamente a nuestra Meet-Me Room mediante cross-connects ópticos para enlazar con operadores, nubes públicas y puntos neutros con menos de 2 ms de latencia.",
    specs: [
      { labelEn: "CAPACITY", labelEs: "CAPACIDAD", valueEn: "21U Half / 42U–48U Full", valueEs: "21U Medio / 42U–48U Completo" },
      { labelEn: "DENSITY", labelEs: "DENSIDAD", valueEn: "3 kW up to 40 kW / Rack", valueEs: "3 kW hasta 40 kW / Rack" },
      { labelEn: "REDUNDANCY", labelEs: "REDUNDANCIA", valueEn: "2N UPS + N+1 Cooling", valueEs: "SAI 2N + Clima N+1" },
      { labelEn: "SECURITY", labelEs: "SEGURIDAD", valueEn: "Private Lock + CCTV", valueEs: "Cerradura propia + CCTV" },
    ],
  },
  jaulas: {
    slug: "jaulas",
    index: "03.",
    badgeEn: "COLOCATION · PRIVATE CAGES",
    badgeEs: "COLOCATION · JAULAS PRIVADAS",
    titleDarkEn: "Private",
    titleDarkEs: "Jaulas",
    titleMutedEn: "Security Cages",
    titleMutedEs: "Privadas",
    subtitleEn:
      "Custom perimeter-fenced multi-rack environments with dedicated biometric access control, continuous CCTV, and strict regulatory compliance.",
    subtitleEs:
      "Entornos multi-rack con cerramiento perimetral a medida, control de acceso biométrico dedicado, CCTV continuo y cumplimiento normativo estricto.",
    heroImage: "/ola-datacenter-hall.jpg",
    detailImage: "/ola-datacenter-racks.jpg",
    statementDarkEn:
      "Designed for financial institutions, regulated enterprises, and public sector workloads requiring",
    statementDarkEs:
      "Diseñadas para entidades financieras, grandes corporaciones y administraciones públicas que exigen",
    statementMutedEn: "perimeter-grade physical security.",
    statementMutedEs: "seguridad perimetral dedicada.",
    col1En:
      "Our Private Cages surround your contiguous racks with floor-to-ceiling physical partitioning, customizable access policies, and dedicated surveillance cameras integrated into our 24×7 SOC/NOC.",
    col1Es:
      "Nuestras Jaulas Privadas protegen tus racks contiguos con cerramiento físico de suelo a techo, políticas de acceso personalizadas para tu equipo y cámaras de vigilancia dedicadas.",
    col2En:
      "Fully aligned with ENS High (Esquema Nacional de Seguridad), ISO 27001, and PCI-DSS physical security requirements, with dedicated overhead power busways and fiber pathways.",
    col2Es:
      "Cumplimiento íntegro con los requisitos físicos de ENS Alto, ISO 27001 y PCI-DSS, con canalizaciones de fibra exclusivas y distribución eléctrica redundante a medida.",
    specs: [
      { labelEn: "FOOTPRINT", labelEs: " ESCALA", valueEn: "From 3 to 20+ Racks", valueEs: "De 3 a 20+ Racks" },
      { labelEn: "ACCESS", labelEs: "ACCESO", valueEn: "Dedicated Biometrics", valueEs: "Biometría dedicada" },
      { labelEn: "COMPLIANCE", labelEs: "NORMATIVA", valueEn: "ENS High / ISO 27001", valueEs: "ENS Alto / ISO 27001" },
      { labelEn: "POWER", labelEs: "ENERGÍA", valueEn: "Custom 2N Busways", valueEs: "Distribución 2N a medida" },
    ],
  },
  suites: {
    slug: "suites",
    index: "04.",
    badgeEn: "COLOCATION · PRIVATE SUITES",
    badgeEs: "COLOCATION · SUITES PRIVADAS",
    titleDarkEn: "Private",
    titleDarkEs: "Suites",
    titleMutedEn: "Technical Suites",
    titleMutedEs: "Privadas",
    subtitleEn:
      " Dedicated technical rooms with independent climate control, cold/hot aisle containment, and high-density readiness for AI and enterprise core systems.",
    subtitleEs:
      "Salas técnicas exclusivas con climatización independiente, contención de pasillos y preparación para despliegues de IA y sistemas críticos.",
    heroImage: "/ola-datacenter-hall.jpg",
    detailImage: "/ola-datacenter-racks.jpg",
    statementDarkEn:
      "Your own private data hall inside OLA Datacenter, combining the autonomy of an on-premise facility with",
    statementDarkEs:
      "Tu propia sala técnica privada dentro de OLA Datacenter, combinando el control de un centro propio con",
    statementMutedEn: "100% renewable Tier III+ engineering.",
    statementMutedEs: "ingeniería Tier III+ 100% renovable.",
    col1En:
      "Each Suite is an isolated technical room with its own access control, fire detection and suppression zone, and custom rack layout tailored to your exact server and storage architecture.",
    col1Es:
      "Cada Suite es una sala técnica independiente con su propio control de acceso, zona de detección y extinción de incendios, y distribución de racks diseñada a medida de tu arquitectura.",
    col2En:
      "Engineered to support both traditional enterprise cabinets and liquid-ready high-density GPU racks, backed by dedicated PDUs and direct dark-fiber entry points.",
    col2Es:
      "Preparada tanto para armarios corporativos tradicionales como para clústeres GPU de alta densidad, con cuadros eléctricos dedicados y entrada directa de fibra oscura.",
    specs: [
      { labelEn: "PRIVACY", labelEs: "PRIVACIDAD", valueEn: "100% Dedicated Room", valueEs: "Sala 100% exclusiva" },
      { labelEn: "COOLING", labelEs: "CLIMATIZACIÓN", valueEn: "Independent N+1 Zone", valueEs: "Zona N+1 independiente" },
      { labelEn: "AI READY", labelEs: "SOPORTE IA", valueEn: "Up to 40+ kW / Rack", valueEs: "Hasta 40+ kW / Rack" },
      { labelEn: "OPERATIONS", labelEs: "OPERACIÓN", valueEn: "24×7 Dedicated NOC", valueEs: "NOC 24×7 dedicado" },
    ],
  },
  wholesale: {
    slug: "wholesale",
    index: "05.",
    badgeEn: "COLOCATION · HOUSING / WHOLESALE",
    badgeEs: "COLOCATION · HOUSING / WHOLESALE",
    titleDarkEn: "Housing &",
    titleDarkEs: "Housing y",
    titleMutedEn: "Wholesale",
    titleMutedEs: "Wholesale",
    subtitleEn:
      "High-capacity power blocks and custom technical footprints in Spain for cloud service providers, telcos, and large-scale AI infrastructure.",
    subtitleEs:
      "Bloques de potencia de alta capacidad y espacio técnico a medida en España para proveedores cloud, operadores y despliegues de IA a gran escala.",
    heroImage: "/ola-building-exterior.jpg",
    detailImage: "/ola-datacenter-racks.jpg",
    statementDarkEn:
      "Sovereign European scale with guaranteed renewable power, carrier-neutral dark fiber rings, and",
    statementDarkEs:
      "Capacidad mayorista con soberanía europea, suministro renovable garantizado, anillos de fibra oscura y",
    statementMutedEn: "build-to-suit flexibility.",
    statementMutedEs: "diseño técnico build-to-suit.",
    col1En:
      "Our Housing / Wholesale solutions provide committed electrical capacity from 250 kW to multi-megawatt allocations, with transparent pass-through energy models and industry-leading PUE.",
    col1Es:
      "Nuestras soluciones Housing / Wholesale ofrecen capacidad eléctrica comprometida desde 250 kW hasta múltiples megavatios, con modelos energéticos transparentes y PUE optimizado.",
    col2En:
      "Partner directly with our infrastructure engineering team to customize power distribution, cooling topology, staging areas, and dedicated office or warehouse space on campus.",
    col2Es:
      "Trabaja directamente con nuestro equipo de ingeniería para personalizar la distribución eléctrica, topología de refrigeración, zonas de staging y espacio logístico en el propio campus.",
    specs: [
      { labelEn: "POWER SCALE", labelEs: "CAPACIDAD", valueEn: "250 kW to Multi-MW", valueEs: "250 kW a Multi-MW" },
      { labelEn: "ENERGY", labelEs: "ENERGÍA", valueEn: "100% Renewable Supply", valueEs: "100% Energía Renovable" },
      { labelEn: "FIBER", labelEs: "FIBRA", valueEn: "Diverse Dark Fiber Routes", valueEs: "Rutas diversas de fibra oscura" },
      { labelEn: "CONTRACT", labelEs: "MODALIDAD", valueEn: "Custom SLA & Build-to-Suit", valueEs: "SLA y diseño a medida" },
    ],
  },
}

const ORDERED_SLUGS = ["por-u", "racks", "jaulas", "suites", "wholesale"] as const

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
export default function ColocationProductDetailPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const { lang, t } = useLanguage()

  const product =
    PRODUCTS_BY_SLUG[resolvedParams.slug] ?? PRODUCTS_BY_SLUG["por-u"]

  const mediaRef = useRef<HTMLElement>(null)
  const statementRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const switcherRef = useRef<HTMLElement>(null)

  const [heroRevealed, setHeroRevealed] = useState(false)
  const [mediaRevealed, setMediaRevealed] = useState(false)
  const [statementRevealed, setStatementRevealed] = useState(false)
  const [detailRevealed, setDetailRevealed] = useState(false)
  const [switcherRevealed, setSwitcherRevealed] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setHeroRevealed(true)
      setMediaRevealed(true)
      setStatementRevealed(true)
      setDetailRevealed(true)
      setSwitcherRevealed(true)
      return
    }

    const timer = window.setTimeout(() => setHeroRevealed(true), 60)

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target
          if (target === mediaRef.current) setMediaRevealed(true)
          else if (target === statementRef.current) setStatementRevealed(true)
          else if (target === detailRef.current) setDetailRevealed(true)
          else if (target === switcherRef.current) setSwitcherRevealed(true)
          obs.unobserve(target)
        })
      },
      { threshold: 0, rootMargin: "0px 0px -15% 0px" }
    )

    ;[mediaRef.current, statementRef.current, detailRef.current, switcherRef.current].forEach(
      (el) => {
        if (el) obs.observe(el)
      }
    )

    return () => {
      window.clearTimeout(timer)
      obs.disconnect()
    }
  }, [product.slug])

  const titleDark = lang === "es" ? product.titleDarkEs : product.titleDarkEn
  const titleMuted = lang === "es" ? product.titleMutedEs : product.titleMutedEn

  const heroTitleWords: RevealWord[] = [
    ...titleDark.split(" ").map((text, idx, arr) => ({
      text,
      breakAfter: idx === arr.length - 1,
    })),
    ...titleMuted.split(" ").map((text) => ({ text, muted: true })),
  ]

  const heroSubWords: RevealWord[] = (
    lang === "es" ? product.subtitleEs : product.subtitleEn
  )
    .split(" ")
    .map((text) => ({ text }))

  const statementWords: RevealWord[] = [
    ...(lang === "es" ? product.statementDarkEs : product.statementDarkEn)
      .split(" ")
      .map((text) => ({ text })),
    ...(lang === "es" ? product.statementMutedEs : product.statementMutedEn)
      .split(" ")
      .map((text) => ({ text, muted: true })),
  ]

  const otherProducts = ORDERED_SLUGS.map((s) => PRODUCTS_BY_SLUG[s]).filter(
    (p) => p.slug !== product.slug
  )

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: c-hero del Producto ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[128px] md:pt-[144px] pb-[48px]">
        {/* Migas de pan estilo pastilla mono */}
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/datacenter/colocation"
            className="inline-flex items-center bg-surface-light hover:bg-[#cef79e]/45 text-text-base rounded-[8px] py-2 pl-2.5 pr-3 font-mono uppercase text-[11px] leading-none tracking-[0.02em] transition-colors"
          >
            <span aria-hidden className="mr-2">←</span>
            {t("ALL COLOCATION PRODUCTS", "TODOS LOS PRODUCTOS COLOCATION")}
          </Link>
          <span className="inline-flex items-center bg-[#cef79e]/45 text-bg-dark rounded-[8px] py-2 px-3 font-mono uppercase text-[11px] leading-none tracking-[0.02em]">
            {t(product.badgeEn, product.badgeEs)}
          </span>
        </div>

        <div className="flex flex-col gap-y-9 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,482px)] md:gap-x-[60px] md:gap-y-9">
          <h1 className="md:col-span-2 text-[clamp(3rem,calc(2.8rem+0.085*(100vw-27.5rem)),8.25rem)] font-normal tracking-[-0.03em] leading-[1.02] md:min-h-[340px] lg:min-h-[390px] pb-12 md:pb-[110px] relative after:content-[''] after:absolute after:bottom-0 after:inset-x-0 after:h-3 after:rounded-t-[8px] after:border-t after:border-l after:border-r after:border-bg-dark/10">
            <WordRevealText words={heroTitleWords} revealed={heroRevealed} staggerMs={105} />
          </h1>

          <div className="hidden md:flex items-center">
            <ArrowCta href="/contact">
              {t("REQUEST QUOTE & AVAILABILITY", "SOLICITAR DISPONIBILIDAD")}
            </ArrowCta>
          </div>

          <h2 className="text-[clamp(1.0625rem,calc(1.0625rem+0.007*(100vw-27.5rem)),1.45rem)] font-normal tracking-[-0.02em] leading-[1.24] max-w-[482px] text-pretty">
            <WordRevealText
              words={heroSubWords}
              revealed={heroRevealed}
              staggerMs={34}
              baseDelayMs={200}
            />
          </h2>
        </div>
      </section>

      {/* ── SECCIÓN 2: Barra de Especificaciones + Imagen Panorámica (`c-fs-media`) ── */}
      <section ref={mediaRef} className="w-full max-w-[1624px] mx-auto px-3 pb-3">
        <div className="max-w-[1600px] mx-auto px-3 md:px-[32px] mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {product.specs.map((spec, idx) => (
            <div
              key={spec.labelEn}
              className={cn(
                "bg-surface-light rounded-[12px] p-5 border border-bg-dark/5",
                "transition-all duration-[700ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                mediaRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              )}
              style={{ transitionDelay: `${idx * 70}ms` }}
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.02em] text-text-base/50 mb-1.5">
                {t(spec.labelEn, spec.labelEs)}
              </div>
              <div className="text-[clamp(1.125rem,1.4vw,1.375rem)] font-normal tracking-[-0.02em] text-text-base">
                {t(spec.valueEn, spec.valueEs)}
              </div>
            </div>
          ))}
        </div>

        <figure className="relative w-full aspect-[16/9] md:aspect-[1596/640] rounded-[12px] lg:rounded-[30px] overflow-hidden bg-bg-dark">
          <img
            src={product.heroImage}
            alt={t(product.titleDarkEn + " " + product.titleMutedEn, product.titleDarkEs + " " + product.titleMutedEs)}
            fetchPriority="high"
            decoding="async"
            width={1024}
            height={682}
            className={cn(
              "w-full h-full object-cover object-center transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              mediaRevealed ? "scale-100" : "scale-[1.05]"
            )}
          />
        </figure>
      </section>

      {/* ── SECCIÓN 3: c-hgroup (Manifiesto Técnico del Producto) ── */}
      <section
        ref={statementRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[60px] pb-[clamp(70px,calc(45px+5vw),130px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-11 lg:gap-x-10 items-start"
      >
        <aside className="w-full">
          <div
            className={cn(
              "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
              statementRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
            {product.index} · {t(product.badgeEn, product.badgeEs)}
          </div>
        </aside>

        <div className="w-full">
          <h3 className="text-[clamp(1.625rem,calc(1.625rem+0.02*(100vw-26.25rem)),3.125rem)] font-normal tracking-[-0.02em] leading-[1.12] text-balance">
            <WordRevealText words={statementWords} revealed={statementRevealed} staggerMs={40} />
          </h3>
        </div>
      </section>

      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
        <hr className="border-t border-bg-dark/10 m-0" />
      </div>

      {/* ── SECCIÓN 4: c-media-wi-multicol (Arquitectura Detallada + CTA) ── */}
      <section
        ref={detailRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(48px,calc(40px+3vw),96px)] pb-[clamp(72px,calc(60px+4vw),128px)] grid grid-cols-1 lg:grid-cols-2 gap-11 lg:gap-x-12 items-start"
      >
        <aside className="w-full">
          <figure
            className={cn(
              "relative w-full max-w-[623px] aspect-[623/500] rounded-[12px] overflow-hidden bg-bg-dark",
              "transition-all duration-[900ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
              detailRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
          >
            <img
              src={product.detailImage}
              alt={t("OLA Datacenter technical infrastructure", "Infraestructura técnica OLA Datacenter")}
              loading="lazy"
              decoding="async"
              width={1024}
              height={682}
              className="w-full h-full object-cover object-center"
            />
          </figure>
        </aside>

        <div className="w-full flex flex-col items-start gap-y-9">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 max-w-[752px] text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35]">
            <p
              className={cn(
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[120ms]",
                detailRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              {t(product.col1En, product.col1Es)}
            </p>
            <p
              className={cn(
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[220ms]",
                detailRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              {t(product.col2En, product.col2Es)}
            </p>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center gap-4 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[320ms]",
              detailRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <ArrowCta href="/contact">
              {t("CONFIGURE & DEPLOY", "CONTRATAR O SOLICITAR PRESUPUESTO")}
            </ArrowCta>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 5: Acceso rápido al resto de Productos de Colocation ── */}
      <section
        ref={switcherRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pb-[clamp(80px,calc(60px+4vw),130px)]"
      >
        <div className="pt-12 relative before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em]">
              <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
              {t("OTHER COLOCATION MODALITIES", "OTRAS MODALIDADES DE COLOCATION")}
            </div>
            <Link
              href="/datacenter/colocation"
              className="font-mono text-[12px] uppercase tracking-[0.02em] text-text-base/70 hover:text-text-base"
            >
              {t("View all →", "Ver todas →")}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {otherProducts.map((item, idx) => (
              <Link
                key={item.slug}
                href={`/datacenter/colocation/${item.slug}`}
                className={cn(
                  "group relative flex flex-col justify-between min-h-[210px] p-5 rounded-t-[20px] rounded-bl-[20px] overflow-hidden text-text-base no-underline",
                  "transition-all duration-[700ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  switcherRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${idx * 90}ms` }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-surface-light rounded-t-[20px] rounded-bl-[20px] z-0 transition-colors group-hover:bg-white"
                  style={{
                    clipPath:
                      "polygon(100% 0, 100% calc(100% - 75px), calc(100% - 75px) calc(100% - 75px), calc(100% - 75px) 100%, 0 100%, 0 0)",
                  }}
                />
                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-text-base/50">{item.index}</span>
                  <span className="inline-block px-2 py-0.5 rounded bg-[#cef79e]/45 font-mono text-[10px] uppercase text-bg-dark">
                    Colocation
                  </span>
                </div>

                <div className="relative z-10 my-4">
                  <h4 className="text-[20px] font-normal tracking-[-0.02em] leading-[1.15] text-text-base">
                    {t(
                      `${item.titleDarkEn} ${item.titleMutedEn}`,
                      `${item.titleDarkEs} ${item.titleMutedEs}`
                    )}
                  </h4>
                </div>

                <div className="relative z-10 font-mono text-[11px] uppercase tracking-[-0.01em] text-text-base/75 pr-14">
                  {t("Explore →", "Explorar →")}
                </div>

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
        </div>
      </section>

      <Footer />
    </main>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: para que el catálogo de `/datacenter/colocation` y los enlaces del
 * mega-menú den acceso real a cada uno de los 5 productos de Colocation
 * (`por-u`, `racks`, `jaulas`, `suites`, `wholesale`) con una ficha PRO completa.
 * Edge cases:
 *  - Si se navega a un `slug` no listado, cae de forma segura a `por-u`.
 *  - Compatible con `params: Promise<{ slug: string }>` de Next.js 16 mediante `React.use(params)`.
 */
