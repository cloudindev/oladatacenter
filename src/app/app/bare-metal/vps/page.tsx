import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"
import {
  ButtonLink,
  EmptyState,
  Notice,
  PageTitle,
  Panel,
  StatusBadge,
  SERVICE_STATUS_UI,
} from "@/components/app/ui"
import { CopyField } from "@/components/servers/CopyField"
import { EmptyServersIllustration } from "@/components/servers/EmptyServersIllustration"
import { dunningWarning, formatDate, specsLine, TERM_LABEL } from "@/components/servers/labels"
import { creditSummary } from "@/server/billing/credit"
import { customerContext } from "@/server/services/customer"
import { load } from "@/server/services/load"
import { pendingOrderHref } from "@/server/pending-order"
import { pendingOrderSummary } from "@/server/pending-order-summary"
import { discardPendingOrder } from "../../pending-order-actions"
import { listServicesForCustomer } from "@/server/services/repository"
import { whmcsProductsOfKind } from "@/server/whmcs-products"
import { ManagedByCloudinNote, WhmcsProductTable, WhmcsReadNotice } from "@/components/app/WhmcsProducts"
import { Eyebrow } from "@/components/app/ui"
import type { ServiceListItem } from "@/server/services/types"

/**
 * Bare Metal Cloud → VPS: every server of the customer.
 *
 * Reads only our own database, so it answers fast and keeps working when OVH does not.
 * The live power state belongs to the detail page, where we actually ask the provider.
 */

export const metadata: Metadata = {
  title: "VPS · Bare Metal Cloud · OLA",
}

export default async function ServersPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>Tus servidores</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tus servidores">
          {context.message}
        </Notice>
      </>
    )
  }

  const [services, credit, pendingOrder] = await Promise.all([
    load("listServicesForCustomer", () => listServicesForCustomer(context.customerId)),
    load("creditSummary", () => creditSummary(context.customerId)),
    pendingOrderHref(),
  ])
  const otherVps = await whmcsProductsOfKind(context.customerId, "vps")
  const pendingSummary = pendingOrder ? await pendingOrderSummary(pendingOrder) : null

  return (
    <>
      <PageTitle
        description="Todo lo que tienes contratado con nosotros, con su estado y su próxima renovación."
        action={
          <ButtonLink href="/vps/configurar" withArrow>
            Crear servidor
          </ButtonLink>
        }
      >
        Servidores privados virtuales (VPS)
      </PageTitle>

      {pendingOrder ? (
        <div className="mb-6">
          <Notice
            tone="ok"
            title="Tienes un servidor a medio contratar"
            action={
              <div className="flex flex-wrap items-center gap-3">
                <form action={discardPendingOrder}>
                  <button
                    type="submit"
                    className="label-mono text-text-muted underline-offset-4 hover:text-text-base hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
                  >
                    Descartar
                  </button>
                </form>
                <ButtonLink href={pendingOrder} withArrow>
                  Continuar con tu pedido
                </ButtonLink>
              </div>
            }
          >
            {pendingSummary ?? "Guardamos la configuración que elegiste."}
          </Notice>
        </div>
      ) : null}

      {credit.ok && credit.data.expiringSoon && credit.data.expiringAt ? (
        <div className="mb-6">
          <Notice tone="warn" title="Tu saldo está a punto de caducar">
            Te quedan {formatCents(credit.data.expiringAmount)} de saldo que caducan el{" "}
            {formatDate(credit.data.expiringAt)}. Se aplican solos en tu próxima factura.
          </Notice>
        </div>
      ) : null}

      {!services.ok ? (
        <Notice tone="warn" title="No hemos podido cargar tus servidores">
          {services.message} Vuelve a intentarlo en unos minutos.
        </Notice>
      ) : services.data.length === 0 ? (
        <EmptyState
          illustration={<EmptyServersIllustration className="h-auto w-full text-bg-dark" />}
          action={
            <ButtonLink href="/vps/configurar" withArrow>
              Crear servidor
            </ButtonLink>
          }
        >
          {otherVps.state === "ok" && otherVps.items.some((item) => item.live)
            ? "Todavía no has creado ningún servidor desde OLA. Abajo tienes los VPS que ya tenías con nosotros."
            : "Todavía no tienes ningún servidor con nosotros."}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {services.data.map((service) => (
            <li key={service.id}>
              <ServerCard service={service} />
            </li>
          ))}
        </ul>
      )}

      {otherVps.state === "unavailable" || (otherVps.state === "ok" && otherVps.items.length > 0) ? (
        <section className="mt-10">
          <Eyebrow>Otros VPS de tu cuenta</Eyebrow>
          <WhmcsReadNotice read={otherVps} what="tus otros VPS" />
          {otherVps.state === "ok" ? (
            <>
              <WhmcsProductTable items={otherVps.items} showIps />
              <ManagedByCloudinNote />
            </>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

function ServerCard({ service }: { service: ServiceListItem }) {
  const statusUi = SERVICE_STATUS_UI[service.status] ?? {
    label: "Estado desconocido",
    tone: "neutral" as const,
  }
  const warning = dunningWarning(service.dunningStage, service.status)

  return (
    <Panel as="article">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-normal tracking-tight text-text-base">
              <Link
                href={`/app/servers/${service.id}`}
                className="hover:text-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
              >
                {service.name}
              </Link>
            </h2>
            <StatusBadge tone={statusUi.tone} pulse={service.status === "provisioning"}>
              {statusUi.label}
            </StatusBadge>
            {service.rescueMode ? <StatusBadge tone="warn">Modo rescate</StatusBadge> : null}
          </div>

          <p className="mt-2 text-sm text-text-muted">
            {service.planName} · {specsLine(service.specs)}
          </p>

          <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div className="flex gap-2 min-w-0">
              <dt className="label-mono text-text-muted shrink-0 pt-0.5">IPv4</dt>
              <dd className="min-w-0">
                {service.ipv4 ? (
                  <CopyField value={service.ipv4} label="la IPv4" />
                ) : (
                  <span className="text-sm text-text-muted">Se asigna al crear el servidor</span>
                )}
              </dd>
            </div>
            <div className="flex gap-2 min-w-0">
              <dt className="label-mono text-text-muted shrink-0 pt-0.5">Sistema</dt>
              <dd className="text-sm text-text-base truncate">{service.os}</dd>
            </div>
            <div className="flex gap-2 min-w-0">
              <dt className="label-mono text-text-muted shrink-0 pt-0.5">Ubicación</dt>
              <dd className="text-sm text-text-base">{service.datacenterLabel}</dd>
            </div>
            <div className="flex gap-2 min-w-0">
              <dt className="label-mono text-text-muted shrink-0 pt-0.5">Renovación</dt>
              <dd className="text-sm text-text-base">
                {service.nextDueAt ? formatDate(service.nextDueAt) : "—"} ·{" "}
                {TERM_LABEL[service.term] ?? service.term} · {formatCents(service.monthlyPrice)}
                /mes
              </dd>
            </div>
          </dl>
        </div>

        <div className="shrink-0">
          <ButtonLink href={`/app/servers/${service.id}`} variant="secondary">
            Gestionar
          </ButtonLink>
        </div>
      </div>

      {warning ? (
        <div className="mt-5">
          <Notice tone={warning.tone} title={warning.title}>
            {warning.body}
          </Notice>
        </div>
      ) : null}

      {!service.autoRenew && service.status !== "terminated" ? (
        <div className="mt-5">
          <Notice tone="warn" title="La renovación está cancelada">
            Este servidor se dará de baja el{" "}
            {service.nextDueAt ? formatDate(service.nextDueAt) : "final del periodo"}. Puedes
            volver a activar la renovación desde la pestaña de plan.
          </Notice>
        </div>
      ) : null}
    </Panel>
  )
}
