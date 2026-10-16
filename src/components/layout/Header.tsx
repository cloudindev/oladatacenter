"use client"

/**
 * Header — IntegratedBio-inspired navigation
 *
 * Layout: logo pinned to the left edge (own white chip), nav + actions centered.
 * Style: frosted white pills, Roboto Mono uppercase items, charcoal active state,
 * charcoal CTA with soft-mint arrow chip.
 *
 * Lecciones aprendidas:
 *  - El logo PNG es blanco; sobre fondos claros se usa `invert hue-rotate-180`
 *    para pasarlo a oscuro conservando el acento de color.
 *  - El backdrop que "morfa" mide el contenedor central: el logo debe quedar
 *    FUERA de ese contenedor o el panel se estiraría hasta el borde izquierdo.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { ChipCta } from "@/components/ui/ChipCta"
import { cn } from "@/lib/utils"

// ─── Interfaces ─────────────────────────────────────────────────────────────
type MenuKey = "datacenter" | "products" | "solutions" | "company"
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

// ─── Styles ─────────────────────────────────────────────────────────────────
const PILL_GLASS =
  "bg-white/80 backdrop-blur-md border border-white/60 shadow-[0_4px_24px_rgba(34,47,48,0.08)]"

// ─── Component ──────────────────────────────────────────────────────────────
export function Header() {
  const { lang, t } = useLanguage()
  const [active, setActive] = React.useState<ActiveState>(null)
  const open = active !== null
  const menu: MenuKey | null = active === null || active === "bare" ? null : active

  const containerRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [backdrop, setBackdrop] = React.useState<BackdropSize>({ w: 0, h: 68 })

  /**
   * The white backdrop morphs: closed → sized like the nav pill (invisible);
   * hover on a bare item → stretches right to cover both pills;
   * hover on a submenu item → also grows downward to fit the panel content.
   * Perf: one layout read per hover change (not per frame); CSS does the tween.
   */
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

  const navItem = (key: MenuKey, label: string) => (
    <button
      type="button"
      aria-expanded={menu === key}
      onMouseEnter={() => setActive(key)}
      onFocus={() => setActive(key)}
      className={cn(
        "label-mono flex items-center gap-1.5 px-[22px] h-9 rounded-md whitespace-nowrap transition-colors duration-200",
        menu === key ? "bg-bg-dark text-text-dark" : "text-text-base/70 hover:text-text-base"
      )}
    >
      {label}
      <span className={cn("transition-opacity", menu === key ? "opacity-70" : "opacity-40")}>+</span>
    </button>
  )

  const bareLink = (href: string, label: string) => (
    <Link
      href={href}
      onMouseEnter={() => setActive("bare")}
      className="label-mono px-[22px] h-9 flex items-center rounded-md whitespace-nowrap text-text-base/70 hover:text-text-base transition-colors duration-200"
    >
      {label}
    </Link>
  )

  const panelLink = (item: PanelItem) => (
    <li key={item.href + item.en}>
      <Link
        href={item.href}
        className="block px-2 py-1.5 -mx-2 rounded-md text-sm text-text-base hover:bg-surface-beige transition-colors"
      >
        {t(item.en, item.es)}
        {item.descEn && (
          <span className="block text-[11px] leading-snug text-text-muted mt-0.5">{t(item.descEn, item.descEs)}</span>
        )}
      </Link>
    </li>
  )

  const panelHeading = (href: string | null, title: string, desc: string) => {
    const inner = (
      <>
        <h4 className="label-mono text-text-muted group-hover/ph:text-text-base transition-colors">{title}</h4>
        <span className="block text-[11px] leading-snug text-text-muted mt-1.5">{desc}</span>
      </>
    )
    return href ? (
      <Link href={href} className="group/ph block mb-3 px-2 py-1.5 -mx-2 rounded-md hover:bg-surface-beige transition-colors">
        {inner}
      </Link>
    ) : (
      <div className="mb-3 px-2 py-1.5 -mx-2">{inner}</div>
    )
  }

  return (
    <header className="fixed top-[29px] inset-x-0 z-50 pointer-events-none px-4 md:px-[44px] [&_.label-mono]:!text-[12px]">
      <div className="relative flex justify-end md:justify-center">
        {/* Logo — pinned left, outside the morphing container */}
        <Link
          href="/"
          aria-label="OLA Datacenter"
          className={cn("absolute left-0 top-0 h-[52px] flex items-center px-4 rounded-lg pointer-events-auto", PILL_GLASS)}
        >
          <Image
            src="/ola-logo.png?v=2"
            alt="OLA Datacenter"
            width={1082}
            height={378}
            priority
            className="h-[18px] w-auto invert hue-rotate-180"
          />
        </Link>

        {/* Centered group: nav pill + actions pill (share the morphing backdrop) */}
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
              "relative z-10 hidden md:flex items-center gap-1 h-[52px] px-3 rounded-lg transition-colors duration-300",
              open ? "bg-transparent border border-transparent" : PILL_GLASS
            )}
          >
            {navItem("datacenter", t("Datacenter", "Datacenter"))}
            {navItem("products", t("AI", "IA"))}
            {navItem("solutions", t("Cloud", "Cloud"))}
            {navItem("company", t("OLA", "OLA"))}
            {bareLink("/resources", t("Resources", "Recursos"))}
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
                      "Choose the space you need: from a single U to a full suite",
                      "Escoge el espacio que necesitas: desde una U hasta una suite completa"
                    )
                  )}
                  <ul className="space-y-1">
                    {[
                      { href: "/datacenter/colocation", en: "Colocation per U", es: "Colocation por U" },
                      { href: "/datacenter/colocation", en: "Half rack / full rack", es: "Medio rack / rack completo" },
                      { href: "/datacenter/colocation", en: "Cages", es: "Jaulas" },
                      { href: "/datacenter/colocation", en: "Suites", es: "Suites" },
                      { href: "/datacenter/colocation", en: "Housing / wholesale", es: "Housing / wholesale" },
                    ].map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    null,
                    t("Connectivity", "Conectividad"),
                    t(
                      "Connect your infrastructure to carriers, clouds and partners",
                      "Conecta tu infraestructura con operadores, clouds y partners"
                    )
                  )}
                  <ul className="space-y-1">
                    {[
                      { href: "/datacenter/colocation", en: "Cross-connects", es: "Cross-connects" },
                      { href: "/datacenter/colocation", en: "Meet-me room", es: "Meet-me room" },
                      { href: "/datacenter/colocation", en: "IP transit", es: "Tránsito IP" },
                    ].map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    "/datacenter/hosting",
                    t("Operations services", "Servicios de operación"),
                    t(
                      "We operate your hardware so you don't have to travel",
                      "Operamos tu hardware para que no tengas que desplazarte"
                    )
                  )}
                  <ul className="space-y-1">
                    {[
                      { href: "/datacenter/hosting", en: "Remote smart hands", es: "Remote smart hands" },
                      { href: "/datacenter/hosting", en: "Installation & racking", es: "Instalación y racking" },
                      { href: "/datacenter/hosting", en: "Logistics", es: "Logística" },
                    ].map(panelLink)}
                  </ul>
                </div>
              </div>
            )}

            {menu === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_220px] gap-6 p-4">
                <div>
                  {panelHeading(
                    "/cloud/ai",
                    "AI Cloud",
                    t(
                      "Get your AI to market faster with advanced GPU clusters",
                      "Lleva tu IA al mercado más rápido con clústeres GPU avanzados"
                    )
                  )}
                  <ul className="space-y-1">
                    {[
                      { href: "/datacenter/ai-servers", en: "GPU Servers", es: "Servidores GPU" },
                      { href: "/datacenter/bare-metal", en: "Bare metal", es: "Bare metal" },
                    ].map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    "/datacenter/on-premise",
                    "On-Prem Cloud",
                    t(
                      "Complete solution to deploy the cloud on your own premises",
                      "Solución completa para desplegar el cloud en tus propias instalaciones"
                    )
                  )}
                  <ul className="space-y-1">
                    {[{ href: "/products", en: "AI box", es: "AI box" }].map(panelLink)}
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
                    "/cloud/compute",
                    t("Servers", "Servidores"),
                    t(
                      "Cloud servers ready in minutes, for any workload",
                      "Servidores cloud listos en minutos, para cualquier carga de trabajo"
                    )
                  )}
                  <ul className="space-y-1">
                    {[
                      { href: "/cloud/compute", en: "Cloud VPS servers", es: "Servidores VPS Cloud" },
                      { href: "/cloud/compute", en: "Windows VPS servers", es: "Servidores VPS Windows" },
                      { href: "/cloud/compute", en: "Dedicated VPS servers", es: "Servidores VPS Dedicados" },
                    ].map(panelLink)}
                  </ul>
                </div>
                <div>
                  {panelHeading(
                    null,
                    "Cloud Addons",
                    t("Adapt your cloud to your business needs", "Adapta tu nube a las necesidades de tu empresa")
                  )}
                  <ul className="space-y-1">
                    {[
                      { href: "/cloud/managed", en: "Managed services", es: "Servicios gestionados" },
                      { href: "/cloud/storage", en: "Disaster Recovery & Backups", es: "Disaster Recovery y Backups" },
                      { href: "/cloud/database", en: "Synchronous geo-replication", es: "Georeplicación síncrona" },
                      { href: "/cloud/build", en: "Cloud migration", es: "Migración a la nube" },
                    ].map(panelLink)}
                  </ul>
                </div>
              </div>
            )}

            {menu === "company" && (
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-4">
                <div className="relative rounded-lg overflow-hidden min-h-[180px] hidden md:block">
                  <Image src="/ola-datacenter-hero.jpg" alt="OLA Datacenter" fill className="object-cover" />
                </div>
                <div>
                  <h4 className="label-mono text-text-muted mb-4">{t("Company", "Empresa")}</h4>
                  <ul className="space-y-1">
                    {[
                      { href: "/company/about", en: "About us", es: "Sobre nosotros" },
                      { href: "/company/sustainability", en: "Sustainability", es: "Sostenibilidad" },
                      { href: "/company/news", en: "News", es: "Noticias" },
                      { href: "/contact", en: "Contact", es: "Contacto" },
                    ].map(panelLink)}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Actions pill */}
          <div
            className={cn(
              "relative z-10 flex items-center gap-3 h-[52px] pl-4 pr-1.5 rounded-lg transition-colors duration-300",
              open ? "bg-transparent border border-transparent" : PILL_GLASS
            )}
          >
            <Link
              href="/login"
              onMouseEnter={() => setActive("bare")}
              className="label-mono hidden sm:block text-text-base/70 hover:text-text-base transition-colors"
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
 * ─── Memoria ────────────────────────────────────────────────────────────────
 * Por qué: el usuario pidió el estilo de integratedbio.com — logo a la izquierda
 * y menús centrados. Se conserva el mega-menú con backdrop "morphing" que ya
 * existía, cambiando solo la piel (tokens charcoal/menta + Roboto Mono).
 * Edge cases:
 *  - Móvil (<md): la nav se oculta, el grupo se alinea a la derecha para no
 *    solaparse con el logo.
 *  - Teclado: onFocus abre el panel igual que el hover; aria-expanded refleja
 *    el estado.
 *  - Los enlaces de Soluciones apuntaban a rutas inexistentes (/solutions/*);
 *    se redirigen a páginas reales del sitio para evitar 404.
 */
