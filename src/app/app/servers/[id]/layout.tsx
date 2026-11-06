import Link from "next/link"
import { notFound } from "next/navigation"
import { Notice, StatusBadge, SERVICE_STATUS_UI } from "@/components/app/ui"
import { TabBar } from "@/components/servers/TabBar"
import { specsLine } from "@/components/servers/labels"
import { serviceForPage } from "@/server/services/page-data"

/**
 * Frame of one server: its name, its status, and the tab bar. Each tab is a route
 * segment of its own, so this layout stays mounted while the customer moves between
 * them and only the panel below changes.
 */
export default async function ServerLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const page = await serviceForPage(id)

  if (page.state === "missing") notFound()

  if (page.state === "unavailable") {
    return (
      <div>
        <Link href="/app" className="label-mono text-text-muted hover:text-text-base">
          ← Tus servidores
        </Link>
        <div className="mt-6">
          <Notice tone="warn" title="No hemos podido cargar este servidor">
            {page.message} Vuelve a intentarlo en unos minutos.
          </Notice>
        </div>
      </div>
    )
  }

  const { service } = page
  const statusUi = SERVICE_STATUS_UI[service.status] ?? {
    label: "Estado desconocido",
    tone: "neutral" as const,
  }

  return (
    <div>
      <Link
        href="/app"
        className="label-mono text-text-muted hover:text-text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
      >
        ← Tus servidores
      </Link>

      <div className="mt-5 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-text-base break-words">
            {service.name}
          </h1>
          <StatusBadge tone={statusUi.tone} pulse={service.status === "provisioning"}>
            {statusUi.label}
          </StatusBadge>
          {service.rescueMode ? <StatusBadge tone="warn">Modo rescate</StatusBadge> : null}
        </div>
        <p className="mt-2 text-text-muted">
          {service.planName} · {specsLine(service.specs)} · {service.datacenterLabel}
        </p>
      </div>

      <TabBar serviceId={service.id} />

      <div className="pt-8">{children}</div>
    </div>
  )
}
