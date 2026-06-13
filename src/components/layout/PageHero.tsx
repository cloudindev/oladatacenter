"use client"

import React from "react"
import { useLanguage } from "@/context/LanguageContext"

interface PageHeroProps {
  categoryEn: string
  categoryEs: string
  titleEn: string
  titleEs: string
  subtitleEn: string
  subtitleEs: string
}

export function PageHero({
  categoryEn,
  categoryEs,
  titleEn,
  titleEs,
  subtitleEn,
  subtitleEs,
}: PageHeroProps) {
  const { t } = useLanguage()

  return (
    <section className="bg-bg-dark pt-32 pb-24 border-b border-border-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-bg-dark to-bg-dark pointer-events-none" />
      </div>
      
      <div className="container mx-auto px-4 relative z-10 max-w-4xl">
        <div className="text-primary text-xs font-bold tracking-widest uppercase mb-6">
          {t(categoryEn, categoryEs)}
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.1] mb-6">
          {t(titleEn, titleEs)}
        </h1>
        
        <p className="text-lg md:text-xl text-white/60 leading-relaxed max-w-2xl">
          {t(subtitleEn, subtitleEs)}
        </p>
      </div>
    </section>
  )
}
