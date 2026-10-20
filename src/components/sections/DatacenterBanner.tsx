"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"
import { useLanguage } from "@/context/LanguageContext"

export function DatacenterBanner() {
  const { t } = useLanguage()

  return (
    <section className="bg-bg-light pb-16 md:pb-24">
      <div className="max-w-[1600px] mx-auto px-6 md:px-[44px]">
        <div className="relative rounded-xl overflow-hidden bg-bg-dark text-white min-h-[320px] shadow-2xl">
          
          {/* Background Image */}
          <div className="absolute inset-y-0 right-0 w-full md:w-[66%] z-0">
            <Image 
              src="/ola-ai-datacenter.jpg" 
              alt="OLA AI Datacenter" 
              fill 
              unoptimized
              className="object-cover object-[center_42%] md:[mask-image:linear-gradient(to_right,transparent_0%,transparent_8%,black_48%)]" 
              quality={100}
            />
            {/* Smooth left gradient blend on desktop + full legibility scrim on mobile */}
            <div className="absolute inset-0 bg-[#222f30]/78 md:bg-transparent md:bg-gradient-to-r md:from-[#222f30] md:via-[#222f30]/70 md:via-[36%] md:to-transparent pointer-events-none" />
          </div>

          <div className="relative z-10 p-6 sm:p-8 md:p-12 lg:p-14 max-w-2xl h-full flex flex-col justify-center">
            <div className="text-[#CEF79E] label-mono mb-3">
              {t("SOVEREIGN BY DESIGN", "SOBERANÍA POR DISEÑO")}
            </div>
            
            <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-white leading-tight mb-5">
              {t("Your data. Your rules.", "Tus datos. Tus reglas.")}<br />
              {t("Our infrastructure.", "Nuestra infraestructura.")}
            </h2>
            
            <p className="text-white/70 mb-8 max-w-md leading-relaxed">
              {t("Our data center is located in Spain, powered by renewable energy and built to the highest standards of security and compliance.", "Nuestro datacenter están ubicado en España, alimentados por energía renovable y construidos con los más altos estándares de seguridad y cumplimiento normativo.")}
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
