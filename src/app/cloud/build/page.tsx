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
        titleEn="Build"
        titleEs="Construcción"
        subtitleEn="Tools to build cloud-native applications faster."
        subtitleEs="Herramientas para construir aplicaciones cloud-native más rápido."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
            {t("DEVELOPER PREVIEW", "VISTA PREVIA PARA DESARROLLADORES")}
          </div>
          <h2 className="text-4xl font-normal text-text-base mb-6">{t("Focus on code, not infrastructure.", "Concéntrate en el código, no en la infraestructura.")}</h2>
          <p className="text-xl text-text-muted mb-16">{t("OLA Build provides serverless CI/CD, managed container registries, and edge function deployments.", "OLA Build proporciona CI/CD serverless, registros de contenedores gestionados y despliegues de funciones edge.")}</p>
          
          <div className="bg-bg-dark rounded-lg p-8 border border-border-dark text-left relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h3 className="text-xl font-medium text-white mb-2">{t("OLA App Platform", "Plataforma de Apps OLA")}</h3>
                <p className="text-white/60 mb-6">{t("Connect your GitHub repository and we will automatically build, deploy, and scale your web applications globally.", "Conecta tu repositorio de GitHub y nosotros construiremos, desplegaremos y escalaremos automáticamente tus aplicaciones web a nivel global.")}</p>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-[#1e293b] rounded flex items-center justify-center border border-white/10 text-white font-medium text-xs">React</div>
                  <div className="w-10 h-10 bg-[#1e293b] rounded flex items-center justify-center border border-white/10 text-white font-medium text-xs">Node</div>
                  <div className="w-10 h-10 bg-[#1e293b] rounded flex items-center justify-center border border-white/10 text-white font-medium text-xs">Go</div>
                  <div className="w-10 h-10 bg-[#1e293b] rounded flex items-center justify-center border border-white/10 text-white font-medium text-xs">Python</div>
                </div>
              </div>
              <div className="bg-black/50 border border-white/10 rounded-lg p-4 font-mono text-sm text-green-400 w-full md:w-auto min-w-[300px]">
                <div className="text-white/40 mb-2">$ ola app deploy</div>
                <div>&gt; Building container... DONE</div>
                <div>&gt; Pushing to registry... DONE</div>
                <div>&gt; Provisioning route... DONE</div>
                <div className="text-white mt-2">Deployed to: <span className="text-blue-400 underline cursor-pointer">https://app-q2x9.olacloud.app</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
