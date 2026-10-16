"use client"

import * as React from "react"
import { useLanguage } from "@/context/LanguageContext"
import { Button } from "@/components/ui/Button"
import { ArrowRight } from "lucide-react"

export function CtaBanner() {
  const { t } = useLanguage()

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="bg-bg-dark rounded-xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden shadow-2xl">
          {/* Background Glows */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl md:text-4xl font-normal text-white mb-4 leading-tight">
              Bring your AI workload home.
            </h2>
            <p className="text-text-muted mb-2 text-lg">
              Datacenter, hardware and cloud — built and operated in Spain by a single team.
            </p>
            <p className="text-text-muted/70 italic mb-8">
              {t(
                "Trae tu IA a casa. Datacenter, hardware y cloud — diseñados en España.",
                "Trae tu IA a casa. Datacenter, hardware y cloud — diseñados en España."
              )}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="lg" className="rounded-full group">
                Start free
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="rounded-full border-border-dark text-white hover:bg-surface-dark hover:text-white">
                Book a DC tour
              </Button>
            </div>
          </div>

          {/* Mini Rack Illustration */}
          <div className="relative z-10 hidden md:block">
            <div className="w-48 h-32 bg-[#1b2627] rounded-xl border border-border-dark p-2 flex flex-col gap-1 shadow-2xl transform rotate-[-5deg] hover:rotate-[0deg] transition-transform duration-500">
               {Array.from({ length: 3 }).map((_, i) => (
                 <div key={i} className="flex-1 bg-surface-dark rounded border border-border-dark/50 flex items-center px-2 justify-between">
                    <div className="flex gap-1">
                      <div className="w-3 h-1 bg-bg-dark rounded-sm" />
                      <div className="w-3 h-1 bg-bg-dark rounded-sm" />
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_5px_var(--color-primary)]" style={{ animationDelay: `${i * 200}ms` }} />
                 </div>
               ))}
               <div className="h-2 mt-auto flex items-center justify-between px-1">
                 <div className="text-[6px] text-text-muted/50 font-mono tracking-widest">OLADC-AI</div>
               </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
