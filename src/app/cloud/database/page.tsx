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
        categoryEn="Cloud"
        categoryEs="Cloud"
        titleEn="Databases"
        titleEs="Bases de datos"
        subtitleEn="Managed databases built for speed and reliability."
        subtitleEs="Bases de datos gestionadas diseñadas para velocidad y fiabilidad."
      />
      
      <div className="flex-1 bg-bg-light">
        <div className="container mx-auto px-4 py-24 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-text-base mb-4">{t("Stop worrying about backups and replication.", "Deja de preocuparte por backups y replicación.")}</h2>
            <p className="text-text-muted text-lg">{t("Deploy production-ready databases with automatic failover, daily backups, and point-in-time recovery with a single click.", "Despliega bases de datos listas para producción con failover automático, backups diarios y recuperación a un punto en el tiempo con un solo clic.")}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-border-base rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform shadow-sm">
              <img src="https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg" alt="PostgreSQL" className="w-16 h-16 mx-auto mb-4 opacity-80" />
              <h3 className="font-bold text-lg mb-2">PostgreSQL</h3>
              <p className="text-sm text-text-muted">{t("Relational powerhouse for complex apps.", "Motor relacional para apps complejas.")}</p>
            </div>
            <div className="bg-white border border-border-base rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform shadow-sm">
              <img src="https://upload.wikimedia.org/wikipedia/en/6/62/MySQL.svg" alt="MySQL" className="w-16 h-16 mx-auto mb-4 opacity-80 object-contain" />
              <h3 className="font-bold text-lg mb-2">MySQL</h3>
              <p className="text-sm text-text-muted">{t("The world's most popular open-source database.", "La base de datos open-source más popular.")}</p>
            </div>
            <div className="bg-white border border-border-base rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform shadow-sm">
              <img src="https://upload.wikimedia.org/wikipedia/en/6/6b/Redis_Logo.svg" alt="Redis" className="w-16 h-16 mx-auto mb-4 opacity-80" />
              <h3 className="font-bold text-lg mb-2">Redis™</h3>
              <p className="text-sm text-text-muted">{t("In-memory data store for caching & messaging.", "Almacén de datos en memoria para caché.")}</p>
            </div>
            <div className="bg-white border border-border-base rounded-2xl p-6 text-center hover:-translate-y-1 transition-transform shadow-sm">
              <img src="https://upload.wikimedia.org/wikipedia/en/4/45/MongoDB-Logo.svg" alt="MongoDB" className="w-16 h-16 mx-auto mb-4 opacity-80 object-contain" />
              <h3 className="font-bold text-lg mb-2">MongoDB</h3>
              <p className="text-sm text-text-muted">{t("NoSQL document database for flexible schemas.", "Base de datos de documentos NoSQL.")}</p>
            </div>
          </div>
        </div>
      </div>
    
      <Footer />
    </main>
  )
}
