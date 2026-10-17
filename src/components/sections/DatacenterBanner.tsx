"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { useLanguage } from "@/context/LanguageContext"

export function DatacenterBanner() {
  const { t } = useLanguage()

  return (
    <section className="bg-bg-light pb-24">
      <div className="max-w-[1600px] mx-auto px-10">
        <div className="relative rounded-lg overflow-hidden bg-bg-dark text-white min-h-[320px] shadow-2xl">
          
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <Image 
              src="/ola-ai-datacenter.jpg" 
              alt="OLA AI Datacenter" 
              fill 
              className="object-cover md:object-contain object-right [mask-image:linear-gradient(to_right,transparent,black_15%)]" 
              quality={100}
            />
            {/* Overlay gradient extended to completely hide the hard edge of the image on the left */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1c] via-[#0a0f1c] via-[40%] to-transparent w-full pointer-events-none" />
          </div>

          <div className="relative z-10 p-8 md:p-12 lg:p-14 max-w-2xl h-full flex flex-col justify-center">
            <div className="text-[#67E8F9] label-mono mb-3">
              {t("SOVEREIGN BY DESIGN", "SOBERANÍA POR DISEÑO")}
            </div>
            
            <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-white leading-tight mb-5">
              {t("Your data. Your rules.", "Tus datos. Tus reglas.")}<br />
              {t("Our infrastructure.", "Nuestra infraestructura.")}
            </h2>
            
            <p className="text-white/70 mb-8 max-w-md leading-relaxed">
              {t("All our data centers are located in Spain, powered by 100% renewable energy and built to the highest standards of security and compliance.", "Todos nuestros datacenters están ubicados en España, alimentados por energía 100% renovable y construidos con los más altos estándares de seguridad y cumplimiento normativo.")}
            </p>
            
            <div>
              <Link href="/datacenter/colocation">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-6 py-6 font-medium text-sm">
                  {t("Discover our data centers →", "Descubrir nuestros datacenters →")}
                </Button>
              </Link>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  )
}
