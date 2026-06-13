"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { useLanguage } from "@/context/LanguageContext"

export function HeroV2() {
  const { t } = useLanguage()

  return (
    <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden bg-white min-h-[90vh] flex items-center">
      
      {/* Background Image & Gradients */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/ola-datacenter-hero.jpg" 
          alt="OLA Datacenter Corridor" 
          fill 
          className="object-cover md:object-contain object-right [mask-image:linear-gradient(to_right,transparent,black_15%)]" 
          quality={100}
          priority
        />
        
        {/* Overlay gradient extended to completely hide the hard edge of the image on the left */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white via-[40%] to-transparent w-full pointer-events-none" />
        
        {/* Subtle global white wash for mobile readability if image is too bright */}
        <div className="absolute inset-0 bg-white/30 md:hidden pointer-events-none" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-primary text-xs font-bold tracking-widest uppercase">
              {t("✦ Built for cloud. Design for AI", "✦ Creado para la nube. Diseñado para IA")}
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-tight text-bg-dark leading-[1.05] mb-8">
            {t("The AI cloud", "La nube de IA")} <br />
            {t("infrastructure", "e infraestructura")} <br />
            {t("for next-gen.", "de nueva generación.")}
          </h1>
          
          <p className="text-lg text-bg-dark/70 max-w-lg mb-10 leading-relaxed font-medium">
            {t("Sovereign infrastructure. Extreme performance.", "Infraestructura soberana. Rendimiento extremo.")} <br className="hidden sm:block" />
            {t("Designed to power AI and mission-critical workloads.", "Diseñada para potenciar IA y cargas críticas.")}
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/products">
              <Button className="bg-[#0a0f1c] text-white hover:bg-[#0a0f1c]/90 rounded-[4px] px-8 py-6 text-sm font-semibold shadow-sm transition-all hover:scale-105">
                {t("Explore solutions →", "Explorar soluciones →")}
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" className="bg-transparent border-[#0a0f1c]/20 text-[#0a0f1c] hover:bg-[#0a0f1c]/5 rounded-[4px] px-8 py-6 text-sm font-semibold transition-all">
                {t("Talk to an expert", "Hablar con un experto")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
