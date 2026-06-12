import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

// V2 Sections (Light Theme)
import { HeroV2 } from "@/components/sections/HeroV2"
import { FeaturesBar } from "@/components/sections/FeaturesBar"
import { ArchitectureSection } from "@/components/sections/ArchitectureSection"
import { HardwareSectionV2 } from "@/components/sections/HardwareSectionV2"
import { SolutionsSection } from "@/components/sections/SolutionsSection"
import { DatacenterBanner } from "@/components/sections/DatacenterBanner"

// V1 Sections (Dark Theme)
import { Hero } from "@/components/sections/Hero"
import { PromiseSection } from "@/components/sections/PromiseSection"
import { DatacenterSection } from "@/components/sections/DatacenterSection"
import { HardwareSection } from "@/components/sections/HardwareSection"
import { CloudSection } from "@/components/sections/CloudSection"
import { StatsBar } from "@/components/sections/StatsBar"
import { CtaBanner } from "@/components/sections/CtaBanner"

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-bg-light">
        {/* NEW V2 DESIGN SECTIONS */}
        <HeroV2 />
        <FeaturesBar />
        <ArchitectureSection />
        <HardwareSectionV2 />
        <SolutionsSection />
        <DatacenterBanner />

        {/* VISUAL SEPARATOR */}
        <div className="py-24 bg-red-500/10 border-y-4 border-red-500 border-dashed text-center">
          <h2 className="text-3xl font-bold text-red-500 mb-2">--- V1 / OLD SECTIONS BELOW ---</h2>
          <p className="text-red-400">These are kept here for your review and comparison. You can delete them later.</p>
        </div>

        {/* OLD V1 DESIGN SECTIONS */}
        <Hero />
        <PromiseSection />
        <DatacenterSection />
        <HardwareSection />
        <CloudSection />
        <StatsBar />
        <CtaBanner />
      </main>
      <Footer />
    </>
  )
}
