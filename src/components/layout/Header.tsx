"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

type MenuKey = "products" | "solutions" | "company"
type ActiveState = MenuKey | "bare" | null

export function Header() {
  const { lang, t } = useLanguage()
  const [active, setActive] = React.useState<ActiveState>(null)
  const open = active !== null
  const menu: MenuKey | null = active === null || active === "bare" ? null : active

  const containerRef = React.useRef<HTMLDivElement>(null)
  const pillRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [backdrop, setBackdrop] = React.useState({ w: 0, h: 68 })

  // The white backdrop morphs: closed → sized like the left pill (invisible);
  // hover on a bare item → stretches right to cover both pills;
  // hover on a submenu item → also grows downward to fit the panel content.
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
      onMouseEnter={() => setActive(key)}
      className={cn(
        "flex items-center gap-1.5 px-3.5 h-9 rounded-md text-xs font-normal whitespace-nowrap transition-colors duration-200",
        open
          ? menu === key
            ? "bg-neutral-900 text-white"
            : "text-neutral-500 hover:text-neutral-900"
          : "text-white/80 hover:text-white"
      )}
    >
      {label}
      <span className={cn("text-xs transition-opacity", open && menu === key ? "opacity-70" : "opacity-40")}>+</span>
    </button>
  )

  const bareLink = (href: string, label: string) => (
    <Link
      href={href}
      onMouseEnter={() => setActive("bare")}
      className={cn(
        "px-3.5 h-9 flex items-center rounded-md text-xs font-normal whitespace-nowrap transition-colors duration-200",
        open ? "text-neutral-500 hover:text-neutral-900" : "text-white/80 hover:text-white"
      )}
    >
      {label}
    </Link>
  )

  const panelLink = (item: { href: string; en: string; es: string; descEn?: string; descEs?: string }) => (
    <li key={item.href + item.en}>
      <Link
        href={item.href}
        className="block px-2 py-1.5 -mx-2 rounded-md text-sm font-normal text-neutral-800 hover:bg-neutral-100 transition-colors"
      >
        {t(item.en, item.es)}
        {item.descEn && (
          <span className="block text-[11px] leading-snug text-neutral-400 mt-0.5">
            {t(item.descEn, item.descEs)}
          </span>
        )}
      </Link>
    </li>
  )

  return (
    <header className="fixed top-[29px] inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div
        ref={containerRef}
        className="relative flex items-stretch gap-2 pointer-events-auto"
        onMouseLeave={() => setActive(null)}
      >
        {/* Morphing white backdrop (stretches right on hover, and down for submenus) */}
        <div
          aria-hidden
          className={cn(
            "absolute -top-2 -left-2 bg-white rounded-2xl shadow-2xl border border-black/5 pointer-events-none transition-all duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
            open ? "opacity-100" : "opacity-0"
          )}
          style={{ width: backdrop.w, height: backdrop.h }}
        />

        {/* Left pill: logo + nav (transparent over the white backdrop when open) */}
        <div
          ref={pillRef}
          className={cn(
            "relative z-10 flex items-center gap-0.5 h-[52px] px-2.5 rounded-lg overflow-clip transition-colors duration-300",
            open ? "bg-transparent" : "bg-[rgba(8,8,6,0.55)] backdrop-blur-[7px]"
          )}
        >
          {/* Animated aurora shimmer (hidden while open) */}
          <span
            aria-hidden
            className={cn(
              "nav-aurora absolute inset-0 -z-10 pointer-events-none transition-opacity duration-300",
              open ? "opacity-0" : "opacity-100"
            )}
          />
          <Link href="/" className="flex items-center pl-1.5 pr-3">
            <Image
              src="/ola-logo.png?v=2"
              alt="OLA Datacenter"
              width={1082}
              height={378}
              priority
              className={cn(
                "h-[18px] w-auto transition-[filter] duration-300",
                open && "invert hue-rotate-180"
              )}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItem("products", t("Private AI Cloud", "Cloud IA privado"))}
            {navItem("solutions", t("Solutions", "Soluciones"))}
            {bareLink("/datacenter", t("Datacenter", "Datacenter"))}
            {navItem("company", t("Company", "Empresa"))}
            {bareLink("/resources", t("Resources", "Recursos"))}
          </nav>
        </div>

        {/* Panel content (fades in below the nav; height feeds the backdrop) */}
        <div
          ref={contentRef}
          className={cn(
            "absolute top-[52px] -left-2 -right-2 pt-2 px-4 pb-4 transition-opacity duration-300",
            menu ? "opacity-100 delay-100" : "opacity-0 pointer-events-none"
          )}
        >
          {menu === "products" && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_220px] gap-6 p-4">
              <div>
                <Link
                  href="/cloud/ai"
                  className="group/aicloud block mb-3 px-2 py-1.5 -mx-2 rounded-md cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                  <h4 className="text-neutral-500 font-normal text-[11px] tracking-[0.15em] uppercase group-hover/aicloud:text-neutral-900 transition-colors">
                    AI Cloud
                  </h4>
                  <span className="block text-[11px] leading-snug text-neutral-400 mt-0.5 group-hover/aicloud:text-neutral-600 transition-colors">
                    {t(
                      "Get your AI to market faster with advanced GPU clusters",
                      "Lleva tu IA al mercado más rápido con clústeres GPU avanzados"
                    )}
                  </span>
                </Link>
                <ul className="space-y-1">
                  {[
                    { href: "/datacenter/ai-servers", en: "GPU Servers", es: "Servidores GPU" },
                    { href: "/datacenter/bare-metal", en: "Bare metal", es: "Bare metal" },
                  ].map(panelLink)}
                </ul>
              </div>
              <div>
                <Link
                  href="/datacenter/on-premise"
                  className="group/onprem block mb-3 px-2 py-1.5 -mx-2 rounded-md cursor-pointer hover:bg-neutral-100 transition-colors"
                >
                  <h4 className="text-neutral-500 font-normal text-[11px] tracking-[0.15em] uppercase group-hover/onprem:text-neutral-900 transition-colors">
                    On-Prem Cloud
                  </h4>
                  <span className="block text-[11px] leading-snug text-neutral-400 mt-0.5 group-hover/onprem:text-neutral-600 transition-colors">
                    {t(
                      "Complete solution to deploy the cloud on your own premises",
                      "Solución completa para desplegar el cloud en tus propias instalaciones"
                    )}
                  </span>
                </Link>
                <ul className="space-y-1">
                  {[
                    { href: "/products/ai-box", en: "AI box", es: "AI box" },
                  ].map(panelLink)}
                </ul>
              </div>
              <div className="relative rounded-xl overflow-hidden min-h-[210px] hidden md:block">
                <Image src="/ola-ai-datacenter.jpg" alt="OLA AI Datacenter" fill className="object-cover" />
              </div>
            </div>
          )}

          {menu === "solutions" && (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-4 max-w-xl">
              <div className="relative rounded-xl overflow-hidden min-h-[190px] hidden md:block">
                <Image src="/solutions-menu.jpg" alt="OLA Cloud Addons" fill className="object-cover" />
              </div>
              <div>
              <div className="mb-3 px-2 py-1.5 -mx-2">
                <h4 className="text-neutral-500 font-normal text-[11px] tracking-[0.15em] uppercase">
                  Cloud Addons
                </h4>
                <span className="block text-[11px] leading-snug text-neutral-400 mt-0.5">
                  {t(
                    "Adapt your cloud to your business needs",
                    "Adapta tu nube a las necesidades de tu empresa"
                  )}
                </span>
              </div>
              <ul className="space-y-1">
                {[
                  { href: "/cloud/managed", en: "Managed services", es: "Servicios gestionados" },
                  { href: "/solutions/disaster-recovery", en: "Disaster Recovery & Backups", es: "Disaster Recovery y Backups" },
                  { href: "/solutions/georeplicacion", en: "Synchronous geo-replication", es: "Georeplicación síncrona" },
                  { href: "/solutions/migracion", en: "Cloud migration", es: "Migración a la nube" },
                ].map(panelLink)}
              </ul>
              </div>
            </div>
          )}

          {menu === "company" && (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 p-4">
              <div className="relative rounded-xl overflow-hidden min-h-[180px] hidden md:block">
                <Image src="/ola-datacenter-hero.jpg" alt="OLA Datacenter" fill className="object-cover" />
              </div>
              <div>
                <h4 className="text-neutral-400 font-normal mb-3 text-[11px] tracking-[0.15em] uppercase">
                  {t("Company", "Empresa")}
                </h4>
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

        {/* Right pill: frosted glass when closed; blends into the white backdrop when open */}
        <div
          className={cn(
            "relative z-10 flex items-center gap-3 h-[52px] pl-4 pr-1.5 rounded-lg transition-all duration-300",
            open
              ? "bg-transparent shadow-none"
              : "backdrop-blur-[15px] bg-[linear-gradient(136deg,rgba(255,255,255,0.4)_0%,rgba(255,255,255,0.2)_49.37%,rgba(255,255,255,0.3)_100%)] shadow-[0_4px_17px_rgba(122,122,122,0.21)]"
          )}
        >
          <Link
            href="/login"
            className="hidden sm:block text-xs font-normal text-black hover:opacity-70 transition-opacity"
          >
            {t("Log in", "Entrar")}
          </Link>

          <span className="hidden sm:block w-px h-5 bg-[#b2b2b2]" aria-hidden />

          {/* Raft-style CTA: transparent with white chip that expands on hover */}
          <Link href="/contact" className="group relative flex items-center h-[38px] pl-3 pr-0.5 rounded-lg overflow-clip">
            <span
              aria-hidden
              className="absolute inset-y-0.5 right-0.5 left-[calc(100%-38px)] rounded-md bg-white transition-[left] duration-[420ms] ease-out group-hover:left-0.5"
            />
            <span className="relative text-xs font-normal text-black mr-3 whitespace-nowrap">
              {t("Talk to us", "Habla con nosotros")}
            </span>
            <span className="relative w-[34px] h-[34px] flex items-center justify-center text-black">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
