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
        titleEn="AI Servers"
        titleEs="Servidores IA"
        subtitleEn="High-performance GPU servers for AI workloads."
        subtitleEs="Servidores GPU de alto rendimiento para cargas de IA."
      />
      
      <div className="flex-1 bg-bg-dark text-white">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-6">
                {t("POWERED BY NVIDIA", "IMPULSADO POR NVIDIA")}
              </div>
              <h2 className="text-4xl md:text-5xl font-normal mb-6 tracking-tight">
                {t("Train LLMs faster than ever before.", "Entrena LLMs más rápido que nunca.")}
              </h2>
              <p className="text-white/70 text-lg mb-8 leading-relaxed">
                {t("Purpose-built clusters featuring up to 8x NVIDIA H100 Tensor Core GPUs per node, fully interconnected with NVSwitch and 400Gbps InfiniBand network fabrics.", "Clústeres diseñados a medida con hasta 8 GPUs NVIDIA H100 Tensor Core por nodo, totalmente interconectados con NVSwitch y redes InfiniBand de 400Gbps.")}
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-3xl font-medium text-primary mb-1">3.2 Tbps</div>
                  <div className="text-sm text-white/50">{t("Bisection Bandwidth", "Ancho de banda de bisección")}</div>
                </div>
                <div>
                  <div className="text-3xl font-medium text-primary mb-1">32 petaFLOPS</div>
                  <div className="text-sm text-white/50">{t("FP8 Deep Learning", "Aprendizaje profundo FP8")}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-[#2b3a3b] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col relative">
              <div className="absolute top-4 right-4 z-10">
                <span className="bg-primary text-[#2b3a3b] text-xs font-medium px-3 py-1 rounded-full uppercase tracking-wider">{t("Most Popular", "Más Popular")}</span>
              </div>
              
              <div className="w-full bg-[#e7e8e1] border-b border-white/10">
                <img src="/oladc-serverai.jpg" alt="OLADC AI1" className="w-full h-auto object-cover mix-blend-multiply" />
              </div>

              <div className="p-8 flex flex-col flex-grow">
                <h3 className="text-2xl font-medium mb-2">OLADC AI1</h3>
                <p className="text-white/50 text-sm mb-8">{t("Optimized for distributed training", "Optimizado para entrenamiento distribuido")}</p>
                
                <ul className="space-y-4 flex-grow">
                  <li className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/70">CPU</span>
                    <span className="font-medium text-right">EPYC 4585PX</span>
                  </li>
                  <li className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/70">RAM</span>
                    <span className="font-medium text-right">192GB</span>
                  </li>
                  <li className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/70">{t("Storage", "Almacenamiento")}</span>
                    <span className="font-medium text-right">2x4TB + 4 GPU</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
