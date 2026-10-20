"use client"

/**
 * Footer — Pie de página arquitectónico de OLA Datacenter.
 * Estructura alineada a la rejilla global (`max-w-[1600px] px-6 md:px-[44px]`):
 *  1. Franja superior de CTA horizontal: titular editorial bitono a la izquierda
 *     y botón paralelogramo `ArrowCta` (`variant="light"`) a la derecha.
 *  2. Matriz principal 12 columnas: bloque de marca (`ola-footer-logo.png` +
 *     `Data Center` + telemetría de estado) a la izquierda y las 3 columnas de
 *     productos (`01 / Datacenter`, `02 / IA`, `03 / Cloud`) ordenadas con
 *     filetes superiores y espaciado compacto (`space-y-1.5`).
 *  3. Barra legal inferior con selector de idioma `EN / ES` en acento lima.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface FooterLinkItem {
  href: string
  label: string
}

interface FooterColumnProps {
  index: string
  title: string
  links: FooterLinkItem[]
}

// ─── 2. Subcomponents ───────────────────────────────────────────────────────
/**
 * Columna de producto con filete arquitectónico superior, índice `font-mono`
 * en verde lima y lista compacta con micro-desplazamiento en hover.
 */
function FooterProductColumn({ index, title, links }: FooterColumnProps) {
  return (
    <div className="border-t border-white/12 pt-4">
      <div className="flex items-center gap-2 mb-3.5">
        <span className="font-mono text-[11px] tracking-[0.06em] text-primary">
          {index}
        </span>
        <span aria-hidden className="text-white/20 font-mono text-[11px]">
          /
        </span>
        <h4 className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#f7f7f5] font-normal">
          {title}
        </h4>
      </div>

      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="group inline-flex items-center text-[13.5px] leading-snug text-[#8e9899] hover:text-[#f7f7f5] transition-colors duration-200"
            >
              <span
                aria-hidden
                className="w-0 overflow-hidden opacity-0 group-hover:w-3 group-hover:opacity-100 transition-all duration-200 text-primary font-mono text-[11px]"
              >
                ›
              </span>
              <span className="transition-transform duration-200">
                {l.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── 3. Component Logic & Render ────────────────────────────────────────────
export function Footer() {
  const { lang, setLang, t } = useLanguage()

  const datacenterLinks: FooterLinkItem[] = [
    { href: "/datacenter/colocation/por-u", label: t("Colocation per U", "Colocation por U") },
    { href: "/datacenter/colocation/racks", label: t("Half rack / full rack", "Medio rack / rack completo") },
    { href: "/datacenter/colocation/jaulas", label: t("Cages", "Jaulas") },
    { href: "/datacenter/colocation/suites", label: t("Suites", "Suites") },
    { href: "/datacenter/colocation/wholesale", label: t("Housing / wholesale", "Housing / wholesale") },
    { href: "/datacenter/connectivity", label: t("Connectivity", "Conectividad") },
    { href: "/datacenter/hosting", label: t("Operations services", "Servicios de operación") },
  ]

  const aiLinks: FooterLinkItem[] = [
    { href: "/cloud/ai", label: t("AI Infrastructure", "Infraestructura IA") },
    { href: "/datacenter/ai-servers", label: t("GPU Servers", "Servidores GPU") },
    { href: "/datacenter/on-premise", label: t("On-Prem Cloud", "On-Prem Cloud") },
    { href: "/products", label: t("AI box", "AI box") },
  ]

  const cloudLinks: FooterLinkItem[] = [
    { href: "/cloud/compute#vps-cloud", label: t("Cloud VPS servers", "Servidores VPS Cloud") },
    { href: "/cloud/compute#vps-windows", label: t("Windows VPS servers", "Servidores VPS Windows") },
    { href: "/cloud/compute#dedicados", label: t("Dedicated servers", "Servidores Dedicados") },
    { href: "/cloud/managed", label: t("Managed services", "Servicios gestionados") },
    { href: "/cloud/storage", label: t("Disaster Recovery & Backups", "Disaster Recovery y Backups") },
    { href: "/cloud/database", label: t("Synchronous geo-replication", "Georeplicación síncrona") },
    { href: "/cloud/build", label: t("Cloud migration", "Migración a la nube") },
  ]

  return (
    <footer className="bg-[#1b2627] text-[#f7f7f5] border-t border-white/10">
      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
        {/* ── 1. Banda Superior CTA Arquitectónica ── */}
        <div className="py-14 md:py-16 border-b border-white/10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 font-mono uppercase text-[11px] tracking-[0.06em] text-primary mb-4">
              <span aria-hidden className="w-1.5 h-1.5 bg-primary inline-block" />
              <span>{t("CUSTOM INFRASTRUCTURE", "ARQUITECTURA A MEDIDA")}</span>
            </div>
            <h3 className="text-[clamp(1.65rem,calc(1.65rem+0.018*(100vw-27.5rem)),2.65rem)] font-normal tracking-[-0.03em] leading-[1.12] text-[#f7f7f5]">
              {t("Contact our team", "Contacta con nuestro equipo")}{" "}
              <span className="text-[#859192]">
                {t(
                  "and we'll help you configure your cloud.",
                  "y te ayudamos a configurar tu nube."
                )}
              </span>
            </h3>
          </div>

          <div className="shrink-0">
            <ArrowCta href="/contact" variant="light">
              {t("Talk to an expert", "Contacta con un experto")}
            </ArrowCta>
          </div>
        </div>

        {/* ── 2. Matriz Principal: Marca + 3 Columnas de Productos ── */}
        <div className="py-14 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-10 items-start">
          {/* Columna de Marca (Izquierda) */}
          <div className="lg:col-span-4 flex flex-col items-start">
            <Link href="/" className="inline-flex flex-col items-stretch group">
              <Image
                src="/ola-footer-logo.png"
                alt="OLA Datacenter"
                width={886}
                height={212}
                unoptimized
                className="h-[24px] w-auto block transition-opacity duration-200 group-hover:opacity-90"
              />
              <span
                aria-label="Data Center"
                className="w-full flex justify-between px-[1.5px] font-mono text-[10px] uppercase leading-none text-[#f7f7f5]/75 mt-2.5 select-none"
              >
                {"DATA CENTER".split("").map((ch, idx) => (
                  <span key={idx} className={ch === " " ? "w-1.5" : undefined}>
                    {ch}
                  </span>
                ))}
              </span>
            </Link>
          </div>

          {/* 3 Columnas de Productos (Derecha) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-10">
            <FooterProductColumn
              index="01"
              title="Datacenter"
              links={datacenterLinks}
            />
            <FooterProductColumn
              index="02"
              title={t("AI", "IA")}
              links={aiLinks}
            />
            <FooterProductColumn
              index="03"
              title="Cloud"
              links={cloudLinks}
            />
          </div>
        </div>

        {/* ── 3. Barra Legal e Idioma ── */}
        <div className="border-t border-white/10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[#7c8788]">
            © 2026 OLA Datacenter. {t("All rights reserved", "Todos los derechos reservados")}
          </span>

          <div className="flex flex-wrap items-center gap-6">
            <Link
              href="/legal/terms"
              className="font-mono text-[11px] uppercase tracking-[0.04em] text-[#8e9899] hover:text-[#f7f7f5] transition-colors"
            >
              {t("Legal", "Aviso Legal")}
            </Link>
            <Link
              href="/legal/privacy"
              className="font-mono text-[11px] uppercase tracking-[0.04em] text-[#8e9899] hover:text-[#f7f7f5] transition-colors"
            >
              {t("Privacy", "Privacidad")}
            </Link>
            <Link
              href="/legal/cookies"
              className="font-mono text-[11px] uppercase tracking-[0.04em] text-[#8e9899] hover:text-[#f7f7f5] transition-colors"
            >
              Cookies
            </Link>

            {/* Conmutador de idioma minimalista con acento lima */}
            <button
              type="button"
              aria-label={t("Switch language", "Cambiar idioma")}
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="relative flex items-center bg-white/[0.04] border border-white/12 rounded-[6px] p-0.5 cursor-pointer select-none"
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-0.5 bottom-0.5 w-[30px] bg-primary rounded-[4px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  lang === "es" ? "translate-x-[30px]" : "translate-x-0"
                )}
              />
              <span className="relative z-10 flex font-mono text-[10px] font-medium uppercase tracking-[0.06em]">
                <span
                  className={cn(
                    "w-[30px] text-center py-1 transition-colors duration-200",
                    lang === "en" ? "text-bg-dark" : "text-white/55"
                  )}
                >
                  EN
                </span>
                <span
                  className={cn(
                    "w-[30px] text-center py-1 transition-colors duration-200",
                    lang === "es" ? "text-bg-dark" : "text-white/55"
                  )}
                >
                  ES
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

/*
 * ─── 4. Documentación de Memoria ────────────────────────────────────────────
 * - Decisión técnica: Se unificó el ancho del Footer con el resto del sistema
 *   editorial (`max-w-[1600px] px-6 md:px-[44px]`), estructurando los elementos
 *   existentes en 3 niveles horizontales limpios: banda CTA superior con
 *   titular bitono + `ArrowCta`, matriz 4+8 columnas con filetes superiores e
 *   índices `01 / 02 / 03` en verde lima para `Datacenter`, `IA` y `Cloud`, y
 *   barra legal inferior en `font-mono`.
 * - Edge cases cubiertos:
 *   1. El conmutador de idioma es ahora un `<button type="button">` accesible
 *      por teclado en lugar de un `<div>`.
 *   2. Los enlaces de producto mantienen `space-y-1.5` compacto e incorporan un
 *      indicador `›` que aparece en hover sin desplazar el layout vertical.
 */
