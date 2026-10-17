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
        titleEn="Colocation"
        titleEs="Colocation"
        subtitleEn="Secure and reliable colocation services in our Tier III facilities."
        subtitleEs="Servicios de colocation seguros y fiables en nuestras instalaciones Tier III."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
            <div>
              <h2 className="text-3xl font-normal text-text-base mb-6">{t("World-class infrastructure for your IT assets.", "Infraestructura de clase mundial para tus activos TI.")}</h2>
              <p className="text-lg text-text-muted mb-6 leading-relaxed">
                {t("Our colocation services provide a secure, highly connected, and resilient environment for your mission-critical hardware. By leveraging our state-of-the-art Tier III facilities, you can reduce capital expenditures while ensuring maximum uptime and performance.", "Nuestros servicios de colocation proporcionan un entorno seguro, altamente conectado y resiliente para tu hardware de misión crítica. Al aprovechar nuestras instalaciones Tier III de última generación, puedes reducir los gastos de capital mientras aseguras el máximo tiempo de actividad y rendimiento.")}
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-accent-ink mt-0.5">✓</div>
                  <span className="text-text-base">{t("100% renewable energy powered.", "Impulsado por energía 100% renovable.")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-accent-ink mt-0.5">✓</div>
                  <span className="text-text-base">{t("Carrier-neutral with multiple dark fiber routes.", "Operador neutral con múltiples rutas de fibra oscura.")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-accent-ink mt-0.5">✓</div>
                  <span className="text-text-base">{t("24/7/365 physical security and on-site remote hands.", "Seguridad física 24/7/365 y manos remotas in situ.")}</span>
                </li>
              </ul>
            </div>
            <div className="bg-surface-dark rounded-lg border border-border-dark p-8 flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
              <div className="grid grid-cols-3 gap-4 w-full opacity-80">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="h-16 bg-[#3a4b4c] rounded-lg border border-white/5 flex items-center justify-between px-3">
                    <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><div className="w-2 h-2 rounded-full bg-blue-500" /></div>
                    <div className="w-8 h-1 bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <h3 className="text-2xl font-medium text-text-base mb-10 text-center">{t("Facilities Built for the Future", "Instalaciones Construidas para el Futuro")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-border-base/50">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-6 text-2xl">⚡</div>
              <h4 className="text-xl font-medium text-text-base mb-3">{t("Power & Cooling", "Energía y Refrigeración")}</h4>
              <p className="text-text-muted">{t("Up to 40kW per rack for high-density deployments. N+1 cooling and 2N UPS redundancy.", "Hasta 40kW por rack para despliegues de alta densidad. Refrigeración N+1 y redundancia UPS 2N.")}</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm border border-border-base/50">
              <div className="w-12 h-12 bg-primary/50 rounded-xl flex items-center justify-center text-accent-ink mb-6 text-2xl">🔒</div>
              <h4 className="text-xl font-medium text-text-base mb-3">{t("Physical Security", "Seguridad Física")}</h4>
              <p className="text-text-muted">{t("Biometric access control, mantrap entry, and perimeter fencing with 24/7 CCTV monitoring.", "Control de acceso biométrico, entrada con doble puerta y perímetro vallado con monitorización CCTV 24/7.")}</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm border border-border-base/50">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-6 text-2xl">🌐</div>
              <h4 className="text-xl font-medium text-text-base mb-3">{t("Interconnectivity", "Interconectividad")}</h4>
              <p className="text-text-muted">{t("Direct cross-connects to major cloud providers, IXPs, and over 50 global carriers.", "Conexiones cruzadas directas a los principales proveedores cloud, IXPs y más de 50 operadores globales.")}</p>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
