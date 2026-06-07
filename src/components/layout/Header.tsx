"use client"

import * as React from "react"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"
import { Button } from "@/components/ui/Button"

export function Header() {
  const { lang, setLang, t } = useLanguage()

  const toggleLanguage = () => {
    setLang(lang === "en" ? "es" : "en")
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-base/40 bg-bg-light/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-bold text-xl tracking-tight text-text-base">OLA</span>
          <span className="text-text-muted font-medium text-sm border border-border-base rounded px-1">DC</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-text-muted">
          <Link href="#datacenter" className="hover:text-text-base transition-colors">{t("Datacenter")}</Link>
          <Link href="#servers" className="hover:text-text-base transition-colors">{t("Servers")}</Link>
          <Link href="#cloud" className="hover:text-text-base transition-colors">{t("Cloud")}</Link>
          <Link href="#solutions" className="hover:text-text-base transition-colors">{t("Solutions", "Soluciones")}</Link>
          <Link href="#pricing" className="hover:text-text-base transition-colors">{t("Pricing", "Precios")}</Link>
          <Link href="#company" className="hover:text-text-base transition-colors">{t("Company", "Empresa")}</Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLanguage}
            className="text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-base px-2 border border-border-base rounded-full h-7 flex items-center"
          >
            {lang}
          </button>
          
          <Link href="#login" className="hidden sm:block text-sm font-medium text-text-muted hover:text-text-base">
            {t("Login", "Entrar")}
          </Link>
          
          <Button variant="default" className="rounded-full">
            {t("Talk to us →", "Habla con nosotros →")}
          </Button>
        </div>
      </div>
    </header>
  )
}
