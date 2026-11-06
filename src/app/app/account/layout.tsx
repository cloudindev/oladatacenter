import type { Metadata } from "next"
import { PageTitle } from "@/components/app/ui"
import { AccountTabs } from "@/components/auth/AccountTabs"
import { requireUser } from "@/server/auth/session"

/**
 * Shell for /app/account. The gate lives here as well as in every action: a layout can
 * be bypassed by calling an action directly, so neither check is redundant.
 */

export const metadata: Metadata = {
  title: "Mi cuenta · OLA VPS Cloud",
  robots: { index: false, follow: false },
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser()

  return (
    <div className="flex-1 bg-bg-light">
      <div className="w-full max-w-[920px] mx-auto px-6 md:px-10 py-12 md:py-16">
        <PageTitle description="Tus datos, tu seguridad y tus claves de acceso.">
          Mi cuenta
        </PageTitle>
        <AccountTabs />
        {children}
      </div>
    </div>
  )
}
