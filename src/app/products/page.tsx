"use client"

/**
 * AiBoxPage (`/products`) — Variación 2B:
 * "Turnkey 4U AI Appliance Showroom & Interactive Layer Anatomy"
 *
 * Cubre el apartado `AI box` del menú `IA`.
 */

import React, { useState } from "react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface AiBoxEdition {
  id: string
  code: string
  name: string
  gpus: string
  vram: string
  modelsEs: string
  modelsEn: string
  acoustic: string
  power: string
}

const EDITIONS: AiBoxEdition[] = [
  {
    id: "aibox-compact",
    code: "EDITION 01 // OFFICE QUIET",
    name: "OLA AI Box · Whisper 4U",
    gpus: "2× / 4× NVIDIA L40S / RTX 6000 Ada",
    vram: "96 GB – 192 GB ECC VRAM",
    modelsEs: "Llama-3 70B (FP8), Mistral Large, Qwen 72B + RAG hasta 500k documentos",
    modelsEn: "Llama-3 70B (FP8), Mistral Large, Qwen 72B + RAG up to 500k documents",
    acoustic: "< 44 dBA (Apto para oficina)",
    power: "2× 2000W (Enchufe estándar C19)",
  },
  {
    id: "aibox-pro",
    code: "EDITION 02 // RACKMOUNT ENTERPRISE",
    name: "OLA AI Box · Datacenter Pro",
    gpus: "4× / 8× NVIDIA H100 NVL / L40S",
    vram: "376 GB – 640 GB HBM3 / GDDR6",
    modelsEs: "Multi-modelo concurrente (70B–405B), agentes autónomos, voz y visión",
    modelsEn: "Concurrent multi-model (70B–405B), autonomous agents, speech & vision",
    acoustic: "Chasis 4U para sala técnica",
    power: "Redundante 2N (3+1 PSUs Titanium)",
  },
]

export default function AiBoxPage() {
  const { lang, t } = useLanguage()
  const [activeLayer, setActiveLayer] = useState<number>(0)

  const layers = [
    {
      code: "L4 // WORKSPACE UI",
      titleEs: "Chat Privado, Asistentes y API Compatible OpenAI",
      titleEn: "Private Chat UI, Assistants & OpenAI-Compatible API",
      descEs: "Interfaz web lista para tus empleados con control de permisos SSO/LDAP y endpoint REST local para conectar tu software interno en minutos.",
      descEn: "Turnkey web interface for your employees with SSO/LDAP role permissions and a local REST endpoint to plug into your internal software in minutes.",
    },
    {
      code: "L3 // PRIVATE RAG ENGINE",
      titleEs: "Conector Documental y Base Vectorial In-Memory",
      titleEn: "Document Connector & In-Memory Vector Database",
      descEs: "Indexa automáticamente PDFs, contratos, código fuente y bases de datos SQL sin enviar un solo fragmento a nubes de terceros.",
      descEn: "Automatically indexes PDFs, contracts, source code, and SQL databases without sending a single chunk to third-party clouds.",
    },
    {
      code: "L2 // INFERENCE RUNTIME",
      titleEs: "Motor vLLM + TensorRT Pre-optimizado",
      titleEn: "Pre-optimized vLLM + TensorRT Runtime",
      descEs: "Incluye catálogo curado de modelos abiertos (Llama, Mistral, DeepSeek, Qwen) listos para activar con un clic.",
      descEn: "Includes a curated catalog of open-weights models (Llama, Mistral, DeepSeek, Qwen) ready to activate with one click.",
    },
    {
      code: "L1 // 4U HARDWARE ENCLAVE",
      titleEs: "Chasis 4U Cifrado con GPUs Dedicadas",
      titleEn: "Encrypted 4U Chassis with Dedicated GPUs",
      descEs: "Almacenamiento NVMe autocifrado (SED), módulo TPM 2.0 y operación 100% desconectada de internet (Air-Gapped) si tu normativa lo exige.",
      descEn: "Self-encrypting NVMe drives (SED), TPM 2.0 module, and 100% offline (Air-Gapped) operation when required by regulation.",
    },
  ]

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: Showroom Técnico del Appliance AI Box ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-16">
        <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-6">
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{t("02 / AI · TURNKEY APPLIANCE", "02 / IA · APPLIANCE LLAVE EN MANO")}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-center">
          <div className="lg:col-span-6">
            <h1 className="text-[clamp(2.5rem,calc(2.5rem+0.075*(100vw-23rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.01] mb-6">
              OLA <span className="text-[#c9cbbe]">AI Box.</span>
            </h1>
            <p className="text-[18px] md:text-[21px] font-normal tracking-[-0.015em] text-text-base leading-[1.38] mb-5 max-w-[44ch]">
              {t(
                "Plug-and-play private AI appliance. Unbox, connect power, and run sovereign LLMs inside your building in under 30 minutes.",
                "Appliance de IA privada plug-and-play. Conéctalo a la corriente y ejecuta modelos LLM soberanos dentro de tu edificio en menos de 30 minutos."
              )}
            </p>
            <p className="text-[15.5px] text-text-base/70 leading-[1.5] mb-9 max-w-[48ch]">
              {t(
                "Engineered for law firms, healthcare, defense, finance, and industrial R&D where confidential data can never leave the room.",
                "Diseñado para despachos, sanidad, defensa, banca e I+D industrial donde la información confidencial no puede salir jamás de la sala."
              )}
            </p>

            <ArrowCta href="/contact">
              {t("Request AI Box demo", "Solicitar demo de AI Box")}
            </ArrowCta>
          </div>

          {/* Plano frontal y corte isométrico del chasis OLA AI Box */}
          <div className="lg:col-span-6">
            <div className="rounded-[22px] bg-bg-dark text-white p-6 sm:p-8 border border-bg-dark">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.08em] text-white/55">
                <span>APPLIANCE_CAD // OLA_AIBOX_4U_REV3</span>
                <span className="text-primary">100% LOCAL INFERENCE</span>
              </div>

              <svg viewBox="0 0 560 250" fill="none" className="w-full h-auto block">
                {/* Chasis frontal 4U */}
                <rect x="20" y="28" width="520" height="154" rx="10" fill="#1b2627" stroke="#CEF79E" strokeWidth="1.5" />
                {/* Orejetas rackmount */}
                <rect x="8" y="38" width="12" height="134" rx="2" fill="#2b3a3b" stroke="#CEF79E" strokeOpacity="0.5" />
                <rect x="540" y="38" width="12" height="134" rx="2" fill="#2b3a3b" stroke="#CEF79E" strokeOpacity="0.5" />

                {/* Rejilla hexagonal / ventilación izquierda */}
                <rect x="40" y="48" width="160" height="114" rx="6" fill="#222f30" stroke="#CEF79E" strokeOpacity="0.35" />
                {[0, 1, 2, 3, 4].map((r) => (
                  <line
                    key={r}
                    x1="54"
                    y1={64 + r * 20}
                    x2="186"
                    y2={64 + r * 20}
                    stroke="#CEF79E"
                    strokeOpacity="0.25"
                    strokeWidth="2"
                    strokeDasharray="8 6"
                  />
                ))}

                {/* Bahías NVMe SED centrales */}
                {[0, 1, 2, 3].map((bay) => (
                  <g key={bay}>
                    <rect
                      x={216 + bay * 34}
                      y="48"
                      width="28"
                      height="114"
                      rx="3"
                      fill="#222f30"
                      stroke="#CEF79E"
                      strokeOpacity="0.5"
                    />
                    <circle cx={230 + bay * 34} cy="62" r="2.5" fill="#CEF79E" />
                  </g>
                ))}

                {/* Pantalla OLED de telemetría frontal a la derecha */}
                <rect x="366" y="48" width="154" height="114" rx="6" fill="#222f30" stroke="#CEF79E" strokeWidth="1.3" />
                <text x="382" y="72" fill="#CEF79E" fontSize="11" fontFamily="monospace">
                  OLA // AI BOX
                </text>
                <text x="382" y="96" fill="#ffffff" fillOpacity="0.8" fontSize="8.5" fontFamily="monospace">
                  STATUS: AIR-GAPPED OK
                </text>
                <text x="382" y="114" fill="#ffffff" fillOpacity="0.8" fontSize="8.5" fontFamily="monospace">
                  MODEL: LLAMA-3.3-70B
                </text>
                <text x="382" y="132" fill="#CEF79E" fontSize="8.5" fontFamily="monospace">
                  THROUGHPUT: 148 TOK/S
                </text>

                {/* Cotas técnicas inferiores */}
                <line x1="20" y1="210" x2="540" y2="210" stroke="#CEF79E" strokeOpacity="0.4" strokeWidth="1" />
                <text x="205" y="228" fill="#CEF79E" fontSize="9" fontFamily="monospace">
                  19&quot; STANDARD RACK / TOWER · 4U (178 MM)
                </text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: Anatomía Interactiva de las 4 Capas Pre-integradas ── */}
      <section className="w-full bg-surface-beige border-y border-bg-dark/12 py-20 md:py-28">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="mb-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2">
              {t("FULL HARDWARE + SOFTWARE STACK", "STACK COMPLETO HARDWARE + SOFTWARE")}
            </div>
            <h2 className="text-[clamp(1.85rem,3.4vw,3.25rem)] font-normal tracking-[-0.03em] leading-[1.06]">
              {t("Everything pre-installed inside the box", "Todo preinstalado dentro del chasis")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {layers.map((l, idx) => {
              const active = idx === activeLayer
              return (
                <div
                  key={l.code}
                  onMouseEnter={() => setActiveLayer(idx)}
                  onClick={() => setActiveLayer(idx)}
                  className={cn(
                    "rounded-[20px] p-6 sm:p-7 border transition-all cursor-pointer flex flex-col justify-between",
                    active
                      ? "bg-bg-dark text-white border-bg-dark shadow-lg"
                      : "bg-surface-light text-text-base border-bg-dark/10"
                  )}
                >
                  <div>
                    <span
                      className={cn(
                        "font-mono text-[10.5px] uppercase tracking-[0.06em] block mb-5",
                        active ? "text-primary" : "text-text-base/50"
                      )}
                    >
                      {l.code}
                    </span>
                    <h3 className="text-[20px] font-normal tracking-[-0.02em] leading-snug mb-3">
                      {lang === "es" ? l.titleEs : l.titleEn}
                    </h3>
                    <p
                      className={cn(
                        "text-[14px] leading-relaxed",
                        active ? "text-white/75" : "text-text-base/70"
                      )}
                    >
                      {lang === "es" ? l.descEs : l.descEn}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "mt-8 pt-4 border-t font-mono text-[10px] uppercase tracking-[0.06em]",
                      active ? "border-white/15 text-primary" : "border-bg-dark/10 text-text-base/45"
                    )}
                  >
                    READY OUT OF THE BOX
                  </div>
                </div>
              )
            })}
          </div>

          {/* Comparativa de las 2 Ediciones de AI Box */}
          <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {EDITIONS.map((ed) => (
              <div
                key={ed.id}
                className="rounded-[22px] bg-surface-light border border-bg-dark/10 p-7 sm:p-9 flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] bg-primary/65 text-bg-dark px-2.5 py-1 rounded inline-block mb-4">
                    {ed.code}
                  </span>
                  <h3 className="text-[26px] font-normal tracking-[-0.02em] text-text-base mb-6">
                    {ed.name}
                  </h3>

                  <div className="space-y-3 border-t border-bg-dark/10 pt-5 text-[14.5px]">
                    <div className="flex justify-between gap-4 py-1.5 border-b border-bg-dark/8">
                      <span className="font-mono text-[11px] uppercase text-text-base/50">GPUS</span>
                      <span className="font-medium text-right">{ed.gpus}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-bg-dark/8">
                      <span className="font-mono text-[11px] uppercase text-text-base/50">VRAM</span>
                      <span className="font-medium text-right">{ed.vram}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-bg-dark/8">
                      <span className="font-mono text-[11px] uppercase text-text-base/50">ACÚSTICA</span>
                      <span className="text-right">{ed.acoustic}</span>
                    </div>
                    <div className="pt-2">
                      <span className="block font-mono text-[10.5px] uppercase text-text-base/50 mb-1">
                        {t("SUPPORTED WORKLOADS", "CAPACIDAD DE MODELOS")}
                      </span>
                      <span className="text-text-base/80">
                        {lang === "es" ? ed.modelsEs : ed.modelsEn}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <ArrowCta href="/contact">
                    {t("Configure this edition", "Configurar esta edición")}
                  </ArrowCta>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
