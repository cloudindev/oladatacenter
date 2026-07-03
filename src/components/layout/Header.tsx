"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

type MenuKey = "products" | "company" | null

export function Header() {
  const { t } = useLanguage()
  const [menu, setMenu] = React.useState<MenuKey>(null)
  const open = menu !== null

  const navItem = (key: Exclude<MenuKey, null>, label: string) => (
    <button
      onMouseEnter={() => setMenu(key)}
      className={cn(
        "flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-sm font-medium transition-colors duration-200",
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

  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="flex items-stretch gap-2 pointer-events-auto">

        {/* Left pill: logo + nav, expands into mega panel on hover */}
        <div className="relative" onMouseLeave={() => setMenu(null)}>
          <div
            className={cn(
              "relative z-10 flex items-center gap-0.5 h-[52px] px-2.5 rounded-2xl transition-colors duration-300",
              open ? "bg-white" : "bg-[rgba(10,10,10,0.55)] backdrop-blur-xl"
            )}
          >
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
              {navItem("products", t("Products", "Productos"))}
              {navItem("company", t("Company", "Empresa"))}
              <Link
                href="/datacenter"
                onMouseEnter={() => setMenu(null)}
                className={cn(
                  "px-3.5 h-9 flex items-center rounded-lg text-sm font-medium transition-colors duration-200",
                  open ? "text-neutral-500 hover:text-neutral-900" : "text-white/80 hover:text-white"
                )}
              >
                {t("Datacenter", "Datacenter")}
              </Link>
              <Link
                href="/resources"
                onMouseEnter={() => setMenu(null)}
                className={cn(
                  "px-3.5 h-9 flex items-center rounded-lg text-sm font-medium transition-colors duration-200",
                  open ? "text-neutral-500 hover:text-neutral-900" : "text-white/80 hover:text-white"
                )}
              >
                {t("Resources", "Recursos")}
              </Link>
            </nav>
          </div>

          {/* Mega panel */}
          <div
            className={cn(
              "absolute -top-2 -left-2 w-[calc(100vw-2rem)] max-w-[820px] bg-white rounded-[24px] shadow-2xl border border-black/5 pt-[68px] px-4 pb-4 transition-all duration-300 origin-top-left",
              open ? "opacity-100 scale-100 visible" : "opacity-0 scale-[0.98] invisible"
            )}
          >
            {menu === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_1fr] gap-6 p-4">
                <div className="relative rounded-xl overflow-hidden min-h-[210px] hidden md:block">
                  <Image src="/ola-ai-datacenter.jpg" alt="OLA AI Datacenter" fill className="object-cover" />
                </div>
                <div>
                  <h4 className="text-neutral-400 font-semibold mb-3 text-[11px] tracking-[0.15em] uppercase">
                    {t("Datacenter", "Datacenter")}
                  </h4>
                  <ul className="space-y-1">
                    {[
                      { href: "/datacenter/colocation", en: "Colocation", es: "Colocation" },
                      { href: "/datacenter/on-premise", en: "On-premise Cloud", es: "Cloud On-premise" },
                      { href: "/datacenter/ai-servers", en: "AI Servers", es: "Servidores IA" },
                      { href: "/datacenter/bare-metal", en: "Bare metal", es: "Bare metal" },
                      { href: "/datacenter/hosting", en: "Hosting", es: "Hosting" },
                    ].map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block px-2 py-1.5 -mx-2 rounded-lg text-[15px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
                        >
                          {t(item.en, item.es)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-neutral-400 font-semibold mb-3 text-[11px] tracking-[0.15em] uppercase">
                    {t("AI Cloud", "Cloud IA")}
                  </h4>
                  <ul className="space-y-1">
                    {[
                      { href: "/cloud/build", en: "Build", es: "Construcción" },
                      { href: "/cloud/compute", en: "Compute", es: "Cómputo" },
                      { href: "/cloud/storage", en: "Storage", es: "Almacenamiento" },
                      { href: "/cloud/database", en: "Databases", es: "Bases de datos" },
                      { href: "/cloud/managed", en: "Managed solutions", es: "Soluciones gestionadas" },
                    ].map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block px-2 py-1.5 -mx-2 rounded-lg text-[15px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
                        >
                          {t(item.en, item.es)}
                        </Link>
                      </li>
                    ))}
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
                  <h4 className="text-neutral-400 font-semibold mb-3 text-[11px] tracking-[0.15em] uppercase">
                    {t("Company", "Empresa")}
                  </h4>
                  <ul className="space-y-1">
                    {[
                      { href: "/company/about", en: "About us", es: "Sobre nosotros" },
                      { href: "/company/sustainability", en: "Sustainability", es: "Sostenibilidad" },
                      { href: "/company/news", en: "News", es: "Noticias" },
                      { href: "/contact", en: "Contact", es: "Contacto" },
                    ].map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block px-2 py-1.5 -mx-2 rounded-lg text-[15px] font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
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
        </div>

        {/* Right pill: login + CTA */}
        <div className="flex items-center gap-2 h-[52px] px-2 rounded-2xl bg-white/90 backdrop-blur-xl shadow-lg">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors px-1"
          >
            {t("Log in", "Entrar")}
          </Link>

          <Link href="/contact" className="group flex items-stretch h-9">
            <span className="flex items-center bg-neutral-900 text-white text-sm font-semibold px-4 rounded-l-lg transition-colors group-hover:bg-neutral-800">
              {t("Talk to us", "Habla con nosotros")}
            </span>
            <span className="flex items-center justify-center w-9 bg-neutral-900 text-white rounded-r-lg border-l border-white/15 transition-colors group-hover:bg-neutral-800">
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}
