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
        titleEn="Managed Hosting"
        titleEs="Hosting Gestionado"
        subtitleEn="Managed hosting solutions tailored to your business."
        subtitleEs="Soluciones de hosting gestionado adaptadas a tu negocio."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-text-base mb-8">{t("Focus on your business, we manage the servers.", "Concéntrate en tu negocio, nosotros gestionamos los servidores.")}</h2>
          
          <div className="bg-white rounded-2xl p-10 border border-border-base shadow-sm text-left">
            <h3 className="text-xl font-bold text-text-base mb-6 border-b pb-4">{t("Included in all managed plans:", "Incluido en todos los planes gestionados:")}</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <li className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span> {t("Proactive 24/7 monitoring", "Monitorización proactiva 24/7")}
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span> {t("Daily automated backups", "Copias de seguridad diarias automatizadas")}
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span> {t("OS patching & updates", "Parches y actualizaciones de SO")}
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span> {t("DDoS mitigation", "Mitigación DDoS")}
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span> {t("Dedicated Technical Account Manager", "Gestor Técnico de Cuentas dedicado")}
              </li>
              <li className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span> {t("Custom firewall rules", "Reglas de firewall personalizadas")}
              </li>
            </ul>
            
            <div className="mt-10 p-6 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-blue-800 text-center font-medium">
                {t("Contact our sales team to design a custom hosting architecture for your enterprise.", "Contacta con nuestro equipo de ventas para diseñar una arquitectura de hosting a medida para tu empresa.")}
              </p>
              <div className="mt-6 flex justify-center">
                <button className="bg-blue-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-blue-700 transition-colors">
                  {t("Talk to an expert", "Habla con un experto")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
