"use client"

/**
 * CloudComputePage (`/cloud/compute`) — Variación 3C:
 * "Interactive 3-Family Compute Matrix & NVMe Hypervisor Blueprint"
 *
 * Cubre los 3 apartados del submenú de Servidores en Cloud:
 *  - Servidores VPS Cloud (`#vps-cloud`)
 *  - Servidores VPS Windows (`#vps-windows`)
 *  - Servidores Dedicados (`#dedicados`)
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

type ComputeFamilyId = "vps-cloud" | "vps-windows" | "dedicados"

interface ComputeTier {
  code: string
  vcpu: string
  ram: string
  nvme: string
  bandwidth: string
  workloadEs: string
  workloadEn: string
}

interface ComputeFamily {
  id: ComputeFamilyId
  index: string
  badge: string
  titleEs: string
  titleEn: string
  leadEs: string
  leadEn: string
  osInfoEs: string
  osInfoEn: string
  tiers: ComputeTier[]
}

// ─── 2. Datos de las 3 Familias de Servidores Cloud ─────────────────────────
const FAMILIES: ComputeFamily[] = [
  {
    id: "vps-cloud",
    index: "01",
    badge: "KVM // NVME GEN5 LINUX",
    titleEs: "Servidores VPS Cloud",
    titleEn: "Cloud VPS Servers",
    leadEs:
      "Instancias cloud de alto rendimiento sobre procesadores AMD EPYC de última generación y almacenamiento NVMe Gen5 triple réplica. Despliegue en menos de 45 segundos.",
    leadEn:
      "High-performance cloud instances powered by latest-generation AMD EPYC processors and triple-replicated NVMe Gen5 storage. Provisioned in under 45 seconds.",
    osInfoEs: "Ubuntu · Debian · Rocky Linux · AlmaLinux · Imágenes Cloud-Init & Kubernetes",
    osInfoEn: "Ubuntu · Debian · Rocky Linux · AlmaLinux · Cloud-Init & Kubernetes images",
    tiers: [
      {
        code: "OLA-VPS-01",
        vcpu: "4 vCPU EPYC",
        ram: "16 GB DDR5 ECC",
        nvme: "160 GB NVMe Gen5",
        bandwidth: "10 Gbps",
        workloadEs: "Microservicios, APIs y entornos web de producción",
        workloadEn: "Microservices, APIs, and production web workloads",
      },
      {
        code: "OLA-VPS-02",
        vcpu: "8 vCPU EPYC",
        ram: "32 GB DDR5 ECC",
        nvme: "320 GB NVMe Gen5",
        bandwidth: "10 Gbps",
        workloadEs: "Nodos Kubernetes, bases de datos SQL/NoSQL y CI/CD",
        workloadEn: "Kubernetes nodes, SQL/NoSQL databases, and CI/CD",
      },
      {
        code: "OLA-VPS-03",
        vcpu: "16 vCPU EPYC",
        ram: "64 GB DDR5 ECC",
        nvme: "640 GB NVMe Gen5",
        bandwidth: "25 Gbps",
        workloadEs: "ERP empresarial, cachés en memoria y analítica intensiva",
        workloadEn: "Enterprise ERP, in-memory caches, and intensive analytics",
      },
      {
        code: "OLA-VPS-04",
        vcpu: "32 vCPU EPYC",
        ram: "128 GB DDR5 ECC",
        nvme: "1.28 TB NVMe Gen5",
        bandwidth: "25 Gbps",
        workloadEs: "Sistemas transaccionales de misión crítica y alta concurrencia",
        workloadEn: "High-concurrency mission-critical transactional systems",
      },
    ],
  },
  {
    id: "vps-windows",
    index: "02",
    badge: "MICROSOFT SPLA // RDS & AD READY",
    titleEs: "Servidores VPS Windows",
    titleEn: "Windows VPS Servers",
    leadEs:
      "Entornos Windows Server 2022 / 2025 Datacenter totalmente licenciados, optimizados con drivers VirtIO firmados para escritorio remoto, SQL Server, .NET y software de gestión corporativa.",
    leadEn:
      "Fully licensed Windows Server 2022 / 2025 Datacenter environments, optimized with signed VirtIO drivers for Remote Desktop, SQL Server, .NET, and corporate ERP suites.",
    osInfoEs: "Windows Server 2022 / 2025 · SQL Server Web/Standard · Active Directory & RDP",
    osInfoEn: "Windows Server 2022 / 2025 · SQL Server Web/Standard · Active Directory & RDP",
    tiers: [
      {
        code: "OLA-WIN-01",
        vcpu: "4 vCPU Dedicadas",
        ram: "16 GB DDR5 ECC",
        nvme: "200 GB NVMe Gen5",
        bandwidth: "10 Gbps",
        workloadEs: "Escritorio remoto corporativo (hasta 15 usuarios) y aplicaciones .NET",
        workloadEn: "Corporate Remote Desktop (up to 15 users) and .NET apps",
      },
      {
        code: "OLA-WIN-02",
        vcpu: "8 vCPU Dedicadas",
        ram: "32 GB DDR5 ECC",
        nvme: "400 GB NVMe Gen5",
        bandwidth: "10 Gbps",
        workloadEs: "ERP (SAP Business One, Navision, Sage, A3) y controlador de dominio",
        workloadEn: "ERP (SAP Business One, Dynamics, Sage) & Domain Controller",
      },
      {
        code: "OLA-WIN-03",
        vcpu: "16 vCPU Dedicadas",
        ram: "64 GB DDR5 ECC",
        nvme: "800 GB NVMe Gen5",
        bandwidth: "25 Gbps",
        workloadEs: "Microsoft SQL Server de alto rendimiento y granjas Terminal Server",
        workloadEn: "High-performance Microsoft SQL Server & RDS farms",
      },
      {
        code: "OLA-WIN-04",
        vcpu: "32 vCPU Dedicadas",
        ram: "128 GB DDR5 ECC",
        nvme: "1.6 TB NVMe Gen5",
        bandwidth: "25 Gbps",
        workloadEs: "Infraestructura corporativa Windows crítica multi-sede",
        workloadEn: "Multi-site critical enterprise Windows infrastructure",
      },
    ],
  },
  {
    id: "dedicados",
    index: "03",
    badge: "SINGLE-TENANT // 100% BARE METAL",
    titleEs: "Servidores Dedicados",
    titleEn: "Dedicated Servers",
    leadEs:
      "El 100% del silicio físico para tu organización. Sin hipervisor intermedio, con acceso raíz IPMI/KVM fuera de banda, discos NVMe empresariales en RAID hardware y red privada VLAN.",
    leadEn:
      "100% of the physical silicon dedicated to your organization. Zero hypervisor overhead, out-of-band IPMI/KVM root access, enterprise NVMe RAID, and private VLAN networking.",
    osInfoEs: "Proxmox VE · VMware ESXi · Linux Bare Metal · Windows Server Datacenter",
    osInfoEn: "Proxmox VE · VMware ESXi · Linux Bare Metal · Windows Server Datacenter",
    tiers: [
      {
        code: "OLA-BM-32C",
        vcpu: "AMD EPYC 32 Cores / 64T",
        ram: "128 GB DDR5 ECC",
        nvme: "2× 1.92 TB NVMe U.3",
        bandwidth: "2× 25 Gbps LACP",
        workloadEs: "Virtualización privada Proxmox/VMware y bases de datos dedicadas",
        workloadEn: "Private Proxmox/VMware virtualization & dedicated databases",
      },
      {
        code: "OLA-BM-64C",
        vcpu: "AMD EPYC 64 Cores / 128T",
        ram: "256 GB DDR5 ECC",
        nvme: "2× 3.84 TB NVMe U.3",
        bandwidth: "2× 25 Gbps LACP",
        workloadEs: "Clústeres de hiperconvergencia (HCI) y procesamiento intensivo",
        workloadEn: "Hyperconverged clusters (HCI) and compute-intensive workloads",
      },
      {
        code: "OLA-BM-128C",
        vcpu: "2× AMD EPYC 128 Cores / 256T",
        ram: "512 GB DDR5 ECC",
        nvme: "4× 3.84 TB NVMe Gen5",
        bandwidth: "2× 100 Gbps QSFP28",
        workloadEs: "Consolidación masiva de cargas críticas y big data en tiempo real",
        workloadEn: "Massive critical workload consolidation & real-time big data",
      },
      {
        code: "OLA-BM-192C",
        vcpu: "2× AMD EPYC 192 Cores / 384T",
        ram: "1.5 TB DDR5 ECC",
        nvme: "8× 7.68 TB NVMe Gen5",
        bandwidth: "2× 100 Gbps QSFP28",
        workloadEs: "Nube privada corporativa de gran escala y bases en memoria",
        workloadEn: "Large-scale enterprise private cloud & in-memory databases",
      },
    ],
  },
]

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

export default function CloudComputePage() {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)
  const [activeId, setActiveId] = useState<ComputeFamilyId>("vps-cloud")

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 60)
    const hash = window.location.hash.replace("#", "")
    if (hash === "vps-cloud" || hash === "vps-windows" || hash === "dedicados") {
      setActiveId(hash)
    }
    return () => window.clearTimeout(timer)
  }, [])

  const activeFamily = FAMILIES.find((f) => f.id === activeId) ?? FAMILIES[0]

  const heroWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Servidores" },
          { text: "cloud", breakAfter: true },
          { text: "listos", muted: true },
          { text: "en", muted: true },
          { text: "segundos.", muted: true },
        ]
      : [
          { text: "Cloud" },
          { text: "servers", breakAfter: true },
          { text: "ready", muted: true },
          { text: "in", muted: true },
          { text: "seconds.", muted: true },
        ]

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: Cabecera Editorial + Selector de las 3 Familias de Cómputo ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-14">
        <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-text-base mb-6">
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{t("03 / CLOUD · COMPUTE & SERVERS", "03 / CLOUD · SERVIDORES Y CÓMPUTO")}</span>
        </div>

        <h1 className="text-[clamp(2.35rem,calc(2.35rem+0.07*(100vw-23rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.02] pb-10 border-b border-bg-dark/12">
          <WordRevealText words={heroWords} revealed={revealed} staggerMs={85} />
        </h1>

        {/* Pestañas de las 3 familias del submenú Cloud */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-10">
          {FAMILIES.map((fam) => {
            const isAct = fam.id === activeId
            return (
              <button
                key={fam.id}
                id={fam.id}
                type="button"
                onClick={() => setActiveId(fam.id)}
                className={cn(
                  "text-left p-6 rounded-[18px] border transition-all cursor-pointer flex flex-col justify-between",
                  isAct
                    ? "bg-bg-dark text-white border-bg-dark shadow-lg"
                    : "bg-surface-light text-text-base border-bg-dark/10 hover:border-bg-dark/35"
                )}
              >
                <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.06em] mb-4">
                  <span className={isAct ? "text-primary" : "text-text-base/50"}>
                    {fam.index} // {fam.badge}
                  </span>
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isAct ? "bg-primary" : "bg-bg-dark/20"
                    )}
                  />
                </div>
                <div className="text-[23px] font-normal tracking-[-0.02em] leading-snug">
                  {lang === "es" ? fam.titleEs : fam.titleEn}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── SECCIÓN 2: Matriz de Instancias de la Familia Seleccionada ── */}
      <section className="w-full bg-surface-beige border-t border-bg-dark/12 py-16 md:py-24">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end pb-10 border-b border-bg-dark/12">
            <div className="lg:col-span-7">
              <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 block mb-2">
                {activeFamily.badge}
              </span>
              <h2 className="text-[clamp(1.85rem,3.2vw,3rem)] font-normal tracking-[-0.03em] text-text-base mb-3">
                {lang === "es" ? activeFamily.titleEs : activeFamily.titleEn}
              </h2>
              <p className="text-[16px] text-text-base/75 leading-[1.5]">
                {lang === "es" ? activeFamily.leadEs : activeFamily.leadEn}
              </p>
            </div>
            <div className="lg:col-span-5 bg-surface-light rounded-[14px] p-4 border border-bg-dark/10">
              <span className="block font-mono text-[10px] uppercase tracking-[0.06em] text-text-base/45 mb-1">
                {t("SUPPORTED IMAGES & STACK", "SISTEMAS OPERATIVOS Y STACK")}
              </span>
              <span className="font-mono text-[12px] text-text-base">
                {lang === "es" ? activeFamily.osInfoEs : activeFamily.osInfoEn}
              </span>
            </div>
          </div>

          {/* Tabla arquitectónica de configuraciones */}
          <div className="divide-y divide-bg-dark/12 border-b border-bg-dark/12">
            {activeFamily.tiers.map((tier) => (
              <div
                key={tier.code}
                className="py-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center hover:bg-surface-light/60 px-4 -mx-4 rounded-[12px] transition-colors"
              >
                <div className="lg:col-span-2">
                  <span className="font-mono text-[12px] font-medium uppercase tracking-[0.05em] bg-primary/75 text-bg-dark px-2.5 py-1 rounded">
                    {tier.code}
                  </span>
                </div>
                <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[13px]">
                  <div>
                    <span className="block text-[9.5px] uppercase text-text-base/45">COMPUTE</span>
                    <span>{tier.vcpu}</span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] uppercase text-text-base/45">MEMORY</span>
                    <span>{tier.ram}</span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] uppercase text-text-base/45">STORAGE</span>
                    <span>{tier.nvme}</span>
                  </div>
                  <div>
                    <span className="block text-[9.5px] uppercase text-text-base/45">NETWORK</span>
                    <span>{tier.bandwidth}</span>
                  </div>
                </div>
                <div className="lg:col-span-3 text-[14px] text-text-base/75">
                  {lang === "es" ? tier.workloadEs : tier.workloadEn}
                </div>
                <div className="lg:col-span-2 flex lg:justify-end">
                  <Link
                    href="/contact"
                    className="font-mono text-[11px] uppercase tracking-[0.05em] bg-bg-dark text-white px-4 py-2.5 rounded-lg hover:bg-primary hover:text-bg-dark transition-colors"
                  >
                    {t("Deploy →", "Desplegar →")}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-10 flex flex-wrap items-center justify-between gap-6">
            <ArrowCta href="/contact">
              {t("Request custom cluster sizing", "Solicitar dimensionamiento a medida")}
            </ArrowCta>
            <Link
              href="/cloud/managed"
              className="font-mono text-[12px] uppercase tracking-[0.05em] text-text-base/70 hover:text-text-base underline underline-offset-4"
            >
              {t("Add 24×7 Managed Administration →", "Añadir Administración Gestionada 24×7 →")}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
