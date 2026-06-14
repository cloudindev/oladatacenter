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
        titleEn="AI Cloud"
        titleEs="Cloud IA"
        subtitleEn="The platform for your intelligent applications."
        subtitleEs="La plataforma para tus aplicaciones inteligentes."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-text-base mb-6">{t("Train and deploy at scale.", "Entrena y despliega a gran escala.")}</h2>
            <p className="text-lg text-text-muted">{t("Our AI Cloud is purpose-built to accelerate machine learning workloads. Access thousands of GPUs instantly via API and scale your training jobs with high-throughput distributed storage.", "Nuestro Cloud IA está diseñado para acelerar las cargas de trabajo de machine learning. Accede a miles de GPUs al instante vía API y escala tus trabajos de entrenamiento con almacenamiento distribuido de alto rendimiento.")}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="bg-surface-dark text-white rounded-3xl p-10 border border-border-dark relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <h3 className="text-2xl font-bold mb-4">{t("Training Clusters", "Clústeres de Entrenamiento")}</h3>
              <p className="text-white/70 mb-8">{t("Bare-metal performance with cloud flexibility. Spin up interconnected H100 nodes with a single command.", "Rendimiento bare-metal con flexibilidad cloud. Despliega nodos H100 interconectados con un solo comando.")}</p>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-2 text-sm text-white/80"><span className="text-primary">✓</span> NVIDIA Quantum-2 InfiniBand</li>
                <li className="flex gap-2 text-sm text-white/80"><span className="text-primary">✓</span> WEKA parallel file system</li>
                <li className="flex gap-2 text-sm text-white/80"><span className="text-primary">✓</span> Slurm & Kubernetes integrations</li>
              </ul>
            </div>
            
            <div className="bg-white rounded-3xl p-10 border border-border-base shadow-sm">
              <h3 className="text-2xl font-bold text-text-base mb-4">{t("Inference APIs", "APIs de Inferencia")}</h3>
              <p className="text-text-muted mb-8">{t("Deploy your models globally with auto-scaling inference endpoints. Pay only for the tokens or requests you process.", "Despliega tus modelos globalmente con endpoints de inferencia auto-escalables. Paga solo por los tokens o peticiones que proceses.")}</p>
              <ul className="space-y-3 mb-8">
                <li className="flex gap-2 text-sm text-text-muted"><span className="text-primary font-bold">✓</span> Triton Inference Server</li>
                <li className="flex gap-2 text-sm text-text-muted"><span className="text-primary font-bold">✓</span> Serverless GPU scaling (Scale to zero)</li>
                <li className="flex gap-2 text-sm text-text-muted"><span className="text-primary font-bold">✓</span> Sub-millisecond routing</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
