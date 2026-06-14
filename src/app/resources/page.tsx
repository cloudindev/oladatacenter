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
        categoryEn="Resources"
        categoryEs="Recursos"
        titleEn="Resources & Documentation"
        titleEs="Recursos y Documentación"
        subtitleEn="Everything you need to build on OLA."
        subtitleEs="Todo lo que necesitas para construir en OLA."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <a href="#" className="bg-white border border-border-base p-8 rounded-2xl hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 group-hover:scale-110 transition-transform">📚</div>
              <h3 className="text-xl font-bold text-text-base mb-3">{t("Documentation", "Documentación")}</h3>
              <p className="text-text-muted text-sm">{t("Guides, tutorials, and concepts to help you get the most out of our platform.", "Guías, tutoriales y conceptos para ayudarte a sacar el máximo provecho de nuestra plataforma.")}</p>
            </a>
            
            <a href="#" className="bg-white border border-border-base p-8 rounded-2xl hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 group-hover:scale-110 transition-transform">🔌</div>
              <h3 className="text-xl font-bold text-text-base mb-3">{t("API Reference", "Referencia API")}</h3>
              <p className="text-text-muted text-sm">{t("Detailed endpoints, request formats, and responses for our REST API.", "Endpoints detallados, formatos de petición y respuestas de nuestra API REST.")}</p>
            </a>
            
            <a href="#" className="bg-white border border-border-base p-8 rounded-2xl hover:shadow-lg transition-shadow text-center group">
              <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 group-hover:scale-110 transition-transform">💬</div>
              <h3 className="text-xl font-bold text-text-base mb-3">{t("Community Forum", "Foro de la Comunidad")}</h3>
              <p className="text-text-muted text-sm">{t("Connect with other developers, ask questions, and share what you've built.", "Conecta con otros desarrolladores, haz preguntas y comparte lo que has construido.")}</p>
            </a>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
