"use client"

/**
 * Header — Navegación principal de OLA Datacenter.
 *
 * - Desktop (`>= md`): Píldoras esmeriladas centradas con backdrop blanco
 *   "morphing" y submenús desplegables por hover/foco.
 * - Mobile (`< md`): Barra superior compacta a ancho completo con logo a la
 *   izquierda, CTA directo y botón hamburguesa animado que despliega un cajón
 *   móvil estructurado con acordeones para `Datacenter`, `IA`, `Cloud`, enlace
 *   a `OLA` y acceso al Portal de Clientes (`/login`).
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/context/LanguageContext"
import { ChipCta } from "@/components/ui/ChipCta"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
type MenuKey = "datacenter" | "products" | "solutions"
type ActiveState = MenuKey | "bare" | null

interface PanelItem {
  href: string
  en: string
  es: string
  descEn?: string
  descEs?: string
}

interface BackdropSize {
  w: number
  h: number
}

// ─── 2. Styles & Data ───────────────────────────────────────────────────────
const PILL_GLASS =
  "bg-white/85 backdrop-blur-md border border-white/60 shadow-[0_4px_24px_rgba(34,47,48,0.08)]"

const COLOCATION_ITEMS: PanelItem[] = [
  { href: "/datacenter/colocation/por-u", en: "Colocation per U", es: "Colocation por U" },
  { href: "/datacenter/colocation/racks", en: "Half rack / full rack", es: "Medio rack / rack completo" },
  { href: "/datacenter/colocation/jaulas", en: "Cages", es: "Jaulas" },
  { href: "/datacenter/colocation/suites", en: "Suites", es: "Suites" },
  { href: "/datacenter/colocation/wholesale", en: "Housing / wholesale", es: "Housing / wholesale" },
]

const CONNECTIVITY_ITEMS: PanelItem[] = [
  { href: "/datacenter/connectivity#cross-connects", en: "Cross-connects", es: "Cross-connects" },
  { href: "/datacenter/connectivity#mmr", en: "Meet-me room", es: "Meet-me room" },
  { href: "/datacenter/connectivity#ip-transit", en: "IP transit", es: "Tránsito IP" },
]

const OPERATIONS_ITEMS: PanelItem[] = [
  { href: "/datacenter/hosting#smart-hands", en: "Remote smart hands", es: "Remote smart hands" },
  { href: "/datacenter/hosting#racking", en: "Installation & racking", es: "Instalación y racking" },
  { href: "/datacenter/hosting#logistics", en: "Logistics", es: "Logística" },
]

const AI_CLOUD_ITEMS: PanelItem[] = [
  { href: "/cloud/ai", en: "AI Infrastructure", es: "Infraestructura IA" },
  { href: "/datacenter/ai-servers", en: "GPU Servers", es: "Servidores GPU" },
]

const ON_PREM_ITEMS: PanelItem[] = [
  { href: "/products", en: "AI box", es: "AI box" },
]

const CLOUD_SERVER_ITEMS: PanelItem[] = [
  { href: "/cloud/compute#vps-cloud", en: "Cloud VPS servers", es: "Servidores VPS Cloud" },
  { href: "/cloud/compute#vps-windows", en: "Windows VPS servers", es: "Servidores VPS Windows" },
  { href: "/cloud/compute#dedicados", en: "Dedicated servers", es: "Servidores Dedicados" },
]

const CLOUD_ADDON_ITEMS: PanelItem[] = [
  { href: "/cloud/managed", en: "Managed services", es: "Servicios gestionados" },
  { href: "/cloud/storage", en: "Disaster Recovery & Backups", es: "Disaster Recovery y Backups" },
  { href: "/cloud/database", en: "Synchronous geo-replication", es: "Georeplicación síncrona" },
  { href: "/cloud/build", en: "Cloud migration", es: "Migración a la nube" },
]

// ─── 3. Component Logic ─────────────────────────────────────────────────────
export function Header() {
  const { lang, t } = useLanguage()
  const pathname = usePathname()

  // Estado Desktop
  const [active, setActive] = React.useState<ActiveState>(null)
  const open = active !== null
  const menu: MenuKey | null = active === null || active === "bare" ? null : active

  // Estado Mobile
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mobileSection, setMobileSection] = React.useState<MenuKey | null>("datacenter")

  const containerRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [backdrop, setBackdrop] = React.useState<BackdropSize>({ w: 0, h: 68 })

  // Cierra menús al cambiar de ruta
  React.useEffect(() => {
    setActive(null)
    setMobileOpen(false)
  }, [pathname])

  // Bloquea el scroll del body cuando el menú móvil está abierto
  React.useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  React.useLayoutEffect(() => {
    const container = containerRef.current
    const pill = pillRef.current
    if (!container || !pill) return
    if (!open) {
      setBackdrop({ w: pill.offsetWidth + 16, h: 68 })
    } else {
      const contentH = menu && contentRef.current ? contentRef.current.offsetHeight : 0
      setBackdrop({ w: container.offsetWidth + 16, h: contentH ? 60 + contentH : 68 })
    }
  }, [active, open, menu, lang])

  const toggleMobileSection = (key: MenuKey) => {
    setMobileSection((prev) => (prev === key ? null : key))
  }

  const navItem = (key: MenuKey, label: string) => {
    const isActive = menu === key
    return (
      <button
        type="button"
        aria-expanded={isActive}
        onMouseEnter={() => setActive(key)}
        onFocus={() => setActive(key)}
        className={cn(
          "group/nav label-mono flex items-center gap-1.5 px-[22px] h-9 rounded-md whitespace-nowrap transition-colors duration-200",
          isActive ? "bg-bg-dark text-text-dark" : "text-[rgba(30,29,29,0.93)] hover:text-text-base"
        )}
      >
        {label}
        <svg
          aria-hidden
          viewBox="0 0 10 10"
          fill="none"
          className={cn(
            "w-2.5 h-2.5 shrink-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isActive
              ? "rotate-180 opacity-90 translate-y-[0.5px] text-primary"
              : "rotate-0 opacity-45 group-hover/nav:opacity-80 group-hover/nav:translate-y-[1px]"
          )}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    )
  }

  const bareLink = (href: string, label: string) => (
    <Link
      href={href}
      onMouseEnter={() => setActive("bare")}
      className="label-mono px-[22px] h-9 flex items-center rounded-md whitespace-nowrap text-[rgba(30,29,29,0.93)] hover:text-text-base transition-colors duration-200"
    >
      {label}
    </Link>
  )

  const panelLink = (item: PanelItem) => (
    <li key={item.href + item.en}>
      <Link
        href={item.href}
        onClick={() => setActive(null)}
        className="block px-2 py-1.5 -mx-2 rounded-md text-sm text-text-base hover:bg-surface-beige transition-colors"
      >
        {t(item.en, item.es)}
        {item.descEn && (
          <span className="block text-[11px] leading-snug text-text-muted mt-0.5">{t(item.descEn, item.descEs)}</span>
        )}
      </Link>
    </li>
  )

  const panelHeading = (href: string | null, title: string, desc: string, pastelBgClass: string) => {
    const inner = (
      <>
        <h4
          className={cn(
            "label-mono inline-block px-2 py-1 -ml-1 rounded text-bg-dark/85 group-hover/ph:bg-transparent group-hover/ph:text-text-base transition-colors duration-200",
            pastelBgClass
          )}
        >
          {title}
        </h4>
        <span className="block text-[11px] leading-snug text-text-muted mt-1.5 whitespace-pre-line">{desc}</span>
      </>
    )
    return href ? (
      <Link
        href={href}
        onClick={() => setActive(null)}
        className="group/ph block mb-3 px-2 py-1.5 -mx-2 rounded-md hover:bg-surface-beige transition-colors"
      >
        {inner}
      </Link>
    ) : (
      <div className="group/ph mb-3 px-2 py-1.5 -mx-2 rounded-md hover:bg-surface-beige transition-colors">{inner}</div>
    )
  }

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <header className="fixed top-3 md:top-[29px] inset-x-0 z-50 pointer-events-none px-3 sm:px-4 md:px-[44px] [&_.label-mono]:!text-[12.5px]">
      {/* ── VERSIÓN MOBILE (< md) ── */}
      <div className="md:hidden pointer-events-auto">
        <div
          className={cn(
            "flex items-center justify-between h-[52px] px-4 rounded-xl transition-colors duration-200",
            mobileOpen ? "bg-white shadow-xl border border-bg-dark/10" : PILL_GLASS
          )}
        >
          <Link
            href="/"
            aria-label="OLA Datacenter"
            onClick={() => setMobileOpen(false)}
            className="flex items-center shrink-0 py-2"
          >
            <Image
              src="/oladc.svg"
              alt="OLA Datacenter"
              width={1936}
              height={460}
              priority
              unoptimized
              className="h-[18px] w-auto"
            />
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="font-mono text-[11px] uppercase tracking-[0.04em] bg-bg-dark text-white px-3 py-2 rounded-lg hover:bg-bg-dark/90 transition-colors"
            >
              {t("Contact", "Contacto")}
            </Link>

            <button
              type="button"
              aria-label={mobileOpen ? t("Close menu", "Cerrar menú") : t("Open menu", "Abrir menú")}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="w-9 h-9 rounded-lg bg-surface-beige/80 text-bg-dark flex items-center justify-center border border-bg-dark/10 active:scale-95 transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                {mobileOpen ? (
                  <path
                    d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M3 5.5H15M3 9H15M3 12.5H15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Panel desplegable Mobile */}
        {mobileOpen && (
          <div className="mt-2 rounded-2xl bg-white/98 backdrop-blur-xl border border-bg-dark/10 shadow-[0_24px_48px_rgba(34,47,48,0.18)] p-4 max-h-[calc(100dvh-84px)] overflow-y-auto">
            <div className="divide-y divide-bg-dark/10">
              {/* 01. Datacenter */}
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => toggleMobileSection("datacenter")}
                  className="w-full flex items-center justify-between py-2.5 font-mono text-[12px] uppercase tracking-[0.06em] text-text-base"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-hover inline-block" />
                    <span>01 / Datacenter</span>
                  </span>
                  <span className="font-mono text-[14px] text-text-base/50">
                    {mobileSection === "datacenter" ? "−" : "+"}
                  </span>
                </button>
                {mobileSection === "datacenter" && (
                  <div className="pb-3 pl-3.5 space-y-3">
                    <div>
                      <Link
                        href="/datacenter/colocation"
                        onClick={() => setMobileOpen(false)}
                        className="inline-block font-mono text-[11px] uppercase tracking-[0.05em] px-2 py-0.5 rounded bg-[#cef79e]/50 text-bg-dark mb-1.5"
                      >
                        Colocation →
                      </Link>
                      <ul className="space-y-1 pl-1 border-l border-bg-dark/10">
                        {COLOCATION_ITEMS.map((item) => (
                          <li key={item.href + item.en}>
                            <Link
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className="block py-1 pl-2.5 text-[14px] text-text-base/80 active:text-text-base"
                            >
                              {t(item.en, item.es)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-[0.05em] text-text-base/50 mb-1">
                          {t("Connectivity", "Conectividad")}
                        </span>
                        <ul className="space-y-1">
                          {CONNECTIVITY_ITEMS.map((item) => (
                            <li key={item.en}>
                              <Link
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className="block py-0.5 text-[13px] text-text-base/75"
                              >
                                {t(item.en, item.es)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-[0.05em] text-text-base/50 mb-1">
                          {t("Operations", "Operación")}
                        </span>
                        <ul className="space-y-1">
                          {OPERATIONS_ITEMS.map((item) => (
                            <li key={item.en}>
                              <Link
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className="block py-0.5 text-[13px] text-text-base/75"
                              >
                                {t(item.en, item.es)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 02. IA */}
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => toggleMobileSection("products")}
                  className="w-full flex items-center justify-between py-2.5 font-mono text-[12px] uppercase tracking-[0.06em] text-text-base"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-hover inline-block" />
                    <span>02 / {t("AI", "IA")}</span>
                  </span>
                  <span className="font-mono text-[14px] text-text-base/50">
                    {mobileSection === "products" ? "−" : "+"}
                  </span>
                </button>
                {mobileSection === "products" && (
                  <div className="pb-3 pl-3.5 space-y-2.5">
                    <div>
                      <Link
                        href="/cloud/ai"
                        onClick={() => setMobileOpen(false)}
                        className="inline-block font-mono text-[11px] uppercase tracking-[0.05em] px-2 py-0.5 rounded bg-[#99f6e4]/45 text-bg-dark mb-1"
                      >
                        {t("AI Cloud", "IA Cloud")} →
                      </Link>
                      <ul className="space-y-1 pl-1 border-l border-bg-dark/10">
                        {AI_CLOUD_ITEMS.map((item) => (
                          <li key={item.en}>
                            <Link
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className="block py-1 pl-2.5 text-[14px] text-text-base/80"
                            >
                              {t(item.en, item.es)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <Link
                        href="/datacenter/on-premise"
                        onClick={() => setMobileOpen(false)}
                        className="inline-block font-mono text-[11px] uppercase tracking-[0.05em] px-2 py-0.5 rounded bg-[#99f6e4]/25 text-bg-dark mb-1"
                      >
                        On-Prem Cloud →
                      </Link>
                      <ul className="space-y-1 pl-1 border-l border-bg-dark/10">
                        {ON_PREM_ITEMS.map((item) => (
                          <li key={item.en}>
                            <Link
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className="block py-1 pl-2.5 text-[14px] text-text-base/80"
                            >
                              {t(item.en, item.es)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* 03. Cloud */}
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => toggleMobileSection("solutions")}
                  className="w-full flex items-center justify-between py-2.5 font-mono text-[12px] uppercase tracking-[0.06em] text-text-base"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-hover inline-block" />
                    <span>03 / Cloud</span>
                  </span>
                  <span className="font-mono text-[14px] text-text-base/50">
                    {mobileSection === "solutions" ? "−" : "+"}
                  </span>
                </button>
                {mobileSection === "solutions" && (
                  <div className="pb-3 pl-3.5 space-y-2.5">
                    <ul className="space-y-1 pl-1 border-l border-bg-dark/10">
                      {[...CLOUD_SERVER_ITEMS, ...CLOUD_ADDON_ITEMS].map((item) => (
                        <li key={item.en}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="block py-1 pl-2.5 text-[14px] text-text-base/80"
                          >
                            {t(item.en, item.es)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 04. OLA */}
              <div className="py-2">
                <Link
                  href="/company/about"
                  onClick={() => setMobileOpen(false)}
                  className="w-full flex items-center justify-between py-2.5 font-mono text-[12px] uppercase tracking-[0.06em] text-text-base"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary-hover inline-block" />
                    <span>04 / OLA</span>
                  </span>
                  <span className="font-mono text-[12px] text-text-base/50">→</span>
                </Link>
              </div>
            </div>

            {/* Acciones inferiores del cajón móvil */}
            <div className="mt-3 pt-3 border-t border-bg-dark/10 flex items-center justify-between gap-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex-1 text-center font-mono text-[12px] uppercase tracking-[0.05em] py-3 rounded-xl border border-bg-dark/15 text-text-base hover:bg-surface-beige/60 transition-colors"
              >
                {t("Client Portal · Log in", "Portal Clientes · Entrar")}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── VERSIÓN DESKTOP (>= md) ── */}
      <div className="relative hidden md:flex justify-center">
        <div
          ref={containerRef}
          className="relative flex items-stretch gap-2 pointer-events-auto"
          onMouseLeave={() => setActive(null)}
        >
          {/* Morphing white backdrop */}
          <div
            aria-hidden
            className={cn(
              "absolute -top-2 -left-2 bg-white rounded-xl shadow-2xl border border-black/5 pointer-events-none transition-all duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
              open ? "opacity-100" : "opacity-0"
            )}
            style={{ width: backdrop.w, height: backdrop.h }}
          />

          {/* Nav pill */}
          <nav
            ref={pillRef}
            aria-label={t("Main", "Principal")}
            className={cn(
              "relative z-10 flex items-center gap-1 h-[52px] pl-5 pr-3 rounded-lg transition-colors duration-300",
              open ? "bg-transparent border border-transparent" : PILL_GLASS
            )}
          >
            <Link
              href="/"
              aria-label="OLA Datacenter"
              onMouseEnter={() => setActive(null)}
              className="flex items-center pr-4 mr-2 shrink-0"
            >
              <Image
                src="/oladc.svg"
                alt="OLA Datacenter"
                width={1936}
                height={460}
                priority
                unoptimized
                className="h-[20px] w-auto"
              />
            </Link>
            <div className="flex items-center gap-1">
              {navItem("datacenter", t("Datacenter", "Datacenter"))}
              {navItem("products", t("AI", "IA"))}
              {navItem("solutions", t("Cloud", "Cloud"))}
              {bareLink("/company/about", t("OLA", "OLA"))}
            </div>
          </nav>

          {/* Panel content (fades in below the nav; height feeds the backdrop) */}
          <div
            ref={contentRef}
            className={cn(
              "absolute top-[52px] -left-2 -right-2 pt-2 px-4 pb-4 transition-opacity duration-300",
              menu ? "opacity-100 delay-100" : "opacity-0 pointer-events-none"
            )}
          >
            {menu === "datacenter" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
                <div>
                  {panelHeading(
                    "/datacenter/colocation",
                    "Colocation",
                    t(
                      "Choose the space you need, from a single U\nto a full suite",
                      "Escoge el espacio que necesitas, desde una U\nhasta una suite completa"
                    ),
                    "bg-[#cef79e]/45"
                  )}
                  <ul className="space-y-1">
                    {COLOCATION_ITEMS.map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    "/datacenter/connectivity",
                    t("Connectivity", "Conectividad"),
                    t(
                      "Connect your infrastructure to carriers",
                      "Conecta tu infraestructura con operadores"
                    ),
                    "bg-[#cef79e]/25"
                  )}
                  <ul className="space-y-1">
                    {CONNECTIVITY_ITEMS.map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    "/datacenter/hosting",
                    t("Operations services", "Servicios de operación"),
                    t(
                      "We operate your hardware so you don't have to travel",
                      "Operamos tu hardware para que no tengas que desplazarte"
                    ),
                    "bg-[#cef79e]/12"
                  )}
                  <ul className="space-y-1">
                    {OPERATIONS_ITEMS.map(panelLink)}
                  </ul>
                </div>
              </div>
            )}

            {menu === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_220px] gap-6 p-4">
                <div>
                  {panelHeading(
                    "/cloud/ai",
                    t("AI Cloud", "IA Cloud"),
                    t(
                      "Get your AI to market faster with advanced GPU clusters",
                      "Lleva tu IA al mercado más rápido con clústeres GPU avanzados"
                    ),
                    "bg-[#99f6e4]/45"
                  )}
                  <ul className="space-y-1">
                    {AI_CLOUD_ITEMS.map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    "/datacenter/on-premise",
                    "On-Prem Cloud",
                    t(
                      "Complete solution to deploy the cloud on your own premises",
                      "Solución completa para desplegar el cloud en tus propias instalaciones"
                    ),
                    "bg-[#99f6e4]/20"
                  )}
                  <ul className="space-y-1">
                    {ON_PREM_ITEMS.map(panelLink)}
                  </ul>
                </div>
                <div className="relative rounded-lg overflow-hidden min-h-[210px] hidden md:block">
                  <Image src="/ola-ai-datacenter.jpg" alt="OLA AI Datacenter" fill className="object-cover" />
                </div>
              </div>
            )}

            {menu === "solutions" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                <div>
                  {panelHeading(
                    "/datacenter/bare-metal",
                    t("Servers", "Servidores"),
                    t(
                      "Cloud servers ready in minutes, for any workload",
                      "Servidores cloud listos en minutos, para cualquier carga de trabajo"
                    ),
                    "bg-[#bae6fd]/50"
                  )}
                  <ul className="space-y-1">
                    {CLOUD_SERVER_ITEMS.map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    null,
                    "Cloud Addons",
                    t("Adapt your cloud to your business needs", "Adapta tu nube a las necesidades de tu empresa"),
                    "bg-[#bae6fd]/22"
                  )}
                  <ul className="space-y-1">
                    {CLOUD_ADDON_ITEMS.map(panelLink)}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Actions pill */}
          <div
            className={cn(
              "relative z-10 flex items-center gap-7 h-[52px] pl-9 pr-1.5 rounded-lg transition-colors duration-300",
              open ? "bg-transparent border border-transparent" : PILL_GLASS
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 h-4 w-px bg-bg-dark/10 transition-opacity duration-300",
                open ? "opacity-100" : "opacity-0"
              )}
            />
            <Link
              href="/login"
              onMouseEnter={() => setActive("bare")}
              className="label-mono text-[rgba(30,29,29,0.93)] hover:text-text-base transition-colors"
            >
              {t("Log in", "Entrar")}
            </Link>
            <ChipCta href="/contact">{t("Talk to us", "Habla con nosotros")}</ChipCta>
          </div>
        </div>
      </div>
    </header>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * - Decisión técnica: En `< md` antes se ocultaban los enlaces del menú sin
 *   ofrecer botón hamburguesa ni cajón de navegación, y la píldora de acciones
 *   con `pl-9` comprimía la barra en pantallas móviles. Se separó explícitamente
 *   la barra móvil (`md:hidden`) con su cajón desplegable por acordeones (`01 /
 *   Datacenter`, `02 / IA`, `03 / Cloud`, `04 / OLA` + `Portal Clientes`) y se
 *   conservó intacto el mega-menú "morphing" en `md:flex`.
 * - Edge cases:
 *   1. Cierre automático del cajón al navegar (`usePathname`) y bloqueo de
 *      scroll en `document.body` mientras está abierto.
 */
