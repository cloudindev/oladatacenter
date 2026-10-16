"use client"

import React, { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"

type PresetId = "A" | "B" | "C" | "D" | "E"

interface HeadlinePreset {
  id: PresetId
  label: string
  h1Class: string
  line1Class: string
  line2Class: string
  line1Style?: React.CSSProperties
  line2Style?: React.CSSProperties
}

const PRESETS: HeadlinePreset[] = [
  {
    id: "A",
    label: "A · Charcoal + Gris pizarra (Bicolor)",
    h1Class:
      "uppercase text-[8.5vw] sm:text-5xl lg:text-[4.25rem] font-semibold tracking-[-0.03em] leading-[0.94]",
    line1Class: "block text-[#222f30]",
    line2Class: "block text-[#445e5f]",
  },
  {
    id: "B",
    label: "B · Charcoal sólido compacto",
    h1Class:
      "uppercase text-[8.5vw] sm:text-5xl lg:text-[4.25rem] font-semibold tracking-[-0.035em] leading-[0.93]",
    line1Class: "block text-[#222f30]",
    line2Class: "block text-[#222f30]",
  },
  {
    id: "C",
    label: "C · Degradado metálico Charcoal → Gris",
    h1Class:
      "uppercase text-[8.5vw] sm:text-5xl lg:text-[4.25rem] font-semibold tracking-[-0.03em] leading-[0.94]",
    line1Class: "block",
    line2Class: "block",
    line1Style: {
      backgroundImage:
        "linear-gradient(180deg, #1b2627 0%, #222f30 55%, #566f70 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    line2Style: {
      backgroundImage:
        "linear-gradient(180deg, #222f30 0%, #445e5f 60%, #6e8586 100%)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
  },
  {
    id: "D",
    label: "D · Blanco + Gris salvia (con relieve sutil)",
    h1Class:
      "uppercase text-[8.5vw] sm:text-5xl lg:text-[4.25rem] font-semibold tracking-[-0.03em] leading-[0.94] drop-shadow-[0_2px_18px_rgba(34,47,48,0.28)]",
    line1Class: "block text-white",
    line2Class: "block text-[#e7e8e1]",
  },
  {
    id: "E",
    label: "E · Técnico Mono + Sans (Estilo editorial)",
    h1Class:
      "uppercase text-[8vw] sm:text-5xl lg:text-[3.9rem] font-semibold tracking-[0.02em] leading-[0.96]",
    line1Class: "block text-[#445e5f] font-mono font-medium text-[0.58em] tracking-[0.14em] mb-2",
    line2Class: "block text-[#222f30]",
  },
]

export function HeroV3() {
  const { t } = useLanguage()
  const [presetId, setPresetId] = useState<PresetId>("A")
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]

  const frameRef = useRef<HTMLElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  // Cursor-following glow, spring-smoothed with rAF
  useEffect(() => {
    const section = sectionRef.current
    const glow = glowRef.current
    if (!section || !glow) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    let raf = 0
    let active = false
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }

    const onMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect()
      target.x = e.clientX - rect.left
      target.y = e.clientY - rect.top
      glow.style.opacity = "1"
      if (!active) {
        active = true
        loop()
      }
    }

    const onLeave = () => {
      glow.style.opacity = "0"
    }

    const loop = () => {
      current.x += (target.x - current.x) * 0.08
      current.y += (target.y - current.y) * 0.08
      glow.style.transform = `translate(${current.x - 330}px, ${current.y - 330}px)`

      raf = requestAnimationFrame(loop)
    }

    section.addEventListener("mousemove", onMove)
    section.addEventListener("mouseleave", onLeave)
    return () => {
      section.removeEventListener("mousemove", onMove)
      section.removeEventListener("mouseleave", onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  // On scroll, the framed card stretches to full width (padding and radius collapse to 0)
  useEffect(() => {
    const frame = frameRef.current
    const card = sectionRef.current
    if (!frame || !card) return

    const onScroll = () => {
      const progress = Math.min(window.scrollY / 320, 1)
      const pad = 15 * (1 - progress)
      frame.style.padding = `${pad}px`
      card.style.borderRadius = `${21 * (1 - progress)}px`
      card.style.height = `calc(100vh - ${pad * 2}px)`
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <section ref={frameRef} className="bg-[#f7f7f5] p-[15px]">
      <div
        ref={sectionRef}
        className="relative h-[calc(100vh-30px)] min-h-[660px] rounded-[21px] overflow-hidden flex flex-col justify-between"
      >
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/hero1.jpg"
            alt="OLA Datacenter"
            fill
            className="object-cover object-center"
            quality={100}
            priority
          />
        </div>

        {/* Drifting cloud */}
        <Image
          src="/cloud.webp?v=2"
          alt=""
          aria-hidden
          width={1122}
          height={557}
          className="hero-cloud absolute top-[16%] left-0 w-[220px] md:w-[280px] h-auto opacity-70 pointer-events-none select-none"
        />

        {/* Cursor-following glow */}
        <div
          ref={glowRef}
          className="absolute top-0 left-0 w-[660px] h-[660px] rounded-full pointer-events-none opacity-0 transition-opacity duration-700 mix-blend-screen"
          style={{
            background:
              "radial-gradient(50% 50%, rgba(206,247,158,0.32) 0%, rgba(206,247,158,0.14) 38%, rgba(206,247,158,0.05) 62%, transparent 75%)",
            filter: "blur(32px)",
          }}
        />

        {/* Headline block */}
        <div className="relative z-10 px-6 pt-36 md:px-14 md:pt-52">
          <h1 className={preset.h1Class}>
            <span style={preset.line1Style} className={preset.line1Class}>
              Edge Green
            </span>
            <span style={preset.line2Style} className={preset.line2Class}>
              Datacenter
            </span>
          </h1>
        </div>

        {/* Selector temporal de pruebas */}
        <div className="fixed bottom-5 right-5 z-50 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#222f30]/90 backdrop-blur-md p-1.5 shadow-lg border border-white/10">
          <span className="label-mono text-white/60 px-2">Pruebas H1:</span>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPresetId(p.id)}
              title={p.label}
              className={`px-2.5 py-1 rounded text-xs font-mono uppercase transition-colors ${
                presetId === p.id
                  ? "bg-[#cef79e] text-[#222f30] font-medium"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              {p.id}
            </button>
          ))}
        </div>

        {/* Bottom block: subheadline + CTAs */}
        <div className="relative z-10 px-6 pb-10 md:px-14 md:pb-14">
          <p className="text-lg md:text-xl text-text-base max-w-xl mb-8 leading-relaxed font-normal">
            {t("Sovereign infrastructure. Extreme performance.", "Infraestructura soberana. Rendimiento extremo.")}{" "}
            <br className="hidden sm:block" />
            {t(
              "Designed to power AI and mission-critical workloads.",
              "Diseñada para potenciar IA y cargas críticas."
            )}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <ArrowCta href="/products">
              {t("Explore solutions", "Explorar soluciones")}
            </ArrowCta>
            <ArrowCta href="/contact" variant="light">
              {t("Talk to an expert", "Hablar con un experto")}
            </ArrowCta>
          </div>
        </div>
      </div>
    </section>
  )
}

