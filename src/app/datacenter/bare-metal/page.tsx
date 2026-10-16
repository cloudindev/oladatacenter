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
        categoryEn="Datacenter"
        categoryEs="Datacenter"
        titleEn="Bare Metal"
        titleEs="Bare Metal"
        subtitleEn="Dedicated servers with maximum control and performance."
        subtitleEs="Servidores dedicados con máximo control y rendimiento."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-normal text-text-base mb-4">{t("Raw performance, no noisy neighbors.", "Rendimiento puro, sin vecinos ruidosos.")}</h2>
            <p className="text-text-muted text-lg">{t("Gain root access to single-tenant dedicated hardware. Automated provisioning gets your server online in less than 5 minutes.", "Obtén acceso root a hardware dedicado de inquilino único. El aprovisionamiento automatizado pone tu servidor en línea en menos de 5 minutos.")}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* C1 Server */}
            <div className="bg-white rounded-lg border border-border-base shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
              
              <div className="w-full bg-[#e7e8e1] border-b border-border-base/10">
                <img src="/oladc-server.jpg" alt="OLADC C1" className="w-full h-auto object-cover mix-blend-multiply" />
              </div>

              <div className="p-8 flex flex-col flex-grow">
                <div className="mb-8">
                  <span className="text-text-muted text-xs font-medium uppercase tracking-widest">{t("1U Entry Level", "1U Nivel de Entrada")}</span>
                  <h3 className="text-2xl font-medium text-text-base mt-1">OLADC C1</h3>
                </div>
                
                <div className="space-y-4 flex-grow">
                  <div className="bg-bg-light rounded-lg p-4 flex justify-between">
                    <span className="text-text-muted font-medium">CPU</span>
                    <span className="text-text-base font-medium">EPYC 4565P</span>
                  </div>
                  <div className="bg-bg-light rounded-lg p-4 flex justify-between">
                    <span className="text-text-muted font-medium">RAM</span>
                    <span className="text-text-base font-medium">192GB</span>
                  </div>
                  <div className="bg-bg-light rounded-lg p-4 flex justify-between">
                    <span className="text-text-muted font-medium">Storage</span>
                    <span className="text-text-base font-medium">2x4TB U.3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* C2 Server */}
            <div className="bg-white rounded-lg border border-border-base shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
              
              <div className="w-full bg-[#e7e8e1] border-b border-border-base/10">
                <img src="/oladc-server.jpg" alt="OLADC C2" className="w-full h-auto object-cover mix-blend-multiply" />
              </div>

              <div className="p-8 flex flex-col flex-grow">
                <div className="mb-8">
                  <span className="text-text-muted text-xs font-medium uppercase tracking-widest">{t("2U High Density", "2U Alta Densidad")}</span>
                  <h3 className="text-2xl font-medium text-text-base mt-1">OLADC C2</h3>
                </div>

                <div className="space-y-4 flex-grow">
                  <div className="bg-bg-light rounded-lg p-4 flex justify-between">
                    <span className="text-text-muted font-medium">CPU</span>
                    <span className="text-text-base font-medium">EPYC 4565P</span>
                  </div>
                  <div className="bg-bg-light rounded-lg p-4 flex justify-between">
                    <span className="text-text-muted font-medium">RAM</span>
                    <span className="text-text-base font-medium">192GB</span>
                  </div>
                  <div className="bg-bg-light rounded-lg p-4 flex justify-between">
                    <span className="text-text-muted font-medium">Storage</span>
                    <span className="text-text-base font-medium">24TB útiles</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
