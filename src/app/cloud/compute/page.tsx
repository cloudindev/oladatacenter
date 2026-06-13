"use client"

import React from "react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { PageHero } from "@/components/layout/PageHero"
import { useLanguage } from "@/context/LanguageContext"

export default function Page() {
  const { t } = useLanguage()

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <PageHero 
        categoryEn="Cloud"
        categoryEs="Cloud"
        titleEn="Compute"
        titleEs="Cómputo"
        subtitleEn="Scalable compute instances for any workload."
        subtitleEs="Instancias de cómputo escalables para cualquier carga."
      />
      <div className="flex-1 container mx-auto px-4 py-24 max-w-4xl">
        <div className="bg-bg-light/50 border border-border-base/10 rounded-2xl p-12 text-center">
          <p className="text-bg-dark/50 text-lg font-medium">
            {t("This section is currently under development. Check back soon for updates.", "Esta sección se encuentra actualmente en desarrollo. Vuelve pronto para ver las actualizaciones.")}
          </p>
        </div>
      </div>
      <Footer />
    </main>
  )
}
