"use client"

/**
 * SolutionsSection — Sección creativa de IA (`IA Cloud & On-Prem`) en la Home (`/`).
 *
 * Diseño solicitado por el usuario:
 *  - Fondeado gris cálido corporativo (`bg-surface-beige` / `#e7e8e0`).
 *  - Cabecera editorial con revelación por cortina de palabra (`#222f30` + `#9a9c8e`),
 *    pastilla mono con cuadrado lima/teal y botón `ArrowCta`.
 *  - 4 tarjetas creativas interactivas con la muesca curva inferior derecha (`87×90` SVG
 *    calada al color gris `#e7e8e0` de la sección) + botón paralelogramo `.u-btn--2`
 *    y dibujos vectoriales animados de líneas para cada escenario de IA:
 *    1. Entrenamiento Distribuido de Modelos
 *    2. Inferencia de Baja Latencia
 *    3. RAG & Vector DB Soberano
 *    4. AI Box & On-Prem Cloud
 */

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface WordDef {
  text: string
  muted?: boolean
  breakAfter?: boolean
}

interface AiScenarioDef {
  index: string
  tagEn: string
  tagEs: string
  titleEn: string
  titleEs: string
  descEn: string
  descEs: string
  chipsEn: string[]
  chipsEs: string[]
  ctaEn: string
  ctaEs: string
  href: string
  accentBg: string
  diagram: React.ReactNode
}

// ─── 2. Diagramas Vectoriales Animados de IA ────────────────────────────────

/**
 * 01. Diagrama vectorial animado: Entrenamiento Distribuido de Modelos (All-Reduce GPU Ring + Curva de Convergencia)
 */
function VectorModelTraining() {
  return (
    <svg viewBox="0 0 420 190" fill="none" className="w-full h-full">
      {/* Anillo de sincronización All-Reduce entre GPUs */}
      <ellipse
        cx="132"
        cy="95"
        rx="74"
        ry="54"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="5 4"
        className="animate-[aiDash_2.2s_linear_infinite]"
      />
      <line x1="58" y1="95" x2="206" y2="95" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.25" />
      <line x1="132" y1="41" x2="132" y2="149" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.25" />
      <line x1="80" y1="57" x2="184" y2="133" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.25" />
      <line x1="184" y1="57" x2="80" y2="133" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.25" />

      {/* 6 Nodos GPU en anillo */}
      {[
        { x: 132, y: 41, l: "G0" },
        { x: 196, y: 68, l: "G1" },
        { x: 196, y: 122, l: "G2" },
        { x: 132, y: 149, l: "G3" },
        { x: 68, y: 122, l: "G4" },
        { x: 68, y: 68, l: "G5" },
      ].map((n, i) => (
        <g key={n.l}>
          <rect
            x={n.x - 16}
            y={n.y - 12}
            width="32"
            height="24"
            rx="4"
            fill={i % 2 === 0 ? "#cef79e" : "#ffffff"}
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <text x={n.x - 7} y={n.y + 3} fill="currentColor" fontSize="8.5" fontFamily="monospace">
            {n.l}
          </text>
        </g>
      ))}

      {/* Núcleo central Tensor */}
      <circle cx="132" cy="95" r="16" fill="#99f6e4" fillOpacity="0.65" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="132" cy="95" r="4" fill="currentColor" />

      {/* Panel derecho: Curva de entrenamiento Loss / Épocas */}
      <rect x="242" y="36" width="154" height="118" rx="6" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="258" y1="62" x2="380" y2="62" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.18" />
      <line x1="258" y1="95" x2="380" y2="95" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.18" />
      <line x1="258" y1="128" x2="380" y2="128" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.18" />
      <path
        d="M 260 64 C 282 118, 315 124, 378 130"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M 260 64 C 282 118, 315 124, 378 130"
        stroke="#222f30"
        strokeWidth="3"
        strokeDasharray="8 140"
        className="animate-[aiPulsePath_2.6s_linear_infinite]"
      />
      <circle cx="378" cy="130" r="3.5" fill="#cef79e" stroke="currentColor" strokeWidth="1.2" />
      <text x="258" y="52" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        LOSS CONVERGENCE · FP8
      </text>
    </svg>
  )
}

/**
 * 02. Diagrama vectorial animado: Inferencia de Baja Latencia (Pipeline de Tokens en Tiempo Real)
 */
function VectorInferencePipeline() {
  return (
    <svg viewBox="0 0 420 190" fill="none" className="w-full h-full">
      {/* Entrada Prompt */}
      <rect x="24" y="68" width="76" height="54" rx="5" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.2" />
      <text x="36" y="91" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        PROMPT IN
      </text>
      <line x1="36" y1="103" x2="84" y2="103" stroke="currentColor" strokeWidth="1.2" />

      {/* Flecha animada hacia el motor vLLM / TensorRT */}
      <line
        x1="100"
        y1="95"
        x2="148"
        y2="95"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        className="animate-[aiDash_1.4s_linear_infinite]"
      />

      {/* Motor central de Inferencia */}
      <rect
        x="148"
        y="46"
        width="114"
        height="98"
        rx="7"
        fill="#cef79e"
        fillOpacity="0.65"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x="162" y="68" fill="currentColor" fontSize="9" fontFamily="monospace">
        INFERENCE ENGINE
      </text>
      {[0, 1, 2].map((lane) => (
        <g key={lane}>
          <rect
            x="162"
            y={78 + lane * 18}
            width="86"
            height="11"
            rx="2"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="1"
          />
          <rect
            x="165"
            y={80.5 + lane * 18}
            width={58 - lane * 12}
            height="6"
            rx="1"
            fill="currentColor"
          />
        </g>
      ))}

      {/* Salida paralela hacia 3 canales de streaming de tokens */}
      {[56, 95, 134].map((ty, idx) => (
        <g key={ty}>
          <path
            d={`M 262 95 L 296 ${ty} H 322`}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            className="animate-[aiDash_1.5s_linear_infinite]"
          />
          <rect
            x="322"
            y={ty - 14}
            width="74"
            height="28"
            rx="4"
            fill={idx === 1 ? "#99f6e4" : "#f7f7f5"}
            fillOpacity={idx === 1 ? "0.65" : "1"}
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <text x="332" y={ty + 3} fill="currentColor" fontSize="8.5" fontFamily="monospace">
            TOK/S 0{idx + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}

/**
 * 03. Diagrama vectorial animado: RAG & Vector DB Soberano (Espacio Vectorial + Búsqueda Semántica)
 */
function VectorRagDatabase() {
  return (
    <svg viewBox="0 0 420 190" fill="none" className="w-full h-full">
      {/* Cilindros apilados de Base de Datos Vectorial */}
      <g>
        {[124, 96, 68].map((cy, idx) => (
          <g key={cy}>
            <path
              d={`M 42 ${cy} V ${cy + 22} C 42 ${cy + 30}, 138 ${cy + 30}, 138 ${cy + 22} V ${cy}`}
              fill={idx === 2 ? "#cef79e" : "#f7f7f5"}
              fillOpacity={idx === 2 ? "0.65" : "1"}
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <ellipse
              cx="90"
              cy={cy}
              rx="48"
              ry="11"
              fill={idx === 2 ? "#cef79e" : "#ffffff"}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </g>
        ))}
        <text x="58" y="71" fill="currentColor" fontSize="8.5" fontFamily="monospace">
          VECTOR DB
        </text>
      </g>

      {/* Enlace de consulta semántica */}
      <line
        x1="138"
        y1="98"
        x2="196"
        y2="98"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeDasharray="4 4"
        className="animate-[aiDash_1.8s_linear_infinite]"
      />

      {/* Cubo / Espacio de Embeddings Semánticos */}
      <rect
        x="196"
        y="34"
        width="198"
        height="124"
        rx="6"
        fill="#f7f7f5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <text x="210" y="52" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        SEMANTIC EMBEDDING SPACE · ES
      </text>

      {/* Líneas de distancia coseno (Nearest Neighbors) */}
      <line
        x1="292"
        y1="102"
        x2="240"
        y2="76"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="3 3"
        className="animate-[aiDash_2s_linear_infinite]"
      />
      <line
        x1="292"
        y1="102"
        x2="348"
        y2="78"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="3 3"
        className="animate-[aiDash_2s_linear_infinite]"
      />
      <line
        x1="292"
        y1="102"
        x2="334"
        y2="134"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="3 3"
        className="animate-[aiDash_2s_linear_infinite]"
      />

      <circle cx="292" cy="102" r="14" fill="#99f6e4" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="292" cy="102" r="4" fill="currentColor" />

      {[
        { x: 240, y: 76 },
        { x: 348, y: 78 },
        { x: 334, y: 134 },
        { x: 236, y: 128 },
        { x: 368, y: 112 },
      ].map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r="5.5"
          fill={i < 3 ? "#cef79e" : "#ffffff"}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  )
}

/**
 * 04. Diagrama vectorial animado: AI Box & On-Prem Cloud (Appliance Dedicado en tus Instalaciones)
 */
function VectorAiBoxOnPrem() {
  return (
    <svg viewBox="0 0 420 190" fill="none" className="w-full h-full">
      {/* Chasis técnico AI Box */}
      <rect
        x="34"
        y="40"
        width="224"
        height="112"
        rx="7"
        fill="#f7f7f5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x="48" y="58" fill="currentColor" fontSize="9" fontFamily="monospace">
        OLA AI BOX · TURNKEY APPLIANCE
      </text>
      <line x1="34" y1="66" x2="258" y2="66" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />

      {/* 4 Blades GPU locales dentro del AI Box */}
      {[0, 1, 2, 3].map((b) => (
        <g key={b}>
          <rect
            x={48 + b * 50}
            y="78"
            width="42"
            height="58"
            rx="3"
            fill={b < 2 ? "#cef79e" : "#99f6e4"}
            fillOpacity="0.6"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <line x1={55 + b * 50} y1="92" x2={83 + b * 50} y2="92" stroke="currentColor" strokeWidth="1" />
          <line x1={55 + b * 50} y1="102" x2={83 + b * 50} y2="102" stroke="currentColor" strokeWidth="1" />
          <circle cx={69 + b * 50} cy="122" r="3" fill="currentColor" />
        </g>
      ))}

      {/* Enlace local cifrado hacia la red privada del cliente */}
      <line
        x1="258"
        y1="96"
        x2="314"
        y2="96"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="4 4"
        className="animate-[aiDash_1.8s_linear_infinite]"
      />

      {/* Perímetro On-Premise del cliente */}
      <rect
        x="314"
        y="52"
        width="78"
        height="88"
        rx="6"
        fill="#ffffff"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <text x="327" y="76" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        ON-PREM
      </text>
      <text x="327" y="88" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        LAN ONLY
      </text>
      <circle cx="353" cy="114" r="12" fill="#cef79e" stroke="currentColor" strokeWidth="1.2" />
      <path d="M 349 114 L 352 117 L 358 110" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const AI_SCENARIOS: AiScenarioDef[] = [
  {
    index: "01.",
    tagEn: "DISTRIBUTED GPU CLUSTERS",
    tagEs: "CLÚSTERES GPU DISTRIBUIDOS",
    titleEn: "Model Training & Fine-Tuning",
    titleEs: "Entrenamiento y Fine-Tuning",
    descEn:
      "Train and fine-tune foundational models or domain-specific LLMs on high-density bare-metal GPU nodes with ultra-low latency interconnects.",
    descEs:
      "Entrena y ajusta modelos fundacionales o LLMs propios sobre servidores GPU dedicados de alta densidad con interconexión de ultrabaja latencia.",
    chipsEn: ["Dedicated GPUs", "High-Speed Fabric", "100% Renewable"],
    chipsEs: ["GPUs Dedicadas", "Red de Alta Velocidad", "100% Renovable"],
    ctaEn: "Explore GPU Servers",
    ctaEs: "Ver Servidores GPU",
    href: "/datacenter/ai-servers",
    accentBg: "bg-[#cef79e]/65",
    diagram: <VectorModelTraining />,
  },
  {
    index: "02.",
    tagEn: "PRODUCTION AI ENDPOINTS",
    tagEs: "ENDPOINTS DE PRODUCCIÓN",
    titleEn: "Low-Latency Inference",
    titleEs: "Inferencia de Baja Latencia",
    descEn:
      "Serve production AI models with sub-2ms national network latency, predictable pricing without per-token surprises, and dedicated throughput.",
    descEs:
      "Despliega modelos en producción con menos de 2 ms de latencia en España, caudal garantizado y costes predecibles sin sorpresas por token.",
    chipsEn: ["< 2 ms Latency", "Predictable Cost", "High Availability"],
    chipsEs: ["Latencia < 2 ms", "Coste Predecible", "Alta Disponibilidad"],
    ctaEn: "Explore IA Cloud",
    ctaEs: "Explorar IA Cloud",
    href: "/cloud/ai",
    accentBg: "bg-[#99f6e4]/65",
    diagram: <VectorInferencePipeline />,
  },
  {
    index: "03.",
    tagEn: "SOVEREIGN KNOWLEDGE AI",
    tagEs: "CONOCIMIENTO PRIVADO RGPD",
    titleEn: "Private RAG & Vector DB",
    titleEs: "RAG Privado y Vector DB",
    descEn:
      "Connect your corporate documentation and databases to sovereign AI pipelines that never leave Spain or train third-party public models.",
    descEs:
      "Conecta tus bases de datos y documentación corporativa a motores de IA soberanos donde tus datos nunca salen de España ni entrenan modelos externos.",
    chipsEn: ["Zero Data Leakage", "GDPR & ENS High", "Managed Storage"],
    chipsEs: ["Fuga de Datos Cero", "RGPD y ENS Alto", "Almacenamiento Seguro"],
    ctaEn: "Explore AI Infrastructure",
    ctaEs: "Ver Infraestructura IA",
    href: "/cloud/ai",
    accentBg: "bg-[#99f6e4]/45",
    diagram: <VectorRagDatabase />,
  },
  {
    index: "04.",
    tagEn: "ON-PREMISE APPLIANCE",
    tagEs: "DESPLIEGUE EN TUS INSTALACIONES",
    titleEn: "AI Box & On-Prem Cloud",
    titleEs: "AI Box y Cloud On-Premise",
    descEn:
      "Complete turnkey hardware and software solution to deploy private AI and cloud capabilities directly inside your own company premises.",
    descEs:
      "Solución llave en mano de hardware y software para desplegar capacidades de IA privada y cloud directamente en las instalaciones de tu empresa.",
    chipsEn: ["Turnkey AI Box", "Air-Gapped Ready", "24×7 OLA Support"],
    chipsEs: ["AI Box Llave en Mano", "Aislamiento Local", "Soporte OLA 24×7"],
    ctaEn: "Discover AI Box",
    ctaEs: "Descubrir AI Box",
    href: "/datacenter/on-premise",
    accentBg: "bg-[#cef79e]/45",
    diagram: <VectorAiBoxOnPrem />,
  },
]

// ─── 3. Component Logic ─────────────────────────────────────────────────────
export function SolutionsSection() {
  const { lang, t } = useLanguage()

  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const [inView, setInView] = useState(false)
  const [headingRevealed, setHeadingRevealed] = useState(false)
  const [gridRevealed, setGridRevealed] = useState(false)

  const words: WordDef[] =
    lang === "es"
      ? [
          { text: "IA" },
          { text: "Cloud" },
          { text: "para" },
          { text: "cada" },
          { text: "escenario", breakAfter: true },
          { text: "con", muted: true },
          { text: "soberanía", muted: true },
          { text: "total.", muted: true },
        ]
      : [
          { text: "IA" },
          { text: "Cloud" },
          { text: "for" },
          { text: "every" },
          { text: "scenario", breakAfter: true },
          { text: "with", muted: true },
          { text: "full", muted: true },
          { text: "sovereignty.", muted: true },
        ]

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setInView(true)
      setHeadingRevealed(true)
      setGridRevealed(true)
      return
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          if (entry.target === sectionRef.current) setInView(true)
          else if (entry.target === headingRef.current) setHeadingRevealed(true)
          else if (entry.target === gridRef.current) setGridRevealed(true)
          obs.unobserve(entry.target)
        })
      },
      { threshold: 0, rootMargin: "0px 0px -15% 0px" }
    )

    if (sectionRef.current) obs.observe(sectionRef.current)
    if (headingRef.current) obs.observe(headingRef.current)
    if (gridRef.current) obs.observe(gridRef.current)

    return () => obs.disconnect()
  }, [])

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      className="bg-surface-beige text-text-base py-[clamp(72px,calc(48px+5vw),144px)] mb-20 overflow-hidden"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes aiDash {
              to { stroke-dashoffset: -28; }
            }
            @keyframes aiPulsePath {
              0% { stroke-dashoffset: 140; }
              100% { stroke-dashoffset: 0; }
            }
          `,
        }}
      />

      <div className="max-w-[1600px] mx-auto px-6 md:px-[44px]">
        {/* ── CABECERA EDITORIAL (1fr / 2fr) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-10 lg:gap-x-10 items-start pb-[clamp(48px,calc(32px+3.5vw),88px)]">
          <aside className="flex flex-col items-start gap-6">
            <div
              className={cn(
                "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
              {t("OUR AI SOLUTIONS", "SOLUCIONES DE IA SOBERANA")}
            </div>
          </aside>

          <div className="flex flex-col items-start gap-7">
            <h2
              ref={headingRef}
              className="text-[clamp(1.85rem,calc(1.65rem+0.048*(100vw-27.5rem)),4.5rem)] font-normal tracking-[-0.02em] leading-[1.08] text-balance"
            >
              {words.map((w, idx) => (
                <React.Fragment key={idx}>
                  <span
                    className={cn(
                      "relative inline-block align-bottom",
                      w.muted ? "text-[#9a9c8e]" : "text-text-base"
                    )}
                    style={{ clipPath: "inset(-0.1em)" }}
                  >
                    {w.text}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-[0.12em] bottom-[-0.12em] bg-current origin-bottom transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{
                        transform: headingRevealed ? "scaleY(0)" : "scaleY(1)",
                        transitionDelay: `${idx * 90}ms`,
                      }}
                    />
                  </span>{" "}
                  {w.breakAfter && <br className="hidden md:inline" />}
                </React.Fragment>
              ))}
            </h2>

            <div className="w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
              <p
                className={cn(
                  "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35] max-w-[640px]",
                  "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[140ms]",
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
              >
                {t(
                  "Managed GPU clusters, sovereign cloud endpoints, and turnkey on-premise appliances engineered to build, train, and run AI with full data privacy.",
                  "Clústeres GPU dedicados, endpoints de inferencia y soluciones AI Box on-premise para construir, entrenar y ejecutar IA con total control y rendimiento."
                )}
              </p>

              <div
                className={cn(
                  "shrink-0 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[220ms]",
                  inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
              >
                <ArrowCta href="/cloud/ai">
                  {t("EXPLORE IA CLOUD", "EXPLORAR IA CLOUD")}
                </ArrowCta>
              </div>
            </div>
          </div>
        </div>

        {/* ── GRID CREATIVO DE 4 ESCENARIOS DE IA CON MUESCA INTEGRATEDBIO ── */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
        >
          {AI_SCENARIOS.map((item, idx) => {
            const chips = lang === "es" ? item.chipsEs : item.chipsEn
            return (
              <Link
                key={item.index}
                href={item.href}
                className={cn(
                  "group relative flex flex-col min-h-[360px] p-4 md:p-5 rounded-t-[24px] rounded-bl-[24px] overflow-hidden text-text-base no-underline",
                  "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  gridRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                )}
                style={{ transitionDelay: `${100 + idx * 110}ms` }}
              >
                {/* Fondo blanco con recorte inferior derecho `.item_background` */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-surface-light rounded-t-[24px] rounded-bl-[24px] z-0 transition-colors duration-300 group-hover:bg-white"
                  style={{
                    clipPath:
                      "polygon(100% 0, 100% calc(100% - 75px), calc(100% - 75px) calc(100% - 75px), calc(100% - 75px) 100%, 0 100%, 0 0)",
                  }}
                />

                {/* Barra superior: Índice + Etiqueta Pastel */}
                <div className="relative z-10 flex items-center justify-between gap-2 mb-3 px-1">
                  <span className="font-mono text-[12px] tracking-[-0.02em] text-text-base/60">
                    {item.index}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-[6px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.02em] text-bg-dark",
                      item.accentBg
                    )}
                  >
                    {t(item.tagEn, item.tagEs)}
                  </span>
                </div>

                {/* Lienzo vectorial animado de cada escenario */}
                <figure className="relative z-10 w-full aspect-[420/190] rounded-[16px] bg-[#f3f4ee] border border-bg-dark/6 overflow-hidden mb-5 flex items-center justify-center p-2 transition-colors duration-300 group-hover:bg-[#eef0e6]">
                  <div className="w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]">
                    {item.diagram}
                  </div>
                </figure>

                {/* Texto + Chips de especificaciones */}
                <div className="relative z-10 flex flex-col flex-1 gap-3 px-2 pb-1">
                  <h3 className="text-[clamp(1.375rem,1.8vw,1.65rem)] font-normal tracking-[-0.02em] leading-[1.12] text-text-base">
                    {t(item.titleEn, item.titleEs)}
                  </h3>
                  <p className="text-[15px] text-text-base/75 tracking-[-0.01em] leading-[1.38] max-w-[540px]">
                    {t(item.descEn, item.descEs)}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center bg-bg-light text-text-base/80 border border-bg-dark/10 rounded-[6px] px-2.5 py-1 font-mono text-[11px] tracking-[-0.01em] leading-none"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto pt-5 font-mono text-[12px] tracking-[-0.02em] leading-none uppercase text-text-base pr-16 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-hover transition-transform duration-300 group-hover:scale-150" />
                    {t(item.ctaEn, item.ctaEs)}
                  </div>
                </div>

                {/* Muesca curva SVG (`87x90`) + botón paralelogramo `.u-btn--2` (`51x48`) */}
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
            )
          })}
        </div>
      </div>
    </section>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario pidió para la siguiente sección de IA algo más creativo y
 * con el fondeado gris que utilizamos en el sistema (`bg-surface-beige` / `#e7e8e0`).
 * Decisiones técnicas:
 *  - Fondeado a sangre `bg-surface-beige` (`#e7e8e0`) con cabecera bicolor animada
 *    por cortina de palabra y `ArrowCta`.
 *  - 4 tarjetas interactivas con muesca curva inferior derecha (`87×90`) + botón
 *    paralelogramo `.u-btn--2` y 4 diagramas vectoriales animados de líneas
 *    (`VectorModelTraining`, `VectorInferencePipeline`, `VectorRagDatabase`, `VectorAiBoxOnPrem`).
 */
