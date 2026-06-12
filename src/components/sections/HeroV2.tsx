import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"

export function HeroV2() {
  return (
    <section className="relative pt-32 pb-24 md:pt-48 md:pb-40 overflow-hidden bg-white min-h-[90vh] flex items-center">
      
      {/* Background Image & Gradients */}
      <div className="absolute inset-0 z-0">
        <Image 
          src="/ola-datacenter-hero.jpg" 
          alt="OLA Datacenter Corridor" 
          fill 
          className="object-cover object-[75%_center] md:object-right" 
          quality={100}
          priority
        />
        
        {/* White fade from left to right */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 md:via-white/80 to-transparent w-full md:w-[80%] lg:w-[70%]" />
        
        {/* Subtle global white wash for mobile readability if image is too bright */}
        <div className="absolute inset-0 bg-white/30 md:hidden" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-primary text-xs font-bold tracking-widest uppercase">
              ✦ Built for cloud. Design for AI
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-[5rem] font-bold tracking-tight text-bg-dark leading-[1.05] mb-8">
            The cloud<br />
            infrastructure<br />
            built for<br />
            what's next.
          </h1>
          
          <p className="text-lg text-bg-dark/70 max-w-lg mb-10 leading-relaxed font-medium">
            Sovereign infrastructure. Extreme performance.<br className="hidden sm:block" />
            Designed to power AI and mission-critical workloads.
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <Link href="#solutions">
              <Button className="bg-[#0a0f1c] text-white hover:bg-[#0a0f1c]/90 rounded-[4px] px-8 py-6 text-sm font-semibold shadow-sm transition-all hover:scale-105">
                Explore solutions →
              </Button>
            </Link>
            <Link href="#contact">
              <Button variant="outline" className="bg-transparent border-[#0a0f1c]/20 text-[#0a0f1c] hover:bg-[#0a0f1c]/5 rounded-[4px] px-8 py-6 text-sm font-semibold transition-all">
                Talk to an expert
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
