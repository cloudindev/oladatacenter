"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

export function Footer() {
  const { lang, setLang, t } = useLanguage()

  const col = (title: string, links: { href: string; label: string }[]) => (
    <div>
      <h4 className="text-[#f9f9f6] text-[15px] font-normal mb-3">{title}</h4>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-[14px] leading-snug text-[#807d73] hover:text-white transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <footer className="bg-[#1b2627]">
      {/* Pre-footer CTA */}
      <div className="container mx-auto px-6 pt-28 pb-24 flex flex-col items-center text-center">
        <p className="text-lg md:text-xl text-[#f9f9f6] max-w-2xl mb-10 leading-relaxed">
          {t(
            "Contact our team and we'll help you configure your cloud.",
            "Contacta con nuestro equipo y te ayudamos a configurar tu nube"
          )}
        </p>
        <Link
          href="/contact"
          className="group relative flex items-center h-14 pl-7 pr-1 rounded-lg overflow-clip bg-[#222f30] border border-white/10"
        >
          <span
            aria-hidden
            className="absolute inset-y-1 right-1 left-[calc(100%-52px)] rounded-md bg-[#f9f9f6] transition-[left] duration-[420ms] ease-out group-hover:left-1"
          />
          <span className="relative text-sm font-normal text-[#f9f9f6] mr-10 transition-colors duration-300 group-hover:text-[#222f30]">
            {t("Talk to an expert", "Contacta con un experto")}
          </span>
          <span className="relative w-12 h-12 flex items-center justify-center text-[#333333]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
        </Link>
      </div>

      {/* Main grid: brand column + product columns */}
      <div className="container mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 items-start">
        <div className="flex flex-col items-start">
          <Link href="/" className="mb-2.5 block">
            <Image
              src="/ola-footer-logo.png"
              alt="OLA Datacenter"
              width={1024}
              height={243}
              unoptimized
              className="h-[22px] w-auto"
            />
          </Link>
          <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#f9f9f6]/80">
            Data Center
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-10 gap-y-8">
          {col("Datacenter", [
            { href: "/datacenter/colocation/por-u", label: t("Colocation per U", "Colocation por U") },
            { href: "/datacenter/colocation/racks", label: t("Half rack / full rack", "Medio rack / rack completo") },
            { href: "/datacenter/colocation/jaulas", label: t("Cages", "Jaulas") },
            { href: "/datacenter/colocation/suites", label: t("Suites", "Suites") },
            { href: "/datacenter/colocation/wholesale", label: t("Housing / wholesale", "Housing / wholesale") },
            { href: "/datacenter/colocation", label: t("Connectivity", "Conectividad") },
            { href: "/datacenter/hosting", label: t("Operations services", "Servicios de operación") },
          ])}
          {col(t("AI", "IA"), [
            { href: "/cloud/ai", label: t("AI Infrastructure", "Infraestructura IA") },
            { href: "/datacenter/ai-servers", label: t("GPU Servers", "Servidores GPU") },
            { href: "/datacenter/on-premise", label: t("On-Prem Cloud", "On-Prem Cloud") },
            { href: "/products", label: t("AI box", "AI box") },
          ])}
          {col("Cloud", [
            { href: "/cloud/compute", label: t("Cloud VPS servers", "Servidores VPS Cloud") },
            { href: "/cloud/compute", label: t("Windows VPS servers", "Servidores VPS Windows") },
            { href: "/cloud/compute", label: t("Dedicated servers", "Servidores Dedicados") },
            { href: "/cloud/managed", label: t("Managed services", "Servicios gestionados") },
            { href: "/cloud/storage", label: t("Disaster Recovery & Backups", "Disaster Recovery y Backups") },
            { href: "/cloud/database", label: t("Synchronous geo-replication", "Georeplicación síncrona") },
            { href: "/cloud/build", label: t("Cloud migration", "Migración a la nube") },
          ])}
        </div>
      </div>

      {/* Bottom legal bar */}
      <div className="container mx-auto px-6">
        <div className="border-t border-white/10 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#807d73]">
          <span>© 2026 OLA Datacenter. {t("All rights reserved", "Todos los derechos reservados")}</span>

          <div className="flex items-center gap-6">
            <Link href="/legal/terms" className="hover:text-white transition-colors">{t("Legal", "Aviso Legal")}</Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">{t("Privacy", "Privacidad")}</Link>
            <Link href="/legal/cookies" className="hover:text-white transition-colors">Cookies</Link>

            {/* Language toggle */}
            <div
              className="relative flex items-center bg-white/5 border border-white/15 rounded-full p-0.5 cursor-pointer select-none"
              onClick={() => setLang(lang === "en" ? "es" : "en")}
            >
              <div
                className={cn(
                  "absolute top-0.5 bottom-0.5 w-[32px] bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out",
                  lang === "es" ? "translate-x-[32px]" : "translate-x-0"
                )}
              />
              <div className="relative z-10 flex text-[10px] font-medium uppercase tracking-wide">
                <span className={cn("w-[32px] text-center py-1 transition-colors duration-300", lang === "en" ? "text-neutral-900" : "text-white/50")}>
                  EN
                </span>
                <span className={cn("w-[32px] text-center py-1 transition-colors duration-300", lang === "es" ? "text-neutral-900" : "text-white/50")}>
                  ES
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
