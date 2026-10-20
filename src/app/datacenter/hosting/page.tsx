"use client"

/**
 * OperationsPage (`/datacenter/hosting` & `/datacenter/operations`) —
 * "NOC Command Matrix & Interactive Smart-Hands Blueprint"
 *
 * Cubre los 3 apartados del submenú de Servicios de Operación en Datacenter:
 *  - Remote smart hands (`#smart-hands`)
 *  - Instalación y racking (`#racking`)
 *  - Logística (`#logistics`)
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

interface OperationPillar {
  id: "smart-hands" | "racking" | "logistics"
  index: string
  tagEs: string
  tagEn: string
  titleEs: string
  titleEn: string
  slaBadge: string
  leadEs: string
  leadEn: string
  tasksEs: string[]
  tasksEn: string[]
  diagram: React.ReactNode
}

// ─── 2. Vector Blueprints para los 3 Servicios de Operación ─────────────────
function VectorSmartHands() {
  return (
    <svg viewBox="0 0 420 200" fill="none" className="w-full h-full text-bg-dark">
      <rect x="20" y="24" width="140" height="152" rx="8" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.3" />
      <text x="34" y="46" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        NOC DESK 24×7
      </text>
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x="34"
          y={60 + i * 26}
          width="112"
          height="18"
          rx="3"
          fill={i === 1 ? "#cef79e" : "#ffffff"}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      <line
        x1="160"
        y1="100"
        x2="246"
        y2="100"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="4 4"
      />
      <circle cx="203" cy="100" r="14" fill="#cef79e" stroke="currentColor" strokeWidth="1.2" />
      <text x="193" y="103" fill="currentColor" fontSize="8" fontFamily="monospace">
        &lt;15m
      </text>
      <rect x="246" y="24" width="154" height="152" rx="8" fill="#222f30" stroke="currentColor" strokeWidth="1.3" />
      <text x="262" y="46" fill="#cef79e" fontSize="8.5" fontFamily="monospace">
        ON-SITE RACK ACTION
      </text>
      {[0, 1, 2, 3, 4].map((u) => (
        <g key={u}>
          <rect
            x="262"
            y={58 + u * 21}
            width="122"
            height="15"
            rx="2"
            fill={u === 2 ? "#cef79e" : "#2b3a3b"}
            stroke={u === 2 ? "#cef79e" : "#445e5f"}
            strokeWidth="1"
          />
          <circle
            cx="372"
            cy={65.5 + u * 21}
            r="2.5"
            fill={u === 2 ? "#222f30" : "#cef79e"}
          />
        </g>
      ))}
    </svg>
  )
}

function VectorRackingInstall() {
  return (
    <svg viewBox="0 0 420 200" fill="none" className="w-full h-full text-bg-dark">
      {/* Bastidor de 42U en alzado técnico */}
      <rect x="44" y="18" width="110" height="164" rx="4" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.4" />
      {[0, 1, 2, 3, 4, 5].map((u) => (
        <rect
          key={u}
          x="54"
          y={30 + u * 23}
          width="90"
          height="17"
          rx="2"
          fill={u < 3 ? "#cef79e" : "#ffffff"}
          fillOpacity={u < 3 ? "0.7" : "1"}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
      {/* Escuadras de montaje y peinado de cables */}
      <path d="M154 52 H232 L254 78 H380" stroke="currentColor" strokeWidth="1.3" strokeDasharray="4 3" />
      <path d="M154 98 H232 L254 124 H380" stroke="currentColor" strokeWidth="1.3" strokeDasharray="4 3" />
      <rect x="242" y="34" width="146" height="132" rx="8" fill="#ffffff" stroke="currentColor" strokeWidth="1.3" />
      <text x="258" y="56" fill="currentColor" fontSize="8.5" fontFamily="monospace">
        STRUCTURED CABLING
      </text>
      <text x="258" y="88" fill="currentColor" fontSize="8" fontFamily="monospace">
        • PDU A + PDU B BALANCE
      </text>
      <text x="258" y="112" fill="currentColor" fontSize="8" fontFamily="monospace">
        • LABELING ISO/TIA-606
      </text>
      <text x="258" y="136" fill="currentColor" fontSize="8" fontFamily="monospace">
        • OTDR FIBER TEST
      </text>
    </svg>
  )
}

function VectorTechnicalLogistics() {
  return (
    <svg viewBox="0 0 420 200" fill="none" className="w-full h-full text-bg-dark">
      {[
        { x: 24, code: "01", title: "RECEPCIÓN", sub: "MUELLE SEGURO" },
        { x: 156, code: "02", title: "CUSTODIA", sub: "ALMACÉN ESD" },
        { x: 288, code: "03", title: "PUESTA EN RACK", sub: "BURN-IN TEST" },
      ].map((step, idx) => (
        <g key={step.code}>
          <rect
            x={step.x}
            y="42"
            width="108"
            height="116"
            rx="8"
            fill={idx === 2 ? "#cef79e" : "#ffffff"}
            fillOpacity={idx === 2 ? "0.65" : "1"}
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <text x={step.x + 14} y="66" fill="currentColor" fontSize="9" fontFamily="monospace">
            STEP // {step.code}
          </text>
          <line x1={step.x + 14} y1="76" x2={step.x + 94} y2="76" stroke="currentColor" strokeOpacity="0.2" />
          <text x={step.x + 14} y="104" fill="currentColor" fontSize="10" fontFamily="monospace">
            {step.title}
          </text>
          <text x={step.x + 14} y="122" fill="currentColor" fillOpacity="0.6" fontSize="8" fontFamily="monospace">
            {step.sub}
          </text>
          {idx < 2 && (
            <line
              x1={step.x + 108}
              y1="100"
              x2={step.x + 156}
              y2="100"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeDasharray="3 3"
            />
          )}
        </g>
      ))}
    </svg>
  )
}

const PILLARS: OperationPillar[] = [
  {
    id: "smart-hands",
    index: "01",
    tagEs: "INTERVENCIÓN INMEDIATA 24×7×365",
    tagEn: "24×7×365 IMMEDIATE INTERVENTION",
    titleEs: "Remote Smart Hands",
    titleEn: "Remote Smart Hands",
    slaBadge: "SLA < 15 MIN",
    leadEs:
      "Nuestros ingenieros de sala actúan como una extensión directa de tu equipo técnico las 24 horas del día, los 365 días del año, para que nunca tengas que desplazarte al centro de datos.",
    leadEn:
      "Our on-site data hall engineers act as a direct extension of your technical team 24/7/365, so you never have to travel to the facility.",
    tasksEs: [
      "Sustitución en caliente (Hot-Swap) de discos NVMe/SAS, fuentes redundantes, ventiladores y módulos SFP+/QSFP",
      "Conexión de consola KVM/IPMI portátil de emergencia y diagnóstico visual de indicadores LED",
      "Tendido, reconexión y verificación reflectométrica de latiguillos de fibra y cobre",
      "Reinicio físico controlado y pruebas de arranque asistidas en coordinación con tu equipo",
    ],
    tasksEn: [
      "Hot-swap replacement of NVMe/SAS drives, redundant PSUs, fans, and SFP+/QSFP transceivers",
      "Emergency crash-cart KVM/IPMI console attachment and visual LED telemetry verification",
      "Patching, re-routing, and optical power testing of fiber and copper cross-connects",
      "Controlled physical power cycling and assisted boot diagnostics alongside your team",
    ],
    diagram: <VectorSmartHands />,
  },
  {
    id: "racking",
    index: "02",
    tagEs: "INGENIERÍA DE MONTAJE EN SALA",
    tagEn: "DATA HALL DEPLOYMENT ENGINEERING",
    titleEs: "Instalación y Racking",
    titleEn: "Installation & Racking",
    slaBadge: "TURNKEY READY",
    leadEs:
      "Ejecutamos el despliegue físico completo de tus servidores, switches y cabinas de almacenamiento siguiendo estándares estrictos de cableado estructurado, flujo térmico y balanceo eléctrico.",
    leadEn:
      "We execute the complete physical deployment of your servers, switches, and storage arrays following strict structured cabling, thermal airflow, and power-balancing standards.",
    tasksEs: [
      "Enracado mecánico en guías deslizantes para chasis de 1U a 8U y nodos GPU de alta densidad",
      "Peinado y etiquetado normativo TIA-606 de cableado eléctrico (Ramas A+B) y fibra óptica",
      "Instalación de paneles ciegos (blanking panels) y cepillos pasacables para optimizar el PUE",
      "Documentación fotográfica de alta resolución, mapa de elevación de U y entrega de puertos IPMI",
    ],
    tasksEn: [
      "Mechanical rail mounting for 1U to 8U chassis and high-density GPU nodes",
      "Structured dressing and TIA-606 labeling of dual A+B power cords and optical fiber",
      "Blanking panel and brush-strip installation to preserve cold/hot aisle containment",
      "High-resolution photographic handover, U-elevation diagram, and IPMI port activation",
    ],
    diagram: <VectorRackingInstall />,
  },
  {
    id: "logistics",
    index: "03",
    tagEs: "CADENA DE CUSTODIA Y ALMACÉN",
    tagEn: "CHAIN OF CUSTODY & WAREHOUSING",
    titleEs: "Logística Técnica",
    titleEn: "Technical Logistics",
    slaBadge: "ISO 27001 CUSTODY",
    leadEs:
      "Gestionamos la recepción, desembalaje, custodia de repuestos críticos y tramitación RMA desde nuestro muelle de carga blindado hasta tu bastidor.",
    leadEn:
      "We manage hardware reception, uncrating, spare-parts warehousing, and vendor RMA handling from our secure loading dock right to your cabinet.",
    tasksEs: [
      "Recepción directa de envíos paletizados en muelle de carga privado con control de albarán y estado físico",
      "Zona de desembalaje y laboratorio de pre-configuración (staging & burn-in) libre de polvo",
      "Custodia de repuestos críticos del cliente (discos, transceptores, RAM) en armario ESD dedicado",
      "Empaquetado seguro y gestión de devoluciones RMA con fabricantes (Dell, HPE, Supermicro, NVIDIA)",
    ],
    tasksEn: [
      "Direct recepción of palletized shipments at our private loading dock with manifest & damage inspection",
      "Dust-free uncrating area and pre-deployment staging & burn-in laboratory",
      "Dedicated ESD-safe spare parts locker for your critical drives, transceivers, and DIMMs",
      "Secure packaging and vendor RMA coordination (Dell, HPE, Supermicro, NVIDIA)",
    ],
    diagram: <VectorTechnicalLogistics />,
  },
]

// ─── 3. Helper Components ───────────────────────────────────────────────────
function WordRevealText({
  words,
  revealed,
  staggerMs = 80,
}: {
  words: RevealWord[]
  revealed: boolean
  staggerMs?: number
}) {
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
                transitionDelay: `${idx * staggerMs}ms`,
              }}
            />
          </span>{" "}
          {w.breakAfter && <br className="hidden md:inline" />}
        </React.Fragment>
      ))}
    </>
  )
}

// ─── 4. Page Component ──────────────────────────────────────────────────────
export default function OperationsPage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 60)
    return () => window.clearTimeout(timer)
  }, [])

  const heroWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Operamos" },
          { text: "tu" },
          { text: "hardware", breakAfter: true },
          { text: "sin", muted: true },
          { text: "que", muted: true },
          { text: "tengas", muted: true },
          { text: "que", muted: true },
          { text: "desplazarte.", muted: true },
        ]
      : [
          { text: "We" },
          { text: "operate" },
          { text: "your", breakAfter: true },
          { text: "hardware", muted: true },
          { text: "on-site", muted: true },
          { text: "24×7.", muted: true },
        ]

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: Cabecera Editorial + Barra de Telemetría Operativa ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-16">
        <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-6">
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{t("01 / DATACENTER · OPERATIONS SERVICES", "01 / DATACENTER · SERVICIOS DE OPERACIÓN")}</span>
        </div>

        <h1 className="text-[clamp(2.25rem,calc(2.25rem+0.062*(100vw-23rem)),6.25rem)] font-normal tracking-[-0.03em] leading-[1.03] pb-12 border-b border-bg-dark/12">
          <WordRevealText words={heroWords} revealed={revealed} staggerMs={85} />
        </h1>

        {/* Barra de 4 KPIs operativos */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-bg-dark/12 border-b border-bg-dark/12">
          {[
            { val: "24×7×365", labelEs: "INGENIERÍA EN SALA", labelEn: "ON-SITE ENGINEERS" },
            { val: "< 15 min", labelEs: "TIEMPO DE RESPUESTA", labelEn: "RESPONSE TIME SLA" },
            { val: "TIA-606", labelEs: "ESTÁNDAR DE CABLEADO", labelEn: "CABLING STANDARD" },
            { val: "100%", labelEs: "TRAZABILIDAD DOCUMENTAL", labelEn: "AUDIT TRACEABILITY" },
          ].map((kpi) => (
            <div key={kpi.val} className="py-6 sm:px-6 first:pl-0">
              <div className="text-[clamp(1.75rem,2.6vw,2.5rem)] font-normal tracking-[-0.03em] text-text-base leading-none mb-2">
                {kpi.val}
              </div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-base/55">
                {lang === "es" ? kpi.labelEs : kpi.labelEn}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECCIÓN 2: Los 3 Pilares de Operación en Filas Arquitectónicas Alternas ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pb-24 space-y-8">
        {PILLARS.map((pillar, idx) => (
          <article
            key={pillar.id}
            id={pillar.id}
            className={cn(
              "rounded-[20px] lg:rounded-[28px] p-6 sm:p-10 lg:p-12 border border-bg-dark/10 grid grid-cols-1 lg:grid-cols-12 gap-y-10 lg:gap-x-12 items-center",
              idx % 2 === 1 ? "bg-surface-beige" : "bg-surface-light"
            )}
          >
            {/* Columna de Texto (7 cols) */}
            <div className={cn("lg:col-span-7", idx % 2 === 1 && "lg:order-2")}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55">
                  {pillar.index} // {lang === "es" ? pillar.tagEs : pillar.tagEn}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] bg-primary px-2.5 py-1 rounded text-bg-dark">
                  {pillar.slaBadge}
                </span>
              </div>

              <h2 className="text-[clamp(1.85rem,3.2vw,3rem)] font-normal tracking-[-0.03em] leading-[1.06] text-text-base mb-4">
                {lang === "es" ? pillar.titleEs : pillar.titleEn}
              </h2>

              <p className="text-[16px] md:text-[17px] text-text-base/75 leading-[1.5] mb-8 max-w-[60ch]">
                {lang === "es" ? pillar.leadEs : pillar.leadEn}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {(lang === "es" ? pillar.tasksEs : pillar.tasksEn).map((task) => (
                  <div
                    key={task}
                    className="p-3.5 rounded-[10px] bg-bg-light/80 border border-bg-dark/8 text-[14px] text-text-base/85 leading-snug flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 bg-primary-hover mt-1.5 shrink-0" />
                    <span>{task}</span>
                  </div>
                ))}
              </div>

              <ArrowCta href="/contact">
                {t("Request Smart Hands support", "Solicitar servicio operativo")}
              </ArrowCta>
            </div>

            {/* Columna del Plano Vectorial (5 cols) */}
            <div className={cn("lg:col-span-5", idx % 2 === 1 && "lg:order-1")}>
              <div className="rounded-[16px] bg-bg-light border border-bg-dark/10 p-4">
                <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-bg-dark/10 font-mono text-[9.5px] uppercase tracking-[0.06em] text-text-base/50">
                  <span>CAD_SPEC // {pillar.id.toUpperCase()}</span>
                  <span>OLA_NOC_TEAM</span>
                </div>
                {pillar.diagram}
              </div>
            </div>
          </article>
        ))}
      </section>

      <Footer />
    </main>
  )
}
