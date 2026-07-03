"use client"

import * as React from "react"
import { useLanguage } from "@/context/LanguageContext"
import { SectionLabel } from "@/components/ui/SectionLabel"
import { ArrowRight, Server, Database, Box, Network, Shield, GitBranch } from "lucide-react"

export function CloudSection() {
  const { t } = useLanguage()

  return (
    <section id="cloud" className="py-24 md:py-32 bg-bg-light border-b border-border-base/40">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <SectionLabel>03 · CLOUD</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-4">
              {t("From code to production in one git push.", "Del código a producción con un solo git push.")}
            </h2>
            <p className="text-lg text-text-muted">
              {t(
                "The OLA Cloud platform — AI, compute, data and security on sovereign Spanish infrastructure.",
                "La plataforma OLA Cloud — IA, cómputo, datos y seguridad sobre infraestructura soberana española."
              )}
            </p>
          </div>
          <a href="#" className="text-teal-600 font-medium flex items-center hover:underline">
             olacloud.es <ArrowRight className="w-4 h-4 ml-1" />
           </a>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* Main Tile (AI Cloud) */}
          <div className="md:col-span-2 lg:col-span-2 bg-bg-dark border border-border-dark rounded-2xl p-8 flex flex-col justify-between hover:shadow-xl transition-shadow group">
            <div>
              <SectionLabel className="text-primary mb-2">PLATFORM</SectionLabel>
              <h3 className="text-3xl font-bold text-white mb-4">AI Cloud</h3>
              <p className="text-text-muted mb-6 text-lg max-w-md">
                {t(
                  "On-demand GPU, Train, fine-tune and serve LLMs and RAG — no infra plumbing required.",
                  "GPU bajo demanda. Entrena, ajusta y sirve LLMs y RAG — sin complicaciones de infraestructura."
                )}
              </p>
              <div className="flex gap-2 mb-8">
                <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">H100</span>
                <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">A100</span>
                <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">Sandbox</span>
              </div>
            </div>
            <div className="flex justify-end">
               <button className="text-primary font-medium flex items-center group-hover:underline">
                 {t("Deploy", "Desplegar")} <ArrowRight className="w-4 h-4 ml-1" />
               </button>
            </div>
          </div>

          {/* Small Tiles */}
          <div className="bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Server className="w-6 h-6 text-teal-600 mb-4" />
               <h4 className="font-bold text-text-base mb-2">{t("Compute", "Cómputo")}</h4>
               <p className="text-sm text-text-muted">{t("Cloud servers with autoscaling + CI/CD.", "Servidores cloud con autoescalado + CI/CD.")}</p>
            </div>
          </div>
          
          <div className="bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Database className="w-6 h-6 text-teal-600 mb-4" />
               <h4 className="font-bold text-text-base mb-2">{t("Database", "Bases de datos")}</h4>
               <p className="text-sm text-text-muted">{t("Managed PostgreSQL, Redis & Mongo.", "PostgreSQL, Redis y Mongo gestionados.")}</p>
            </div>
          </div>

          <div className="bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Box className="w-6 h-6 text-teal-600 mb-4" />
               <h4 className="font-bold text-text-base mb-2">{t("Storage", "Almacenamiento")}</h4>
               <p className="text-sm text-text-muted">{t("S3 compatible object storage, archive and backup.", "Almacenamiento de objetos compatible con S3, archivo y backup.")}</p>
            </div>
          </div>



          <div className="md:col-span-2 bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Shield className="w-6 h-6 text-teal-600 mb-4" />
               <div className="text-xs font-semibold text-teal-600 mb-1 uppercase">{t("PRIVATE CLOUD", "CLOUD PRIVADO")}</div>
               <h4 className="font-bold text-text-base mb-2 text-lg">{t("Private Cloud", "Cloud Privado")}</h4>
               <p className="text-sm text-text-muted">{t("Dedicated tenancy. Your data stays in Spain — encrypted, isolated, audited.", "Tenencia dedicada. Tus datos permanecen en España — cifrados, aislados y auditados.")}</p>
            </div>
          </div>

          <div className="bg-bg-dark border border-border-dark rounded-2xl p-6 hover:shadow-xl transition-shadow group flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent pointer-events-none" />
            <div className="relative z-10">
               <GitBranch className="w-6 h-6 text-primary mb-4" />
               <div className="text-xs font-semibold text-primary mb-1 uppercase">git push → live</div>
               <h4 className="font-bold text-white mb-2 text-lg">{t("Serverless Deploy", "Despliegue Serverless")}</h4>
               <p className="text-sm text-text-muted">{t("Push from your repo. We build, scale and serve — globally in minutes.", "Haz push desde tu repo. Nosotros construimos, escalamos y servimos — global en minutos.")}</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
