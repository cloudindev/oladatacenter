import React from "react"
import Link from "next/link"
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
          
          {/* Right Image Placeholder Column */}
          <div className="w-full lg:w-1/2 relative h-[400px] sm:h-[500px] lg:h-[600px] rounded-2xl overflow-hidden group">
            {/* 
              This is a placeholder for the datacenter corridor image. 
              We use a CSS composition to look somewhat like a server aisle in a light theme.
            */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-gray-100 to-gray-200" />
            
            {/* Perspective Grid to simulate depth */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `linear-gradient(to right, #0a0f1c 1px, transparent 1px), linear-gradient(to bottom, #0a0f1c 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
                transform: 'perspective(1000px) rotateX(60deg) translateY(-100px) translateZ(-200px) scale(3)',
                transformOrigin: 'top center'
              }}
            />
            
            {/* Left simulated racks */}
            <div className="absolute left-0 top-0 bottom-0 w-1/4 bg-gradient-to-r from-gray-300 to-transparent shadow-[inset_-10px_0_20px_rgba(0,0,0,0.05)] border-r border-white/50" />
            
            {/* Right simulated racks */}
            <div className="absolute right-0 top-0 bottom-0 w-1/4 bg-gradient-to-l from-gray-300 to-transparent shadow-[inset_10px_0_20px_rgba(0,0,0,0.05)] border-l border-white/50" />
            
            {/* Light coming from the end of the corridor */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.8)_0%,_transparent_60%)] opacity-80 mix-blend-overlay" />
            
            {/* Temporary image placeholder text */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/40 backdrop-blur-sm">
              <span className="text-bg-dark font-medium bg-white/80 px-4 py-2 rounded-full shadow-sm text-sm">
                [Datacenter Image Placeholder]
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
