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
        titleEn="On-premise Cloud"
        titleEs="Cloud On-premise"
        subtitleEn="Bring the cloud experience to your own datacenter."
        subtitleEs="Lleva la experiencia cloud a tu propio datacenter."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-text-base mb-6 max-w-3xl mx-auto">
            {t("Cloud computing, delivered to your edge.", "Cloud computing, entregado en tu edge.")}
          </h2>
          <p className="text-xl text-text-muted mb-16 max-w-2xl mx-auto">
            {t("Get the agility and scalability of public cloud with the security and latency benefits of keeping your hardware on-premises.", "Obtén la agilidad y escalabilidad de la nube pública con los beneficios de seguridad y latencia de mantener tu hardware en local.")}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="bg-white border border-border-base/50 rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-text-base mb-4">{t("Deploy Anywhere", "Despliega en Cualquier Lugar")}</h3>
              <p className="text-text-muted leading-relaxed">{t("We ship and install our proprietary cloud racks directly to your office, factory floor, or regional datacenter.", "Enviamos e instalamos nuestros racks cloud propietarios directamente a tu oficina, fábrica o datacenter regional.")}</p>
            </div>
            <div className="bg-white border border-border-base/50 rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-text-base mb-4">{t("Fully Managed", "Totalmente Gestionado")}</h3>
              <p className="text-text-muted leading-relaxed">{t("We monitor, patch, and manage the hardware and virtualization layer 24/7. You just consume APIs.", "Monitorizamos, parcheamos y gestionamos el hardware y la capa de virtualización 24/7. Tú solo consumes APIs.")}</p>
            </div>
            <div className="bg-white border border-border-base/50 rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-text-base mb-4">{t("Single Pane of Glass", "Panel Único")}</h3>
              <p className="text-text-muted leading-relaxed">{t("Manage your on-premise nodes through the exact same OLA Cloud console you use for our public regions.", "Gestiona tus nodos locales a través de la misma consola de OLA Cloud que usas para nuestras regiones públicas.")}</p>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
