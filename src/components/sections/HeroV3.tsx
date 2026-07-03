"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"

// Rotating words shown after "for" / "para"
const WORDS = [
  { en: "training.", es: "entrenamiento." },
  { en: "inference.", es: "inferencia." },
  { en: "sovereign data.", es: "datos soberanos." },
  { en: "next-gen.", es: "nueva generación." },
]

// Raft-style gradient fill applied to the headline via background-clip
const headlineGradient: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(120% 180% at -5% 120%, #00FFC7 0%, #8cffe6 32%, #eafff9 68%, #ffffff 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  paddingBottom: "0.12em",
}

export function HeroV3() {
  const { lang, t } = useLanguage()

  const sectionRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLSpanElement>(null)

  const [wordIndex, setWordIndex] = useState(0)
  const [wordVisible, setWordVisible] = useState(true)
  const [wordWidth, setWordWidth] = useState<number | null>(null)

  // Cursor-following glow + subtle background parallax, spring-smoothed with rAF
  useEffect(() => {
    const section = sectionRef.current
    const glow = glowRef.current
    const bg = bgRef.current
    if (!section || !glow || !bg) return

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

      const rect = section.getBoundingClientRect()
      const nx = current.x / rect.width - 0.5
      const ny = current.y / rect.height - 0.5
      bg.style.transform = `scale(1.08) translate(${nx * -18}px, ${ny * -12}px)`

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

  // Word rotation: fade/blur out, swap, fade/blur in
  useEffect(() => {
    const interval = setInterval(() => {
      setWordVisible(false)
      setTimeout(() => {
        setWordIndex((i) => (i + 1) % WORDS.length)
        setWordVisible(true)
      }, 450)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Measure the active word so the container width animates between words
  useEffect(() => {
    if (rulerRef.current) setWordWidth(rulerRef.current.offsetWidth)
  }, [wordIndex, lang])

  const word = lang === "es" ? WORDS[wordIndex].es : WORDS[wordIndex].en

  return (
    <section className="bg-[#0d0d0d] p-[15px]">
      <div
        ref={sectionRef}
        className="relative h-[calc(100vh-30px)] min-h-[660px] rounded-[21px] overflow-hidden flex flex-col justify-between"
      >
        {/* Background image with parallax */}
        <div ref={bgRef} className="absolute inset-0 will-change-transform scale-[1.08]">
          <Image
            src="/ola-datacenter-hero.jpg"
            alt="OLA Datacenter"
            fill
            className="object-cover object-center"
            quality={100}
            priority
          />
        </div>

        {/* Legibility overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Cursor-following glow */}
        <div
          ref={glowRef}
          className="absolute top-0 left-0 w-[660px] h-[660px] rounded-full pointer-events-none opacity-0 transition-opacity duration-700 mix-blend-screen"
          style={{
            background:
              "radial-gradient(50% 50%, rgba(0,255,199,0.32) 0%, rgba(0,255,199,0.14) 38%, rgba(0,255,199,0.05) 62%, transparent 75%)",
            filter: "blur(32px)",
          }}
        />

        {/* Headline block */}
        <div className="relative z-10 px-6 pt-28 md:px-14 md:pt-36">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="text-primary text-xs font-bold tracking-widest uppercase">
              {t("✦ Built for cloud. Designed for AI", "✦ Creado para la nube. Diseñado para IA")}
            </span>
          </div>

          <h1 className="text-[13vw] sm:text-7xl lg:text-[6.5rem] font-medium tracking-[-0.05em] leading-[0.98]">
            <span style={headlineGradient} className="block">
              {t("The AI cloud", "La nube de IA")}
            </span>
            <span style={headlineGradient} className="block">
              {t("for", "para")}{" "}
              <span
                className="inline-flex overflow-hidden align-bottom transition-[width] duration-500 ease-out"
                style={{ width: wordWidth ? `${wordWidth}px` : "auto" }}
              >
                <span
                  style={headlineGradient}
                  className={
                    "inline-block whitespace-nowrap transition-all duration-500 " +
                    (wordVisible
                      ? "opacity-100 translate-y-0 blur-0"
                      : "opacity-0 translate-y-4 blur-sm")
                  }
                >
                  {word}
                </span>
              </span>
            </span>
          </h1>

          {/* Invisible ruler to measure the active word width */}
          <span
            ref={rulerRef}
            aria-hidden="true"
            className="absolute invisible whitespace-nowrap text-[13vw] sm:text-7xl lg:text-[6.5rem] font-medium tracking-[-0.05em]"
          >
            {word}
          </span>
        </div>

        {/* Bottom block: subheadline + CTAs */}
        <div className="relative z-10 px-6 pb-10 md:px-14 md:pb-14">
          <p className="text-base md:text-lg text-white/85 max-w-md mb-8 leading-relaxed font-medium">
            {t("Sovereign infrastructure. Extreme performance.", "Infraestructura soberana. Rendimiento extremo.")}{" "}
            <br className="hidden sm:block" />
            {t(
              "Designed to power AI and mission-critical workloads.",
              "Diseñada para potenciar IA y cargas críticas."
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/products" className="group flex items-stretch">
              <span className="flex items-center bg-[#0d0d0d]/70 backdrop-blur-md text-white text-sm font-semibold px-6 rounded-l-xl border border-white/10 border-r-0 h-[52px] transition-colors group-hover:bg-[#0d0d0d]/90">
                {t("Explore solutions", "Explorar soluciones")}
              </span>
              <span className="flex items-center justify-center w-[52px] h-[52px] bg-white text-[#0d0d0d] rounded-r-xl border border-white transition-transform duration-300">
                <svg
                  className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </Link>

            <Link
              href="/contact"
              className="flex items-center h-[52px] px-6 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold transition-colors hover:bg-white/20"
            >
              {t("Talk to an expert", "Hablar con un experto")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
