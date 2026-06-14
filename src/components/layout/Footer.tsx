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
                className="h-8 w-auto object-contain object-left"
              />
              <div className="text-[7.5px] text-[#d8fff4] font-bold tracking-[0.25em] mt-0.5">NEXT-GEN DATACENTER</div>
            </Link>
            <p className="text-sm text-text-muted/80 mb-6 leading-relaxed">
              {t("AI Cloud for the next big thing", "AI Cloud for the next big thing")}
            </p>
          </div>

          {/* Links Cols */}
          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Datacenter", "Datacenter")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="/datacenter/colocation" className="hover:text-white transition-colors">{t("Colocation", "Colocation")}</Link></li>
              <li><Link href="/datacenter/on-premise" className="hover:text-white transition-colors">{t("On-premise Cloud", "Cloud On-premise")}</Link></li>
              <li><Link href="/datacenter/ai-servers" className="hover:text-white transition-colors">{t("AI Servers", "Servidores IA")}</Link></li>
              <li><Link href="/datacenter/bare-metal" className="hover:text-white transition-colors">{t("Bare metal", "Bare metal")}</Link></li>
              <li><Link href="/datacenter/hosting" className="hover:text-white transition-colors">{t("Hosting", "Hosting")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Servers", "Servidores")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="/datacenter/bare-metal" className="hover:text-white transition-colors">OLADC C1</Link></li>
              <li><Link href="/datacenter/bare-metal" className="hover:text-white transition-colors">OLADC C2</Link></li>
              <li><Link href="/datacenter/bare-metal" className="hover:text-white transition-colors">OLADC AI1</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Cloud", "Cloud")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="/cloud/ai" className="hover:text-white transition-colors">{t("AI Cloud", "Cloud IA")}</Link></li>
              <li><Link href="/cloud/compute" className="hover:text-white transition-colors">{t("Compute", "Cómputo")}</Link></li>
              <li><Link href="/cloud/database" className="hover:text-white transition-colors">{t("Database", "Bases de datos")}</Link></li>
              <li><Link href="/cloud/storage" className="hover:text-white transition-colors">{t("Storage", "Almacenamiento")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-6 text-xs uppercase tracking-widest">{t("Company", "Empresa")}</h4>
            <ul className="space-y-4 text-sm text-text-muted/80">
              <li><Link href="/company/about" className="hover:text-white transition-colors">{t("About OLA", "Sobre OLA")}</Link></li>
              <li><Link href="/company/sustainability" className="hover:text-white transition-colors">{t("Sustainability", "Sostenibilidad")}</Link></li>
              <li><Link href="/company/news" className="hover:text-white transition-colors">{t("News", "Noticias")}</Link></li>
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
            <div className="text-[11px] text-teal-400 mb-3 font-medium">{t("Build and deploy", "Construye y despliega")}</div>
            <Image src="/olacloud-logo.png" alt="OLA CLOUD" width={140} height={30} className="h-5 md:h-6 w-auto object-contain object-left" />
          </div>

          <div>
            <div className="text-[11px] text-cyan-400 mb-3 font-medium">{t("Hosting", "Hosting")}</div>
            <Image src="/cloudin-logo.png" alt="cloudin" width={140} height={30} className="h-5 md:h-6 w-auto object-contain object-left" />
          </div>
        </div>

        {/* Legal */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/5 text-[11px] text-text-muted/60 gap-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-center md:text-left">
            <span>© 2026 OLA Datacenter</span>
          </div>
          <div className="flex gap-6">
            <Link href="/legal/terms" className="hover:text-white transition-colors">{t("Legal", "Aviso Legal")}</Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">{t("Privacy", "Privacidad")}</Link>
            <Link href="/legal/cookies" className="hover:text-white transition-colors">{t("Cookies", "Cookies")}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
