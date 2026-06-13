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
              <div className="text-[9px] text-emerald-400 font-bold tracking-[0.2em] mt-2">NEXT-GEN DATACENTER</div>
            </Link>
            <p className="text-sm text-text-muted/80 mb-6 leading-relaxed">
              {t("AI Cloud for the next big thing", "AI Cloud for the next big thing")}
            </p>
          </div>

          {/* Links Cols */}
          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Datacenter")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">DC Edge</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">DC AI</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Colocation", "Colocation")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Tour the facility", "Visitar instalaciones")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Servers", "Servidores")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">OLADC C1</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">OLADC C2</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">OLADC AI1</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Configurator", "Configurador")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Cloud")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">AI Cloud</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Compute</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Database</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">Storage</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Company", "Empresa")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="#" className="hover:text-white transition-colors">{t("About OLA", "Sobre OLA")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Sustainability", "Sostenibilidad")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("Careers", "Carreras")}</Link></li>
              <li><Link href="#" className="hover:text-white transition-colors">{t("News", "Noticias")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Language Block / CTA */}
        <div className="bg-[#111827]/80 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="text-[11px] text-text-muted/60 uppercase tracking-widest mb-3">{t("TE AYUDAMOS", "WE CAN HELP")}</div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">{t("Contacta con un experto", "Talk to an expert")}</h3>
            <p className="text-sm text-text-muted/80 max-w-2xl leading-relaxed">{t("Contacta con nuestro equipo, estaremos encantados de ayudarte a configurar tu nube.", "Contact our team, we will be happy to help you configure your cloud.")}</p>
          </div>
          <Link 
            href="mailto:hola@oladc.es"
            className="text-sm font-medium text-white border border-white/20 px-6 py-2.5 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            {t("Contactar →", "Contact us →")}
          </Link>
        </div>

        {/* Sub-brands */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-start gap-12 md:gap-24 mb-10 pl-2">
          <div>
            <div className="text-[11px] text-teal-400 mb-3 font-medium">Build and deploy</div>
            <Image src="/olacloud-logo.png" alt="OLA CLOUD" width={140} height={30} className="h-5 md:h-6 w-auto object-contain brightness-0 invert opacity-90" />
          </div>
          <div>
            <div className="text-[11px] text-blue-500 mb-3 font-medium">Managed Cloud</div>
            <Image src="/cloudm.png" alt="CLOUDMAX" width={140} height={30} className="h-5 md:h-6 w-auto object-contain brightness-0 invert opacity-90" />
          </div>
          <div>
            <div className="text-[11px] text-cyan-400 mb-3 font-medium">Hosting</div>
            <Image src="/cloudin-logo.png" alt="cloudin" width={140} height={30} className="h-5 md:h-6 w-auto object-contain brightness-0 invert opacity-90" />
          </div>
        </div>

        {/* Legal */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 text-[11px] text-text-muted/60 gap-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-center md:text-left">
            <span>© 2026 OLA Datacenter</span>
            <span className="hidden sm:inline opacity-30">|</span>
            <span>Tier III · RGPD · PCI DSS</span>
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
