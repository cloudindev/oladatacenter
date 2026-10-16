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
      <h4 className="text-[#f9f9f6] text-base font-normal mb-6">{title}</h4>
      <ul className="space-y-3.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-[15px] text-[#807d73] hover:text-white transition-colors">
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
            "Contact our team, we will be happy to help you configure your cloud.",
            "Contacta con nuestro equipo, estaremos encantados de ayudarte a configurar tu nube."
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

      {/* Main grid: brand column + link columns */}
      <div className="container mx-auto px-6 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div className="flex flex-col items-start">
          <Link href="/" className="mb-6 block">
            <Image
              src="/logo-oladc-g.png?v=2"
              alt="OLA Datacenter"
              width={1024}
              height={320}
              className="h-6 w-auto"
            />
          </Link>
          <p className="text-sm text-[#f9f9f6]/90 mb-10">
            {t("AI Cloud for what's sovereign", "AI Cloud para lo soberano")}
          </p>

          <div className="w-full max-w-xs border-t border-white/10 pt-6 flex flex-col gap-6">
            <div>
              <div className="text-[11px] text-primary mb-2 font-medium">{t("Build and deploy", "Construye y despliega")}</div>
              <Image src="/olacloud-logo.png" alt="OLA CLOUD" width={140} height={30} className="h-5 w-auto object-contain object-left" />
            </div>
            <div>
              <div className="text-[11px] text-cyan-400 mb-2 font-medium">Hosting</div>
              <Image src="/cloudin-logo.png" alt="cloudin" width={140} height={30} className="h-5 w-auto object-contain object-left" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
          {col("Datacenter", [
            { href: "/datacenter/colocation", label: t("Colocation", "Colocation") },
            { href: "/datacenter/on-premise", label: t("On-premise Cloud", "Cloud On-premise") },
            { href: "/datacenter/ai-servers", label: t("AI Servers", "Servidores IA") },
            { href: "/datacenter/bare-metal", label: t("Bare metal", "Bare metal") },
            { href: "/datacenter/hosting", label: "Hosting" },
          ])}
          {col("Cloud", [
            { href: "/cloud/ai", label: t("AI Cloud", "Cloud IA") },
            { href: "/cloud/compute", label: t("Compute", "Cómputo") },
            { href: "/cloud/storage", label: t("Storage", "Almacenamiento") },
            { href: "/cloud/database", label: t("Databases", "Bases de datos") },
            { href: "/cloud/managed", label: t("Managed solutions", "Soluciones gestionadas") },
          ])}
          {col(t("Company", "Empresa"), [
            { href: "/company/about", label: t("About OLA", "Sobre OLA") },
            { href: "/company/sustainability", label: t("Sustainability", "Sostenibilidad") },
            { href: "/company/news", label: t("News", "Noticias") },
            { href: "/contact", label: t("Contact", "Contacto") },
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
