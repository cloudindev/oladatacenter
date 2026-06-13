import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/Button"

export function DatacenterBanner() {
  return (
    <section className="bg-bg-light pb-24">
      <div className="max-w-[1600px] mx-auto px-10">
        <div className="relative rounded-2xl overflow-hidden bg-bg-dark text-white min-h-[320px] shadow-2xl">
          
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
            <div className="text-[#00FFC7] text-xs font-bold tracking-widest uppercase mb-3">
              SOVEREIGN BY DESIGN
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight mb-5">
              Your data. Your rules.<br />
              Our infrastructure.
            </h2>
            
            <p className="text-white/70 mb-8 max-w-md leading-relaxed">
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
