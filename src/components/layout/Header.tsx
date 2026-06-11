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
            className="h-6 w-auto object-contain"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70 h-full">
          <div className="group/navItem h-full flex items-center">
            <Link href="#datacenter" className="hover:text-primary hover:drop-shadow-[0_0_8px_rgba(0,255,199,0.5)] transition-all flex items-center gap-1">
              {t("Datacenter")}
              <svg className="w-4 h-4 opacity-70 group-hover/navItem:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </Link>
            
            {/* Mega Menu Dropdown */}
            <div className="absolute top-[64px] left-0 w-full bg-[#0a0f1c]/95 backdrop-blur-2xl border-b border-white/5 opacity-0 invisible group-hover/navItem:opacity-100 group-hover/navItem:visible transition-all duration-300 shadow-2xl">
              <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-3 gap-12">
                  {/* Column 1 */}
                  <div>
                    <h4 className="text-white font-semibold mb-4 text-xs tracking-wider uppercase opacity-50">Infrastructure</h4>
                    <ul className="space-y-4">
                      <li><Link href="#colocation" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Colocation</span><span className="text-xs opacity-60">Tier IV & Tier III facilities</span></Link></li>
                      <li><Link href="#baremetal" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Bare Metal</span><span className="text-xs opacity-60">Dedicated compute power</span></Link></li>
                      <li><Link href="#ai-clusters" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">AI Clusters</span><span className="text-xs opacity-60">High-density GPU racks</span></Link></li>
                    </ul>
                  </div>
                  {/* Column 2 */}
                  <div>
                    <h4 className="text-white font-semibold mb-4 text-xs tracking-wider uppercase opacity-50">Interconnection</h4>
                    <ul className="space-y-4">
                      <li><Link href="#fabric" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">OLA Fabric</span><span className="text-xs opacity-60">Software-defined interconnection</span></Link></li>
                      <li><Link href="#cross-connects" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Cross Connects</span><span className="text-xs opacity-60">Direct physical links</span></Link></li>
                      <li><Link href="#internet-exchange" className="text-white/80 hover:text-primary transition-colors flex flex-col"><span className="font-medium text-base">Internet Exchange</span><span className="text-xs opacity-60">Global peering</span></Link></li>
                    </ul>
                  </div>
                  {/* Column 3 - Featured */}
                  <div className="bg-white/5 p-6 rounded-xl border border-white/10 relative overflow-hidden group/featured">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover/featured:opacity-100 transition-opacity duration-500" />
                    <h4 className="text-primary font-semibold mb-2">Sustainable Datacenters</h4>
                    <p className="text-sm text-white/70 mb-4 leading-relaxed">Powered by 100% renewable energy with advanced liquid cooling capabilities for high-density AI workloads.</p>
                    <Link href="#sustainability" className="text-sm font-medium text-white hover:text-primary inline-flex items-center gap-1 transition-colors">
                      Learn more <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
