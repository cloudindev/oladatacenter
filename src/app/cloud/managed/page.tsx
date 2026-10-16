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
        titleEn="Managed Solutions"
        titleEs="Soluciones Gestionadas"
        subtitleEn="End-to-end management for your critical infrastructure."
        subtitleEs="Gestión integral para tu infraestructura crítica."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
          <div className="w-20 h-20 bg-primary/20 text-accent-ink rounded-lg flex items-center justify-center text-3xl mx-auto mb-8">
            🛠️
          </div>
          <h2 className="text-3xl md:text-4xl font-normal text-text-base mb-6">{t("Your extended Cloud operations team.", "Tu equipo extendido de operaciones Cloud.")}</h2>
          <p className="text-xl text-text-muted mb-12">
            {t("Let OLA Cloud certified architects and engineers handle the day-to-day operations of your environment so you can focus on innovation.", "Deja que los arquitectos e ingenieros certificados de OLA Cloud manejen las operaciones diarias de tu entorno para que puedas centrarte en la innovación.")}
          </p>
          
          <div className="text-left space-y-6">
            <div className="bg-white border border-border-base rounded-lg p-6 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-xl shrink-0">🏛️</div>
              <div>
                <h4 className="font-medium text-text-base text-lg">{t("Architecture & Migration", "Arquitectura y Migración")}</h4>
                <p className="text-text-muted">{t("We design highly available, cost-optimized architectures and seamlessly migrate your legacy systems to OLA Cloud.", "Diseñamos arquitecturas altamente disponibles y optimizadas en costes, y migramos sin problemas tus sistemas heredados a OLA Cloud.")}</p>
              </div>
            </div>
            <div className="bg-white border border-border-base rounded-lg p-6 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-lg flex items-center justify-center text-xl shrink-0">🛡️</div>
              <div>
                <h4 className="font-medium text-text-base text-lg">{t("Security & Compliance", "Seguridad y Cumplimiento")}</h4>
                <p className="text-text-muted">{t("Continuous vulnerability scanning, WAF configuration, and regular audits to ensure SOC2, PCI-DSS, and GDPR compliance.", "Escaneo continuo de vulnerabilidades, configuración WAF y auditorías regulares para asegurar cumplimiento SOC2, PCI-DSS y RGPD.")}</p>
              </div>
            </div>
            <div className="bg-white border border-border-base rounded-lg p-6 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-xl shrink-0">📈</div>
              <div>
                <h4 className="font-medium text-text-base text-lg">{t("24/7 SRE & Incident Response", "SRE 24/7 y Respuesta a Incidentes")}</h4>
                <p className="text-text-muted">{t("Our Site Reliability Engineers monitor your logs and metrics 24/7, resolving incidents before your users even notice.", "Nuestros Site Reliability Engineers monitorizan tus logs y métricas 24/7, resolviendo incidentes antes de que tus usuarios lo noten.")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
