import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { destroySession } from "@/server/auth/session"
import { customerContext } from "@/server/services/customer"
import { SideMenu, UniverseTabs } from "@/components/app/shell/AppShellNav"

/**
 * Shell of the customer area, organised like the OVHcloud manager: universes across the
 * top (Inicio, Bare Metal Cloud, Web Cloud) and the current universe's menu on the left.
 * Same language as oladc.com: off-white canvas, hairline borders, monospace labels.
 */

export const metadata: Metadata = {
  title: "Panel de cliente · OLA VPS Cloud",
  description: "Gestiona tus servidores, tus facturas y tu cuenta.",
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await customerContext()

  async function signOut(): Promise<void> {
    "use server"
    await destroySession()
    redirect("/login")
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg-light">
      <header className="sticky top-0 z-30 border-b border-border-base bg-surface-light">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex items-center gap-4 h-16">
            <Link
              href="/app"
              className="flex items-center gap-2 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              aria-label="Inicio del panel de OLA"
            >
              <Image
                src="/ola-logo-panel.png"
                alt="OLA"
                width={900}
                height={213}
                priority
                className="h-6 w-auto"
              />
            </Link>

            <div className="hidden md:block min-w-0 flex-1 pl-4">
              <UniverseTabs />
            </div>

            <div className="ml-auto flex items-center gap-4 min-w-0">
              {context.ok ? (
                <Link
                  href="/app/account"
                  className="label-mono text-text-muted hover:text-text-base truncate max-w-[14rem] hidden sm:inline"
                >
                  {context.email}
                </Link>
              ) : null}
              <form action={signOut}>
                <button
                  type="submit"
                  className="label-mono text-text-muted hover:text-text-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>

          <div className="md:hidden pb-3">
            <UniverseTabs />
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:flex lg:gap-8">
        <aside className="pt-5 lg:pt-8 lg:w-60 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <SideMenu />
          </div>
        </aside>

        <main className="min-w-0 flex-1 py-6 sm:py-8 lg:py-10">{children}</main>
      </div>

      <footer className="border-t border-border-base">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 flex flex-wrap gap-x-6 gap-y-2">
          <p className="label-mono text-text-muted">OLA Datacenter</p>
          <Link href="/legal/terms" className="label-mono text-text-muted hover:text-text-base">
            Condiciones
          </Link>
          <Link href="/legal/privacy" className="label-mono text-text-muted hover:text-text-base">
            Privacidad
          </Link>
          <Link href="/contact" className="label-mono text-text-muted hover:text-text-base">
            Soporte
          </Link>
        </div>
      </footer>
    </div>
  )
}
