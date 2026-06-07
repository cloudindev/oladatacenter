"use client"

import * as React from "react"
import { useLanguage } from "@/context/LanguageContext"
import { SectionLabel } from "@/components/ui/SectionLabel"

export function PromiseSection() {
  const { t } = useLanguage()

  return (
    <section className="bg-bg-dark text-text-dark py-24 md:py-32 relative overflow-hidden">
      {/* Subtle Cyan Curve Decorator */}
      <div className="absolute top-0 right-0 w-1/2 h-px bg-gradient-to-l from-transparent via-primary/50 to-transparent opacity-50" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10 max-w-5xl">
        <SectionLabel className="text-primary/80 mb-8">THE OLA DC PROMISE</SectionLabel>
        
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-medium tracking-tight text-white mb-8 leading-tight">
          From enterprise AI to data sovereignty — <span className="text-primary italic">your clouds, data and AI workloads</span> work as one. Privately.
        </h2>
        
        <p className="text-lg md:text-xl text-text-muted italic max-w-3xl">
          {t(
            "De la IA empresarial a la soberanía del dato: tu cloud, tus datos y tus cargas de IA, una sola arquitectura — privada.",
            "De la IA empresarial a la soberanía del dato: tu cloud, tus datos y tus cargas de IA, una sola arquitectura — privada."
          )}
        </p>
      </div>
    </section>
  )
}
