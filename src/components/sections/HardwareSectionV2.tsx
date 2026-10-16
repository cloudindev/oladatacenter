"use client"

import React from "react"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"

export function HardwareSectionV2() {
  const { t } = useLanguage()
  const servers = [
    {
      id: "c1",
      label: t("1U - ENTRY", "1U - ENTRADA"),
      name: "OLADC C1",
      specs: [
        { label: "CPU", value: "EPYC 4565P" },
        { label: "RAM", value: "192GB" },
        { label: t("Storage", "Almacenamiento"), value: "2x4TB U.3" }
      ],
      isNew: false
    },
    {
      id: "c2",
      label: t("2U - BALANCED", "2U - BALANCEADO"),
      name: "OLADC C2",
      specs: [
        { label: "CPU", value: "EPYC 4565P" },
        { label: "RAM", value: "192GB" },
        { label: t("Storage", "Almacenamiento"), value: "24TB útiles" }
      ],
      isNew: false
    },
    {
      id: "ai1",
      label: "4U - AI / GPU",
      name: "OLADC AI1",
      specs: [
        { label: "CPU", value: "EPYC 4585PX" },
        { label: "RAM", value: "192GB" },
        { label: t("Storage", "Almacenamiento"), value: "2x4TB + 4 GPU" }
      ],
      isNew: true
    }
  ]

  return (
    <section className="bg-bg-light py-24 border-b border-border-base/5">
      <div className="container mx-auto px-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <div className="text-accent-ink label-mono mb-4">
              02 - HARDWARE
            </div>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-bg-dark mb-4">
              {t("The OLA server line.", "La línea de servidores OLA.")}
            </h2>
            <p className="text-lg text-bg-dark/80">
              {t("Built for Cloud. Design for AI. Colocated in our own facility or buy the AI box and operate it from anywhere.", "Creado para la Nube. Diseñado para IA. Ubicado en nuestras propias instalaciones o compra el equipo y opéralo desde cualquier parte.")}
            </p>
          </div>
          <div>
            <Link href="/products" className="text-accent-ink font-medium hover:text-bg-dark inline-flex items-center gap-1 transition-colors">
              {t("View all servers", "Ver todos los servidores")} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>
        </div>

        {/* Server Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servers.map((server) => (
            <div key={server.id} className="bg-white rounded-lg border border-border-base/10 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full overflow-hidden">
              
              {/* Image Full Width at Top */}
              <div className="w-full bg-[#e7e8e1] border-b border-border-base/10">
                <img 
                  src={server.id === 'ai1' ? "/oladc-serverai.jpg" : "/oladc-server.jpg"} 
                  alt={server.name} 
                  className="w-full h-auto object-cover mix-blend-multiply" 
                />
              </div>

              {/* Card Content with Padding */}
              <div className="p-8 flex flex-col flex-grow">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-medium text-bg-dark/40 uppercase tracking-widest">{server.label}</span>
                  {server.isNew && (
                    <span className="bg-primary/40 text-accent-ink text-[10px] font-medium px-2 py-0.5 rounded-sm uppercase tracking-wider">{t("NEW", "NUEVO")}</span>
                  )}
                </div>
                
                <h3 className="text-2xl font-medium text-bg-dark mb-8">{server.name}</h3>
                
                {/* Specs */}
                <div className="space-y-4 flex-grow">
                  {server.specs.map((spec, i) => (
                    <div key={i} className="flex justify-between items-end border-b border-gray-100 pb-2">
                      <span className="text-sm text-bg-dark/50">{spec.label}</span>
                      <span className="text-sm font-medium text-bg-dark text-right">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
