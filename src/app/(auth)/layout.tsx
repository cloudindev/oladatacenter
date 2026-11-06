import type { Metadata } from "next"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

/**
 * Shell for every authentication screen.
 *
 * It reuses the site's own `Header` and `Footer` and the editorial canvas of
 * oladc.com: off-white background, one hairline rule, no card and no shadow. The
 * screens themselves are Server Components; the layout adds no state of its own.
 */

export const metadata: Metadata = {
  title: "Acceso · OLA VPS Cloud",
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />
      <section className="flex-1 flex items-center w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[164px] pb-20 md:pb-32">
        {children}
      </section>
      <Footer />
    </main>
  )
}
