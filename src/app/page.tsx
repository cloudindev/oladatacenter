import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
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
      <main className="flex-1">
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
