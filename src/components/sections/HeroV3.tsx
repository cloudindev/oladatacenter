"use client"

import React, { useEffect, useRef } from "react"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"

// Headline colour: solid charcoal token, as on integratedbio.com
const headlineColor: React.CSSProperties = {
  color: "var(--ag-sys-color-text-light)",
  paddingBottom: "0.12em",
}

export function HeroV3() {
  const { t } = useLanguage()

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
        <div className="relative z-10 px-6 pt-28 md:px-14 md:pt-36">
          <h1 className="text-[13vw] sm:text-7xl lg:text-[6.5rem] font-light tracking-[-0.05em] leading-[0.98]">
            <span style={headlineColor} className="block">
              Edge Green
            </span>
            <span style={headlineColor} className="block -mt-[0.16em]">
              Datacenter
            </span>
          </h1>
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
