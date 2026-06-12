import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

// V2 Sections (Light Theme)
import { HeroV2 } from "@/components/sections/HeroV2"
import { FeaturesBar } from "@/components/sections/FeaturesBar"
import { ArchitectureSection } from "@/components/sections/ArchitectureSection"
import { HardwareSectionV2 } from "@/components/sections/HardwareSectionV2"
import { SolutionsSection } from "@/components/sections/SolutionsSection"
import { DatacenterBanner } from "@/components/sections/DatacenterBanner"


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

      </main>
      <Footer />
    </>
  )
}
