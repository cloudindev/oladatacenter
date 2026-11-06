import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { destroySession } from "@/server/auth/session"
import { customerContext } from "@/server/services/customer"
import { AppNav } from "@/components/servers/AppNav"

/**
 * Shell of the customer area.
 *
 * Deliberately not the public marketing header: inside the panel the only navigation
 * that matters is servers, billing and account. Same language as oladc.com — off-white
 * canvas, hairline borders, monospace uppercase labels.
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
      <header className="border-b border-border-base bg-surface-light">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-16">
            <Link
              href="/app"
              className="flex items-center gap-2 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              aria-label="Panel de OLA"
            >
              <Image
                src="/ola-logo-panel.png"
                alt="OLA"
                width={900}
                height={213}
                priority
                className="h-6 w-auto"
              />
              <span className="label-mono text-text-base hidden sm:inline">
                Panel de cliente
              </span>
            </Link>

            <div className="flex items-center gap-4 min-w-0">
              {context.ok ? (
                <span className="label-mono text-text-muted truncate max-w-[12rem] hidden sm:inline">
                  {context.email}
                </span>
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

          <AppNav />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">{children}</div>
      </main>

      <footer className="border-t border-border-base">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-wrap gap-x-6 gap-y-2">
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
