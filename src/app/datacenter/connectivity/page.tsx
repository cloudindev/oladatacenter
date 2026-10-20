"use client"

/**
 * ConnectivityPage (`/datacenter/connectivity`) — Variación 1:
 * "Interactive Blueprint Split & Live Topology Console"
 *
 * Cubre los 3 apartados del submenú de Conectividad en Datacenter:
 *  - Cross-connects (`#cross-connects`)
 *  - Meet-Me Room (`#mmr`)
 *  - Tránsito IP (`#ip-transit`)
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

interface ConnectivityModule {
  id: "cross-connects" | "mmr" | "ip-transit"
  index: string
  code: string
  titleEs: string
  titleEn: string
  subtitleEs: string
  subtitleEn: string
  descEs: string
  descEn: string
  metrics: { labelEs: string; labelEn: string; value: string }[]
  specsEs: string[]
  specsEn: string[]
}

// ─── 2. Constants & Data ────────────────────────────────────────────────────
const MODULES: ConnectivityModule[] = [
  {
    id: "cross-connects",
    index: "01",
    code: "L1_OPTICAL // X-CONNECT",
    titleEs: "Cross-Connects",
    titleEn: "Cross-Connects",
    subtitleEs: "Interconexión física directa entre bastidores, operadores y nubes.",
    subtitleEn: "Direct physical interconnection between racks, carriers, and clouds.",
    descEs:
      " Enlaces dedicados punto a punto en fibra monomodo (OS2), multimodo (OM4/OM5) o cobre dentro del centro de datos. Sin saltos intermedios, sin congestión y con latencia determinista inferior a 0,1 ms.",
    descEn:
      "Dedicated point-to-point links over single-mode (OS2), multi-mode (OM4/OM5) fiber, or copper inside the data center. Zero intermediate hops, zero congestion, and deterministic sub-0.1ms latency.",
    metrics: [
      { labelEs: "LATENCIA INTERNA", labelEn: "INTERNAL LATENCY", value: "< 0.08 ms" },
      { labelEs: "CAUDAL ÓPTICO", labelEn: "OPTICAL SPEED", value: "1G – 400G" },
      { labelEs: "DISPONIBILIDAD", labelEn: "AVAILABILITY", value: "99.999%" },
    ],
    specsEs: [
      "Fibra monomodo OS2 y multimodo OM4/OM5 con doble ruta física A+B",
      "Aprovisionamiento rápido y certificación reflectométrica OTDR en cada tendido",
      "Conexión directa a otros clientes, proveedores cloud o carriers en MMR",
    ],
    specsEn: [
      "Single-mode OS2 and multi-mode OM4/OM5 fiber with diverse A+B physical paths",
      "Rapid provisioning and OTDR reflectometric certification on every run",
      "Direct patching to other tenants, cloud on-ramps, or carriers in the MMR",
    ],
  },
  {
    id: "mmr",
    index: "02",
    code: "MMR_REDUNDANT // CARRIER_NEUTRAL",
    titleEs: "Meet-Me Room",
    titleEn: "Meet-Me Room",
    subtitleEs: "Salas de interconexión neutras con rutas de entrada físicamente diversas.",
    subtitleEn: "Carrier-neutral interconnection rooms with physically diverse entry paths.",
    descEs:
      "Nuestras cámaras Meet-Me Room (MMR) duplicadas operan bajo neutralidad total de red. Conecta tu infraestructura con los principales operadores nacionales, internacionales y puntos neutros de intercambio (IXP).",
    descEn:
      "Our dual redundant Meet-Me Rooms (MMR) operate with complete carrier neutrality. Connect your infrastructure to Tier-1 international carriers, national fiber networks, and Internet Exchange Points (IXPs).",
    metrics: [
      { labelEs: "ACOMETIDAS DE FIBRA", labelEn: "FIBER ENTRANCES", value: "2 Rutas (N+N)" },
      { labelEs: "ECOSISTEMA", labelEn: "ECOSYSTEM", value: "100% Neutro" },
      { labelEs: "SEGURIDAD FÍSICA", labelEn: "PHYSICAL SECURITY", value: "Biometría + CCTV" },
    ],
    specsEs: [
      "Doble cámara de entrada de fibra en extremos opuestos del edificio",
      "Bandejas aéreas segregadas para caminos ópticos A y B hasta tu rack",
      "Acceso directo a anillos metropolitanos de fibra oscura y puntos neutros",
    ],
    specsEn: [
      "Dual fiber entry vaults at opposite perimeters of the facility",
      "Segregated overhead raceways for A and B optical paths right to your rack",
      "Direct access to metro dark fiber rings and Internet Exchanges",
    ],
  },
  {
    id: "ip-transit",
    index: "03",
    code: "BGP_BLEND // TIER1_TRANSIT",
    titleEs: "Tránsito IP",
    titleEn: "IP Transit",
    subtitleEs: "Caudal IP multi-homing de baja latencia con mitigación DDoS en línea.",
    subtitleEn: "Low-latency multi-homed IP blend with inline DDoS mitigation.",
    descEs:
      "Combinación inteligente BGP de múltiples operadores Tier-1 e intercambio directo en IXP para garantizar la ruta más corta hacia cualquier destino en España y Europa, con sesiones BGP completas o puerta de enlace redundante VRRP.",
    descEn:
      "Intelligent BGP blend of multiple Tier-1 upstreams and direct IXP peering to guarantee the shortest path across Spain and Europe, available with full BGP tables or redundant VRRP gateways.",
    metrics: [
      { labelEs: "LATENCIA EN ESPAÑA", labelEn: "SPAIN LATENCY", value: "< 2 ms" },
      { labelEs: "PROTOCOLOS", labelEn: "PROTOCOLS", value: "IPv4 / IPv6 BGP" },
      { labelEs: "PROTECCIÓN", labelEn: "PROTECTION", value: "Anti-DDoS L3–L7" },
    ],
    specsEs: [
      "Mix BGP multi-operador Tier-1 con conmutación automática sin pérdida de paquetes",
      "Entrega en puertos 1G, 10G, 25G, 40G y 100G redundantes (LACP / BGP ECMP)",
      "Anuncio de prefijos propios (BYOIP) o asignación de direccionamiento RIPE",
    ],
    specsEn: [
      "Multi-homed Tier-1 BGP blend with automated zero-packet-loss failover",
      "Delivered over redundant 1G, 10G, 25G, 40G, and 100G ports (LACP / BGP ECMP)",
      "Bring Your Own IP (BYOIP) BGP announcements or RIPE IPv4/IPv6 allocation",
    ],
  },
]

// ─── 3. Helper Components ───────────────────────────────────────────────────
function WordRevealText({
  words,
  revealed,
  staggerMs = 80,
  baseDelayMs = 0,
}: {
  words: RevealWord[]
  revealed: boolean
  staggerMs?: number
  baseDelayMs?: number
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
 * Consola Vectorial Interactiva de Topología Óptica:
 * Cambia dinámicamente según el módulo seleccionado (`cross-connects`, `mmr`, `ip-transit`).
 */
function OpticalTopologyBlueprint({
  activeId,
  onSelect,
}: {
  activeId: ConnectivityModule["id"]
  onSelect: (id: ConnectivityModule["id"]) => void
}) {
  return (
    <div className="relative w-full rounded-[16px] lg:rounded-[24px] bg-surface-light border border-bg-dark/12 p-4 sm:p-6 overflow-hidden">
      {/* Cabecera técnica del plano */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-bg-dark/10 font-mono text-[10px] uppercase tracking-[0.06em] text-text-base/55">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-primary-hover inline-block" />
          <span>OPTICAL_MATRIX // LIVE_BLUEPRINT</span>
        </span>
        <span>REDUNDANCY: 2N (PATH_A + PATH_B)</span>
      </div>

      <svg viewBox="0 0 640 400" fill="none" className="w-full h-auto block text-bg-dark">
        <style>{`
          @keyframes optDash { to { stroke-dashoffset: -32; } }
        `}</style>

        {/* Cuadrícula de referencia sutil */}
        <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
          {[80, 160, 240, 320].map((y) => (
            <line key={`hy-${y}`} x1="0" y1={y} x2="640" y2={y} />
          ))}
          {[128, 256, 384, 512].map((x) => (
            <line key={`vx-${x}`} x1={x} y1="0" x2={x} y2="400" />
          ))}
        </g>

        {/* ── ZONA 3 (Arriba): TRÁNSITO IP / TIER-1 UPSTREAMS ── */}
        <g
          onClick={() => onSelect("ip-transit")}
          className="cursor-pointer"
        >
          <rect
            x="24"
            y="18"
            width="592"
            height="96"
            rx="10"
            fill={activeId === "ip-transit" ? "#cef79e" : "#f7f7f5"}
            fillOpacity={activeId === "ip-transit" ? "0.45" : "0.9"}
            stroke="currentColor"
            strokeWidth={activeId === "ip-transit" ? "1.6" : "1"}
          />
          <text x="42" y="40" fill="currentColor" fontSize="9.5" fontFamily="monospace">
            03 // BGP IP TRANSIT & IXP PEERING (AS-OLA)
          </text>

          {[
            { x: 64, label: "TIER-1 CARRIER A" },
            { x: 214, label: "IXP MADRID / EU" },
            { x: 364, label: "CLOUD ON-RAMP" },
            { x: 504, label: "ANTI-DDOS SCRUB" },
          ].map((node) => (
            <g key={node.label}>
              <rect
                x={node.x}
                y="54"
                width="104"
                height="42"
                rx="5"
                fill="#ffffff"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <circle cx={node.x + 14} cy="75" r="3" fill="#a7e26e" />
              <text x={node.x + 24} y="78" fill="currentColor" fontSize="8" fontFamily="monospace">
                {node.label}
              </text>
            </g>
          ))}
        </g>

        {/* Fibras entre Tránsito IP y Meet-Me Rooms */}
        <g
          stroke="currentColor"
          strokeWidth="1.3"
          strokeDasharray="5 4"
          className="animate-[optDash_2s_linear_infinite]"
        >
          <path d="M160 114 V152" />
          <path d="M320 114 V152" />
          <path d="M480 114 V152" />
        </g>

        {/* ── ZONA 2 (Centro): MEET-ME ROOMS (MMR A + MMR B) ── */}
        <g
          onClick={() => onSelect("mmr")}
          className="cursor-pointer"
        >
          <rect
            x="24"
            y="152"
            width="592"
            height="104"
            rx="10"
            fill={activeId === "mmr" ? "#cef79e" : "#f7f7f5"}
            fillOpacity={activeId === "mmr" ? "0.45" : "0.9"}
            stroke="currentColor"
            strokeWidth={activeId === "mmr" ? "1.6" : "1"}
          />
          <text x="42" y="174" fill="currentColor" fontSize="9.5" fontFamily="monospace">
            02 // DUAL MEET-ME ROOMS (MMR-NORTH & MMR-SOUTH)
          </text>

          {/* MMR-A */}
          <rect
            x="56"
            y="186"
            width="230"
            height="52"
            rx="6"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <text x="74" y="208" fill="currentColor" fontSize="9" fontFamily="monospace">
            MMR-A · OPTICAL PATCH MATRIX
          </text>
          <text x="74" y="224" fill="currentColor" fillOpacity="0.55" fontSize="8" fontFamily="monospace">
            PATH A // DIVERSE ENTRY WEST
          </text>

          {/* Anillo interno entre MMR-A y MMR-B */}
          <line
            x1="286"
            y1="212"
            x2="354"
            y2="212"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            className="animate-[optDash_1.5s_linear_infinite]"
          />

          {/* MMR-B */}
          <rect
            x="354"
            y="186"
            width="230"
            height="52"
            rx="6"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <text x="372" y="208" fill="currentColor" fontSize="9" fontFamily="monospace">
            MMR-B · OPTICAL PATCH MATRIX
          </text>
          <text x="372" y="224" fill="currentColor" fillOpacity="0.55" fontSize="8" fontFamily="monospace">
            PATH B // DIVERSE ENTRY EAST
          </text>
        </g>

        {/* Cross-connects diagonales A+B hacia los Racks de cliente */}
        <g
          stroke="currentColor"
          strokeWidth={activeId === "cross-connects" ? "1.8" : "1.2"}
          strokeDasharray="5 4"
          className="animate-[optDash_1.6s_linear_infinite]"
        >
          <path d="M170 256 L130 292" />
          <path d="M170 256 L320 292" />
          <path d="M470 256 L320 292" />
          <path d="M470 256 L510 292" />
        </g>

        {/* ── ZONA 1 (Abajo): CROSS-CONNECTS & CLIENT RACKS ── */}
        <g
          onClick={() => onSelect("cross-connects")}
          className="cursor-pointer"
        >
          <rect
            x="24"
            y="292"
            width="592"
            height="92"
            rx="10"
            fill={activeId === "cross-connects" ? "#cef79e" : "#f7f7f5"}
            fillOpacity={activeId === "cross-connects" ? "0.45" : "0.9"}
            stroke="currentColor"
            strokeWidth={activeId === "cross-connects" ? "1.6" : "1"}
          />
          <text x="42" y="314" fill="currentColor" fontSize="9.5" fontFamily="monospace">
            01 // DIRECT CROSS-CONNECTS (OS2 / OM4 / 100G–400G)
          </text>

          {[
            { x: 64, title: "YOUR RACK / SUITE", sub: "DUAL A+B UPLINKS" },
            { x: 254, title: "AI GPU CLUSTER", sub: "400G RDMA / ROCEV2" },
            { x: 444, title: "PARTNER / CLOUD", sub: "< 0.08 MS DIRECT" },
          ].map((rack, i) => (
            <g key={rack.title}>
              <rect
                x={rack.x}
                y="326"
                width="134"
                height="44"
                rx="5"
                fill={i === 0 ? "#222f30" : "#ffffff"}
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <text
                x={rack.x + 12}
                y="345"
                fill={i === 0 ? "#cef79e" : "currentColor"}
                fontSize="8.5"
                fontFamily="monospace"
              >
                {rack.title}
              </text>
              <text
                x={rack.x + 12}
                y="359"
                fill={i === 0 ? "#ffffff" : "currentColor"}
                fillOpacity="0.65"
                fontSize="7.5"
                fontFamily="monospace"
              >
                {rack.sub}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

// ─── 4. Page Component ──────────────────────────────────────────────────────
export default function ConnectivityPage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)
  const [activeId, setActiveId] = useState<ConnectivityModule["id"]>("cross-connects")
  const detailRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 60)
    // Sincroniza hash inicial si viene de #cross-connects, #mmr o #ip-transit
    const hash = window.location.hash.replace("#", "")
    if (hash === "cross-connects" || hash === "mmr" || hash === "ip-transit") {
      setActiveId(hash)
    }
    return () => window.clearTimeout(timer)
  }, [])

  const activeModule = MODULES.find((m) => m.id === activeId) ?? MODULES[0]

  const heroWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Conectividad" },
          { text: "neutra", breakAfter: true },
          { text: "de", muted: true },
          { text: "ultrabaja", muted: true },
          { text: "latencia.", muted: true },
        ]
      : [
          { text: "Carrier-neutral", breakAfter: true },
          { text: "ultra-low", muted: true },
          { text: "latency", muted: true },
          { text: "network.", muted: true },
        ]

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1 (Variación 1): Split Hero con Consola de Topología en Vivo ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-16 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-start">
          {/* Izquierda (6 cols): Titular + Selector Rápido */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-6">
              <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
              <span>{t("01 / DATACENTER · CONNECTIVITY", "01 / DATACENTER · CONECTIVIDAD")}</span>
            </div>

            <h1 className="text-[clamp(2.35rem,calc(2.35rem+0.065*(100vw-23rem)),6.25rem)] font-normal tracking-[-0.03em] leading-[1.02] mb-8">
              <WordRevealText words={heroWords} revealed={revealed} staggerMs={90} />
            </h1>

            <p className="text-[clamp(1.0625rem,calc(1.0625rem+0.004*(100vw-27.5rem)),1.3125rem)] text-text-base/75 leading-[1.42] max-w-[48ch] mb-10">
              {t(
                "Interconnect your racks with Tier-1 carriers, Internet Exchanges, and sovereign cloud clusters through redundant optical paths and sub-2ms latency across Spain.",
                "Interconecta tus bastidores con operadores Tier-1, puntos neutros y clústeres de nube soberana mediante rutas ópticas redundantes y menos de 2 ms de latencia en España."
              )}
            </p>

            {/* Botones de conmutación rápida de los 3 productos de conectividad */}
            <div className="mb-10">
              <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/50 mb-3">
                {t("SELECT INTERCONNECTION LAYER:", "SELECCIONA CAPA DE INTERCONEXIÓN:")}
              </span>
              <div className="flex flex-wrap gap-2">
                {MODULES.map((mod) => {
                  const isAct = mod.id === activeId
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setActiveId(mod.id)}
                      className={cn(
                        "px-4 py-2.5 rounded-[10px] font-mono text-[12px] uppercase tracking-[0.04em] transition-all cursor-pointer border",
                        isAct
                          ? "bg-bg-dark text-primary border-bg-dark shadow-sm"
                          : "bg-surface-light text-text-base/75 border-bg-dark/12 hover:border-bg-dark/40"
                      )}
                    >
                      {mod.index} · {lang === "es" ? mod.titleEs : mod.titleEn}
                    </button>
                  )
                })}
              </div>
            </div>

            <ArrowCta href="/contact">
              {t("Request connectivity quote", "Solicitar estudio de conectividad")}
            </ArrowCta>
          </div>

          {/* Derecha (6 cols): Blueprint Interactivo en Vivo */}
          <div className="lg:col-span-6">
            <OpticalTopologyBlueprint activeId={activeId} onSelect={setActiveId} />
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: Ficha Técnica Dinámica + Las 3 Soluciones en Detalle ── */}
      <section
        ref={detailRef}
        className="w-full bg-surface-beige border-y border-bg-dark/12 py-20 md:py-28"
      >
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-start">
            {/* Selector lateral de las 3 capas */}
            <div className="lg:col-span-4 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-4">
                {t("INTERCONNECTION SERVICES", "SERVICIOS DE INTERCONEXIÓN")}
              </div>
              {MODULES.map((mod) => {
                const isAct = mod.id === activeId
                return (
                  <button
                    key={mod.id}
                    id={mod.id}
                    type="button"
                    onClick={() => setActiveId(mod.id)}
                    className={cn(
                      "w-full text-left p-5 rounded-[14px] transition-all cursor-pointer border",
                      isAct
                        ? "bg-surface-light border-bg-dark/20 shadow-sm"
                        : "bg-transparent border-bg-dark/10 hover:bg-surface-light/50"
                    )}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.05em] text-text-base/55 mb-2">
                      <span>{mod.index} // {mod.code}</span>
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          isAct ? "bg-primary-hover" : "bg-bg-dark/20"
                        )}
                      />
                    </div>
                    <div className="text-[22px] font-normal tracking-[-0.02em] text-text-base mb-1">
                      {lang === "es" ? mod.titleEs : mod.titleEn}
                    </div>
                    <p className="text-[14px] text-text-base/65 leading-snug">
                      {lang === "es" ? mod.subtitleEs : mod.subtitleEn}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Panel derecho de especificaciones de la capa activa */}
            <div className="lg:col-span-8 bg-surface-light rounded-[20px] lg:rounded-[28px] p-6 sm:p-10 lg:p-12 border border-bg-dark/10">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-bg-dark/10">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/50 block mb-1">
                    {activeModule.code}
                  </span>
                  <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] font-normal tracking-[-0.03em] leading-none text-text-base">
                    {lang === "es" ? activeModule.titleEs : activeModule.titleEn}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-2 bg-primary/55 text-bg-dark font-mono text-[11px] uppercase tracking-[0.05em] px-3 py-1.5 rounded-[8px]">
                  <span className="w-1.5 h-1.5 bg-bg-dark inline-block" />
                  <span>SLA 99.999%</span>
                </span>
              </div>

              <p className="text-[17px] text-text-base/80 leading-[1.55] mb-10 max-w-[64ch]">
                {lang === "es" ? activeModule.descEs : activeModule.descEn}
              </p>

              {/* 3 Métricas clave */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {activeModule.metrics.map((m) => (
                  <div
                    key={m.value}
                    className="bg-bg-light rounded-[12px] p-4 border border-bg-dark/8"
                  >
                    <div className="text-[24px] font-normal tracking-[-0.03em] text-text-base mb-1">
                      {m.value}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-base/55">
                      {lang === "es" ? m.labelEs : m.labelEn}
                    </div>
                  </div>
                ))}
              </div>

              {/* Lista de especificaciones técnicas */}
              <div className="space-y-3 mb-10">
                <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/50 mb-3">
                  {t("TECHNICAL SPECIFICATIONS", "ESPECIFICACIONES TÉCNICAS")}
                </div>
                {(lang === "es" ? activeModule.specsEs : activeModule.specsEn).map((spec) => (
                  <div
                    key={spec}
                    className="flex items-start gap-3 py-2.5 border-b border-bg-dark/8 text-[15px] text-text-base/85"
                  >
                    <span className="w-2 h-2 bg-primary-hover mt-2 shrink-0" />
                    <span>{spec}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <ArrowCta href="/contact">
                  {t("Deploy interconnection", "Contratar interconexión")}
                </ArrowCta>
                <Link
                  href="/datacenter/colocation"
                  className="font-mono text-[12px] uppercase tracking-[0.05em] text-text-base/65 hover:text-text-base underline underline-offset-4"
                >
                  {t("Explore Colocation spaces →", "Explorar espacios de Colocation →")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

/*
 * ─── 5. Documentación de Memoria ────────────────────────────────────────────
 * - Decisión técnica: Implementa la Variación 1 ("Interactive Blueprint Split &
 *   Live Topology Console") para el apartado de Conectividad (`/datacenter/connectivity`),
 *   unificando Cross-Connects, Meet-Me Room y Tránsito IP en una consola óptica
 *   interactiva en vivo.
 * - Edge cases: Sincroniza automáticamente el `window.location.hash` inicial
 *   (`#cross-connects`, `#mmr`, `#ip-transit`) al navegar desde el mega-menú.
 */
