import type { Metadata } from "next"
import Link from "next/link"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { AdminNav } from "@/components/admin/nav"
import { requireAdminPage } from "@/server/admin/queries"

/**
 * The admin shell.
 *
 * `requireAdminPage()` wraps `requireAdmin()` — role `admin` plus a TOTP-verified
 * session — so no admin route renders without it, the layout included.
 *
 * The dark bar is the "you are inside the internal panel" marker, and it is not subtle on
 * purpose: everything below it may show costs, margins, OVH service names and WHMCS ids.
 */
export const metadata: Metadata = {
  title: "Panel interno · OLA",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, impersonation } = await requireAdminPage()

  return (
    <div className="min-h-screen bg-bg-light">
      {impersonation ? (
        <ImpersonationBanner
          customerEmail={impersonation.customerEmail}
          startedAt={impersonation.startedAt.toISOString()}
        />
      ) : null}

      <header className="bg-bg-dark">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="label-mono rounded-md border border-primary px-2 py-1 text-primary"
            >
              Panel interno
            </Link>
            <p className="hidden text-xs text-text-sage sm:block">
              Costes, márgenes e identificadores de OVH y WHMCS. No sale de aquí.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="label-mono text-text-sage">{session.user.email}</span>
            <Link
              href="/app"
              className="label-mono text-text-sage underline decoration-dotted underline-offset-4 hover:text-text-dark"
            >
              Área de cliente
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-[110rem] px-4 pb-3 sm:px-6">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
