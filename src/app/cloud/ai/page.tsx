"use client"

/**
 * AiCloudPage (`/cloud/ai`) — Variación 3:
 * "Editorial Bento Canvas & Interactive Workload Configurator"
 *
 * Cubre el apartado `IA Cloud` / `Infraestructura IA` del menú `IA`.
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

interface AiWorkloadProfile {
  id: "training" | "inference" | "rag"
  code: string
  titleEs: string
  titleEn: string
  taglineEs: string
  taglineEn: string
  descEs: string
  descEn: string
  fabricSpec: string
  storageSpec: string
  orchestratorSpec: string
  highlightsEs: string[]
  highlightsEn: string[]
}

// ─── 2. Constants & Data ────────────────────────────────────────────────────
const WORKLOADS: AiWorkloadProfile[] = [
  {
    id: "training",
    code: "01 // DISTRIBUTED_TRAINING",
    titleEs: "Entrenamiento y Fine-Tuning LLM",
    titleEn: "LLM Training & Fine-Tuning",
    taglineEs: "Clústeres multi-nodo H100/B200 con interconexión RDMA sin cuellos de botella.",
    taglineEn: "Multi-node H100/B200 clusters with non-blocking RDMA interconnect.",
    descEs:
      "Despliega trabajos de pre-entrenamiento, LoRA o RLHF sobre malla NVLink y tejido RoCEv2 / InfiniBand de 400 Gbps por GPU, respaldados por sistemas de ficheros paralelos NVMe de ultrabaja latencia.",
    descEn:
      "Run pre-training, LoRA, or RLHF jobs over NVLink mesh and 400 Gbps per-GPU RoCEv2 / InfiniBand fabric, backed by ultra-low-latency parallel NVMe filesystems.",
    fabricSpec: "400G InfiniBand / RoCEv2 RDMA",
    storageSpec: "Parallel NVMe Gen5 (> 120 GB/s)",
    orchestratorSpec: "Slurm · Kubernetes · PyTorch FSDP",
    highlightsEs: [
      "Topología fat-tree sin sobresuscripción entre nodos GPU",
      "Checkpoints instantáneos sobre almacenamiento distribuido NVMe",
      "Imágenes preconfiguradas con CUDA, NCCL, DeepSpeed y Megatron-LM",
    ],
    highlightsEn: [
      "Non-blocking fat-tree topology across all GPU nodes",
      "Instant checkpointing to distributed parallel NVMe flash",
      "Pre-configured images with CUDA, NCCL, DeepSpeed, and Megatron-LM",
    ],
  },
  {
    id: "inference",
    code: "02 // REALTIME_INFERENCE",
    titleEs: "Inferencia de Baja Latencia",
    titleEn: "Low-Latency Inference",
    taglineEs: "Endpoints dedicados con escalado automático y < 12 ms hasta el primer token.",
    taglineEn: "Dedicated endpoints with auto-scaling and < 12ms time-to-first-token.",
    descEs:
      "Sirve modelos abiertos (Llama, Mistral, Qwen, DeepSeek) o tus propios pesos afinados en instancias dedicadas sin compartir VRAM ni sufrir ruidos de otros inquilinos.",
    descEn:
      "Serve open-weights models (Llama, Mistral, Qwen, DeepSeek) or your own fine-tuned checkpoints on single-tenant GPUs with zero VRAM sharing or noisy neighbors.",
    fabricSpec: "Sub-2ms National Edge Routing",
    storageSpec: "Local NVMe Model Cache + KV-Cache",
    orchestratorSpec: "vLLM · TensorRT-LLM · Triton",
    highlightsEs: [
      "Cuantización FP8 / AWQ / GPTQ en hardware Tensor Core nativo",
      "Batching continuo y PagedAttention para maximizar tokens/segundo",
      "Endpoints privados compatibles con el estándar OpenAI API",
    ],
    highlightsEn: [
      "Native Tensor Core FP8 / AWQ / GPTQ quantization",
      "Continuous batching & PagedAttention for maximum tokens/sec",
      "Private endpoints 100% compatible with the OpenAI API standard",
    ],
  },
  {
    id: "rag",
    code: "03 // SOVEREIGN_RAG_FABRIC",
    titleEs: "RAG Corporativo y Bases Vectoriales",
    titleEn: "Enterprise RAG & Vector Fabric",
    taglineEs: "Conecta tus documentos privados a modelos de IA bajo jurisdicción española.",
    taglineEn: "Connect your private documents to AI models under Spanish jurisdiction.",
    descEs:
      "Arquitectura completa de generación aumentada por recuperación (RAG) con ingesta documental cifrada, índices vectoriales HNSW en memoria y cumplimiento estricto RGPD y ENS Alto.",
    descEn:
      "End-to-end Retrieval-Augmented Generation (RAG) architecture with encrypted document ingestion, in-memory HNSW vector indices, and strict GDPR & ENS High compliance.",
    fabricSpec: "Private VLAN / Direct Cross-Connect",
    storageSpec: "Encrypted NVMe + Object S3 Soberano",
    orchestratorSpec: "Qdrant · Milvus · pgvector · LangChain",
    highlightsEs: [
      "Cero telemetría externa: tus prompts y documentos nunca salen de OLA",
      "Índices vectoriales de millones de embeddings con búsqueda en < 5 ms",
      "Integración directa por fibra privada con tu ERP/CRM corporativo",
    ],
    highlightsEn: [
      "Zero external telemetry: prompts and documents never leave OLA",
      "Multi-million embedding vector indices with sub-5ms similarity search",
      "Direct private fiber integration with your corporate ERP/CRM",
    ],
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
export default function AiCloudPage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)
  const [activeWorkload, setActiveWorkload] = useState<AiWorkloadProfile["id"]>("training")

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 60)
    return () => window.clearTimeout(timer)
  }, [])

  const current = WORKLOADS.find((w) => w.id === activeWorkload) ?? WORKLOADS[0]

  const heroWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Infraestructura" },
          { text: "IA", breakAfter: true },
          { text: "soberana", muted: true },
          { text: "a", muted: true },
          { text: "escala.", muted: true },
        ]
      : [
          { text: "Sovereign" },
          { text: "AI", breakAfter: true },
          { text: "infrastructure", muted: true },
          { text: "at", muted: true },
          { text: "scale.", muted: true },
        ]

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1 (Variación 3): Editorial Hero + Mosaico Bento Asimétrico ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-16">
        <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-6">
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{t("02 / AI · AI CLOUD INFRASTRUCTURE", "02 / IA · INFRAESTRUCTURA IA CLOUD")}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end pb-12 border-b border-bg-dark/12">
          <h1 className="lg:col-span-8 text-[clamp(2.35rem,calc(2.35rem+0.07*(100vw-23rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.02]">
            <WordRevealText words={heroWords} revealed={revealed} staggerMs={90} />
          </h1>
          <p className="lg:col-span-4 text-[16px] md:text-[18px] text-text-base/75 leading-[1.42]">
            {t(
              "Train, fine-tune, and serve foundation models on dedicated GPU clusters in Spain with 100% data sovereignty and predictable costs.",
              "Entrena, afina y despliega modelos fundacionales sobre clústeres GPU dedicados en España con soberanía total del dato y costes predecibles."
            )}
          </p>
        </div>

        {/* Mosaico Bento Asimétrico de 3 Tarjetas de Alto Contraste */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-10">
          {/* Bento 1 (7 cols): Diagrama Vectorial de Malla Tensor NVLink + RoCEv2 */}
          <div className="lg:col-span-7 rounded-[22px] bg-surface-light border border-bg-dark/10 p-6 sm:p-8 flex flex-col justify-between">
            <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-base/55 mb-4">
              <span>ARCH_01 // NON-BLOCKING GPU FABRIC</span>
              <span className="text-bg-dark bg-primary px-2 py-0.5 rounded">900 GB/S NVLINK</span>
            </div>

            <svg viewBox="0 0 600 220" fill="none" className="w-full h-auto my-2 text-bg-dark">
              {/* Spine switches */}
              {[110, 300, 490].map((sx, i) => (
                <g key={sx}>
                  <rect
                    x={sx - 56}
                    y="16"
                    width="112"
                    height="32"
                    rx="5"
                    fill="#222f30"
                  />
                  <text x={sx - 42} y="36" fill="#cef79e" fontSize="8.5" fontFamily="monospace">
                    400G SPINE 0{i + 1}
                  </text>
                </g>
              ))}

              {/* Líneas de malla completa entre Spine y Nodos GPU */}
              {[110, 300, 490].map((sx) =>
                [90, 230, 370, 510].map((gx) => (
                  <line
                    key={`${sx}-${gx}`}
                    x1={sx}
                    y1="48"
                    x2={gx}
                    y2="112"
                    stroke="currentColor"
                    strokeOpacity="0.22"
                    strokeWidth="1.1"
                    strokeDasharray="4 3"
                  />
                ))
              )}

              {/* 4 Nodos GPU H100/B200 */}
              {[
                { x: 90, label: "GPU NODE 01" },
                { x: 230, label: "GPU NODE 02" },
                { x: 370, label: "GPU NODE 03" },
                { x: 510, label: "GPU NODE 04" },
              ].map((node, i) => (
                <g key={node.label}>
                  <rect
                    x={node.x - 54}
                    y="112"
                    width="108"
                    height="52"
                    rx="6"
                    fill={i % 2 === 0 ? "#cef79e" : "#f7f7f5"}
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <text x={node.x - 38} y="134" fill="currentColor" fontSize="8.5" fontFamily="monospace">
                    {node.label}
                  </text>
                  <text x={node.x - 38} y="150" fill="currentColor" fillOpacity="0.6" fontSize="7.5" fontFamily="monospace">
                    8× H100 / B200
                  </text>
                </g>
              ))}

              {/* Bus NVMe paralelo inferior */}
              <rect
                x="36"
                y="182"
                width="528"
                height="26"
                rx="4"
                fill="#e7e8e0"
                stroke="currentColor"
                strokeWidth="1.1"
              />
              <text x="200" y="198" fill="currentColor" fontSize="8.5" fontFamily="monospace">
                PARALLEL NVME GEN5 STORAGE FABRIC · RDMA DIRECT
              </text>
            </svg>

            <div className="pt-4 border-t border-bg-dark/10 flex flex-wrap items-center justify-between gap-4">
              <span className="text-[15px] text-text-base/80">
                {t(
                  "Zero oversubscription optical fabric with GPUDirect RDMA.",
                  "Tejido óptico sin sobresuscripción con GPUDirect RDMA directo a almacenamiento."
                )}
              </span>
              <Link
                href="/datacenter/ai-servers"
                className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base underline underline-offset-4"
              >
                {t("View GPU servers →", "Ver Servidores GPU →")}
              </Link>
            </div>
          </div>

          {/* Bento 2 + 3 (5 cols apiladas): Soberanía + Escalabilidad */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="flex-1 rounded-[22px] bg-bg-dark text-white p-6 sm:p-8 flex flex-col justify-between">
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-primary">
                <span>01 // DATA RESIDENCY</span>
                <span>RGPD · ENS ALTO</span>
              </div>
              <div className="my-6">
                <div className="text-[clamp(1.75rem,2.6vw,2.35rem)] font-normal tracking-[-0.03em] leading-[1.1] mb-3">
                  {t("Your weights stay yours.", "Tus pesos y datos son solo tuyos.")}
                </div>
                <p className="text-[14.5px] text-white/70 leading-relaxed">
                  {t(
                    "Isolated single-tenant VPCs in Spain. Neither your training datasets nor your inference prompts ever leave European jurisdiction.",
                    "VPCs aisladas en España. Ni tus datasets de entrenamiento ni tus prompts de inferencia salen jamás de jurisdicción europea."
                  )}
                </p>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-white/50">
                100% RENEWABLE ENERGY · PUE &lt; 1.2
              </div>
            </div>

            <div className="rounded-[22px] bg-primary text-bg-dark p-6 sm:p-8 flex items-center justify-between gap-6">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-bg-dark/65 mb-1">
                  02 // INSTANT SCALE
                </div>
                <div className="text-[22px] font-normal tracking-[-0.02em] leading-tight">
                  {t("From 1 GPU to multi-rack pods", "Desde 1 GPU hasta pods multi-rack")}
                </div>
              </div>
              <ArrowCta href="/contact">
                {t("Configure", "Configurar")}
              </ArrowCta>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: Configurador Interactivo de Escenarios IA Cloud ── */}
      <section className="w-full bg-surface-beige border-t border-bg-dark/12 py-20 md:py-28">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-3">
                {t("WORKLOAD ARCHITECTURES", "ARQUITECTURAS POR CARGA DE TRABAJO")}
              </div>
              <h2 className="text-[clamp(1.85rem,3.4vw,3.25rem)] font-normal tracking-[-0.03em] leading-[1.06]">
                {t("Select your AI scenario", "Selecciona tu escenario de IA")}
              </h2>
            </div>

            {/* Pestañas selectoras */}
            <div className="flex flex-wrap gap-2">
              {WORKLOADS.map((w) => {
                const active = w.id === activeWorkload
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveWorkload(w.id)}
                    className={cn(
                      "px-4 py-2.5 rounded-[10px] font-mono text-[11.5px] uppercase tracking-[0.04em] transition-all cursor-pointer border",
                      active
                        ? "bg-bg-dark text-primary border-bg-dark"
                        : "bg-surface-light text-text-base/75 border-bg-dark/12 hover:border-bg-dark/40"
                    )}
                  >
                    {lang === "es" ? w.titleEs : w.titleEn}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tarjeta expandida del escenario activo */}
          <div className="rounded-[24px] bg-surface-light border border-bg-dark/10 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-y-10 lg:gap-x-12">
            <div className="lg:col-span-7">
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/50 block mb-2">
                {current.code}
              </span>
              <h3 className="text-[clamp(1.75rem,2.8vw,2.5rem)] font-normal tracking-[-0.03em] text-text-base mb-3">
                {lang === "es" ? current.titleEs : current.titleEn}
              </h3>
              <p className="text-[17px] text-text-base/80 leading-[1.52] mb-8 max-w-[60ch]">
                {lang === "es" ? current.descEs : current.descEn}
              </p>

              <div className="space-y-3 mb-8">
                {(lang === "es" ? current.highlightsEs : current.highlightsEn).map((h) => (
                  <div key={h} className="flex items-start gap-3 text-[15px] text-text-base/85">
                    <span className="w-2 h-2 bg-primary-hover mt-2 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>

              <ArrowCta href="/contact">
                {t("Deploy this architecture", "Desplegar esta arquitectura")}
              </ArrowCta>
            </div>

            {/* Columna derecha: Matriz de stack técnico */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-bg-light rounded-[16px] p-6 border border-bg-dark/10 space-y-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/45 mb-1">
                  01 / INTERCONNECT FABRIC
                </div>
                <div className="text-[18px] font-normal text-text-base">{current.fabricSpec}</div>
              </div>
              <div className="border-t border-bg-dark/10 pt-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/45 mb-1">
                  02 / STORAGE LAYER
                </div>
                <div className="text-[18px] font-normal text-text-base">{current.storageSpec}</div>
              </div>
              <div className="border-t border-bg-dark/10 pt-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-base/45 mb-1">
                  03 / ORCHESTRATION & RUNTIME
                </div>
                <div className="text-[18px] font-normal text-text-base">{current.orchestratorSpec}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
