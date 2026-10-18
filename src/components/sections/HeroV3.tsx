"use client"

import React, { useEffect, useRef } from "react"
import Image from "next/image"
import { useLanguage } from "@/context/LanguageContext"
import { ArrowCta } from "@/components/ui/ArrowCta"

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

        {/* Top spacer so bottom block anchors cleanly at the bottom */}
        <div aria-hidden />

        {/* Bottom block: headline + subheadline + CTAs aligned left */}
        <div className="relative z-10 px-6 pb-10 md:px-14 md:pb-14">
          <h1 className="font-[family-name:var(--font-montserrat)] font-black uppercase text-bg-dark text-[8.5vw] sm:text-5xl lg:text-[4.25rem] tracking-[-0.03em] leading-[0.95] mb-5 text-left">
            <span className="block">Edge Green</span>
            <span className="block">Datacenter</span>
          </h1>

          <p className="text-lg md:text-xl text-text-base max-w-xl mb-8 leading-relaxed font-medium text-left">
            {t(
              "The ecosystem for enterprise AI. Extreme performance.",
              "El ecosistema para la IA empresarial. Rendimiento extremo."
            )}{" "}
            <br className="hidden sm:block" />
            {t(
              "Scalable and secure solutions for data hosting",
              "Soluciones escalables y seguras para el alojamiento de datos"
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

