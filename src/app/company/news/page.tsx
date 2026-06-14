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
        titleEn="News"
        titleEs="Noticias"
        subtitleEn="Latest updates and announcements."
        subtitleEs="Últimas actualizaciones y anuncios."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-4xl">
          <div className="space-y-12">
            <article className="bg-white rounded-2xl overflow-hidden border border-border-base shadow-sm hover:shadow-md transition-shadow">
              <div className="p-8">
                <div className="text-primary text-sm font-bold tracking-wider uppercase mb-3">May 15, 2026</div>
                <h3 className="text-2xl font-bold text-text-base mb-4 cursor-pointer hover:text-primary transition-colors">
                  {t("OLA Datacenter acquires 500 new NVIDIA H100 GPUs to expand AI Cloud capacity", "OLA Datacenter adquiere 500 nuevas GPUs NVIDIA H100 para expandir la capacidad del Cloud IA")}
                </h3>
                <p className="text-text-muted leading-relaxed mb-6">
                  {t("To meet the soaring demand for generative AI training from European enterprises, OLA has successfully deployed an additional 500 H100 GPUs inside our MAD1 facility, interconnected via 400Gbps InfiniBand.", "Para satisfacer la creciente demanda de entrenamiento de IA generativa por parte de las empresas europeas, OLA ha desplegado con éxito 500 GPUs H100 adicionales en nuestra instalación MAD1, interconectadas mediante InfiniBand de 400Gbps.")}
                </p>
                <button className="text-primary font-bold hover:underline">{t("Read Full Press Release →", "Leer Nota de Prensa Completa →")}</button>
              </div>
            </article>
            
            <article className="bg-white rounded-2xl overflow-hidden border border-border-base shadow-sm hover:shadow-md transition-shadow">
              <div className="p-8">
                <div className="text-primary text-sm font-bold tracking-wider uppercase mb-3">March 2, 2026</div>
                <h3 className="text-2xl font-bold text-text-base mb-4 cursor-pointer hover:text-primary transition-colors">
                  {t("OLA achieves ENS Alto Certification", "OLA obtiene la Certificación ENS Alto")}
                </h3>
                <p className="text-text-muted leading-relaxed mb-6">
                  {t("We are proud to announce that our infrastructure has been certified with the Esquema Nacional de Seguridad (ENS) at the 'Alto' (High) level, reaffirming our commitment to the highest security standards for public administration workloads.", "Nos enorgullece anunciar que nuestra infraestructura ha sido certificada con el Esquema Nacional de Seguridad (ENS) en el nivel 'Alto', reafirmando nuestro compromiso con los más altos estándares de seguridad para cargas de la administración pública.")}
                </p>
                <button className="text-primary font-bold hover:underline">{t("Read Full Press Release →", "Leer Nota de Prensa Completa →")}</button>
              </div>
            </article>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
