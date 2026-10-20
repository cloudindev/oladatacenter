"use client"

/**
 * CloudAddonDossierPage — Variación 4:
 * "Swiss Technical Dossier & Sticky Split-Scroll Timeline + Notched Switcher"
 *
 * Motor compartido de alta precisión para los 4 apartados de Cloud Addons:
 *  - `/cloud/managed` (Servicios gestionados)
 *  - `/cloud/storage` (Disaster Recovery y Backups)
 *  - `/cloud/database` (Georeplicación síncrona)
 *  - `/cloud/build` (Migración a la nube)
 */

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
export type AddonSlug = "managed" | "storage" | "database" | "build"

interface RevealWord {
  text: string
  muted?: boolean
  breakAfter?: boolean
}

interface AddonModule {
  step: string
  code: string
  titleEs: string
  titleEn: string
  descEs: string
  descEn: string
  tags: string[]
}

interface AddonDef {
  slug: AddonSlug
  href: string
  dossierIndex: string
  eyebrowEs: string
  eyebrowEn: string
  titleDarkEs: string
  titleMutedEs: string
  titleDarkEn: string
  titleMutedEn: string
  leadEs: string
  leadEn: string
  kpis: { val: string; labelEs: string; labelEn: string }[]
  modules: AddonModule[]
}

// ─── 2. Diagramas Vectoriales Animados para cada Cloud Addon ────────────────
function AddonVectorBlueprint({ slug }: { slug: AddonSlug }) {
  if (slug === "managed") {
    return (
      <svg viewBox="0 0 460 280" fill="none" className="w-full h-auto block text-bg-dark">
        <circle cx="230" cy="140" r="92" stroke="currentColor" strokeWidth="1.2" strokeDasharray="5 4" />
        <circle cx="230" cy="140" r="54" fill="#cef79e" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.4" />
        <text x="195" y="137" fill="currentColor" fontSize="9.5" fontFamily="monospace">
          SRE 24×7
        </text>
        <text x="188" y="151" fill="currentColor" fillOpacity="0.65" fontSize="8" fontFamily="monospace">
          AUTO-HEALING
        </text>
        {[
          { x: 230, y: 32, l: "OBSERVABILITY" },
          { x: 374, y: 140, l: "PATCH & SEC" },
          { x: 230, y: 248, l: "K8S / DB OPS" },
          { x: 86, y: 140, l: "INCIDENT <5M" },
        ].map((n) => (
          <g key={n.l}>
            <rect
              x={n.x - 52}
              y={n.y - 16}
              width="104"
              height="32"
              rx="5"
              fill="#ffffff"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <text x={n.x - 40} y={n.y + 3} fill="currentColor" fontSize="8.5" fontFamily="monospace">
              {n.l}
            </text>
          </g>
        ))}
      </svg>
    )
  }

  if (slug === "storage") {
    return (
      <svg viewBox="0 0 460 280" fill="none" className="w-full h-auto block text-bg-dark">
        {/* Producción izquierda */}
        <rect x="24" y="64" width="126" height="152" rx="8" fill="#ffffff" stroke="currentColor" strokeWidth="1.3" />
        <text x="40" y="90" fill="currentColor" fontSize="9" fontFamily="monospace">
          PRIMARY WORKLOAD
        </text>
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x="40"
            y={106 + i * 30}
            width="94"
            height="20"
            rx="3"
            fill="#f7f7f5"
            stroke="currentColor"
          />
        ))}
        {/* Canal cifrado CDP */}
        <path d="M150 116 H274 M150 164 H274" stroke="currentColor" strokeWidth="1.4" strokeDasharray="5 4" />
        <rect x="176" y="126" width="72" height="28" rx="4" fill="#222f30" />
        <text x="186" y="143" fill="#cef79e" fontSize="8" fontFamily="monospace">
          WORM LOCK
        </text>

        {/* Bóveda inmutable derecha */}
        <rect x="274" y="48" width="162" height="184" rx="10" fill="#cef79e" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.5" />
        <text x="292" y="74" fill="currentColor" fontSize="9" fontFamily="monospace">
          IMMUTABLE DR VAULT
        </text>
        {[
          "SNAP T-00 (RPO < 1m)",
          "SNAP T-01 (IMMUTABLE)",
          "AIR-GAPPED REPLICA",
          "INSTANT FAILOVER VM",
        ].map((snap, idx) => (
          <g key={snap}>
            <rect
              x="292"
              y={90 + idx * 32}
              width="126"
              height="24"
              rx="4"
              fill="#ffffff"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <text x="302" y={105 + idx * 32} fill="currentColor" fontSize="7.5" fontFamily="monospace">
              {snap}
            </text>
          </g>
        ))}
      </svg>
    )
  }

  if (slug === "database") {
    return (
      <svg viewBox="0 0 460 280" fill="none" className="w-full h-auto block text-bg-dark">
        {/* Zona A y Zona B con anillo síncrono RPO = 0 */}
        <rect x="22" y="54" width="144" height="172" rx="10" fill="#ffffff" stroke="currentColor" strokeWidth="1.4" />
        <text x="38" y="80" fill="currentColor" fontSize="9" fontFamily="monospace">
          ZONE A // ACTIVE
        </text>
        <rect x="38" y="96" width="112" height="50" rx="5" fill="#cef79e" stroke="currentColor" strokeWidth="1.2" />
        <text x="50" y="124" fill="currentColor" fontSize="8.5" fontFamily="monospace">
          NVME BLOCK LEADER
        </text>
        <rect x="38" y="158" width="112" height="48" rx="5" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.1" />
        <text x="50" y="186" fill="currentColor" fontSize="8" fontFamily="monospace">
          COMMIT ACK: 0.4ms
        </text>

        {/* Doble anillo de fibra oscura */}
        <path d="M166 112 C210 78, 250 78, 294 112" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 3" />
        <path d="M294 168 C250 202, 210 202, 166 168" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 3" />
        <rect x="190" y="124" width="80" height="32" rx="5" fill="#222f30" />
        <text x="206" y="143" fill="#cef79e" fontSize="9" fontFamily="monospace">
          RPO = 0
        </text>

        <rect x="294" y="54" width="144" height="172" rx="10" fill="#ffffff" stroke="currentColor" strokeWidth="1.4" />
        <text x="310" y="80" fill="currentColor" fontSize="9" fontFamily="monospace">
          ZONE B // ACTIVE
        </text>
        <rect x="310" y="96" width="112" height="50" rx="5" fill="#cef79e" stroke="currentColor" strokeWidth="1.2" />
        <text x="322" y="124" fill="currentColor" fontSize="8.5" fontFamily="monospace">
          NVME SYNC MIRROR
        </text>
        <rect x="310" y="158" width="112" height="48" rx="5" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.1" />
        <text x="322" y="186" fill="currentColor" fontSize="8" fontFamily="monospace">
          ZERO DATA LOSS
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 460 280" fill="none" className="w-full h-auto block text-bg-dark">
      {/* 4 Fases de Migración Sin Corte */}
      {[
        { x: 22, y: 158, h: 76, code: "01", label: "AUDIT" },
        { x: 132, y: 124, h: 110, code: "02", label: "REPLICA" },
        { x: 242, y: 88, h: 146, code: "03", label: "DRY-RUN" },
        { x: 352, y: 48, h: 186, code: "04", label: "CUTOVER" },
      ].map((bar, idx) => (
        <g key={bar.code}>
          <rect
            x={bar.x}
            y={bar.y}
            width="86"
            height={bar.h}
            rx="6"
            fill={idx === 3 ? "#cef79e" : "#ffffff"}
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <text x={bar.x + 14} y={bar.y + 24} fill="currentColor" fontSize="9" fontFamily="monospace">
            PHASE {bar.code}
          </text>
          <text x={bar.x + 14} y={bar.y + 42} fill="currentColor" fontSize="8.5" fontFamily="monospace">
            {bar.label}
          </text>
        </g>
      ))}
      <path d="M65 142 L175 108 L285 72 L395 34" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
    </svg>
  )
}

// ─── 3. Catálogo de los 4 Cloud Addons ──────────────────────────────────────
export const ADDONS_BY_SLUG: Record<AddonSlug, AddonDef> = {
  managed: {
    slug: "managed",
    href: "/cloud/managed",
    dossierIndex: "ADDON // 01",
    eyebrowEs: "03 / CLOUD · SERVICIOS GESTIONADOS 24×7",
    eyebrowEn: "03 / CLOUD · 24×7 MANAGED SERVICES",
    titleDarkEs: "Administración SRE",
    titleMutedEs: "proactiva 24×7.",
    titleDarkEn: "Proactive 24×7",
    titleMutedEn: "SRE operations.",
    leadEs:
      "Delegas la operación diaria de sistemas operativos, clústeres Kubernetes, bases de datos y seguridad perimetral en nuestro equipo de ingeniería en España.",
    leadEn:
      "Delegate day-to-day OS administration, Kubernetes clusters, databases, and perimeter security to our in-house engineering team in Spain.",
    kpis: [
      { val: "< 5 min", labelEs: "RESPUESTA A INCIDENTES", labelEn: "INCIDENT RESPONSE" },
      { val: "24×7×365", labelEs: "MONITORIZACIÓN ACTIVA", labelEn: "ACTIVE MONITORING" },
      { val: "ISO 27001", labelEs: "HARDENING CONTINUO", labelEn: "CONTINUOUS HARDENING" },
    ],
    modules: [
      {
        step: "01",
        code: "SYS_OBSERVABILITY // PROMETHEUS & LOKI",
        titleEs: "Observabilidad en Tiempo Real y Auto-Healing",
        titleEn: "Real-Time Observability & Auto-Healing",
        descEs:
          "Monitorización profunda de métricas de sistema, latencia de disco, saturación de red y trazas de aplicación con runbooks automatizados que corrigen anomalías antes de que afecten al usuario.",
        descEn:
          "Deep telemetry across system metrics, disk latency, network saturation, and application traces with automated runbooks that remediate anomalies before user impact.",
        tags: ["Prometheus", "Grafana", "24×7 NOC", "Automated Runbooks"],
      },
      {
        step: "02",
        code: "OS_SEC // PATCHING & HARDENING",
        titleEs: "Parcheo sin Caídas y Endurecimiento ENS Alto",
        titleEn: "Zero-Downtime Patching & ENS High Hardening",
        descEs:
          "Actualizaciones programadas de kernel (Livepatch), auditoría continua de vulnerabilidades CVE, gestión de cortafuegos perimetrales, WAF y mitigación DDoS.",
        descEn:
          "Scheduled kernel live-patching, continuous CVE vulnerability auditing, perimeter firewall management, WAF tuning, and inline DDoS mitigation.",
        tags: ["Kernel Livepatch", "ENS Alto", "WAF & Anti-DDoS", "CVE Audit"],
      },
      {
        step: "03",
        code: "DATA_K8S // PLATFORM ENGINEERING",
        titleEs: "Gestión de Kubernetes, Bases de Datos y Middlewares",
        titleEn: "Kubernetes, Database & Middleware Operations",
        descEs:
          "Operamos tus clústeres Kubernetes, PostgreSQL, MySQL/Galera, Redis y colas de mensajería en alta disponibilidad, optimizando consultas e índices de forma continua.",
        descEn:
          "We operate your high-availability Kubernetes clusters, PostgreSQL, MySQL/Galera, Redis, and message queues, continuously tuning queries and indices.",
        tags: ["Kubernetes HA", "PostgreSQL / Galera", "Redis Cluster", "CI/CD Pipelines"],
      },
    ],
  },
  storage: {
    slug: "storage",
    href: "/cloud/storage",
    dossierIndex: "ADDON // 02",
    eyebrowEs: "03 / CLOUD · DISASTER RECOVERY Y BACKUPS",
    eyebrowEn: "03 / CLOUD · DISASTER RECOVERY & BACKUPS",
    titleDarkEs: "Continuidad total",
    titleMutedEs: "y backups inmutables.",
    titleDarkEn: "Business continuity",
    titleMutedEn: "& immutable backups.",
    leadEs:
      "Protege tu organización frente a ransomware, fallos críticos o desastres mediante copias inmutables WORM y arranque instantáneo de contingencia en OLA Datacenter.",
    leadEn:
      "Protect your organization against ransomware, critical failures, or disasters with WORM immutable backups and instant failover inside OLA Datacenter.",
    kpis: [
      { val: "< 15 min", labelEs: "RTO DE ARRANQUE DR", labelEn: "FAILOVER RTO" },
      { val: "100%", labelEs: "INMUTABILIDAD WORM", labelEn: "WORM IMMUTABILITY" },
      { val: "AES-256", labelEs: "CIFRADO EXTREMO A EXTREMO", labelEn: "END-TO-END ENCRYPTION" },
    ],
    modules: [
      {
        step: "01",
        code: "IMMUTABLE_VAULT // ANTI-RANSOMWARE",
        titleEs: "Bóveda Inmutable WORM (Write-Once-Read-Many)",
        titleEn: "WORM Immutable Anti-Ransomware Vault",
        descEs:
          "Las copias quedan bloqueadas criptográficamente a nivel de bloque y objeto (S3 Object Lock): ni siquiera un atacante con credenciales de administrador puede alterarlas o borrarlas antes de su expiración.",
        descEn:
          "Backups are cryptographically locked at the block and object level (S3 Object Lock): not even a compromised root credential can alter or delete them before retention expires.",
        tags: ["S3 Object Lock", "Zero-Trust Backup", "Air-Gap Lógico", "AES-256-GCM"],
      },
      {
        step: "02",
        code: "DR_FAILOVER // INSTANT RECOVERY",
        titleEs: "Disaster Recovery as a Service (DRaaS) en Segundos",
        titleEn: "Instant Disaster Recovery as a Service (DRaaS)",
        descEs:
          "En caso de caída de tu sede principal o nube primaria, levantamos tu topología completa de servidores y redes sobre nuestra plataforma en minutos con direccionamiento IP preservado.",
        descEn:
          "If your primary site or cloud goes down, we spin up your entire server and network topology on our platform in minutes while preserving IP routing.",
        tags: ["Veeam Cloud Connect", "Proxmox Backup", "Zerto / CDP", "Simulacros DR"],
      },
      {
        step: "03",
        code: "COMPLIANCE // RETENTION POLICIES",
        titleEs: "Cumplimiento Normativo RGPD, ENS Alto y DORA",
        titleEn: "GDPR, ENS High & DORA Regulatory Compliance",
        descEs:
          "Informes automáticos de verificación de restauración (SureBackup) y retención histórica auditable para banca, salud, sector público e industria.",
        descEn:
          "Automated restore verification reports and auditable long-term retention tailored for banking (DORA), healthcare, public sector, and industry.",
        tags: ["DORA Ready", "ENS Alto", "Verificación Diaria", "100% En España"],
      },
    ],
  },
  database: {
    slug: "database",
    href: "/cloud/database",
    dossierIndex: "ADDON // 03",
    eyebrowEs: "03 / CLOUD · GEOREPLICACIÓN SÍNCRONA",
    eyebrowEn: "03 / CLOUD · SYNCHRONOUS GEO-REPLICATION",
    titleDarkEs: "Georeplicación síncrona",
    titleMutedEs: "con pérdida cero.",
    titleDarkEn: "Synchronous replication",
    titleMutedEn: "with zero data loss.",
    leadEs:
      "Arquitectura activo-activo y replicación síncrona bloque a bloque (RPO = 0) sobre anillos de fibra oscura de ultrabaja latencia para bases de datos y cargas transaccionales.",
    leadEn:
      "Active-active architecture and block-level synchronous replication (RPO = 0) over ultra-low-latency dark fiber rings for databases and transactional workloads.",
    kpis: [
      { val: "RPO = 0", labelEs: "CERO PÉRDIDA DE DATOS", labelEn: "ZERO DATA LOSS" },
      { val: "< 0.8 ms", labelEs: "LATENCIA DE FIBRA ENTRE SALAS", labelEn: "INTER-HALL FIBER RTT" },
      { val: "99.999%", labelEs: "DISPONIBILIDAD CONTINUA", labelEn: "CONTINUOUS AVAILABILITY" },
    ],
    modules: [
      {
        step: "01",
        code: "SYNC_COMMIT // ZERO_RPO",
        titleEs: "Escritura Síncrona Determinista en Doble Enclave",
        titleEn: "Deterministic Dual-Enclave Synchronous Writes",
        descEs:
          "Cada transacción se confirma simultáneamente en dos dominios de fallo físicamente separados antes de devolver el ACK a la aplicación, garantizando pérdida cero ante cualquier contingencia.",
        descEn:
          "Every transaction is committed simultaneously across two physically separated fault domains before returning the ACK to the application, guaranteeing zero data loss.",
        tags: ["RPO = 0", "RDMA / NVMe-oF", "Dual Fault Domain", "Deterministic ACK"],
      },
      {
        step: "02",
        code: "DB_CLUSTERS // ACTIVE-ACTIVE",
        titleEs: "Clústeres Transaccionales Activo-Activo",
        titleEn: "Active-Active Transactional Database Clusters",
        descEs:
          "Diseñado para PostgreSQL Patroni/Raft, MySQL Galera, Oracle DataGuard Far-Sync, SAP HANA System Replication y almacenamiento distribuido Ceph/ZFS.",
        descEn:
          "Engineered for PostgreSQL Patroni/Raft, MySQL Galera, Oracle DataGuard, SAP HANA System Replication, and distributed Ceph/ZFS storage.",
        tags: ["PostgreSQL HA", "SAP HANA Sync", "Ceph Stretch Cluster", "Auto-Failover"],
      },
      {
        step: "03",
        code: "DARK_FIBER // DEDICATED DWDM",
        titleEs: "Transporte Óptico Dedicado por Caminos Diversos",
        titleEn: "Physically Diverse Dedicated Optical Transport",
        descEs:
          "Las réplicas viajan exclusivamente por enlaces privados de fibra oscura de 100G/400G con cifrado en capa 1, sin tocar jamás internet público.",
        descEn:
          "Replicas travel exclusively over private 100G/400G dark fiber links with Layer-1 encryption, never touching the public internet.",
        tags: ["100G/400G DWDM", "Caminos Norte + Sur", "L1 Encryption", "Zero Jitter"],
      },
    ],
  },
  build: {
    slug: "build",
    href: "/cloud/build",
    dossierIndex: "ADDON // 04",
    eyebrowEs: "03 / CLOUD · MIGRACIÓN A LA NUBE",
    eyebrowEn: "03 / CLOUD · CLOUD MIGRATION ENGINEERING",
    titleDarkEs: "Migración a la nube",
    titleMutedEs: "sin corte de servicio.",
    titleDarkEn: "Zero-downtime",
    titleMutedEn: "cloud migration.",
    leadEs:
      "Acompañamos a tu equipo técnico desde la auditoría inicial hasta la conmutación final (cutover) hacia OLA Datacenter, eliminando riesgos, costes ocultos de egreso y bloqueos de proveedor.",
    leadEn:
      "We guide your engineering team from initial discovery through final cutover to OLA Datacenter, eliminating downtime risk, hidden egress fees, and vendor lock-in.",
    kpis: [
      { val: "0 s", labelEs: "VENTANA DE CORTE EN REPLICACIÓN", labelEn: "LIVE SYNC CUTOVER" },
      { val: "0 €", labelEs: "COSTE POR TRÁFICO DE SALIDA", labelEn: "EGRESS TRAFFIC FEES" },
      { val: "100%", labelEs: "INGENIERÍA PROPIA ASIGNADA", labelEn: "DEDICATED MIGRATION SQUAD" },
    ],
    modules: [
      {
        step: "01",
        code: "PHASE_01 // DISCOVERY & TCO AUDIT",
        titleEs: "Auditoría de Arquitectura, Dependencias y Costes",
        titleEn: "Architecture, Dependency & TCO Audit",
        descEs:
          "Analizamos tus cargas actuales (on-premise, VMware o hiperescaladores AWS/Azure/GCP), mapeamos latencias entre servicios y diseñamos la arquitectura objetivo en OLA.",
        descEn:
          "We analyze your current workloads (on-prem, VMware, or AWS/Azure/GCP), map inter-service latencies, and design the target architecture inside OLA.",
        tags: ["TCO Optimization", "VMware Exit", "Hyperscaler Repatriation", "Network Mapping"],
      },
      {
        step: "02",
        code: "PHASE_02 // LIVE BLOCK REPLICATION",
        titleEs: "Sincronización Continua en Caliente y Pruebas Piloto",
        titleEn: "Live Block Synchronization & Dry-Run Testing",
        descEs:
          "Replicamos tus máquinas virtuales y bases de datos en segundo plano mientras tu sistema actual sigue en producción, realizando simulacros completos en red aislada antes del cambio.",
        descEn:
          "We replicate your VMs and databases in the background while production keeps running, executing full dry-run tests in an isolated sandbox before cutover.",
        tags: ["Live Sync", "Sandbox Dry-Run", "Rollback Garantizado", "Zero Data Loss"],
      },
      {
        step: "03",
        code: "PHASE_03 // CUTOVER & HYPERCARE",
        titleEs: "Conmutación Asistida y Acompañamiento Post-Migración",
        titleEn: "Assisted Cutover & 24×7 Hypercare",
        descEs:
          "Ejecutamos la ventana de cambio junto a tu equipo y mantenemos vigilancia intensiva (Hypercare) para afinar rendimiento, seguridad e indicadores SLA.",
        descEn:
          "We execute the cutover window alongside your team and maintain intensive Hypercare monitoring to fine-tune performance, security, and SLA metrics.",
        tags: ["24×7 Hypercare", "Performance Tuning", "DNS / BGP Cutover", "Sovereign Landing"],
      },
    ],
  },
}

const ORDERED_ADDONS: AddonSlug[] = ["managed", "storage", "database", "build"]

// ─── 4. Helper Components ───────────────────────────────────────────────────
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
              w.muted ? "text-[#9a9c8e]" : "text-text-base"
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

// ─── 5. Main Dossier Component ──────────────────────────────────────────────
export function CloudAddonDossierPage({ slug }: { slug: AddonSlug }) {
  const { lang, t } = useLanguage()
  const [revealed, setRevealed] = useState(false)
  const addon = ADDONS_BY_SLUG[slug]

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 60)
    return () => window.clearTimeout(timer)
  }, [slug])

  const titleDark = lang === "es" ? addon.titleDarkEs : addon.titleDarkEn
  const titleMuted = lang === "es" ? addon.titleMutedEs : addon.titleMutedEn

  const heroWords: RevealWord[] = [
    ...titleDark.split(" ").map((text, idx, arr) => ({
      text,
      breakAfter: idx === arr.length - 1,
    })),
    ...titleMuted.split(" ").map((text) => ({ text, muted: true })),
  ]

  const otherAddons = ORDERED_ADDONS.filter((s) => s !== slug).map(
    (s) => ADDONS_BY_SLUG[s]
  )

  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1 (Variación 4): Cabecera Dossier Suizo sobre Banda Gris Cálida ── */}
      <section className="w-full bg-surface-beige border-b border-bg-dark/12 pt-[96px] md:pt-[148px] pb-16 md:pb-24">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-bg-dark/12 font-mono text-[11px] uppercase tracking-[0.06em]">
            <span className="inline-flex items-center gap-2 text-text-base">
              <span className="w-2 h-2 bg-primary-hover inline-block" />
              <span>{lang === "es" ? addon.eyebrowEs : addon.eyebrowEn}</span>
            </span>
            <span className="text-text-base/50">{addon.dossierIndex} // OLA_CLOUD_STACK</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-10 lg:gap-x-12 items-end">
            <h1 className="lg:col-span-8 text-[clamp(2.35rem,calc(2.35rem+0.07*(100vw-23rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.02]">
              <WordRevealText words={heroWords} revealed={revealed} staggerMs={90} />
            </h1>
            <p className="lg:col-span-4 text-[16.5px] md:text-[18px] text-text-base/80 leading-[1.45]">
              {lang === "es" ? addon.leadEs : addon.leadEn}
            </p>
          </div>

          {/* 3 KPIs técnicos en fila */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 pt-8 border-t border-bg-dark/12">
            {addon.kpis.map((k) => (
              <div
                key={k.val}
                className="bg-surface-light rounded-[14px] p-5 border border-bg-dark/10 flex items-baseline justify-between gap-4"
              >
                <span className="text-[28px] md:text-[34px] font-normal tracking-[-0.03em] text-text-base leading-none">
                  {k.val}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-text-base/55 text-right">
                  {lang === "es" ? k.labelEs : k.labelEn}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 2: Sticky Blueprint a la Izquierda + Módulos de Ingeniería a la Derecha ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-14 items-start">
          {/* Columna Izquierda Sticky (5 cols) */}
          <aside className="lg:col-span-5 lg:sticky lg:top-[110px] space-y-6">
            <div className="rounded-[20px] bg-surface-light border border-bg-dark/12 p-5 sm:p-6">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-bg-dark/10 font-mono text-[10px] uppercase tracking-[0.06em] text-text-base/50">
                <span>SYSTEM_SCHEMATIC // {slug.toUpperCase()}</span>
                <span>ENS ALTO</span>
              </div>
              <AddonVectorBlueprint slug={slug} />
            </div>

            <div className="rounded-[20px] bg-bg-dark text-white p-6 sm:p-7">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-primary mb-2">
                {t("DIRECT ENGINEERING CONSULTATION", "INGENIERÍA DIRECTA SIN INTERMEDIARIOS")}
              </div>
              <p className="text-[15px] text-white/75 leading-relaxed mb-6">
                {t(
                  "Speak directly with our systems architects to integrate this service into your existing cloud or colocation environment.",
                  "Habla directamente con nuestros arquitectos de sistemas para integrar este servicio en tu entorno actual de Cloud o Colocation."
                )}
              </p>
              <ArrowCta href="/contact" variant="light">
                {t("Talk to an architect", "Hablar con un arquitecto")}
              </ArrowCta>
            </div>
          </aside>

          {/* Columna Derecha (7 cols): Los 3 Módulos Técnicos del Dossier */}
          <div className="lg:col-span-7 space-y-6">
            {addon.modules.map((mod) => (
              <article
                key={mod.step}
                className="rounded-[22px] bg-surface-light border border-bg-dark/10 p-6 sm:p-9 lg:p-10"
              >
                <div className="flex items-center justify-between gap-4 pb-4 mb-5 border-b border-bg-dark/10 font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/50">
                  <span>{mod.code}</span>
                  <span className="bg-primary px-2 py-0.5 rounded text-bg-dark font-medium">
                    {mod.step}
                  </span>
                </div>

                <h2 className="text-[clamp(1.5rem,2.4vw,2.15rem)] font-normal tracking-[-0.025em] leading-[1.12] text-text-base mb-4">
                  {lang === "es" ? mod.titleEs : mod.titleEn}
                </h2>

                <p className="text-[16px] text-text-base/75 leading-[1.55] mb-6">
                  {lang === "es" ? mod.descEs : mod.descEn}
                </p>

                <div className="flex flex-wrap gap-2">
                  {mod.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[11px] uppercase tracking-[0.04em] bg-bg-light border border-bg-dark/10 rounded-[6px] px-3 py-1 text-text-base/75"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 3: Navegador Cruzado de Cloud Addons (3 Tarjetas con Muesca) ── */}
      <section className="w-full bg-surface-beige border-t border-bg-dark/12 py-16 md:py-24">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-base/55 mb-2">
            {t("EXPLORE OTHER CLOUD ADDONS", "EXPLORAR OTROS SERVICIOS CLOUD")}
          </div>
          <h3 className="text-[clamp(1.65rem,2.8vw,2.5rem)] font-normal tracking-[-0.03em] mb-10">
            {t("Complete your cloud architecture", "Completa tu arquitectura en la nube")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {otherAddons.map((item) => (
              <Link
                key={item.slug}
                href={item.href}
                className="group relative rounded-[20px] bg-surface-light border border-bg-dark/10 p-7 flex flex-col justify-between min-h-[210px] hover:border-bg-dark/35 transition-colors"
              >
                <div>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-base/45 block mb-3">
                    {item.dossierIndex}
                  </span>
                  <div className="text-[22px] font-normal tracking-[-0.02em] text-text-base leading-snug mb-2">
                    {lang === "es"
                      ? `${item.titleDarkEs} ${item.titleMutedEs}`
                      : `${item.titleDarkEn} ${item.titleMutedEn}`}
                  </div>
                </div>
                <div className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-text-base flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-hover inline-block" />
                  <span>{t("View service →", "Ver servicio →")}</span>
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
