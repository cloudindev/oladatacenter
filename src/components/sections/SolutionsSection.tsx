"use client"

import React from "react"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"

export function SolutionsSection() {
  const { t } = useLanguage()
  const solutions = [
    {
      title: t("Model Training", "Entrenamiento de Modelos"),
      description: t("Distributed training at any scale with GPUs on demand.", "Entrenamiento distribuido a cualquier escala con GPUs bajo demanda."),
      icon: (
        <svg className="w-8 h-8 text-blue-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="4" r="2" />
          <circle cx="12" cy="20" r="2" />
          <circle cx="4" cy="12" r="2" />
          <circle cx="20" cy="12" r="2" />
        </svg>
      )
    },
    {
      title: t("Inference", "Inferencia"),
      description: t("Low-latency endpoints for production AI workloads.", "Endpoints de baja latencia para cargas de IA en producción."),
      icon: (
        <svg className="w-8 h-8 text-purple-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      title: t("RAG & Vector DB", "RAG & Vector DB"),
      description: t("Build knowledge applications with managed tools.", "Construye aplicaciones de conocimiento con herramientas gestionadas."),
      icon: (
        <svg className="w-8 h-8 text-teal-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      )
    },
    {
      title: t("MLOps", "MLOps"),
      description: t("Track, deploy and monitor models end-to-end.", "Rastrea, despliega y monitoriza modelos de extremo a extremo."),
      icon: (
        <svg className="w-8 h-8 text-pink-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    }
  ]

  return (
    <section className="bg-bg-light py-24 pb-32">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-8">
          
          {/* Left Text Column */}
          <div className="w-full lg:w-1/3 flex flex-col items-start pr-0 lg:pr-8">
            <div className="text-primary text-xs font-bold tracking-widest uppercase mb-4">
              {t("✦ OUR SOLUTIONS", "✦ NUESTRAS SOLUCIONES")}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-bg-dark leading-[1.1] mb-6">
              {t("AI Cloud", "Cloud IA")}<br />{t("for every scenario.", "para cada escenario.")}
            </h2>
            <p className="text-bg-dark/70 mb-8 leading-relaxed">
              {t("Managed services and tools to build, train and run AI with full control and performance.", "Servicios gestionados y herramientas para construir, entrenar y ejecutar IA con total control y rendimiento.")}
            </p>
            <Link href="/cloud/ai" className="text-primary font-medium hover:text-primary-hover inline-flex items-center gap-1 transition-colors">
              {t("Explore AI Cloud", "Explorar Cloud IA")} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </Link>
          </div>

          {/* Right Cards Grid */}
          <div className="w-full lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-8">
            {solutions.map((item, index) => (
              <div key={index} className="flex flex-col">
                {item.icon}
                <h3 className="text-lg font-bold text-bg-dark mb-3">{item.title}</h3>
                <p className="text-sm text-bg-dark/60 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
