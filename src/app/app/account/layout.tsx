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
    <div className="max-w-[920px]">
      <PageTitle description="Tus datos, tu seguridad y tus claves de acceso.">
        Mi cuenta
      </PageTitle>
      <AccountTabs />
      {children}
    </div>
  )
}
