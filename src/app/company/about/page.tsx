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
        titleEn="About OLA"
        titleEs="Sobre OLA"
        subtitleEn="Building the next generation of cloud infrastructure from Europe."
        subtitleEs="Construyendo la próxima generación de infraestructura cloud desde Europa."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-text-base mb-6">{t("Our Mission", "Nuestra Misión")}</h2>
          <p className="text-xl text-text-muted leading-relaxed mb-16">
            {t("To democratize access to high-performance AI computing while maintaining absolute data sovereignty for European businesses.", "Democratizar el acceso a computación de IA de alto rendimiento manteniendo la absoluta soberanía de datos para las empresas europeas.")}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left mb-16">
            <div className="bg-white border border-border-base p-8 rounded-2xl shadow-sm">
              <h3 className="text-xl font-bold text-primary mb-4">{t("Sovereignty First", "Soberanía Primero")}</h3>
              <p className="text-text-muted">{t("100% European capital. Our datacenters are physically located in Spain, fully compliant with GDPR and ENS Alto frameworks. Your data never leaves our borders unless you tell it to.", "Capital 100% europeo. Nuestros datacenters están físicamente ubicados en España, cumpliendo totalmente con RGPD y ENS Alto. Tus datos nunca salen de nuestras fronteras a menos que tú lo decidas.")}</p>
            </div>
            <div className="bg-white border border-border-base p-8 rounded-2xl shadow-sm">
              <h3 className="text-xl font-bold text-primary mb-4">{t("Innovation Core", "Núcleo de Innovación")}</h3>
              <p className="text-text-muted">{t("We build our own hardware, write our own virtualization stack, and lay our own fiber. This vertical integration allows us to deliver unmatched performance and pricing.", "Construimos nuestro propio hardware, escribimos nuestra propia capa de virtualización y tendemos nuestra propia fibra. Esta integración vertical nos permite ofrecer un rendimiento y precios inigualables.")}</p>
            </div>
          </div>
          
          <div className="bg-bg-dark text-white rounded-2xl p-12 border border-border-dark">
            <h3 className="text-2xl font-bold mb-8">{t("OLA by the numbers", "OLA en cifras")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-4xl font-bold text-primary mb-2">2</div>
                <div className="text-white/60 text-sm uppercase tracking-wider">{t("Datacenters", "Datacenters")}</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">100%</div>
                <div className="text-white/60 text-sm uppercase tracking-wider">{t("Renewable", "Renovable")}</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">&lt;2ms</div>
                <div className="text-white/60 text-sm uppercase tracking-wider">{t("Latency in ES", "Latencia en ES")}</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">24/7</div>
                <div className="text-white/60 text-sm uppercase tracking-wider">{t("Support", "Soporte")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
