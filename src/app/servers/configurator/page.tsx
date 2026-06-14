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
        categoryEn="Servers"
        categoryEs="Servidores"
        titleEn="Server Configurator"
        titleEs="Configurador de Servidores"
        subtitleEn="Build your custom bare-metal or AI server."
        subtitleEs="Construye tu servidor bare-metal o de IA a medida."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-border-base p-8 shadow-sm">
              <h3 className="text-2xl font-bold text-text-base mb-8">{t("1. Choose Base Model", "1. Elige el Modelo Base")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="border-2 border-primary rounded-xl p-4 cursor-pointer relative">
                  <div className="absolute top-4 right-4 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <h4 className="font-bold text-lg">OLADC C1</h4>
                  <p className="text-sm text-text-muted mt-1">1U Compute Node</p>
                </div>
                <div className="border-2 border-border-base rounded-xl p-4 cursor-pointer hover:border-gray-300">
                  <h4 className="font-bold text-lg">OLADC AI1</h4>
                  <p className="text-sm text-text-muted mt-1">4U GPU Node</p>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-text-base mb-6">{t("2. Memory (RAM)", "2. Memoria (RAM)")}</h3>
              <div className="grid grid-cols-3 gap-4 mb-12">
                <div className="border-2 border-border-base rounded-xl p-4 cursor-pointer text-center hover:border-gray-300">128 GB</div>
                <div className="border-2 border-primary rounded-xl p-4 cursor-pointer text-center font-bold">384 GB</div>
                <div className="border-2 border-border-base rounded-xl p-4 cursor-pointer text-center hover:border-gray-300">768 GB</div>
              </div>

              <h3 className="text-2xl font-bold text-text-base mb-6">{t("3. Primary Storage", "3. Almacenamiento Primario")}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-primary rounded-xl p-4 cursor-pointer font-bold">4× 1.92TB NVMe</div>
                <div className="border-2 border-border-base rounded-xl p-4 cursor-pointer hover:border-gray-300">4× 3.84TB NVMe</div>
                <div className="border-2 border-border-base rounded-xl p-4 cursor-pointer hover:border-gray-300">4× 7.68TB NVMe</div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-surface-dark rounded-2xl border border-border-dark p-8 text-white sticky top-24">
                <h3 className="text-xl font-bold mb-6">{t("Order Summary", "Resumen del Pedido")}</h3>
                <ul className="space-y-4 mb-8 text-sm">
                  <li className="flex justify-between border-b border-white/10 pb-3">
                    <span className="text-white/60">Base</span>
                    <span className="font-medium text-right">OLADC C1</span>
                  </li>
                  <li className="flex justify-between border-b border-white/10 pb-3">
                    <span className="text-white/60">RAM</span>
                    <span className="font-medium text-right">384 GB DDR5</span>
                  </li>
                  <li className="flex justify-between border-b border-white/10 pb-3">
                    <span className="text-white/60">Storage</span>
                    <span className="font-medium text-right">4× 1.92TB NVMe</span>
                  </li>
                  <li className="flex justify-between border-b border-white/10 pb-3">
                    <span className="text-white/60">Datacenter</span>
                    <span className="font-medium text-right">Madrid, ES (MAD1)</span>
                  </li>
                </ul>
                <div className="flex justify-between items-end mb-8">
                  <span className="text-white/60">{t("Monthly Total", "Total Mensual")}</span>
                  <span className="text-3xl font-bold text-primary">€129</span>
                </div>
                <button className="w-full bg-primary text-bg-dark font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors">
                  {t("Checkout", "Finalizar Compra")}
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
