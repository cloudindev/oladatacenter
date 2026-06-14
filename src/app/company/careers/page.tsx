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
        titleEn="Careers"
        titleEs="Carreras"
        subtitleEn="Join us to build the infrastructure of tomorrow."
        subtitleEs="Únete a nosotros para construir la infraestructura del mañana."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-text-base mb-6">{t("Open Positions", "Puestos Abiertos")}</h2>
          <p className="text-lg text-text-muted mb-16">{t("Help us build the next big thing in cloud computing. We are looking for talented engineers and visionaries.", "Ayúdanos a construir la próxima gran innovación en computación cloud. Buscamos ingenieros con talento y visión.")}</p>
          
          <div className="space-y-4 text-left">
            <div className="bg-white border border-border-base p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center hover:border-primary transition-colors cursor-pointer group shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-text-base mb-1 group-hover:text-primary transition-colors">Senior Network Engineer</h3>
                <div className="flex gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-1">📍 Madrid / Hybrid</span>
                  <span className="flex items-center gap-1">💼 Full-time</span>
                </div>
              </div>
              <button className="mt-4 md:mt-0 text-primary font-bold bg-primary/10 px-4 py-2 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">{t("Apply", "Aplicar")}</button>
            </div>
            
            <div className="bg-white border border-border-base p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center hover:border-primary transition-colors cursor-pointer group shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-text-base mb-1 group-hover:text-primary transition-colors">Golang Backend Developer</h3>
                <div className="flex gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-1">📍 Remote (Spain)</span>
                  <span className="flex items-center gap-1">💼 Full-time</span>
                </div>
              </div>
              <button className="mt-4 md:mt-0 text-primary font-bold bg-primary/10 px-4 py-2 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">{t("Apply", "Aplicar")}</button>
            </div>
            
            <div className="bg-white border border-border-base p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center hover:border-primary transition-colors cursor-pointer group shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-text-base mb-1 group-hover:text-primary transition-colors">Datacenter Technician (Tier III)</h3>
                <div className="flex gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-1">📍 Madrid (On-site)</span>
                  <span className="flex items-center gap-1">💼 Shifts / Full-time</span>
                </div>
              </div>
              <button className="mt-4 md:mt-0 text-primary font-bold bg-primary/10 px-4 py-2 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">{t("Apply", "Aplicar")}</button>
            </div>
          </div>
          
          <div className="mt-16 text-text-muted">
            {t("Don't see a role that fits? Send us your CV at ", "¿No ves un puesto que encaje? Envíanos tu CV a ")}
            <a href="mailto:talent@oladc.es" className="text-primary hover:underline">talent@oladc.es</a>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
