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
        categoryEn="Legal"
        categoryEs="Legal"
        titleEn="Terms of Service"
        titleEs="Aviso Legal y Condiciones"
        subtitleEn="Our rules and guidelines."
        subtitleEs="Nuestras normas y directrices."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-3xl">
          <div className="bg-white border border-border-base rounded-2xl p-8 md:p-12 shadow-sm prose prose-slate max-w-none">
            <p className="text-text-muted mb-8 italic">
              {t("Last updated: January 1, 2026", "Última actualización: 1 de Enero de 2026")}
            </p>
            
            <h2 className="text-2xl font-bold text-text-base mb-6">{t("1. Agreement to Terms", "1. Aceptación de las Condiciones")}</h2>
            <p className="text-text-muted mb-6">
              {t("These Terms of Service constitute a legally binding agreement made between you and OLA Datacenter concerning your access to and use of our cloud infrastructure and colocation services.", "Estas Condiciones de Servicio constituyen un acuerdo legalmente vinculante entre tú y OLA Datacenter respecto a tu acceso y uso de nuestra infraestructura cloud y servicios de colocation.")}
            </p>
            
            <h2 className="text-2xl font-bold text-text-base mb-6 mt-10">{t("2. Acceptable Use", "2. Uso Aceptable")}</h2>
            <p className="text-text-muted mb-4">
              {t("You agree not to use the Services to:", "Aceptas no utilizar los Servicios para:")}
            </p>
            <ul className="list-disc pl-6 text-text-muted mb-6 space-y-2">
              <li>{t("Host or distribute malware, phishing, or illegal content.", "Alojar o distribuir malware, phishing o contenido ilegal.")}</li>
              <li>{t("Conduct network scanning, DDoS attacks, or hacking.", "Realizar escaneos de red, ataques DDoS o hacking.")}</li>
              <li>{t("Mine cryptocurrencies without explicit written authorization.", "Minar criptomonedas sin autorización explícita por escrito.")}</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-base mb-6 mt-10">{t("3. Service Level Agreement (SLA)", "3. Acuerdo de Nivel de Servicio (SLA)")}</h2>
            <p className="text-text-muted mb-6">
              {t("OLA guarantees 99.982% uptime for its Tier III colocation services and 99.99% for Cloud compute instances. Compensation credits will be applied automatically if we fail to meet these metrics.", "OLA garantiza un 99.982% de tiempo de actividad para sus servicios de colocation Tier III y un 99.99% para las instancias de Cloud compute. Los créditos de compensación se aplicarán automáticamente si no cumplimos con estas métricas.")}
            </p>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
