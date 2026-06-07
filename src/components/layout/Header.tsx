"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

export function Header() {
  const { lang, setLang, t } = useLanguage()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 backdrop-blur-xl bg-[#0a0f1c]/95">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image 
            src="/ola-datacenter-logo.jpg" 
            alt="OLA Datacenter" 
            width={140} 
            height={40} 
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
          <Link href="#datacenter" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all">{t("Datacenter")}</Link>
          <Link href="#servers" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all">{t("Servers")}</Link>
          <Link href="#cloud" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all">{t("Cloud")}</Link>
          <Link href="#solutions" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all">{t("Solutions", "Soluciones")}</Link>
          <Link href="#pricing" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all">{t("Pricing", "Precios")}</Link>
          <Link href="#company" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all">{t("Company", "Empresa")}</Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          
          {/* Sliding Language Toggle */}
          <div className="relative flex items-center bg-white/5 border border-white/10 rounded-full p-1 cursor-pointer" onClick={() => setLang(lang === "en" ? "es" : "en")}>
            <div 
              className={cn(
                "absolute top-1 bottom-1 w-[38px] bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out",
                lang === "es" ? "translate-x-[34px]" : "translate-x-0"
              )} 
            />
            <div className="relative z-10 flex text-xs font-bold uppercase tracking-wide">
              <span className={cn("w-[34px] text-center transition-colors duration-300", lang === "en" ? "text-[#0a0f1c]" : "text-white/50")}>
                EN
              </span>
              <span className={cn("w-[34px] text-center transition-colors duration-300", lang === "es" ? "text-[#0a0f1c]" : "text-white/50")}>
                ES
              </span>
            </div>
          </div>
          
          <Link href="#login" className="hidden sm:block text-sm font-medium text-white/70 hover:text-white transition-colors">
            {t("Log in", "Entrar")}
          </Link>
          
          <Button variant="primary" className="rounded-full shadow-[0_0_15px_rgba(0,255,199,0.2)] hover:shadow-[0_0_25px_rgba(0,255,199,0.4)] transition-shadow">
            {t("Talk to us →", "Habla con nosotros →")}
          </Button>
        </div>
      </div>
    </header>
  )
}
