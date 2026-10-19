"use client"

/**
 * ArchitectureSection — Sección debajo de las 3 tarjetas de colores (`IntegratedPlatformSection`)
 * en la Home (`/`).
 *
 * Diseño solicitado por el usuario:
 *  - Estructura espejo de `IntegratedPlatformSection` (`c-hgroup` con corchetes superiores,
 *    pastilla mono con cuadrado lima, titular bicolor `#222f30` + `#c9cbbe` con cortina por palabra,
 *    párrafo editorial y `ArrowCta`), pero con el **texto a la izquierda**.
 *  - **A la derecha**: Animación vectorial técnica de líneas (en el mismo estilo de planos
 *    vectoriales de Colocation: trazos `#222f30`, cuadrícula técnica sutil, cotas `Roboto Mono`
 *    y acentos `#cef79e`) que representa las **5 capas de aplicación e infraestructura que ofrece el DC**,
 *    combinando un stack isométrico explosionado animado con el plano técnico vivo de cada capa.
 */

import React, { useEffect, useRef, useState } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface WordDef {
  text: string
  muted?: boolean
  breakAfter?: boolean
}

interface DcLayerDef {
  id: "apps" | "ai-cloud" | "security" | "edge" | "dc-infra"
  index: string
  code: string
  elevationLabel: string
  titleEn: string
  titleEs: string
  descEn: string
  descEs: string
  specTagEn: string
  specTagEs: string
}

// ─── 2. Definición de las 5 Capas del Data Center ───────────────────────────
const DC_LAYERS: DcLayerDef[] = [
  {
    id: "apps",
    index: "01.",
    code: "L5 · APP LAYER",
    elevationLabel: "+400mm",
    titleEn: "Applications & Workloads",
    titleEs: "Aplicaciones y Cargas Críticas",
    descEn: "Build, deploy, and scale mission-critical enterprise and AI applications.",
    descEs: "Construye, ejecuta y escala aplicaciones empresariales e inteligentes.",
    specTagEn: "KUBERNETES · APIS · SAAS",
    specTagEs: "KUBERNETES · APIS · SAAS",
  },
  {
    id: "ai-cloud",
    index: "02.",
    code: "L4 · IA CLOUD & VPS",
    elevationLabel: "+300mm",
    titleEn: "IA Cloud & Dedicated Compute",
    titleEs: "IA Cloud y Servidores Dedicados",
    descEn: "Orchestrate LLM models, GPU clusters, and high-performance cloud VPS.",
    descEs: "Orquesta modelos de IA, clústeres GPU y servidores cloud de alto rendimiento.",
    specTagEn: "GPU CLUSTERS · VPS · BARE METAL",
    specTagEs: "CLÚSTERES GPU · VPS · DEDICADOS",
  },
  {
    id: "security",
    index: "03.",
    code: "L3 · SOVEREIGN SECURITY",
    elevationLabel: "+200mm",
    titleEn: "Sovereign Security & Compliance",
    titleEs: "Seguridad Soberana y Cumplimiento",
    descEn: "Built-in protection at every layer under GDPR, ISO 27001, and ENS High.",
    descEs: "Protección integrada en cada capa bajo normativa RGPD, ISO 27001 y ENS Alto.",
    specTagEn: "ENS HIGH · ISO 27001 · DDoS",
    specTagEs: "ENS ALTO · ISO 27001 · ANTI-DDoS",
  },
  {
    id: "edge",
    index: "04.",
    code: "L2 · CARRIER-NEUTRAL EDGE",
    elevationLabel: "+100mm",
    titleEn: "Connectivity & Low-Latency Edge",
    titleEs: "Conectividad Neutra y Edge",
    descEn: "Sub-2ms latency across Spain via redundant Meet-Me Rooms and dark fiber.",
    descEs: " Cómputo y red de baja latencia (< 2 ms) mediante fibra oscura y Meet-Me Room.",
    specTagEn: "< 2 MS · MMR · DARK FIBER",
    specTagEs: "< 2 MS · MMR · FIBRA OSCURA",
  },
  {
    id: "dc-infra",
    index: "05.",
    code: "L1 · PHYSICAL DATACENTER",
    elevationLabel: "0.00mm",
    titleEn: "Green Edge Datacenter Infrastructure",
    titleEs: "Infraestructura Física Datacenter",
    descEn: "Colocation from 1U to private suites powered by 100% renewable 2N energy.",
    descEs: "Colocation desde 1U hasta suites privadas con energía 100% renovable 2N.",
    specTagEn: "2N POWER · 100% RENEWABLE · TIER III+",
    specTagEs: "ENERGÍA 2N · 100% RENOVABLE · TIER III+",
  },
]

// ─── 3. Sub-diagrama Vectorial Animado de la Capa Activa ────────────────────
function ActiveLayerBlueprint({ activeId }: { activeId: DcLayerDef["id"] }) {
  if (activeId === "apps") {
    return (
      <g className="animate-[layerFade_450ms_ease-out]">
        {/* Módulos de microservicios / APIs interconectados */}
        {[
          { x: 350, y: 86, w: 86, h: 48, label: "API-GW" },
          { x: 472, y: 86, w: 86, h: 48, label: "APP-NODE" },
          { x: 350, y: 164, w: 86, h: 48, label: "WORKERS" },
          { x: 472, y: 164, w: 86, h: 48, label: "DB-SYNC" },
        ].map((box, i) => (
          <g key={box.label}>
            <rect
              x={box.x}
              y={box.y}
              width={box.w}
              height={box.h}
              rx="4"
              fill={i === 0 || i === 3 ? "#cef79e" : "#f7f7f5"}
              fillOpacity={i === 0 || i === 3 ? "0.6" : "0.95"}
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <line
              x1={box.x + 10}
              y1={box.y + 15}
              x2={box.x + 44}
              y2={box.y + 15}
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <circle cx={box.x + box.w - 12} cy={box.y + 15} r="2.5" fill="currentColor" />
            <text
              x={box.x + 10}
              y={box.y + 36}
              fill="currentColor"
              fontSize="9"
              fontFamily="monospace"
            >
              {box.label}
            </text>
          </g>
        ))}
        {/* Rutas de datos animadas entre contenedores */}
        <path
          d="M 436 110 H 472 M 393 134 V 164 M 515 134 V 164 M 436 188 H 472"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeDasharray="4 4"
          className="animate-[blueprintDash_2.2s_linear_infinite]"
        />
      </g>
    )
  }

  if (activeId === "ai-cloud") {
    return (
      <g className="animate-[layerFade_450ms_ease-out]">
        {/* Clúster Tensor GPU / Red Neuronal */}
        {[364, 412, 460].map((y, rIdx) => (
          <g key={`in-${y}`}>
            <line
              x1="366"
              y1={98 + rIdx * 46}
              x2="454"
              y2="118"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              className="animate-[blueprintDash_2s_linear_infinite]"
            />
            <line
              x1="366"
              y1={98 + rIdx * 46}
              x2="454"
              y2="172"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              className="animate-[blueprintDash_2s_linear_infinite]"
            />
            <circle
              cx="366"
              cy={98 + rIdx * 46}
              r="11"
              fill="#cef79e"
              fillOpacity="0.65"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <circle cx="366" cy={98 + rIdx * 46} r="3" fill="currentColor" />
          </g>
        ))}
        {[118, 172].map((cy, idx) => (
          <g key={`mid-${cy}`}>
            <line
              x1="454"
              y1={cy}
              x2="538"
              y2="144"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              className="animate-[blueprintDash_1.8s_linear_infinite]"
            />
            <rect
              x="438"
              y={cy - 16}
              width="32"
              height="32"
              rx="4"
              fill="#f7f7f5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <text x="444" y={cy + 3} fill="currentColor" fontSize="8" fontFamily="monospace">
              GPU{idx + 1}
            </text>
          </g>
        ))}
        <rect
          x="520"
          y="122"
          width="42"
          height="44"
          rx="5"
          fill="#cef79e"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <text x="528" y="148" fill="currentColor" fontSize="9.5" fontFamily="monospace">
          IA
        </text>
      </g>
    )
  }

  if (activeId === "security") {
    return (
      <g className="animate-[layerFade_450ms_ease-out]">
        {/* Anillos concéntricos de seguridad + escudo ENS Alto */}
        <circle
          cx="454"
          cy="148"
          r="64"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="5 4"
          className="origin-[454px_148px] animate-[spin_18s_linear_infinite]"
        />
        <circle
          cx="454"
          cy="148"
          r="46"
          fill="#cef79e"
          fillOpacity="0.35"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {/* Escudo geométrico central */}
        <path
          d="M 454 114 L 480 124 V 148 C 480 166 468 178 454 184 C 440 178 428 166 428 148 V 124 Z"
          fill="#f7f7f5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M 446 148 L 452 154 L 464 140"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x="415" y="226" fill="currentColor" fontSize="9" fontFamily="monospace">
          ENS ALTO · ISO 27001
        </text>
      </g>
    )
  }

  if (activeId === "edge") {
    return (
      <g className="animate-[layerFade_450ms_ease-out]">
        {/* Anillo de Fibra Oscura + Meet-Me Room */}
        <ellipse
          cx="454"
          cy="148"
          rx="88"
          ry="48"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeDasharray="5 4"
          className="animate-[blueprintDash_2.4s_linear_infinite]"
        />
        <ellipse
          cx="454"
          cy="148"
          rx="52"
          ry="26"
          fill="#cef79e"
          fillOpacity="0.4"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {[
          { x: 366, y: 148, t: "IXP" },
          { x: 542, y: 148, t: "ISP" },
          { x: 454, y: 100, t: "CLOUD" },
          { x: 454, y: 196, t: "EDGE" },
        ].map((node) => (
          <g key={node.t}>
            <rect
              x={node.x - 22}
              y={node.y - 11}
              width="44"
              height="22"
              rx="3"
              fill="#f7f7f5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <text x={node.x - 14} y={node.y + 3} fill="currentColor" fontSize="8" fontFamily="monospace">
              {node.t}
            </text>
          </g>
        ))}
        <text x="438" y="151" fill="currentColor" fontSize="9" fontFamily="monospace">
          MMR
        </text>
      </g>
    )
  }

  // Default: "dc-infra" (Infraestructura Física Datacenter)
  return (
    <g className="animate-[layerFade_450ms_ease-out]">
      {/* Batería de Racks 2N + Bus Eléctrico Renovable */}
      <line x1="354" y1="84" x2="554" y2="84" stroke="currentColor" strokeWidth="1.4" />
      <text x="356" y="76" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        2N POWER BUS · A+B
      </text>
      {[0, 1, 2, 3].map((idx) => {
        const rx = 362 + idx * 48
        return (
          <g key={idx}>
            <line x1={rx + 19} y1="84" x2={rx + 19} y2="98" stroke="currentColor" strokeWidth="1.2" />
            <rect
              x={rx}
              y="98"
              width="38"
              height="102"
              rx="2"
              fill="#cef79e"
              fillOpacity={0.55}
              stroke="currentColor"
              strokeWidth="1.3"
            />
            {[0, 1, 2, 3, 4].map((u) => (
              <line
                key={u}
                x1={rx + 5}
                y1={112 + u * 18}
                x2={rx + 33}
                y2={112 + u * 18}
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
            <text x={rx + 8} y="214" fill="currentColor" fontSize="8.5" fontFamily="monospace">
              R0{idx + 1}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── 4. Component Logic ─────────────────────────────────────────────────────
export function ArchitectureSection() {
  const { lang, t } = useLanguage()

  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const [inView, setInView] = useState(false)
  const [headingRevealed, setHeadingRevealed] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const words: WordDef[] =
    lang === "es"
      ? [
          { text: "Una" },
          { text: "plataforma." },
          { text: "Cada" },
          { text: "capa", breakAfter: true },
          { text: "diseñada", muted: true },
          { text: "a", muted: true },
          { text: "medida.", muted: true },
        ]
      : [
          { text: "One" },
          { text: "platform." },
          { text: "Every" },
          { text: "layer", breakAfter: true },
          { text: "purpose-built.", muted: true },
        ]

  /**
   * Observador de entrada al viewport idéntico a `IntegratedPlatformSection`.
   */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setInView(true)
      setHeadingRevealed(true)
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          if (entry.target === sectionRef.current) setInView(true)
          else if (entry.target === headingRef.current) setHeadingRevealed(true)
          obs.unobserve(entry.target)
        })
      },
      { threshold: 0, rootMargin: "0px 0px -18% 0px" }
    )

    if (sectionRef.current) obs.observe(sectionRef.current)
    if (headingRef.current) obs.observe(headingRef.current)

    return () => obs.disconnect()
  }, [])

  /**
   * Ciclo automático suave entre las 5 capas cada 3.4s cuando el usuario no tiene el cursor encima,
   * para que la animación vectorial de la derecha esté siempre viva.
   */
  useEffect(() => {
    if (isPaused) return
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % DC_LAYERS.length)
    }, 3400)
    return () => window.clearInterval(timer)
  }, [isPaused])

  const activeLayer = DC_LAYERS[activeIndex] ?? DC_LAYERS[0]

  // ─── 5. Render ────────────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      className="bg-bg-light text-text-base overflow-hidden"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes blueprintDash {
              to { stroke-dashoffset: -28; }
            }
            @keyframes layerFade {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `,
        }}
      />

      <div className="max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(64px,calc(32px+6.5vw),148px)] pb-[clamp(64px,calc(36px+6vw),140px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-y-12 lg:gap-x-12 items-start">
        {/* ── COLUMNA IZQUIERDA: Pastilla + Titular Cortina + Descripción + Selector de Capas + CTA ── */}
        <div className="relative w-full pt-12 flex flex-col items-start gap-y-8 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
          {/* Pastilla `.u-ts--1` con cuadrado verde lima */}
          <div
            className={cn(
              "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
            {t("01 / 05 · DATACENTER STACK", "01 / 05 · CAPAS DEL DATACENTER")}
          </div>

          {/* Titular bicolor con cortina por palabra idéntico a `IntegratedPlatformSection` */}
          <h2
            ref={headingRef}
            className="text-[clamp(1.85rem,calc(1.65rem+0.042*(100vw-27.5rem)),4.25rem)] font-normal tracking-[-0.02em] leading-[1.08] text-balance"
          >
            {words.map((w, idx) => (
              <React.Fragment key={idx}>
                <span
                  className={cn(
                    "relative inline-block align-bottom",
                    w.muted ? "text-[#c9cbbe]" : "text-text-base"
                  )}
                  style={{ clipPath: "inset(-0.1em)" }}
                >
                  {w.text}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-[0.12em] bottom-[-0.12em] bg-current origin-bottom transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{
                      transform: headingRevealed ? "scaleY(0)" : "scaleY(1)",
                      transitionDelay: `${idx * 95}ms`,
                    }}
                  />
                </span>{" "}
                {w.breakAfter && <br className="hidden md:inline" />}
              </React.Fragment>
            ))}
          </h2>

          {/* Párrafo descriptivo */}
          <p
            className={cn(
              "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35] max-w-[620px]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[140ms]",
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            {t(
              "From sovereign physical colocation and renewable 2N power to carrier-neutral connectivity, AI GPU clusters, and enterprise applications — every layer is engineered to work as one.",
              "Desde infraestructura física soberana y energía 100% renovable hasta conectividad neutra, clústeres de IA y aplicaciones — cada capa del centro de datos está diseñada a medida para ofrecer rendimiento, seguridad y control a escala."
            )}
          </p>

          {/* Lista interactiva de las 5 capas (sincronizada con el dibujo vectorial derecho) */}
          <div
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={cn(
              "w-full flex flex-col divide-y divide-bg-dark/10 border-t border-b border-bg-dark/10",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[220ms]",
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            {DC_LAYERS.map((layer, idx) => {
              const isSelected = idx === activeIndex
              return (
                <button
                  key={layer.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "w-full text-left py-3.5 px-3 -mx-3 rounded-[10px] transition-colors duration-200 flex items-start justify-between gap-4 cursor-pointer",
                    isSelected ? "bg-surface-beige/70" : "hover:bg-surface-beige/35"
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className={cn(
                        "font-mono text-[12px] px-2 py-0.5 rounded transition-colors duration-200 mt-0.5",
                        isSelected
                          ? "bg-[#cef79e] text-bg-dark font-medium"
                          : "bg-surface-light text-text-base/60"
                      )}
                    >
                      {layer.index}
                    </span>
                    <div>
                      <div className="text-[16px] md:text-[17px] font-normal tracking-[-0.02em] leading-snug text-text-base">
                        {t(layer.titleEn, layer.titleEs)}
                      </div>
                      <div
                        className={cn(
                          "overflow-hidden transition-all duration-300 text-[14px] text-text-base/70 leading-snug",
                          isSelected ? "max-h-20 opacity-100 mt-1" : "max-h-0 opacity-0"
                        )}
                      >
                        {t(layer.descEn, layer.descEs)}
                      </div>
                    </div>
                  </div>

                  <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.02em] text-text-base/45 shrink-0 mt-1">
                    {layer.code}
                  </span>
                </button>
              )
            })}
          </div>

          {/* CTA inferior */}
          <div
            className={cn(
              "pt-1 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[300ms]",
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <ArrowCta href="/datacenter/colocation">
              {t("EXPLORE INFRASTRUCTURE", "VER CÓMO FUNCIONA")}
            </ArrowCta>
          </div>
        </div>

        {/* ── COLUMNA DERECHA: Animación Vectorial Técnica de las Capas del DC ── */}
        <aside
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative w-full lg:pt-12 lg:sticky lg:top-28 lg:before:content-[''] lg:before:absolute lg:before:top-0 lg:before:left-0 lg:before:w-full lg:before:h-3 lg:before:rounded-t-[8px] lg:before:border-t lg:before:border-l lg:before:border-r lg:before:border-bg-dark/10"
        >
          <div
            className={cn(
              "relative w-full rounded-[20px] bg-[#f1f2ec] border border-bg-dark/10 overflow-hidden p-4 md:p-6 text-bg-dark shadow-[0_1px_3px_rgba(10,15,28,0.03)]",
              "transition-all duration-[900ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[180ms]",
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}
          >
            {/* Cabecera del plano técnico */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-2 border-b border-bg-dark/10">
              <div className="inline-flex items-center gap-2 bg-surface-light rounded-[6px] px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.02em] border border-bg-dark/8">
                <span aria-hidden className="w-2 h-2 bg-primary-hover animate-pulse" />
                {activeLayer.index} {t(activeLayer.titleEn, activeLayer.titleEs)}
              </div>
              <span className="inline-flex items-center bg-[#cef79e]/75 text-bg-dark rounded-[6px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.02em]">
                {t(activeLayer.specTagEn, activeLayer.specTagEs)}
              </span>
            </div>

            {/* Lienzo SVG Vectorial Animado (Stack Isométrico Izquierda + Detalle de Capa Derecha) */}
            <div className="w-full aspect-[620/460]">
              <svg
                viewBox="0 0 620 460"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                {/* Cuadrícula técnica de fondo */}
                <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <line key={`vg-${i}`} x1={50 * (i + 1)} y1="0" x2={50 * (i + 1)} y2="460" />
                  ))}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <line key={`hg-${i}`} x1="0" y1={50 * (i + 1)} x2="620" y2={50 * (i + 1)} />
                  ))}
                </g>

                {/* Ejes verticales de interconexión entre las 5 capas isométricas */}
                <g
                  stroke="currentColor"
                  strokeOpacity="0.28"
                  strokeWidth="1.1"
                  strokeDasharray="4 4"
                  className="animate-[blueprintDash_2.5s_linear_infinite]"
                >
                  <line x1="175" y1="68" x2="175" y2="392" />
                  <line x1="65" y1="120" x2="65" y2="360" />
                  <line x1="285" y1="120" x2="285" y2="360" />
                </g>

                {/* 5 Planos Isométricos Superpuestos (Pintados de abajo hacia arriba: índice 4 -> 0) */}
                {[4, 3, 2, 1, 0].map((layerIdx) => {
                  const layer = DC_LAYERS[layerIdx]
                  const isActive = layerIdx === activeIndex
                  const baseY = 86 + layerIdx * 64
                  const offsetY = isActive ? baseY - 10 : baseY
                  const thickness = 8

                  // Puntos del rombo isométrico (centro X=175, ancho=220, alto=96)
                  const topPts = `175,${offsetY - 46} 285,${offsetY} 175,${offsetY + 46} 65,${offsetY}`
                  const leftSidePts = `65,${offsetY} 175,${offsetY + 46} 175,${offsetY + 46 + thickness} 65,${offsetY + thickness}`
                  const rightSidePts = `285,${offsetY} 175,${offsetY + 46} 175,${offsetY + 46 + thickness} 285,${offsetY + thickness}`

                  return (
                    <g
                      key={layer.id}
                      onClick={() => setActiveIndex(layerIdx)}
                      onMouseEnter={() => setActiveIndex(layerIdx)}
                      className="cursor-pointer transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    >
                      {/* Cara lateral izquierda (grosor técnico) */}
                      <polygon
                        points={leftSidePts}
                        fill={isActive ? "#a7e26e" : "#e3e4dc"}
                        stroke="currentColor"
                        strokeWidth={isActive ? "1.3" : "1"}
                        strokeOpacity={isActive ? "1" : "0.55"}
                      />
                      {/* Cara lateral derecha (grosor técnico) */}
                      <polygon
                        points={rightSidePts}
                        fill={isActive ? "#95d15c" : "#d5d7cd"}
                        stroke="currentColor"
                        strokeWidth={isActive ? "1.3" : "1"}
                        strokeOpacity={isActive ? "1" : "0.55"}
                      />
                      {/* Cara superior del plano isométrico */}
                      <polygon
                        points={topPts}
                        fill={isActive ? "#cef79e" : "#f7f7f5"}
                        fillOpacity={isActive ? "0.92" : "0.88"}
                        stroke="currentColor"
                        strokeWidth={isActive ? "1.6" : "1.1"}
                        strokeOpacity={isActive ? "1" : "0.65"}
                      />

                      {/* Rejilla interna isométrica y circuitos dentro del plano */}
                      <line
                        x1="120"
                        y1={offsetY - 23}
                        x2="230"
                        y2={offsetY + 23}
                        stroke="currentColor"
                        strokeWidth="0.8"
                        strokeOpacity={isActive ? "0.45" : "0.18"}
                      />
                      <line
                        x1="230"
                        y1={offsetY - 23}
                        x2="120"
                        y2={offsetY + 23}
                        stroke="currentColor"
                        strokeWidth="0.8"
                        strokeOpacity={isActive ? "0.45" : "0.18"}
                      />

                      {/* Nodos activos sobre la capa seleccionada */}
                      {isActive && (
                        <g>
                          <path
                            d={`M 135 ${offsetY} Q 175 ${offsetY - 18} 215 ${offsetY}`}
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeDasharray="3 3"
                            className="animate-[blueprintDash_1.6s_linear_infinite]"
                          />
                          <circle cx="135" cy={offsetY} r="4" fill="#222f30" />
                          <circle cx="175" cy={offsetY - 9} r="3.5" fill="#222f30" />
                          <circle cx="215" cy={offsetY} r="4" fill="#222f30" />
                        </g>
                      )}

                      {/* Cota izquierda con número de capa */}
                      <line
                        x1="28"
                        y1={offsetY}
                        x2="58"
                        y2={offsetY}
                        stroke="currentColor"
                        strokeWidth={isActive ? "1.3" : "0.9"}
                        strokeOpacity={isActive ? "0.9" : "0.35"}
                      />
                      <text
                        x="14"
                        y={offsetY + 3}
                        fill="currentColor"
                        fillOpacity={isActive ? "1" : "0.45"}
                        fontSize="9.5"
                        fontFamily="monospace"
                      >
                        {layer.index}
                      </text>
                    </g>
                  )
                })}

                {/* Línea de llamada técnica desde la capa activa del stack hacia el panel de inspección derecho */}
                <path
                  d={`M 285 ${86 + activeIndex * 64 - 10} L 318 ${86 + activeIndex * 64 - 10} L 318 148 L 336 148`}
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeDasharray="4 3"
                  className="animate-[blueprintDash_2s_linear_infinite]"
                />
                <circle
                  cx="285"
                  cy={86 + activeIndex * 64 - 10}
                  r="3.5"
                  fill="#cef79e"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />

                {/* ── PANEL DE INSPECCIÓN ORTOGRÁFICO DERECHO (ZOOM DE LA CAPA ACTIVA) ── */}
                <g>
                  <rect
                    x="336"
                    y="46"
                    width="260"
                    height="204"
                    rx="8"
                    fill="#f7f7f5"
                    fillOpacity="0.85"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  {/* Cabecera técnica del módulo de zoom */}
                  <line x1="336" y1="68" x2="596" y2="68" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
                  <text x="348" y="60" fill="currentColor" fontSize="9" fontFamily="monospace">
                    {activeLayer.code} · {activeLayer.elevationLabel}
                  </text>
                  <circle cx="580" cy="57" r="3" fill="#cef79e" stroke="currentColor" strokeWidth="1" />

                  {/* Contenido vectorial específico de la capa activa */}
                  <ActiveLayerBlueprint activeId={activeLayer.id} />
                </g>

                {/* ── TELEMETRÍA Y FLUJO VERTICAL DEL DATACENTER (PARTE INFERIOR DERECHA) ── */}
                <g>
                  <rect
                    x="336"
                    y="268"
                    width="260"
                    height="152"
                    rx="8"
                    fill="#f7f7f5"
                    fillOpacity="0.85"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <text x="350" y="290" fill="currentColor" fontSize="9" fontFamily="monospace">
                    STACK TELEMETRY · FULL-STACK SOVEREIGNTY
                  </text>
                  <line x1="336" y1="298" x2="596" y2="298" stroke="currentColor" strokeWidth="1" strokeOpacity="0.18" />

                  {/* Barras técnicas de las 5 capas sincronizadas */}
                  {DC_LAYERS.map((l, i) => {
                    const isAct = i === activeIndex
                    const by = 312 + i * 20
                    const widths = [192, 176, 184, 168, 200]
                    return (
                      <g
                        key={`tel-${l.id}`}
                        onClick={() => setActiveIndex(i)}
                        className="cursor-pointer"
                      >
                        <text
                          x="350"
                          y={by + 9}
                          fill="currentColor"
                          fillOpacity={isAct ? "1" : "0.5"}
                          fontSize="8.5"
                          fontFamily="monospace"
                        >
                          {l.index}
                        </text>
                        <rect
                          x="374"
                          y={by}
                          width={widths[i]}
                          height="11"
                          rx="2"
                          fill={isAct ? "#cef79e" : "#e7e8e0"}
                          stroke="currentColor"
                          strokeWidth={isAct ? "1.2" : "0.8"}
                          strokeOpacity={isAct ? "1" : "0.4"}
                        />
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>

            {/* Pie del lienzo con indicadores rápidos */}
            <div className="mt-3 pt-3 border-t border-bg-dark/10 flex items-center justify-between font-mono text-[11px] text-text-base/60 uppercase">
              <span>{t("SPAIN · TIER III+ · 100% RENEWABLE", "ESPAÑA · TIER III+ · 100% RENOVABLE")}</span>
              <div className="flex items-center gap-1.5">
                {DC_LAYERS.map((l, idx) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-label={l.titleEs}
                    onClick={() => setActiveIndex(idx)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300 cursor-pointer",
                      idx === activeIndex ? "w-6 bg-bg-dark" : "w-2 bg-bg-dark/20 hover:bg-bg-dark/40"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

/*
 * ─── 6. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario solicitó que la sección debajo de los 3 cuadrados de colores
 * (`IntegratedPlatformSection`) tuviera el mismo lenguaje visual que la de arriba
 * pero con el texto a la izquierda, y a la derecha una animación vectorial con el
 * estilo de los dibujos técnicos de líneas de Colocation representando las capas
 * de aplicación e infraestructura del Data Center.
 * Decisiones técnicas:
 *  - Texto a la izquierda: corchete superior (`before:rounded-t-[8px]`), pastilla mono
 *    con cuadrado lima, titular bicolor `#222f30` + `#c9cbbe` con cortina por palabra,
 *    selector interactivo de las 5 capas y `ArrowCta`.
 *  - Animación vectorial a la derecha: SVG puro sin dependencias pesadas que combina
 *    los 5 planos isométricos del Data Center (con elevación dinámica y flujo de datos)
 *    junto con el plano técnico ortográfico en vivo (`ActiveLayerBlueprint`) de cada capa.
 */
