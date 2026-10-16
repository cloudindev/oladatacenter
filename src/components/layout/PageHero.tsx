"use client"

import React from "react"
import { useLanguage } from "@/context/LanguageContext"
import { SectionLabel } from "@/components/ui/SectionLabel"

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface PageHeroProps {
  categoryEn: string
  categoryEs: string
  titleEn: string
  titleEs: string
  subtitleEn: string
  subtitleEs: string
}

// ─── Component ──────────────────────────────────────────────────────────────
/**
 * Interior page header in the integratedbio.com style: off-white canvas,
 * mono eyebrow with lime square, large light-weight charcoal headline and a
 * muted lead paragraph. Shared by every interior route.
 */
export function PageHero({ categoryEn, categoryEs, titleEn, titleEs, subtitleEn, subtitleEs }: PageHeroProps) {
  const { t } = useLanguage()

  return (
    <section className="bg-bg-light pt-44 pb-20 border-b border-border-base">
      <div className="container mx-auto px-4 max-w-5xl">
        <SectionLabel>{t(categoryEn, categoryEs)}</SectionLabel>

        <h1 className="text-5xl md:text-7xl font-light tracking-[-0.04em] text-text-base leading-[1.02] mb-8">
          {t(titleEn, titleEs)}
        </h1>

        <p className="text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl">{t(subtitleEn, subtitleEs)}</p>
      </div>
    </section>
  )
}

/*
 * ─── Memoria ────────────────────────────────────────────────────────────────
 * Por qué: IntegratedBio presenta sus páginas sobre fondo claro con titulares
 * finos; antes era un bloque azul oscuro con gradiente neón.
 * Edge cases: pt-44 deja hueco para el header fijo (top 29px + 52px de alto).
 */
