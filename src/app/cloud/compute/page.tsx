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
        titleEn="Compute"
        titleEs="Cómputo"
        subtitleEn="Scalable compute instances for any workload."
        subtitleEs="Instancias de cómputo escalables para cualquier carga."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 border border-border-base shadow-sm hover:shadow-md transition-shadow text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="text-2xl">⚡</div>
              </div>
              <h3 className="text-xl font-medium text-text-base mb-3">{t("General Purpose", "Propósito General")}</h3>
              <p className="text-text-muted mb-6 text-sm">{t("Balanced compute and memory. Ideal for web servers, microservices, and small databases.", "Cómputo y memoria balanceados. Ideal para servidores web, microservicios y bases de datos pequeñas.")}</p>
              <div className="font-medium text-text-base">{t("From €4 /mo", "Desde €4 /mes")}</div>
            </div>
            
            <div className="bg-white rounded-xl p-8 border border-border-base shadow-sm hover:shadow-md transition-shadow text-center relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-primary"></div>
              <div className="w-16 h-16 bg-primary/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="text-2xl">🧠</div>
              </div>
              <h3 className="text-xl font-medium text-text-base mb-3">{t("Compute Optimized", "Optimizado para Cómputo")}</h3>
              <p className="text-text-muted mb-6 text-sm">{t("High CPU-to-RAM ratio. Built for video encoding, batch processing, and CI/CD pipelines.", "Alta relación CPU-RAM. Diseñado para codificación de vídeo, procesamiento por lotes y pipelines CI/CD.")}</p>
              <div className="font-medium text-text-base">{t("From €15 /mo", "Desde €15 /mes")}</div>
            </div>
            
            <div className="bg-white rounded-xl p-8 border border-border-base shadow-sm hover:shadow-md transition-shadow text-center">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="text-2xl">💾</div>
              </div>
              <h3 className="text-xl font-medium text-text-base mb-3">{t("Memory Optimized", "Optimizado para Memoria")}</h3>
              <p className="text-text-muted mb-6 text-sm">{t("High RAM-to-CPU ratio. Perfect for in-memory caches (Redis/Memcached) and large databases.", "Alta relación RAM-CPU. Perfecto para cachés en memoria (Redis/Memcached) y grandes bases de datos.")}</p>
              <div className="font-medium text-text-base">{t("From €24 /mo", "Desde €24 /mes")}</div>
            </div>
          </div>
          
          <div className="mt-16 bg-surface-dark text-white rounded-lg p-8 border border-border-dark flex flex-col md:flex-row items-center justify-between">
            <div>
              <h4 className="text-lg font-medium mb-2">{t("Need Kubernetes?", "¿Necesitas Kubernetes?")}</h4>
              <p className="text-white/60">{t("Deploy fully managed K8s clusters using these instance types seamlessly.", "Despliega clústeres de K8s totalmente gestionados usando estos tipos de instancias de forma transparente.")}</p>
            </div>
            <button className="mt-6 md:mt-0 px-6 py-2 bg-white text-bg-dark font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap">
              {t("Explore OLA Kubernetes Engine", "Explorar OLA Kubernetes Engine")}
            </button>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
