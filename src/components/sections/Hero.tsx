"use client"

import * as React from "react"
import { useLanguage } from "@/context/LanguageContext"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { ServerRack } from "@/components/ui/ServerRack"
import { ArrowRight } from "lucide-react"

export function Hero() {
  const { t } = useLanguage()

  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-bg-light border-b border-border-base/40">
      {/* Subtle Grid Background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%2364748b' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Decorative Cyan Glow */}
      <div className="absolute top-1/4 -right-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          
          {/* Left Content */}
          <div className="max-w-2xl">
            <div className="text-xs font-semibold tracking-wider text-text-muted uppercase mb-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
              {t("OLA DATACENTER · SPAIN", "OLA DATACENTER · ESPAÑA")}
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-text-base mb-6 leading-[1.05]">
              AI Cloud <br/>
              {t("for what's", "para lo")} <br/>
              <span className="text-primary">{t("sovereign", "soberano")}</span>
            </h1>

            <div className="space-y-2 mb-10 max-w-lg">
              <p className="text-lg md:text-xl text-text-muted font-medium">
                {t(
                  "Datacenter, dedicated servers and cloud — engineered in Spain to power your AI workloads.",
                  "Datacenter, servidores dedicados y cloud — diseñados en España para potenciar tus cargas de IA."
                )}
              </p>
              <p className="text-base text-text-muted/80 italic">
                {t(
                  "Datacenter, servidores dedicados y cloud — diseñados en España para tu IA.",
                  "Datacenter, dedicated servers and cloud — engineered in Spain for your AI."
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button variant="default" size="lg" className="rounded-full shadow-lg group">
                {t("Explore solutions", "Explorar soluciones")}
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="rounded-full bg-white/50 backdrop-blur-sm border-border-base/60">
                {t("Tour the DC", "Visita el DC")}
              </Button>
            </div>
          </div>

          {/* Right Visual */}
          <div className="relative w-full h-[500px] md:h-[600px] flex items-center justify-center perspective-[1000px]">
             {/* Abstract Floating Badges */}
             <div className="absolute top-20 left-10 md:left-20 z-20 animate-[bounce_8s_infinite] shadow-xl">
               <Badge className="bg-bg-light border border-border-base text-text-base shadow-sm py-1 px-3">
                 {t("DC AI · MADRID · <12 ms latency · Tier III+", "DC IA · MADRID · <12 ms de latencia · Tier III+")}
               </Badge>
             </div>
             
             <div className="absolute bottom-32 right-0 md:right-10 z-20 animate-[bounce_6s_infinite_reverse] shadow-xl">
               <Badge className="bg-surface-dark border border-border-dark text-white py-1 px-3 shadow-primary/20 shadow-lg">
                 OLADC AI1 · GPU · 4U · 128C · NVL72-ready · <span className="text-primary ml-1">NEW</span>
               </Badge>
             </div>

             {/* 3D Rack Wrapper */}
             <div className="relative w-[340px] md:w-[420px] transform rotate-y-[-15deg] rotate-x-[5deg] scale-95 md:scale-100 hover:rotate-y-[0deg] hover:rotate-x-[0deg] transition-transform duration-1000">
               <ServerRack activeLeds={5} className="shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]" />
               {/* Ground shadow */}
               <div className="absolute -bottom-12 left-10 right-10 h-10 bg-black/10 blur-xl rounded-full" />
             </div>
          </div>
        </div>

        {/* Trust Strip */}
        <div className="mt-20 pt-8 border-t border-border-base/40 flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs font-semibold text-text-muted/60 uppercase tracking-widest text-center">
          <span>Tier III</span>
          <span className="hidden sm:inline">·</span>
          <span>ISO 27001</span>
          <span className="hidden sm:inline">·</span>
          <span>RGPD</span>
          <span className="hidden sm:inline">·</span>
          <span>ENS Alto</span>
          <span className="hidden sm:inline">·</span>
          <span>{t("100% renewable", "100% renovable")}</span>
          <span className="hidden sm:inline">·</span>
          <span>AS210882</span>
        </div>
      </div>
    </section>
  )
}
