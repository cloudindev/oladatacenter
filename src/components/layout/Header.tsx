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
    <header className="sticky top-0 z-50 w-full border-b border-border-base/10 bg-white/95 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image 
            src="/ola-datacenter-logo.jpg" 
            alt="OLA Datacenter" 
            width={140} 
            height={40} 
            className="h-8 w-auto object-contain rounded-sm"
          />
          <span className="text-bg-dark/50 font-medium text-sm border border-bg-dark/20 rounded px-1.5 py-0.5">DC</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-bg-dark/80 h-full">
          {/* Products & Solutions Mega Menu */}
          <div className="group/navItem h-full flex items-center">
            <Link href="/products" className="hover:text-primary transition-colors flex items-center gap-1">
              {t("Products & Solutions", "Productos y Soluciones")}
              <svg className="w-4 h-4 opacity-50 group-hover/navItem:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </Link>
            
            {/* Mega Menu Dropdown */}
            <div className="absolute top-[64px] left-0 w-full bg-white/95 backdrop-blur-2xl border-b border-border-base/10 opacity-0 invisible group-hover/navItem:opacity-100 group-hover/navItem:visible transition-all duration-300 shadow-xl">
              <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-3 gap-12">
                  {/* Column 1 - Datacenter */}
                  <div>
                    <h4 className="text-bg-dark font-semibold mb-4 text-xs tracking-wider uppercase opacity-40">{t("Datacenter", "Datacenter")}</h4>
                    <ul className="space-y-4">
                      <li><Link href="/datacenter/colocation" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Colocation", "Colocation")}</span></Link></li>
                      <li><Link href="/datacenter/on-premise" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("On-premise Cloud", "Cloud On-premise")}</span></Link></li>
                      <li><Link href="/datacenter/ai-servers" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("AI Servers", "Servidores IA")}</span></Link></li>
                      <li><Link href="/datacenter/bare-metal" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Bare metal", "Bare metal")}</span></Link></li>
                      <li><Link href="/datacenter/hosting" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Hosting", "Hosting")}</span></Link></li>
                    </ul>
                  </div>
                  {/* Column 2 - AI Cloud */}
                  <div>
                    <h4 className="text-bg-dark font-semibold mb-4 text-xs tracking-wider uppercase opacity-40">{t("AI Cloud", "Cloud IA")}</h4>
                    <ul className="space-y-4">
                      <li><Link href="/cloud/build" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Build", "Construcción")}</span></Link></li>
                      <li><Link href="/cloud/compute" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Compute", "Cómputo")}</span></Link></li>
                      <li><Link href="/cloud/storage" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Storage", "Almacenamiento")}</span></Link></li>
                      <li><Link href="/cloud/database" className="text-bg-dark/70 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">{t("Databases", "Bases de datos")}</span></Link></li>
                    </ul>
                  </div>
                  {/* Column 3 - Banner */}
                  <div className="bg-bg-light p-6 rounded-xl border border-border-base/20 relative overflow-hidden group/featured flex flex-col justify-end min-h-[200px]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-transparent opacity-50 group-hover/featured:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <h4 className="text-bg-dark font-semibold mb-2 text-xl">{t("Managed solutions", "Soluciones gestionadas")}</h4>
                      <p className="text-sm text-bg-dark/60 mb-4 leading-relaxed">{t("Let our experts design, build, and operate your critical infrastructure so you can focus on innovation.", "Deja que nuestros expertos diseñen, construyan y operen tu infraestructura crítica para que puedas centrarte en innovar.")}</p>
                      <Link href="/cloud/managed" className="text-sm font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors">
                        {t("Explore services", "Explorar servicios")} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Link href="/company/about" className="hover:text-primary transition-colors">{t("Company", "Empresa")}</Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          
          {/* Sliding Language Toggle */}
          <div className="relative flex items-center bg-gray-100 border border-gray-200 rounded-full p-1 cursor-pointer" onClick={() => setLang(lang === "en" ? "es" : "en")}>
            <div 
              className={cn(
                "absolute top-1 bottom-1 w-[38px] bg-white rounded-full shadow-sm transition-transform duration-300 ease-in-out",
                lang === "es" ? "translate-x-[34px]" : "translate-x-0"
              )} 
            />
            <div className="relative z-10 flex text-xs font-bold uppercase tracking-wide">
              <span className={cn("w-[34px] text-center transition-colors duration-300", lang === "en" ? "text-bg-dark" : "text-bg-dark/40")}>
                EN
              </span>
              <span className={cn("w-[34px] text-center transition-colors duration-300", lang === "es" ? "text-bg-dark" : "text-bg-dark/40")}>
                ES
              </span>
            </div>
          </div>
          
          <Link href="/login" className="hidden sm:block text-sm font-medium text-bg-dark/70 hover:text-bg-dark transition-colors">
            {t("Log in", "Entrar")}
          </Link>
          
          <Button variant="primary" className="rounded-full shadow-sm">
            {t("Talk to us →", "Habla con nosotros →")}
          </Button>
        </div>
      </div>
    </header>
  )
}
