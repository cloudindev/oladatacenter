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
        categoryEn="Company"
        categoryEs="Empresa"
        titleEn="Sustainability"
        titleEs="Sostenibilidad"
        subtitleEn="Committed to a greener and more efficient future."
        subtitleEs="Comprometidos con un futuro más verde y eficiente."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center gap-12 mb-20">
            <div className="flex-1">
              <h2 className="text-4xl font-normal text-text-base mb-6">{t("Zero Carbon Cloud", "Cloud Cero Carbono")}</h2>
              <p className="text-lg text-text-muted mb-6 leading-relaxed">
                {t("Data centers are massive consumers of energy. At OLA, we take this responsibility seriously. All our facilities are powered by 100% certified renewable energy (solar and wind) generated locally in Spain.", "Los datacenters son consumidores masivos de energía. En OLA nos tomamos esta responsabilidad en serio. Todas nuestras instalaciones funcionan con energía 100% renovable certificada (solar y eólica) generada localmente en España.")}
              </p>
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <span className="text-xl">🍃</span> {t("PUE (Power Usage Effectiveness) of 1.15", "PUE (Efectividad de Uso de Energía) de 1.15")}
              </div>
            </div>
            <div className="w-full md:w-1/3 bg-white p-6 rounded-lg border border-border-base shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-green-100 rounded-bl-[100px] -mr-4 -mt-4"></div>
              <div className="text-5xl mb-4">☀️</div>
              <div className="text-3xl font-medium text-text-base mb-1">100%</div>
              <div className="text-text-muted text-sm">{t("Green Energy Guarantees of Origin (GdO)", "Garantías de Origen Renovable (GdO)")}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-lg border border-border-base">
              <h3 className="text-xl font-medium text-text-base mb-4">{t("Advanced Cooling", "Refrigeración Avanzada")}</h3>
              <p className="text-text-muted">{t("We utilize direct-to-chip liquid cooling for our high-density AI nodes, drastically reducing the energy needed to cool the datacenter compared to traditional air-blown rows.", "Utilizamos refrigeración líquida directa al chip para nuestros nodos de IA de alta densidad, reduciendo drásticamente la energía necesaria para enfriar el datacenter en comparación con las filas tradicionales de aire.")}</p>
            </div>
            <div className="bg-white p-8 rounded-lg border border-border-base">
              <h3 className="text-xl font-medium text-text-base mb-4">{t("Hardware Lifecycle", "Ciclo de Vida del Hardware")}</h3>
              <p className="text-text-muted">{t("Our servers are designed for longevity. We implement rigorous recycling and circular economy practices for all decommissioned silicon and metals.", "Nuestros servidores están diseñados para durar. Implementamos prácticas rigurosas de reciclaje y economía circular para todo el silicio y metales fuera de servicio.")}</p>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
