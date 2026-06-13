"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { Cloud } from "lucide-react"

export function Footer() {
  const { lang, setLang, t } = useLanguage()

  return (
    <footer className="bg-[#0a0f1c] text-text-dark pt-20 pb-8 border-t border-border-dark">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand Col */}
          <div className="lg:col-span-1 flex flex-col items-start">
            <Link href="/" className="mb-6 block">
              <Image 
                src="/ola-datacenter-logo.jpg" 
                alt="OLA Datacenter" 
                width={140} 
                height={40} 
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-text-muted/80 mb-6 leading-relaxed">
              {t("Powerful AI cloud infrastructure, engineered in Spain.", "Infraestructura cloud para IA potente, diseñada en España.")}
            </p>
            <div className="text-sm text-text-muted/80 space-y-1">
              <p>hola@oladc.es</p>
              <p>Madrid · Barcelona · Valencia</p>
            </div>
          </div>

          {/* Links Cols */}
          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Datacenter")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">DC Edge</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">DC AI</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Colocation", "Colocation")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Tour the facility", "Visitar instalaciones")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Connectivity", "Conectividad")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Servers", "Servidores")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">OLADC C1</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">OLADC C2</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">OLADC AI1</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Configurator", "Configurador")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">HaaS program</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Cloud")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">AI Cloud</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Compute</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Database</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Storage</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Network</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Company", "Empresa")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">{t("About OLA", "Sobre OLA")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Sustainability", "Sostenibilidad")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Customers", "Clientes")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Careers", "Carreras")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("News", "Noticias")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Language Block */}
        <div className="bg-[#111827]/80 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="text-[11px] text-text-muted/60 uppercase tracking-widest mb-3">ES · VERSIÓN ESPAÑOLA</div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">AI Cloud para empresas soberanas.</h3>
            <p className="text-sm text-text-muted/80 max-w-2xl leading-relaxed">Datacenter, servidores dedicados y cloud — infraestructura premium para empresas que construyen su futuro en España.</p>
          </div>
          <button 
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="text-sm font-medium text-white border border-white/20 px-6 py-2.5 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            {t("Cambiar idioma →", "Switch to English →")}
          </button>
        </div>

        {/* Sub-brands */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-start gap-12 md:gap-24 mb-10 pl-2">
          <div>
            <div className="text-[11px] text-teal-400 mb-2 font-medium">Build and deploy</div>
            <div className="text-2xl font-bold tracking-tighter text-white flex items-center gap-1.5">
              OLA<span className="text-teal-400 text-xl font-black rotate-12">△</span>CLOUD
            </div>
          </div>
          <div>
            <div className="text-[11px] text-blue-500 mb-2 font-medium">Managed Cloud</div>
            <div className="text-2xl font-bold tracking-tighter text-white flex items-center gap-1">
              CLOUDMAX<span className="text-white text-[10px] uppercase font-normal tracking-normal mb-3">®</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-cyan-400 mb-2 font-medium">Hosting</div>
            <div className="text-2xl font-bold tracking-tighter text-white flex items-center gap-1.5">
              cloudin<Cloud className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 text-[11px] text-text-muted/60 gap-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-center md:text-left">
            <span>© 2026 OLA Datacenter</span>
            <span className="hidden sm:inline opacity-30">|</span>
            <span>Tier III · ISO 27001 · ENS Alto · RGPD · PCI DSS</span>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-white transition-colors">Legal</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
