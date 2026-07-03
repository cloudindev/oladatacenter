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
        <SectionLabel className="text-primary/80 mb-8">{t("THE OLA DC PROMISE", "LA PROMESA OLA DC")}</SectionLabel>

        <h2 className="text-3xl md:text-5xl lg:text-6xl font-medium tracking-tight text-white mb-8 leading-tight">
          {t("From enterprise AI to data sovereignty — ", "De la IA empresarial a la soberanía del dato — ")}
          <span className="text-primary italic">{t("your clouds, data and AI workloads", "tus clouds, datos y cargas de IA")}</span>
          {t(" work as one. Privately.", " funcionan como uno. En privado.")}
        </h2>

        <p className="text-lg md:text-xl text-text-muted italic max-w-3xl">
          {t(
            "De la IA empresarial a la soberanía del dato: tu cloud, tus datos y tus cargas de IA, una sola arquitectura — privada.",
            "From enterprise AI to data sovereignty: your cloud, your data and your AI workloads, one architecture — private."
          )}
        </p>
      </div>
    </section>
  )
}
