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
        categoryEn="Products"
        categoryEs="Productos"
        titleEn="All Products & Solutions"
        titleEs="Todos los Productos y Soluciones"
        subtitleEn="Explore our complete portfolio."
        subtitleEs="Explora nuestro portfolio completo."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center text-xl">🏢</div>
                <h2 className="text-3xl font-bold text-text-base">Datacenter</h2>
              </div>
              <ul className="space-y-4">
                <li><a href="/datacenter/colocation" className="block bg-white p-6 rounded-xl border border-border-base hover:border-primary transition-colors shadow-sm">
                  <h3 className="font-bold text-lg mb-1">{t("Colocation", "Colocation")}</h3>
                  <p className="text-text-muted text-sm">{t("Rack space in Tier III facilities.", "Espacio en rack en instalaciones Tier III.")}</p>
                </a></li>
                <li><a href="/datacenter/bare-metal" className="block bg-white p-6 rounded-xl border border-border-base hover:border-primary transition-colors shadow-sm">
                  <h3 className="font-bold text-lg mb-1">{t("Bare Metal Servers", "Servidores Bare Metal")}</h3>
                  <p className="text-text-muted text-sm">{t("Dedicated C1 and C2 nodes.", "Nodos dedicados C1 y C2.")}</p>
                </a></li>
                <li><a href="/datacenter/ai-servers" className="block bg-white p-6 rounded-xl border border-border-base hover:border-primary transition-colors shadow-sm">
                  <h3 className="font-bold text-lg mb-1">{t("AI Servers", "Servidores IA")}</h3>
                  <p className="text-text-muted text-sm">{t("NVIDIA H100 clusters.", "Clústeres NVIDIA H100.")}</p>
                </a></li>
              </ul>
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">☁️</div>
                <h2 className="text-3xl font-bold text-text-base">Cloud</h2>
              </div>
              <ul className="space-y-4">
                <li><a href="/cloud/compute" className="block bg-white p-6 rounded-xl border border-border-base hover:border-blue-500 transition-colors shadow-sm">
                  <h3 className="font-bold text-lg mb-1">{t("Compute Instances", "Instancias de Cómputo")}</h3>
                  <p className="text-text-muted text-sm">{t("Scalable virtual machines.", "Máquinas virtuales escalables.")}</p>
                </a></li>
                <li><a href="/cloud/storage" className="block bg-white p-6 rounded-xl border border-border-base hover:border-blue-500 transition-colors shadow-sm">
                  <h3 className="font-bold text-lg mb-1">{t("Object Storage", "Object Storage")}</h3>
                  <p className="text-text-muted text-sm">{t("S3-compatible scalable storage.", "Almacenamiento escalable compatible con S3.")}</p>
                </a></li>
                <li><a href="/cloud/ai" className="block bg-white p-6 rounded-xl border border-border-base hover:border-blue-500 transition-colors shadow-sm">
                  <h3 className="font-bold text-lg mb-1">{t("AI Cloud", "Cloud IA")}</h3>
                  <p className="text-text-muted text-sm">{t("Distributed training & inference.", "Entrenamiento e inferencia distribuidos.")}</p>
                </a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
