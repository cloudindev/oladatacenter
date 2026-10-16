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
        categoryEn="Portal"
        categoryEs="Portal"
        titleEn="Client Portal"
        titleEs="Portal de Clientes"
        subtitleEn="Manage your infrastructure."
        subtitleEs="Gestiona tu infraestructura."
      />
      
      <div className="flex-1 flex items-center justify-center bg-bg-light py-24">
        <div className="w-full max-w-md px-4">
          <div className="bg-white rounded-xl border border-border-base shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-block p-3 rounded-lg bg-bg-dark mb-4">
                <img src="/ola-datacenter-logo.jpg" alt="Logo" className="h-6" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <h2 className="text-2xl font-normal text-text-base">{t("Welcome back", "Bienvenido de nuevo")}</h2>
              <p className="text-text-muted mt-2">{t("Sign in to your account", "Inicia sesión en tu cuenta")}</p>
            </div>
            
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-medium text-text-base mb-2">{t("Email", "Correo electrónico")}</label>
                <input type="email" className="w-full bg-bg-light border border-border-base rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="admin@company.com" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-text-base">{t("Password", "Contraseña")}</label>
                  <a href="#" className="text-sm text-accent-ink hover:underline">{t("Forgot?", "¿Olvidada?")}</a>
                </div>
                <input type="password" className="w-full bg-bg-light border border-border-base rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="••••••••" />
              </div>
              
              <button className="w-full bg-bg-dark text-white font-medium py-3.5 rounded-xl hover:bg-black transition-colors mt-4">
                {t("Sign in", "Iniciar sesión")}
              </button>
            </form>
            
            <div className="mt-8 text-center text-sm text-text-muted">
              {t("Don't have an account?", "¿No tienes una cuenta?")} <a href="/contact" className="text-accent-ink font-medium hover:underline">{t("Contact Sales", "Contacta con Ventas")}</a>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
