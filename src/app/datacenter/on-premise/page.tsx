"use client"

/**
 * OnPremCloudPage (`/datacenter/on-premise`) — Variación 3B:
 * "Hybrid Bridge & On-Premise Private Cloud Architecture"
 *
 * Cubre el apartado `On-Prem Cloud` del menú `IA`.
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

export default function OnPremiseCloudPage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)
  const [mode, setMode] = useState<"airgapped" | "hybrid">("hybrid")

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 60)
    return () => window.clearTimeout(timer)
  }, [])

  const heroWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Tu" },
          { text: "propia" },
          { text: "nube,", breakAfter: true },
          { text: "en", muted: true },
          { text: "tus", muted: true },
          { text: "instalaciones.", muted: true },
        ]
      : [
          { text: "Your" },
          { text: "own" },
          { text: "cloud,", breakAfter: true },
          { text: "on", muted: true },
          { text: "your", muted: true },
          { text: "premises.", muted: true },
        ]

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: Hero Editorial + Conmutador de Topología (Air-Gapped vs Híbrida) ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-16">
        <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-6">
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{t("02 / AI · ON-PREMISE CLOUD", "02 / IA · ON-PREM CLOUD")}</span>
        </div>

        <h1 className="text-[clamp(2.35rem,calc(2.35rem+0.07*(100vw-23rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.02] pb-10 border-b border-bg-dark/12">
          <WordRevealText words={heroWords} revealed={revealed} staggerMs={85} />
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-12 pt-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <p className="text-[17px] md:text-[19px] text-text-base/80 leading-[1.48]">
              {t(
                "We design, deliver, and remotely manage a turnkey cloud and AI infrastructure directly inside your corporate headquarters, factory, or hospital — with zero data movement outside your physical perimeter.",
                "Diseñamos, entregamos y operamos llave en mano una infraestructura completa de Cloud e IA dentro de tu propia sede, planta industrial u hospital — sin que un solo byte abandone tu perímetro físico."
              )}
            </p>

            {/* Conmutador interactivo del modo de despliegue */}
            <div className="pt-2">
              <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/50 mb-3">
                {t("DEPLOYMENT TOPOLOGY:", "TOPOLOGÍA DE DESPLIEGUE:")}
              </span>
              <div className="inline-flex p-1 rounded-[12px] bg-surface-beige border border-bg-dark/12">
                <button
                  type="button"
                  onClick={() => setMode("hybrid")}
                  className={cn(
                    "px-4 py-2 rounded-[9px] font-mono text-[11px] uppercase tracking-[0.05em] transition-all cursor-pointer",
                    mode === "hybrid" ? "bg-bg-dark text-primary" : "text-text-base/70"
                  )}
                >
                  {t("Hybrid Optical Sync", "Híbrido con OLA DC")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("airgapped")}
                  className={cn(
                    "px-4 py-2 rounded-[9px] font-mono text-[11px] uppercase tracking-[0.05em] transition-all cursor-pointer",
                    mode === "airgapped" ? "bg-bg-dark text-primary" : "text-text-base/70"
                  )}
                >
                  {t("100% Air-Gapped", "100% Aislado (Air-Gapped)")}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <ArrowCta href="/contact">
                {t("Design On-Prem architecture", "Diseñar arquitectura On-Prem")}
              </ArrowCta>
            </div>
          </div>

          {/* Plano Vectorial Dinámico de Puente On-Prem ↔ OLA Datacenter */}
          <div className="lg:col-span-7">
            <div className="rounded-[20px] lg:rounded-[28px] bg-surface-light border border-bg-dark/12 p-5 sm:p-8">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-bg-dark/10 font-mono text-[10px] uppercase tracking-[0.06em] text-text-base/55">
                <span>TOPOLOGY // {mode === "hybrid" ? "HYBRID_FIBER_EXTENSION" : "ISOLATED_ENCLAVE"}</span>
                <span>LATENCY: &lt; 0.4 MS LOCAL</span>
              </div>

              <svg viewBox="0 0 640 280" fill="none" className="w-full h-auto block text-bg-dark">
                {/* Perímetro de las instalaciones del cliente */}
                <rect
                  x="18"
                  y="22"
                  width="324"
                  height="236"
                  rx="12"
                  fill="#cef79e"
                  fillOpacity="0.28"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <text x="36" y="46" fill="currentColor" fontSize="9.5" fontFamily="monospace">
                  YOUR PREMISES // ON-PREM CLOUD ENCLAVE
                </text>

                {[
                  { y: 66, label: "CONTROL PLANE · KUBERNETES / KVM" },
                  { y: 122, label: "AI INFERENCE & GPU NODES (LOCAL)" },
                  { y: 178, label: "NVME CEPH / ZFS ENCRYPTED STORAGE" },
                ].map((layer) => (
                  <g key={layer.label}>
                    <rect
                      x="36"
                      y={layer.y}
                      width="288"
                      height="42"
                      rx="6"
                      fill="#ffffff"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <circle cx="54" cy={layer.y + 21} r="3.5" fill="#222f30" />
                    <text x="68" y={layer.y + 24} fill="currentColor" fontSize="8.5" fontFamily="monospace">
                      {layer.label}
                    </text>
                  </g>
                ))}

                {/* Enlace hacia OLA Datacenter (Activo en modo Híbrido, Bloqueado en Air-Gapped) */}
                {mode === "hybrid" ? (
                  <g>
                    <line
                      x1="342"
                      y1="118"
                      x2="424"
                      y2="118"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeDasharray="5 4"
                    />
                    <line
                      x1="342"
                      y1="162"
                      x2="424"
                      y2="162"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeDasharray="5 4"
                    />
                    <rect x="354" y="128" width="58" height="22" rx="4" fill="#222f30" />
                    <text x="362" y="142" fill="#cef79e" fontSize="7.5" fontFamily="monospace">
                      DARK FIBER
                    </text>
                  </g>
                ) : (
                  <g>
                    <line x1="382" y1="40" x2="382" y2="240" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                    <rect x="350" y="124" width="64" height="32" rx="5" fill="#222f30" />
                    <text x="358" y="143" fill="#cef79e" fontSize="8" fontFamily="monospace">
                      AIR-GAPPED
                    </text>
                  </g>
                )}

                {/* Perímetro OLA Datacenter */}
                <g opacity={mode === "hybrid" ? "1" : "0.35"}>
                  <rect
                    x="424"
                    y="22"
                    width="198"
                    height="236"
                    rx="12"
                    fill="#f7f7f5"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <text x="442" y="46" fill="currentColor" fontSize="9.5" fontFamily="monospace">
                    OLA DATACENTER
                  </text>
                  <rect x="442" y="72" width="162" height="68" rx="6" fill="#ffffff" stroke="currentColor" strokeWidth="1.1" />
                  <text x="454" y="102" fill="currentColor" fontSize="8.5" fontFamily="monospace">
                    ELASTIC GPU BURST
                  </text>
                  <text x="454" y="118" fill="currentColor" fillOpacity="0.6" fontSize="7.5" fontFamily="monospace">
                    HEAVY LLM TRAINING
                  </text>

                  <rect x="442" y="156" width="162" height="68" rx="6" fill="#ffffff" stroke="currentColor" strokeWidth="1.1" />
                  <text x="454" y="186" fill="currentColor" fontSize="8.5" fontFamily="monospace">
                    DR & IMMUTABLE BACKUP
                  </text>
                  <text x="454" y="202" fill="currentColor" fillOpacity="0.6" fontSize="7.5" fontFamily="monospace">
                    SYNC GEO-REPLICATION
                  </text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: 3 Pilares en Banda Gris Corporativa ── */}
      <section className="w-full bg-surface-beige border-t border-bg-dark/12 py-20 md:py-28">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                idx: "01",
                titleEs: "Hardware Pre-integrado",
                titleEn: "Pre-integrated Hardware",
                descEs:
                  "Entregamos el rack o micro-datacenter sonorizado completamente ensamblado, cableado y probado en nuestro laboratorio antes de instalarlo en tu sede.",
                descEn:
                  "We deliver the rack or soundproof micro-datacenter fully assembled, cabled, and burn-in tested at our lab before installing it at your site.",
              },
              {
                idx: "02",
                titleEs: "Plano de Control Unificado",
                titleEn: "Unified Control Plane",
                descEs:
                  "Gestiona máquinas virtuales, contenedores Kubernetes y modelos de IA locales desde un panel idéntico al de la nube pública, sin curva de aprendizaje.",
                descEn:
                  "Manage virtual machines, Kubernetes clusters, and local AI models from a cloud-native control plane with zero learning curve.",
              },
              {
                idx: "03",
                titleEs: "Operación Gestionada 24×7",
                titleEn: "24×7 Managed Operations",
                descEs:
                  "Nuestro equipo SRE monitoriza la salud térmica, parches del hipervisor y reemplazo de piezas in situ con repuestos garantizados en España.",
                descEn:
                  "Our SRE team monitors thermal health, hypervisor patching, and on-site component replacement with guaranteed spare parts in Spain.",
              },
            ].map((card) => (
              <div
                key={card.idx}
                className="rounded-[20px] bg-surface-light border border-bg-dark/10 p-8 flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/50 block mb-6">
                    {card.idx} // ON-PREM MODULE
                  </span>
                  <h3 className="text-[24px] font-normal tracking-[-0.02em] text-text-base mb-3">
                    {lang === "es" ? card.titleEs : card.titleEn}
                  </h3>
                  <p className="text-[15px] text-text-base/75 leading-relaxed">
                    {lang === "es" ? card.descEs : card.descEn}
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-bg-dark/10 font-mono text-[11px] uppercase tracking-[0.05em] text-text-base/60">
                  SLA 99.99% · CAPEX / OPEX FLEXIBLE
                </div>
              </div>
            ))}
          </div>

          {/* Enlace cruzado a AI Box */}
          <div className="mt-10 rounded-[20px] bg-bg-dark text-white p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-primary mb-1">
                PLUG &amp; PLAY APPLIANCE
              </div>
              <div className="text-[22px] font-normal tracking-[-0.02em]">
                {t(
                  "Looking for a compact 4U turnkey AI Box for local LLMs?",
                  "¿Buscas un appliance compacto 4U llave en mano para IA local?"
                )}
              </div>
            </div>
            <ArrowCta href="/products" variant="light">
              {t("Discover AI Box", "Descubrir AI Box")}
            </ArrowCta>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
