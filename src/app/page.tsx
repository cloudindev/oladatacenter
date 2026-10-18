import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

// V3 Hero (interactive, Raft-style)
import { HeroV3 } from "@/components/sections/HeroV3"
import { IntegratedPlatformSection } from "@/components/sections/IntegratedPlatformSection"
import { ArchitectureSection } from "@/components/sections/ArchitectureSection"
import { SolutionsSection } from "@/components/sections/SolutionsSection"
import { DatacenterBanner } from "@/components/sections/DatacenterBanner"

// V1 Sections (Dark Theme) - Restored
import { PromiseSection } from "@/components/sections/PromiseSection"
import { CloudSection } from "@/components/sections/CloudSection"

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-bg-light">
        {/* NEW V3 HERO */}
        <HeroV3 />
        <IntegratedPlatformSection />
        <ArchitectureSection />
        <SolutionsSection />

        {/* OLD V1 DESIGN SECTIONS (Restored) */}
        <PromiseSection />
        <CloudSection />

        {/* FINAL CLOSING BANNER */}
        <DatacenterBanner />
      </main>
      <Footer />
    </>
  )
}
