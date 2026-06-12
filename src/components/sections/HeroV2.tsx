import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"

export function HeroV2() {
  return (
    <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-bg-light">
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          {/* Left Text Column */}
          <div className="w-full lg:w-1/2 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="text-primary text-xs font-bold tracking-widest uppercase">
                ✦ Built for cloud. Design for AI
              </span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-bg-dark leading-[1.1] mb-6">
              The cloud<br />
              infrastructure<br />
              built for<br />
              what's next.
            </h1>
            
            <p className="text-lg text-bg-dark/70 max-w-xl mb-10 leading-relaxed">
              Sovereign infrastructure. Extreme performance.<br className="hidden sm:block" />
              Designed to power AI and mission-critical workloads.
            </p>
            
            <div className="flex flex-wrap items-center gap-4">
              <Link href="#solutions">
                <Button className="bg-bg-dark text-white hover:bg-bg-dark/90 rounded-full px-6 py-6 text-base shadow-sm">
                  Explore solutions →
                </Button>
              </Link>
              <Link href="#contact">
                <Button variant="outline" className="bg-transparent border-bg-dark/20 text-bg-dark hover:bg-bg-dark/5 rounded-full px-6 py-6 text-base">
                  Talk to an expert
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Right Image Column */}
          <div className="w-full lg:w-1/2 relative h-[400px] sm:h-[500px] lg:h-[600px] rounded-2xl overflow-hidden group shadow-lg">
            <Image 
              src="/ola-datacenter-hero.jpg" 
              alt="OLA Datacenter Corridor" 
              fill 
              className="object-cover object-center" 
              quality={90}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  )
}
