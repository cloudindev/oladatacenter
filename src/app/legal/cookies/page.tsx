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
        titleEn="Cookie Policy"
        titleEs="Política de Cookies"
        subtitleEn="Information about how we use cookies."
        subtitleEs="Información sobre cómo usamos las cookies."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-3xl">
          <div className="bg-white border border-border-base rounded-2xl p-8 md:p-12 shadow-sm prose prose-slate max-w-none">
            <h2 className="text-2xl font-bold text-text-base mb-6">{t("What are cookies?", "¿Qué son las cookies?")}</h2>
            <p className="text-text-muted mb-6">
              {t("Cookies are small text files that are used to store small pieces of information. They are stored on your device when the website is loaded on your browser. These cookies help us make the website function properly, make it more secure, and provide better user experience.", "Las cookies son pequeños archivos de texto que se utilizan para almacenar pequeños fragmentos de información. Se almacenan en tu dispositivo cuando el sitio web se carga en tu navegador. Estas cookies nos ayudan a hacer que el sitio web funcione correctamente, hacerlo más seguro y proporcionar una mejor experiencia de usuario.")}
            </p>
            
            <h2 className="text-2xl font-bold text-text-base mb-6 mt-10">{t("How do we use cookies?", "¿Cómo usamos las cookies?")}</h2>
            <ul className="list-disc pl-6 text-text-muted mb-6 space-y-4">
              <li>
                <strong>{t("Essential:", "Esenciales:")}</strong> {t("Some cookies are essential for you to be able to experience the full functionality of our site (e.g., keeping you logged into the OLA Cloud Console).", "Algunas cookies son esenciales para que puedas experimentar toda la funcionalidad de nuestro sitio (ej. mantener tu sesión iniciada en la Consola OLA Cloud).")}
              </li>
              <li>
                <strong>{t("Statistics:", "Estadísticas:")}</strong> {t("These cookies store information like the number of visitors to the website, the number of unique visitors, which pages of the website have been visited, etc. We use self-hosted privacy-friendly analytics.", "Estas cookies almacenan información como el número de visitantes del sitio web, páginas visitadas, etc. Utilizamos analíticas auto-alojadas amigables con la privacidad.")}
              </li>
              <li>
                <strong>{t("Preferences:", "Preferencias:")}</strong> {t("These cookies help us store your settings and browsing preferences like language preferences (EN/ES) so that you have a better and efficient experience on future visits.", "Estas cookies nos ayudan a almacenar tus ajustes y preferencias de navegación como el idioma (EN/ES) para que tengas una experiencia mejor y más eficiente en futuras visitas.")}
              </li>
            </ul>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
