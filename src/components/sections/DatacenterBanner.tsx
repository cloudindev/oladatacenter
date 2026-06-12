import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"

export function DatacenterBanner() {
  return (
    <section className="bg-bg-light pb-24">
      <div className="container mx-auto px-4">
        <div className="relative rounded-3xl overflow-hidden bg-bg-dark text-white min-h-[400px] shadow-2xl">
          
          {/* Background Image / Composition */}
          {/* Since we don't have the final image, we use a dark gradient with some abstract lighting simulating the building */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1c] via-[#0a0f1c]/90 to-transparent z-0" />
          <div className="absolute right-0 bottom-0 top-0 w-2/3 z-0 opacity-80 mix-blend-screen bg-gradient-to-bl from-blue-900/40 via-transparent to-transparent" />
          
          {/* Simulated Building for placeholder */}
          <div className="absolute right-10 bottom-0 w-[500px] h-[200px] z-0 hidden md:block">
            <div className="w-full h-full bg-[#111] rounded-t-lg border-t border-x border-white/10 relative overflow-hidden">
              <div className="absolute top-4 right-4 font-bold text-white tracking-widest text-2xl">OLA</div>
              {/* Windows grid */}
              <div className="absolute bottom-0 left-0 right-0 h-3/4 flex flex-wrap gap-1 p-2">
                {[...Array(40)].map((_, i) => (
                  <div key={i} className="flex-1 min-w-[20px] h-full bg-blue-400/20 rounded-sm border border-blue-400/10" />
                ))}
              </div>
            </div>
            {/* Ground / glow */}
            <div className="absolute -bottom-4 left-[-10%] right-[-10%] h-8 bg-green-900/30 blur-xl rounded-[100%]" />
          </div>

          <div className="relative z-10 p-10 md:p-16 max-w-2xl h-full flex flex-col justify-center">
            <div className="text-[#00FFC7] text-xs font-bold tracking-widest uppercase mb-4">
              SOVEREIGN BY DESIGN
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight mb-6">
              Your data. Your rules.<br />
              Our infrastructure.
            </h2>
            
            <p className="text-white/70 mb-10 max-w-md leading-relaxed">
              All our data centers are located in Spain, powered by 100% renewable energy and built to the highest standards of security and compliance.
            </p>
            
            <div>
              <Link href="#datacenter">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-6 py-6 font-medium text-sm">
                  Discover our data centers →
                </Button>
              </Link>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  )
}
