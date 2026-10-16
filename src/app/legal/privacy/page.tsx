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
        categoryEn="Legal"
        categoryEs="Legal"
        titleEn="Privacy Policy"
        titleEs="Política de Privacidad"
        subtitleEn="How we protect your data."
        subtitleEs="Cómo protegemos tus datos."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-3xl">
          <div className="bg-white border border-border-base rounded-lg p-8 md:p-12 shadow-sm prose prose-slate max-w-none">
            <h2 className="text-2xl font-normal text-text-base mb-6">{t("1. Introduction", "1. Introducción")}</h2>
            <p className="text-text-muted mb-6">
              {t("OLA Datacenter respects your privacy and is committed to protecting your personal data. This privacy policy informs you as to how we look after your personal data in accordance with the General Data Protection Regulation (GDPR) (EU) 2016/679.", "OLA Datacenter respeta tu privacidad y se compromete a proteger tus datos personales. Esta política de privacidad te informa sobre cómo cuidamos tus datos personales de acuerdo con el Reglamento General de Protección de Datos (RGPD) (UE) 2016/679.")}
            </p>
            
            <h2 className="text-2xl font-normal text-text-base mb-6 mt-10">{t("2. The Data We Collect", "2. Los Datos que Recopilamos")}</h2>
            <p className="text-text-muted mb-4">
              {t("We may collect, use, store and transfer different kinds of personal data about you:", "Podemos recopilar, usar, almacenar y transferir diferentes tipos de datos personales sobre ti:")}
            </p>
            <ul className="list-disc pl-6 text-text-muted mb-6 space-y-2">
              <li>{t("Identity Data (first name, last name, username)", "Datos de Identidad (nombre, apellidos, nombre de usuario)")}</li>
              <li>{t("Contact Data (billing address, email address, telephone numbers)", "Datos de Contacto (dirección de facturación, email, teléfonos)")}</li>
              <li>{t("Financial Data (payment card details - securely processed via Stripe)", "Datos Financieros (detalles de tarjeta de pago - procesados de forma segura a través de Stripe)")}</li>
              <li>{t("Technical Data (IP address, login data, browser type)", "Datos Técnicos (dirección IP, datos de inicio de sesión, tipo de navegador)")}</li>
            </ul>

            <h2 className="text-2xl font-normal text-text-base mb-6 mt-10">{t("3. Data Sovereignty", "3. Soberanía de Datos")}</h2>
            <p className="text-text-muted mb-6">
              {t("As a core principle of OLA, customer workloads and storage buckets reside strictly within the geographical boundaries of the data centers you select. For EU clients choosing Spain, your data never leaves the European Economic Area.", "Como principio fundamental de OLA, las cargas de trabajo y los buckets de almacenamiento de los clientes residen estrictamente dentro de los límites geográficos de los datacenters que elijas. Para los clientes de la UE que eligen España, tus datos nunca salen del Espacio Económico Europeo.")}
            </p>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
