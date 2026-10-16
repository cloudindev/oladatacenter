"use client"

import * as React from "react"
import { useLanguage } from "@/context/LanguageContext"
import { SectionLabel } from "@/components/ui/SectionLabel"
import { ArrowRight } from "lucide-react"

export function DatacenterSection() {
  const { t } = useLanguage()

  return (
    <section id="datacenter" className="py-24 md:py-32 bg-bg-light">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <SectionLabel className="text-accent-ink">01 · DATACENTER</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-text-base mb-4">
              Two facilities. One sovereign network.
            </h2>
            <p className="text-lg text-text-muted">
              Designed for low-latency Edge inference and rack-level AI training under Spanish jurisdiction.
            </p>
          </div>
          <button className="text-sm font-medium text-text-muted hover:text-text-base flex items-center group">
            {t("Ver en español", "View in English")} <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          
          {/* Edge Card - Light */}
          <div className="bg-white border border-border-base rounded-lg p-8 lg:p-10 hover:shadow-lg transition-shadow group cursor-pointer flex flex-col justify-between h-[450px]">
            <div>
              {/* Abstract Nodes Illustration */}
              <div className="h-40 w-full mb-8 relative flex items-center justify-center">
                 <div className="w-3/4 h-full relative">
                    <svg viewBox="0 0 200 100" className="w-full h-full stroke-accent-ink/40 stroke-1 fill-none">
                       <path d="M20,50 L80,20 L150,40 L180,80 L100,90 Z" strokeDasharray="4 4" className="animate-[dash_20s_linear_infinite]" />
                       <circle cx="20" cy="50" r="4" className="fill-accent-ink stroke-none" />
                       <circle cx="80" cy="20" r="4" className="fill-accent-ink stroke-none" />
                       <circle cx="150" cy="40" r="4" className="fill-accent-ink stroke-none" />
                       <circle cx="180" cy="80" r="4" className="fill-accent-ink stroke-none" />
                       <circle cx="100" cy="90" r="4" className="fill-accent-ink stroke-none" />
                    </svg>
                 </div>
              </div>
              
              <div className="label-mono text-text-muted mb-2">SERVICE</div>
              <h3 className="text-2xl font-medium text-text-base mb-3">DC Edge</h3>
              <p className="text-text-muted mb-6">
                Distributed micro-datacenters across Iberia for sub-15 ms inference.
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-auto">
               <div className="flex flex-wrap gap-2">
                 <span className="text-xs font-medium text-text-muted bg-bg-light px-2 py-1 rounded border border-border-base">Low latency</span>
                 <span className="text-xs font-medium text-text-muted bg-bg-light px-2 py-1 rounded border border-border-base">Edge inference</span>
               </div>
               <span className="text-accent-ink font-medium flex items-center group-hover:underline">
                 Learn <ArrowRight className="w-4 h-4 ml-1" />
               </span>
            </div>
          </div>

          {/* AI Card - Dark */}
          <div className="bg-bg-dark border border-border-dark rounded-lg p-8 lg:p-10 hover:shadow-2xl hover:shadow-primary/5 transition-shadow group cursor-pointer flex flex-col justify-between h-[450px]">
            <div>
              {/* Abstract Rack Illustration */}
              <div className="h-40 w-full mb-8 relative flex items-center justify-center">
                 <div className="w-3/4 h-24 bg-surface-dark border border-border-dark rounded-md p-3 flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="h-1/3 bg-bg-dark rounded flex items-center px-4 justify-between">
                       <div className="flex gap-2">
                         <div className="w-6 h-2 bg-primary/20 rounded-sm" />
                         <div className="w-6 h-2 bg-primary/20 rounded-sm" />
                       </div>
                       <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    </div>
                    <div className="h-1/3 bg-bg-dark rounded flex items-center px-4 justify-between">
                       <div className="flex gap-2">
                         <div className="w-6 h-2 bg-primary/20 rounded-sm" />
                         <div className="w-6 h-2 bg-primary/20 rounded-sm" />
                       </div>
                       <div className="w-2 h-2 rounded-full bg-primary animate-pulse delay-75" />
                    </div>
                 </div>
              </div>

              <div className="label-mono text-primary mb-2">SERVICE</div>
              <h3 className="text-2xl font-medium text-white mb-3">DC AI</h3>
              <p className="text-text-muted mb-6">
                Rack-dense, liquid-ready halls purpose built for GPU training & inference.
              </p>
            </div>
            
            <div className="flex items-center justify-between mt-auto">
               <div className="flex flex-wrap gap-2">
                 <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">Up to 132 kW</span>
                 <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">Liquid-ready</span>
               </div>
               <span className="text-primary font-medium flex items-center group-hover:underline">
                 Learn <ArrowRight className="w-4 h-4 ml-1" />
               </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
