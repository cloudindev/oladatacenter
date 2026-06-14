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
        { label: "CPU", value: "AMD EPYC 9304" },
        { label: t("Drives", "Discos"), value: "4 × NVMe U.2" },
        { label: "RAM", value: t("up to 384 GB", "hasta 384 GB") },
        { label: "Net", value: "2 × 25 GbE" }
      ],
      price: "€129",
      isNew: false
    },
    {
      id: "c2",
      label: t("2U - BALANCED", "2U - BALANCEADO"),
      name: "OLADC C2",
      specs: [
        { label: "CPU", value: "2 × EPYC 9334" },
        { label: t("Drives", "Discos"), value: "12 × NVMe U.2" },
        { label: "RAM", value: t("up to 2 TB", "hasta 2 TB") },
        { label: "Net", value: "2 × 100 GbE" }
      ],
      price: "€349",
      isNew: false
    },
    {
      id: "ai1",
      label: "4U - AI / GPU",
      name: "OLADC AI1",
      specs: [
        { label: "CPU", value: "2 × EPYC 9004" },
        { label: t("Interconnect", "Interconexión"), value: "NVLink + 400G" },
        { label: "RAM", value: t("up to 3 TB", "hasta 3 TB") },
        { label: "Net", value: "2 × 400 GbE" }
      ],
      price: "€4,990",
      isNew: true
    }
  ]

  return (
    <section className="bg-bg-light py-24 border-b border-border-base/5">
      <div className="container mx-auto px-4">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <div className="text-primary text-xs font-bold tracking-widest uppercase mb-4">
              02 - HARDWARE
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-bg-dark mb-4">
              {t("The OLADC server line.", "La línea de servidores OLADC.")}
            </h2>
            <p className="text-lg text-bg-dark/60">
              {t("Built for Cloud. Design for AI. Colocated in our own facility or buy the AI box and operate it from anywhere.", "Creado para la Nube. Diseñado para IA. Ubicado en nuestras propias instalaciones o compra el equipo y opéralo desde cualquier parte.")}
            </p>
          </div>
          <div>
            <Link href="/products" className="text-primary font-medium hover:text-primary-hover inline-flex items-center gap-1 transition-colors">
              {t("View all servers", "Ver todos los servidores")} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>
        </div>

        {/* Server Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servers.map((server) => (
            <div key={server.id} className="bg-white rounded-2xl border border-border-base/10 p-8 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full">
              
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold text-bg-dark/40 uppercase tracking-widest">{server.label}</span>
                {server.isNew && (
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider">{t("NEW", "NUEVO")}</span>
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-bg-dark mb-8">{server.name}</h3>
              
              {/* Image Placeholder */}
              <div className="w-full h-32 flex items-center justify-center mb-8 relative">
                {/* Simulated Server Faceplate */}
                <div className={`w-full bg-[#111] rounded shadow-inner border-y border-gray-700 flex flex-col justify-between p-1 overflow-hidden
                  ${server.id === 'c1' ? 'h-8' : server.id === 'c2' ? 'h-16' : 'h-24'}`}>
                  
                  {/* Status LEDs */}
                  <div className="flex gap-1 px-2 pt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  </div>
                  
                  {/* Drives Grid */}
                  <div className="flex gap-0.5 px-1 pb-1 opacity-80">
                    {[...Array(server.id === 'c1' ? 4 : server.id === 'c2' ? 12 : 8)].map((_, i) => (
                      <div key={i} className="flex-1 h-full bg-[#222] border border-[#333] rounded-sm relative overflow-hidden group-hover:border-primary/30 transition-colors">
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500/50" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Specs */}
              <div className="space-y-4 mb-10 flex-grow">
                {server.specs.map((spec, i) => (
                  <div key={i} className="flex justify-between items-end border-b border-gray-100 pb-2">
                    <span className="text-sm text-bg-dark/50">{spec.label}</span>
                    <span className="text-sm font-medium text-bg-dark text-right">{spec.value}</span>
                  </div>
                ))}
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-end mt-auto">
                <Link href={`/datacenter/bare-metal`} className="text-primary text-sm font-medium hover:text-primary-hover inline-flex items-center gap-1 transition-colors">
                  {t("Configure", "Configurar")} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                </Link>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
