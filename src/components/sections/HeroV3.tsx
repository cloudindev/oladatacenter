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

// Headline gradient, same as raft.ai (golden sweep from bottom-left into near-black)
const headlineGradient: React.CSSProperties = {
  backgroundImage:
    "radial-gradient(98% 164% at -5.4% 124.2%, rgb(255, 200, 102) 0%, rgb(141, 114, 67) 40%, rgb(62, 48, 24) 77%, rgb(19, 21, 23) 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
  paddingBottom: "0.12em",
}

export function HeroV3() {
  const { lang, t } = useLanguage()

  const frameRef = useRef<HTMLElement>(null)
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
    <section ref={frameRef} className="bg-[#F2F2F2] p-[15px]">
      <div
        ref={sectionRef}
        className="relative h-[calc(100vh-30px)] min-h-[660px] rounded-[21px] overflow-hidden flex flex-col justify-between"
      >
        {/* Background image with parallax */}
        <div ref={bgRef} className="absolute inset-0 will-change-transform scale-[1.08]">
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
              "radial-gradient(50% 50%, rgba(0,255,199,0.32) 0%, rgba(0,255,199,0.14) 38%, rgba(0,255,199,0.05) 62%, transparent 75%)",
            filter: "blur(32px)",
          }}
        />

        {/* Headline block */}
        <div className="relative z-10 px-6 pt-28 md:px-14 md:pt-36">
          <h1 className="text-[13vw] sm:text-7xl lg:text-[6.5rem] font-medium tracking-[-0.05em] leading-[0.98]">
            <span style={headlineGradient} className="block">
              {t("AI Cloud", "AI Cloud")}
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
          <p className="text-lg md:text-xl text-[#191918] max-w-xl mb-8 leading-relaxed font-normal">
            {t("Sovereign infrastructure. Extreme performance.", "Infraestructura soberana. Rendimiento extremo.")}{" "}
            <br className="hidden sm:block" />
            {t(
              "Designed to power AI and mission-critical workloads.",
              "Diseñada para potenciar IA y cargas críticas."
            )}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {/* Primary: dark glass pill whose white chip expands to fill on hover */}
            <Link
              href="/products"
              className="group relative flex items-center h-14 pl-7 pr-1 rounded-lg overflow-clip bg-[rgba(25,25,24,0.4)] backdrop-blur-[20px]"
            >
              <span
                aria-hidden
                className="absolute inset-y-1 right-1 left-[calc(100%-52px)] rounded-md bg-[#f9f9f6] transition-[left] duration-[420ms] ease-out group-hover:left-1"
              />
              <span className="relative text-sm font-normal text-[#f9f9f6] mr-10 transition-colors duration-300 group-hover:text-[#191918]">
                {t("Explore solutions", "Explorar soluciones")}
              </span>
              <span className="relative w-12 h-12 flex items-center justify-center text-[#333333]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </Link>

            {/* Secondary: frosted glass pill with warm chip, same expanding hover */}
            <Link
              href="/contact"
              className="group relative flex items-center h-14 pl-7 pr-1 rounded-lg overflow-clip bg-white/[0.03] backdrop-blur-[20px]"
            >
              <span
                aria-hidden
                className="absolute inset-y-1 right-1 left-[calc(100%-52px)] rounded-md bg-[#dcd9cb] transition-[left] duration-[420ms] ease-out group-hover:left-1"
              />
              <span className="relative text-sm font-normal text-[#191918] mr-10">
                {t("Talk to an expert", "Hablar con un experto")}
              </span>
              <span className="relative w-12 h-12 flex items-center justify-center text-[#333333]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
