"use client"

/**
 * AiServersPage (`/datacenter/ai-servers`) — Variación 2:
 * "Dark-to-Light Hardware Showroom & Interactive GPU Node Spec Matrix"
 *
 * Cubre el apartado `Servidores GPU` del menú `IA`.
 */

import React, { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface GpuServerSpec {
  id: string
  badge: string
  name: string
  vramTotal: string
  interconnect: string
  cpuRam: string
  network: string
  coolingEs: string
  coolingEn: string
  useCaseEs: string
  useCaseEn: string
}

// ─── 2. Catálogo Técnico de Servidores GPU ──────────────────────────────────
const GPU_SERVERS: GpuServerSpec[] = [
  {
    id: "ola-hgx-b200",
    badge: "FLAGSHIP // BLACKWELL",
    name: "8× NVIDIA B200 / H200 SXM",
    vramTotal: "1,440 GB / 1,128 GB HBM3e",
    interconnect: "NVLink 5 / 4 (up to 1.8 TB/s)",
    cpuRam: "Dual Intel Xeon / AMD EPYC · 2 TB DDR5",
    network: "8× 400G InfiniBand / RoCEv2 + 2× 100G OS",
    coolingEs: "Refrigeración líquida directa (DLC) o híbrida de alta densidad",
    coolingEn: "Direct-to-Chip Liquid Cooling (DLC) or high-density hybrid",
    useCaseEs: "Entrenamiento fundacional de LLMs (>70B) y clústeres multi-nodo masivos.",
    useCaseEn: "Foundation LLM training (>70B) and massive multi-node clusters.",
  },
  {
    id: "ola-hgx-h100",
    badge: "ENTERPRISE STANDARD // HOPPER",
    name: "8× NVIDIA H100 SXM5 (80 GB)",
    vramTotal: "640 GB HBM3 (3.35 TB/s per GPU)",
    interconnect: "NVLink 900 GB/s Full Mesh",
    cpuRam: "2× AMD EPYC 9654 (192c) · 1.5 TB DDR5",
    network: "8× 400G NDR/RoCEv2 + 30.72 TB NVMe Gen5",
    coolingEs: "Flujo térmico optimizado en pasillo contenido hasta 40 kW/rack",
    coolingEn: "Optimized hot/cold aisle airflow up to 40 kW/rack",
    useCaseEs: "Fine-tuning corporativo, entrenamiento multimodal e inferencia de alto caudal.",
    useCaseEn: "Enterprise fine-tuning, multimodal training, and high-throughput inference.",
  },
  {
    id: "ola-l40s-node",
    badge: "INFERENCE & GRAPHICS // ADA",
    name: "4× / 8× NVIDIA L40S (48 GB)",
    vramTotal: "384 GB GDDR6 ECC",
    interconnect: "PCIe Gen5 x16 Full-Duplex",
    cpuRam: "2× AMD EPYC 9354 · 768 GB DDR5",
    network: "2× 100G / 200G QSFP56 + 15.36 TB NVMe",
    coolingEs: "Aire de precisión N+1 (chasis 4U de alta eficiencia)",
    coolingEn: "Precision N+1 air cooling (high-efficiency 4U chassis)",
    useCaseEs: "Inferencia vLLM en tiempo real, generación de vídeo/3D y RAG empresarial.",
    useCaseEn: "Real-time vLLM inference, video/3D generation, and enterprise RAG.",
  },
]

// ─── 3. Page Component ──────────────────────────────────────────────────────
export default function AiServersPage() {
  const { lang, t } = useLanguage()
  const [selectedId, setSelectedId] = useState<string>(GPU_SERVERS[0].id)

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1 (Variación 2): Dark-Charcoal Framed Hardware Showroom Hero ── */}
      <section className="w-full max-w-[1624px] mx-auto px-3 sm:px-6 pt-[84px] md:pt-[116px] pb-16">
        <div className="rounded-[20px] lg:rounded-[30px] bg-bg-dark text-white p-6 sm:p-10 lg:p-16 overflow-hidden relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-center">
            {/* Izquierda: Titular sobre fondo oscuro */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-primary mb-6">
                <span aria-hidden className="w-2 h-2 bg-primary inline-block" />
                <span>{t("02 / AI · DEDICATED GPU SERVERS", "02 / IA · SERVIDORES GPU DEDICADOS")}</span>
              </div>

              <h1 className="text-[clamp(2.25rem,calc(2.25rem+0.06*(100vw-23rem)),5.75rem)] font-normal tracking-[-0.03em] leading-[1.03] text-white mb-6">
                {t("Bare-metal GPU", "Potencia GPU")}{" "}
                <span className="text-[#8f9d9e]">
                  {t("supercomputing.", "bare-metal dedicada.")}
                </span>
              </h1>

              <p className="text-[16px] md:text-[18px] text-white/75 leading-[1.48] max-w-[48ch] mb-10">
                {t(
                  "Single-tenant 8-GPU servers with full NVLink mesh, local NVMe Gen5 RAID, and 400G RDMA fabric. Zero virtualization overhead.",
                  "Servidores dedicados single-tenant de hasta 8 GPUs con malla completa NVLink, almacenamiento NVMe Gen5 local y red RDMA de 400G. Cero sobrecarga de virtualización."
                )}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <ArrowCta href="/contact" variant="light">
                  {t("Reserve GPU nodes", "Reservar nodos GPU")}
                </ArrowCta>
              </div>
            </div>

            {/* Derecha: Plano CAD del Chasis 8U HGX GPU */}
            <div className="lg:col-span-6">
              <div className="rounded-[16px] bg-[#1b2627] border border-white/12 p-4 sm:p-6">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 font-mono text-[10px] uppercase tracking-[0.08em] text-white/55">
                  <span>CHASSIS_BLUEPRINT // 8U HGX SXM TRAY</span>
                  <span className="text-primary">NVLINK 900–1800 GB/S</span>
                </div>

                <svg viewBox="0 0 560 280" fill="none" className="w-full h-auto block">
                  {/* Chasis exterior */}
                  <rect x="16" y="16" width="528" height="248" rx="10" stroke="#CEF79E" strokeOpacity="0.4" strokeWidth="1.4" />

                  {/* 8 Módulos SXM GPU en matriz 4×2 */}
                  {[0, 1].map((row) =>
                    [0, 1, 2, 3].map((col) => {
                      const gx = 42 + col * 122
                      const gy = 38 + row * 82
                      return (
                        <g key={`${row}-${col}`}>
                          <rect
                            x={gx}
                            y={gy}
                            width="104"
                            height="64"
                            rx="5"
                            fill="#222f30"
                            stroke="#CEF79E"
                            strokeWidth="1.3"
                          />
                          {/* Aletas del disipador / coldplate */}
                          {[12, 22, 32].map((ly) => (
                            <line
                              key={ly}
                              x1={gx + 10}
                              y1={gy + ly}
                              x2={gx + 94}
                              y2={gy + ly}
                              stroke="#CEF79E"
                              strokeOpacity="0.28"
                              strokeWidth="1"
                            />
                          ))}
                          <text x={gx + 12} y={gy + 52} fill="#CEF79E" fontSize="9" fontFamily="monospace">
                            GPU 0{row * 4 + col + 1} · SXM
                          </text>
                        </g>
                      )
                    })
                  )}

                  {/* Barra inferior NVSwitch */}
                  <rect
                    x="42"
                    y="206"
                    width="470"
                    height="38"
                    rx="5"
                    fill="#CEF79E"
                    fillOpacity="0.15"
                    stroke="#CEF79E"
                    strokeWidth="1.2"
                  />
                  <text x="148" y="229" fill="#CEF79E" fontSize="9.5" fontFamily="monospace">
                    4× NVIDIA NVSWITCH CROSSBAR · ALL-TO-ALL MESH
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Barra inferior de métricas dentro del Hero Oscuro */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/12">
            {[
              { v: "1.44 TB", l: t("MAX HBM3e VRAM / NODE", "MÁX. VRAM HBM3e / NODO") },
              { v: "3.2 Tbps", l: t("RDMA BANDWIDTH / NODE", "ANCHO DE BANDA RDMA / NODO") },
              { v: "0%", l: t("HYPERVISOR OVERHEAD", "SOBRECARGA DE HIPERVISOR") },
              { v: "24×7", l: t("ON-SITE GPU HARDWARE SLA", "SLA HARDWARE EN SALA") },
            ].map((m) => (
              <div key={m.v}>
                <div className="text-[clamp(1.6rem,2.4vw,2.25rem)] font-normal tracking-[-0.03em] text-primary leading-none mb-1.5">
                  {m.v}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-white/55">
                  {m.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: Matriz Interactiva de Configuraciones de Servidores GPU ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] py-12 md:py-20">
        <div className="mb-12">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2">
            {t("HARDWARE CONFIGURATIONS", "CONFIGURACIONES DE HARDWARE")}
          </div>
          <h2 className="text-[clamp(1.85rem,3.4vw,3.25rem)] font-normal tracking-[-0.03em] leading-[1.06]">
            {t("Dedicated GPU server profiles", "Perfiles de servidores GPU dedicados")}
          </h2>
        </div>

        <div className="divide-y divide-bg-dark/12 border-t border-b border-bg-dark/12">
          {GPU_SERVERS.map((srv) => {
            const isSel = srv.id === selectedId
            return (
              <div
                key={srv.id}
                onClick={() => setSelectedId(srv.id)}
                className={cn(
                  "py-8 px-4 sm:px-6 transition-colors cursor-pointer",
                  isSel ? "bg-surface-beige/75" : "hover:bg-surface-beige/35"
                )}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4">
                    <span className="inline-block font-mono text-[10px] uppercase tracking-[0.06em] bg-primary/70 text-bg-dark px-2 py-0.5 rounded mb-2">
                      {srv.badge}
                    </span>
                    <h3 className="text-[22px] sm:text-[25px] font-normal tracking-[-0.02em] text-text-base">
                      {srv.name}
                    </h3>
                  </div>

                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[12px]">
                    <div>
                      <span className="block text-[10px] text-text-base/45 uppercase">VRAM TOTAL</span>
                      <span className="text-text-base">{srv.vramTotal}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-base/45 uppercase">INTERCONNECT</span>
                      <span className="text-text-base">{srv.interconnect}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-base/45 uppercase">CPU & SYSTEM RAM</span>
                      <span className="text-text-base">{srv.cpuRam}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-text-base/45 uppercase">NETWORK & NVME</span>
                      <span className="text-text-base">{srv.network}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4">
                    <p className="text-[13.5px] text-text-base/70 lg:text-right">
                      {lang === "es" ? srv.useCaseEs : srv.useCaseEn}
                    </p>
                    <Link
                      href="/contact"
                      className="font-mono text-[11px] uppercase tracking-[0.05em] bg-bg-dark text-white px-4 py-2.5 rounded-lg hover:bg-primary hover:text-bg-dark transition-colors shrink-0"
                    >
                      {t("Request availability →", "Consultar disponibilidad →")}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <Footer />
    </main>
  )
}
