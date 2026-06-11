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
            className="h-8 w-auto object-contain"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70 h-full">
          {/* Products & Solutions Mega Menu */}
          <div className="group/navItem h-full flex items-center">
            <Link href="#products" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all flex items-center gap-1 uppercase tracking-wide">
              {t("Products & Solutions", "Productos y Soluciones")}
              <svg className="w-4 h-4 opacity-70 group-hover/navItem:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </Link>
            
            {/* Mega Menu Dropdown */}
            <div className="absolute top-[64px] left-0 w-full bg-[#0a0f1c]/95 backdrop-blur-2xl border-b border-white/5 opacity-0 invisible group-hover/navItem:opacity-100 group-hover/navItem:visible transition-all duration-300 shadow-2xl">
              <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-3 gap-12">
                  {/* Column 1 - Datacenter */}
                  <div>
                    <h4 className="text-white font-semibold mb-4 text-xs tracking-wider uppercase opacity-50">Datacenter</h4>
                    <ul className="space-y-4">
                      <li><Link href="#colocation" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Colocation</span></Link></li>
                      <li><Link href="#on-premise" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">On-premise Cloud</span></Link></li>
                      <li><Link href="#ai-servers" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">AI Servers</span></Link></li>
                      <li><Link href="#baremetal" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Bare metal</span></Link></li>
                      <li><Link href="#hosting" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Hosting</span></Link></li>
                    </ul>
                  </div>
                  {/* Column 2 - AI Cloud */}
                  <div>
                    <h4 className="text-white font-semibold mb-4 text-xs tracking-wider uppercase opacity-50">AI Cloud</h4>
                    <ul className="space-y-4">
                      <li><Link href="#build" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Build</span></Link></li>
                      <li><Link href="#compute" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Compute</span></Link></li>
                      <li><Link href="#storage" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Storage</span></Link></li>
                      <li><Link href="#databases" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Databases</span></Link></li>
                    </ul>
                  </div>
                  {/* Column 3 - Banner */}
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10 relative overflow-hidden group/featured flex flex-col justify-end min-h-[200px]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-transparent opacity-30 group-hover/featured:opacity-80 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <h4 className="text-white font-semibold mb-2 text-xl">Managed solutions</h4>
                      <p className="text-sm text-white/70 mb-4 leading-relaxed">Let our experts design, build, and operate your critical infrastructure so you can focus on innovation.</p>
                      <Link href="#managed" className="text-sm font-medium text-primary hover:text-white inline-flex items-center gap-1 transition-colors">
                        Explore services <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <Link href="#company" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all uppercase tracking-wide">{t("Company", "Empresa")}</Link>
          <Link href="#resources" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all uppercase tracking-wide">{t("Resources", "Recursos")}</Link>
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
