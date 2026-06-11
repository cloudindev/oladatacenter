"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"

export function Footer() {
  const { lang, setLang, t } = useLanguage()

  return (
    <footer className="bg-bg-dark text-text-dark pt-20 pb-10 border-t border-border-dark">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand Col */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image 
                src="/ola-datacenter-logo.jpg" 
                alt="OLA Datacenter" 
                width={140} 
                height={40} 
                className="h-8 w-auto object-contain opacity-90"
              />
              <span className="text-text-muted font-medium text-sm border border-border-dark rounded px-1.5 py-0.5">DC</span>
            </Link>
            <p className="text-sm text-text-muted mb-6">
              {t("Powerful AI cloud infrastructure, engineered in Spain.", "Infraestructura cloud para IA potente, diseñada en España.")}
            </p>
            <div className="text-sm text-text-muted space-y-1">
              <p>hola@oladc.es</p>
              <p>Madrid · Barcelona · Valencia</p>
            </div>
          </div>

          {/* Links Cols */}
          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">{t("Datacenter")}</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">DC Edge</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">DC AI</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Colocation", "Colocation")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Tour the facility", "Visitar instalaciones")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Connectivity", "Conectividad")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">{t("Servers", "Servidores")}</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">OLADC C1</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">OLADC C2</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">OLADC AI1</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Configurator", "Configurador")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">HaaS program</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">{t("Cloud")}</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">AI Cloud</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Compute</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Database</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Storage</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Network</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">Cybersecurity</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">{t("Company", "Empresa")}</h4>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link href="#" className="hover:text-primary transition-colors">{t("About OLA", "Sobre OLA")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Sustainability", "Sostenibilidad")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Customers", "Clientes")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Careers", "Carreras")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("News", "Noticias")}</Link></li>
              <li><Link href="#" className="hover:text-primary transition-colors">{t("Contact", "Contacto")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Language Block */}
        <div className="border border-border-dark bg-surface-dark/50 rounded-xl p-6 mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-2">ES · VERSIÓN ESPAÑOLA</div>
            <h3 className="text-lg font-semibold text-white mb-1">AI Cloud para empresas soberanas.</h3>
            <p className="text-sm text-text-muted max-w-xl">Datacenter, servidores dedicados y cloud — infraestructura premium para empresas que construyen su futuro en España.</p>
          </div>
          <button 
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="text-sm font-medium text-white border border-border-dark px-4 py-2 rounded-lg hover:bg-border-dark transition-colors whitespace-nowrap"
          >
            {t("Cambiar idioma →", "Switch to English →")}
          </button>
        </div>

        {/* Legal */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border-dark text-xs text-text-muted gap-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-center md:text-left">
            <span>© 2026 OLA Datacenter S.L. · CIF B12345678 · AS210882</span>
            <span className="hidden sm:inline">|</span>
            <span>Tier III · ISO 27001 · ENS Alto · RGPD · PCI DSS</span>
          </div>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-white">Legal</Link>
            <Link href="#" className="hover:text-white">Privacy</Link>
            <Link href="#" className="hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
