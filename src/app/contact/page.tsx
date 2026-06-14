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
        categoryEn="Contact"
        categoryEs="Contacto"
        titleEn="Talk to an expert"
        titleEs="Habla con un experto"
        subtitleEn="We are here to help you design your infrastructure."
        subtitleEs="Estamos aquí para ayudarte a diseñar tu infraestructura."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-3xl font-bold text-text-base mb-6">{t("Get in touch", "Ponte en contacto")}</h2>
              <p className="text-lg text-text-muted mb-10">
                {t("Whether you need a single dedicated server or a custom AI cluster spanning multiple racks, our engineering team is ready to assist you.", "Ya sea que necesites un solo servidor dedicado o un clúster de IA a medida que abarque múltiples racks, nuestro equipo de ingeniería está listo para ayudarte.")}
              </p>
              
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-xl shrink-0">📍</div>
                  <div>
                    <h3 className="font-bold text-text-base text-lg">{t("Headquarters & Datacenter MAD1", "Sede y Datacenter MAD1")}</h3>
                    <p className="text-text-muted">Parque Empresarial La Finca<br />28223 Pozuelo de Alarcón<br />Madrid, Spain</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-xl shrink-0">✉️</div>
                  <div>
                    <h3 className="font-bold text-text-base text-lg">{t("Email Us", "Escríbenos")}</h3>
                    <p className="text-text-muted">
                      {t("Sales:", "Ventas:")} <a href="mailto:sales@oladc.es" className="text-teal-600 hover:underline">sales@oladc.es</a><br />
                      {t("Support:", "Soporte:")} <a href="mailto:support@oladc.es" className="text-teal-600 hover:underline">support@oladc.es</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-border-base shadow-lg p-8">
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-2">{t("First Name", "Nombre")}</label>
                    <input type="text" className="w-full bg-bg-light border border-border-base rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-base mb-2">{t("Last Name", "Apellidos")}</label>
                    <input type="text" className="w-full bg-bg-light border border-border-base rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-2">{t("Work Email", "Email del trabajo")}</label>
                  <input type="email" className="w-full bg-bg-light border border-border-base rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-base mb-2">{t("How can we help you?", "¿En qué podemos ayudarte?")}</label>
                  <textarea rows={4} className="w-full bg-bg-light border border-border-base rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>
                </div>
                <button className="w-full bg-bg-dark text-white font-bold py-4 rounded-xl hover:bg-black transition-colors">
                  {t("Send Message", "Enviar Mensaje")}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
