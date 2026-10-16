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
        titleEn="Storage"
        titleEs="Almacenamiento"
        subtitleEn="Secure and redundant object and block storage."
        subtitleEs="Almacenamiento de objetos y bloques seguro y redundante."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="bg-white border border-border-base shadow-xl rounded-lg p-2 relative">
              <div className="bg-bg-light/50 rounded-xl p-8 text-center h-full flex flex-col items-center justify-center">
                <div className="w-24 h-24 mb-6 relative">
                  <div className="absolute inset-0 border-4 border-dashed border-accent-ink rounded-full animate-[spin_10s_linear_infinite]"></div>
                  <div className="absolute inset-2 bg-white shadow-sm rounded-full flex items-center justify-center">S3</div>
                </div>
                <h3 className="text-2xl font-medium text-text-base mb-2">{t("Object Storage", "Object Storage")}</h3>
                <p className="text-text-muted mb-6">{t("S3-compatible, ultra-durable storage for assets, backups, and AI datasets.", "Almacenamiento compatible con S3, ultra-duradero para assets, backups y datasets de IA.")}</p>
                <div className="bg-white border border-border-base rounded p-4 w-full">
                  <div className="text-xs text-text-muted uppercase tracking-wider mb-1">{t("Storage Cost", "Coste de Almacenamiento")}</div>
                  <div className="text-xl font-medium text-text-base">€0.015 / GB</div>
                  <div className="text-xs text-text-muted mt-2">{t("Zero egress fees between OLA Cloud regions", "Cero comisiones de salida entre regiones OLA Cloud")}</div>
                </div>
              </div>
            </div>
            
            <div>
              <h2 className="text-3xl font-normal text-text-base mb-6">{t("Block Storage Volumes", "Volúmenes de Block Storage")}</h2>
              <p className="text-lg text-text-muted mb-8 leading-relaxed">
                {t("Attach high-performance NVMe block storage to your compute instances. Perfect for databases and latency-sensitive applications requiring persistent, dedicated IOPS.", "Adjunta almacenamiento de bloques NVMe de alto rendimiento a tus instancias de cómputo. Perfecto para bases de datos y aplicaciones sensibles a la latencia que requieren IOPS persistentes y dedicadas.")}
              </p>
              
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">⚡</div>
                  <div>
                    <h4 className="font-medium text-text-base">{t("NVMe Standard", "Estándar NVMe")}</h4>
                    <p className="text-sm text-text-muted">{t("Up to 10,000 IOPS. Ideal for standard applications and boot volumes.", "Hasta 10.000 IOPS. Ideal para aplicaciones estándar y volúmenes de arranque.")}</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-accent-ink">🚀</div>
                  <div>
                    <h4 className="font-medium text-text-base">{t("NVMe Premium", "NVMe Premium")}</h4>
                    <p className="text-sm text-text-muted">{t("Up to 100,000 IOPS. Built for intensive I/O operations and massive databases.", "Hasta 100.000 IOPS. Construido para operaciones intensivas de I/O y bases de datos masivas.")}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
