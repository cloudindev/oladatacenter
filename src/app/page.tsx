import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

// V3 Hero (interactive, Raft-style)
import { HeroV3 } from "@/components/sections/HeroV3"
import { IntegratedPlatformSection } from "@/components/sections/IntegratedPlatformSection"
import { ArchitectureSection } from "@/components/sections/ArchitectureSection"
import { SolutionsSection } from "@/components/sections/SolutionsSection"
import { DatacenterBanner } from "@/components/sections/DatacenterBanner"
import { PeopleHelpSection } from "@/components/sections/PeopleHelpSection"

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

        {/* FINAL CLOSING BANNER */}
        <DatacenterBanner />
        <PeopleHelpSection />
      </main>
      <Footer />
    </>
  )
}
