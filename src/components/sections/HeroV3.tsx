"use client"

import React, { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"

// Rotating words shown after "for" / "para"
const WORDS = [
  { en: "agents", es: "agentes" },
  { en: "inference", es: "inferencia" },
  { en: "training", es: "training" },
  { en: "RAG", es: "RAG" },
  { en: "MLOps", es: "MLOps" },
]

// Headline colour: solid charcoal token, as on integratedbio.com (replaces the former gold gradient)
const headlineGradient: React.CSSProperties = {
  color: "var(--ag-sys-color-text-light)",
  paddingBottom: "0.12em",
}

export function HeroV3() {
  const { lang, t } = useLanguage()

  const frameRef = useRef<HTMLElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLSpanElement>(null)

  const [wordIndex, setWordIndex] = useState(0)
  const [wordVisible, setWordVisible] = useState(true)
  const [wordWidth, setWordWidth] = useState<number | null>(null)

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
        <div className="relative z-10 px-6 pt-28 md:px-14 md:pt-36">
          <h1 className="text-[13vw] sm:text-7xl lg:text-[6.5rem] font-light tracking-[-0.05em] leading-[0.98]">
            <span style={headlineGradient} className="block">
              {t("AI Cloud", "AI Cloud")}
            </span>
            <span style={headlineGradient} className="block -mt-[0.16em]">
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
            className="absolute invisible whitespace-nowrap text-[13vw] sm:text-7xl lg:text-[6.5rem] font-light tracking-[-0.05em]"
          >
            {word}
          </span>
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
            <ArrowCta href="/products" size="lg">
              {t("Explore solutions", "Explorar soluciones")}
            </ArrowCta>
            <ArrowCta href="/contact" size="lg" variant="light">
              {t("Talk to an expert", "Hablar con un experto")}
            </ArrowCta>
          </div>
        </div>
      </div>
    </section>
  )
}
