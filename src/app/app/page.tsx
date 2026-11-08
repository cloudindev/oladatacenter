import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CreditCard,
  Globe,
  HardDrive,
  KeyRound,
  Network,
  Server,
  Wallet,
} from "lucide-react"
import { formatCents } from "@ola/core"
import {
  ButtonLink,
  Notice,
  ORDER_STATUS_UI,
  PageTitle,
  Panel,
  StatusBadge,
} from "@/components/app/ui"
import { formatDate } from "@/components/servers/labels"
import { cn } from "@/lib/utils"
import { verificationSnapshot } from "@/server/auth/verification"
import { creditSummary, listInvoiceViews, listPaymentMethods } from "@/server/billing"
import {
  cardExpiresSoon,
  INVOICE_PERIODS,
  invoiceTotals,
  monthlyTotals,
  type InvoiceLike,
  renewalState,
} from "@/server/dashboard/model"
import { listOrdersForCustomer } from "@/server/orders/repository"
import { pendingOrderHref } from "@/server/pending-order"
import { pendingOrderSummary } from "@/server/pending-order-summary"
import { customerContext } from "@/server/services/customer"
import { load } from "@/server/services/load"
import {
  listPleskLicencesForCustomer,
  listServicesForCustomer,
} from "@/server/services/repository"
import { discardPendingOrder } from "./pending-order-actions"
import {
  BillingWidget,
  type BillingInvoiceRow,
  type BillingMonthView,
  type BillingPeriodView,
} from "@/components/app/BillingWidget"
import {
  whmcsBalanceFor,
  whmcsDomainsFor,
  whmcsInvoicesFor,
  whmcsProductsFor,
  type WhmcsProductView,
} from "@/server/whmcs-products"
import type { StatusTone } from "@/components/app/ui"

/** One line of the "payment state" card, whatever it comes from. */
interface PaymentRow {
  key: string
  href: string
  name: string
  subtitle: string
  icon: typeof Server
  label: string
  tone: StatusTone
  date: Date | null
  datePrefix: string
}

const WHMCS_KIND_UI: Record<WhmcsProductView["kind"], { title: string; href: string; icon: typeof Server }> = {
  web_hosting: { title: "Alojamiento web", href: "/app/web-cloud/alojamiento", icon: HardDrive },
  vps: { title: "Servidor privado virtual", href: "/app/bare-metal/vps", icon: Server },
  plesk_licence: { title: "Licencia Plesk", href: "/app/bare-metal/licencias", icon: KeyRound },
  ip: { title: "IP adicional", href: "/app/bare-metal/ip", icon: Network },
}

/**
 * Inicio: the dashboard, OVHcloud style. Every card reads our own database only, so the
 * page answers fast and keeps working when OVH, WHMCS or Stripe do not. Each card fails
 * on its own: one unavailable read never blanks the whole page.
 */

export const metadata: Metadata = {
  title: "Inicio · Panel de cliente · OLA",
}

export default async function DashboardPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>Inicio</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tu panel">
          {context.message}
        </Notice>
      </>
    )
  }

  const { customerId } = context
  const now = new Date()

  const [services, invoices, orders, licences, credit, cards, snapshot, pendingOrder] =
    await Promise.all([
      load("listServicesForCustomer", () => listServicesForCustomer(customerId)),
      load("listInvoiceViews", () => listInvoiceViews(customerId)),
      load("listOrdersForCustomer", () => listOrdersForCustomer(customerId, 1)),
      load("listPleskLicencesForCustomer", () => listPleskLicencesForCustomer(customerId)),
      load("creditSummary", () => creditSummary(customerId)),
      load("listPaymentMethods", () => listPaymentMethods(customerId)),
      load("verificationSnapshot", () => verificationSnapshot(context.session.user.id)),
      pendingOrderHref(),
    ])
  const [whmcsProducts, whmcsDomains, whmcsInvoices] = await Promise.all([
    whmcsProductsFor(customerId),
    whmcsDomainsFor(customerId),
    whmcsInvoicesFor(customerId),
  ])
  const balanceRead = await whmcsBalanceFor(customerId)
  const owed = balanceRead.state === "ok" ? balanceRead.items[0] : undefined
  const otherProducts = whmcsProducts.state === "ok" ? whmcsProducts.items.filter((p) => p.live) : []
  const otherDomains = whmcsDomains.state === "ok" ? whmcsDomains.items.filter((d) => d.live) : []
  const countOf = (kind: WhmcsProductView["kind"]) => otherProducts.filter((p) => p.kind === kind).length
  const pendingSummary = pendingOrder ? await pendingOrderSummary(pendingOrder) : null

  const liveServices = services.ok ? services.data.filter((s) => s.status !== "terminated") : []
  const ipCount =
    liveServices.reduce((sum, s) => sum + (s.ipv4 ? 1 : 0) + (s.ipv6 ? 1 : 0), 0) + countOf("ip")
  const activeLicences =
    (licences.ok ? licences.data.filter((l) => l.status !== "removed").length : 0) +
    countOf("plesk_licence")

  // OLA servers, then the customer's other products and domains, soonest renewal first.
  const paymentRows: PaymentRow[] = [
    ...liveServices.map((service): PaymentRow => {
      const state = renewalState(service)
      return {
        key: `ola-${service.id}`,
        href: `/app/servers/${service.id}`,
        name: service.name,
        subtitle: `Servidor privado virtual · ${service.planName}`,
        icon: Server,
        label: state.label,
        tone: state.tone,
        date: state.date,
        datePrefix: state.datePrefix,
      }
    }),
    ...otherProducts.map((product): PaymentRow => {
      const ui = WHMCS_KIND_UI[product.kind]
      return {
        key: `whmcs-${product.id}`,
        href: ui.href,
        name: product.label ?? product.name,
        subtitle: `${ui.title} · ${product.name}`,
        icon: ui.icon,
        label: product.statusLabel,
        tone: product.tone,
        date: product.nextDueAt,
        // WHMCS keeps the date of the last cycle when nothing was renewed: say so.
        datePrefix: product.nextDueAt && product.nextDueAt.getTime() < now.getTime() ? "venció el" : "renueva el",
      }
    }),
    ...otherDomains.map((domain): PaymentRow => ({
      key: `domain-${domain.id}`,
      href: "/app/web-cloud/dominios",
      name: domain.domain,
      subtitle: "Dominio",
      icon: Globe,
      label: domain.autoRenew ? domain.statusLabel : "No se renueva",
      tone: domain.autoRenew ? domain.tone : "warn",
      date: domain.expiresAt,
      datePrefix: domain.expiresAt && domain.expiresAt.getTime() < now.getTime() ? "caducó el" : "caduca el",
    })),
  ].sort(
    (a, b) =>
      (a.date?.getTime() ?? Number.POSITIVE_INFINITY) - (b.date?.getTime() ?? Number.POSITIVE_INFINITY),
  )
  // A customer linked to WHMCS: its invoices are the book of record. Otherwise, OLA's own.
  const invoiceLikes: InvoiceLike[] | null =
    whmcsInvoices.state === "ok"
      ? whmcsInvoices.items.map((invoice) => ({
          issuedAt: invoice.issuedAt ?? new Date(0),
          status: invoice.owed
            ? ("unpaid" as const)
            : invoice.statusLabel === "Anulada" || invoice.statusLabel === "Reembolsada"
              ? ("cancelled" as const)
              : ("paid" as const),
          total: invoice.totalCents,
        }))
      : invoices.ok
        ? invoices.data.map((invoice) => ({
            issuedAt: invoice.issuedAt,
            status: invoice.status,
            total: invoice.total,
          }))
        : null
  const periodViews: BillingPeriodView[] = invoiceLikes
    ? INVOICE_PERIODS.map((option) => {
        const totals = invoiceTotals(invoiceLikes, option.key, now)
        const paid = totals.total - totals.unpaid
        return {
          key: option.key,
          label: option.label,
          totalLabel: formatCents(totals.total),
          countLabel:
            totals.count === 0
              ? "Sin facturas en este periodo"
              : `${totals.count} ${totals.count === 1 ? "factura" : "facturas"}`,
          paidLabel: paid > 0 ? formatCents(paid) : null,
          unpaidLabel: totals.unpaid > 0 ? formatCents(totals.unpaid) : null,
        }
      })
    : []
  const monthViews: BillingMonthView[] = invoiceLikes
    ? monthlyTotals(invoiceLikes, 12, now).map((month) => ({
        ...month,
        totalLabel: formatCents(month.total),
      }))
    : []
  const latestInvoices: BillingInvoiceRow[] =
    whmcsInvoices.state === "ok"
      ? whmcsInvoices.items.slice(0, 3).map((invoice) => ({
          id: String(invoice.id),
          reference: invoice.reference,
          dateLabel: formatDate(invoice.issuedAt),
          totalLabel: formatCents(invoice.totalCents),
          statusLabel: invoice.statusLabel,
          tone: invoice.tone,
          href: `/app/billing/factura/${invoice.id}`,
        }))
      : invoices.ok
        ? invoices.data.slice(0, 3).map((invoice) => ({
            id: invoice.id,
            reference: invoice.reference,
            dateLabel: formatDate(invoice.issuedAt),
            totalLabel: invoice.totalLabel,
            statusLabel: invoice.statusLabel,
            tone: invoice.status === "paid" ? ("ok" as const) : invoice.status === "unpaid" ? ("warn" as const) : ("neutral" as const),
            href: null,
          }))
        : []
  const lastOrder = orders.ok ? (orders.data[0] ?? null) : null
  const defaultCard = cards.ok ? (cards.data.find((c) => c.isDefault) ?? cards.data[0] ?? null) : null
  const needsAttention = liveServices.filter((s) =>
    ["danger", "warn"].includes(renewalState(s).tone),
  ).length

  return (
    <>
      <PageTitle description="Vista general de tu actividad: servicios, pagos y pedidos.">
        Inicio
      </PageTitle>

      <div className="space-y-4 mb-6">
        {snapshot.ok && !snapshot.data.complete ? (
          <Notice
            tone="warn"
            title="Termina de verificar tu cuenta"
            action={
              <ButtonLink href="/onboarding" withArrow>
                Continuar
              </ButtonLink>
            }
          >
            Es necesario para contratar servidores.
          </Notice>
        ) : null}

        {pendingOrder ? (
          <Notice
            tone="ok"
            title="Tienes un servidor a medio contratar"
            action={
              <div className="flex flex-wrap items-center gap-3">
                <form action={discardPendingOrder}>
                  <button
                    type="submit"
                    className="label-mono text-text-muted underline-offset-4 hover:text-text-base hover:underline"
                  >
                    Descartar
                  </button>
                </form>
                <ButtonLink href={pendingOrder} withArrow>
                  Continuar
                </ButtonLink>
              </div>
            }
          >
            {pendingSummary ?? "Guardamos la configuración que elegiste."}
          </Notice>
        ) : null}

        {needsAttention > 0 ? (
          <Notice tone="danger" title="Hay servicios que necesitan tu atención">
            {needsAttention === 1 ? "Un servicio tiene" : `${needsAttention} servicios tienen`} un
            pago pendiente o la renovación cancelada. Revísalo abajo.
          </Notice>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Payment state of every service */}
        <Card
          className="xl:col-span-2 xl:row-span-2"
          title="Estado de pago de tus servicios"
          count={services.ok ? paymentRows.length : undefined}
          link={{ href: "/app/bare-metal/vps", label: "Ver todo" }}
        >
          {!services.ok ? (
            <p className="text-sm text-text-muted">{services.message}</p>
          ) : paymentRows.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-text-muted mb-5">Todavía no tienes ningún servicio.</p>
              <ButtonLink href="/vps/configurar" withArrow>
                Crear servidor
              </ButtonLink>
            </div>
          ) : (
            <ul className="divide-y divide-border-base">
              {paymentRows.slice(0, 8).map((row) => {
                const Icon = row.icon
                return (
                  <li
                    key={row.key}
                    className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-beige">
                        <Icon aria-hidden className="h-4 w-4 text-text-muted" strokeWidth={1.7} />
                      </span>
                      <div className="min-w-0">
                        <Link href={row.href} className="block truncate text-text-base hover:text-accent-ink">
                          {row.name}
                        </Link>
                        <p className="text-xs text-text-muted truncate">{row.subtitle}</p>
                      </div>
                    </div>
                    <div className="pl-[52px] sm:pl-0 sm:shrink-0 sm:text-right">
                      <StatusBadge tone={row.tone}>{row.label}</StatusBadge>
                      {row.date ? (
                        <p className="mt-1 text-xs text-text-muted">
                          {row.datePrefix ? `${row.datePrefix} ` : ""}
                          {formatDate(row.date)}
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Invoice totals */}
        <Card title="Facturación" link={{ href: "/app/billing", label: "Ver las facturas" }}>
          {invoiceLikes === null ? (
            <p className="text-sm text-text-muted">No hemos podido cargar tus facturas ahora mismo.</p>
          ) : (
            <BillingWidget periods={periodViews} months={monthViews} latest={latestInvoices} />
          )}
        </Card>

        {/* Last order */}
        <Card title="Último pedido" link={{ href: "/app/pedidos", label: "Ver mis pedidos" }}>
          {!orders.ok ? (
            <p className="text-sm text-text-muted">{orders.message}</p>
          ) : lastOrder === null ? (
            <p className="text-sm text-text-muted">Todavía no has hecho ningún pedido.</p>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href={`/app/servers/new/${lastOrder.id}`}
                  className="font-mono text-text-base hover:text-accent-ink"
                >
                  N.º {lastOrder.reference}
                </Link>
                <p className="text-xs text-text-muted mt-1">
                  {formatDate(lastOrder.createdAt)}
                  {lastOrder.planName ? ` · ${lastOrder.planName}` : ""} ·{" "}
                  {formatCents(lastOrder.total)}
                </p>
              </div>
              <StatusBadge tone={(ORDER_STATUS_UI[lastOrder.status] ?? { tone: "neutral" as const }).tone}>
                {(ORDER_STATUS_UI[lastOrder.status] ?? { label: lastOrder.status }).label}
              </StatusBadge>
            </div>
          )}
        </Card>
      </div>

      {/* Solutions and services */}
      <section className="mt-5">
        <Panel>
          <h2 className="text-lg font-normal tracking-tight text-text-base mb-4">
            Mis soluciones y servicios
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile href="/app/bare-metal/vps" icon={Server} label="Servidores privados virtuales" value={liveServices.length + countOf("vps")} />
            <Tile href="/app/bare-metal/licencias" icon={KeyRound} label="Licencias Plesk" value={activeLicences} />
            <Tile href="/app/bare-metal/ip" icon={Network} label="Direcciones IP" value={ipCount} />
            <Tile href="/app/web-cloud/alojamiento" icon={HardDrive} label="Alojamiento web" value={countOf("web_hosting")} />
            <Tile href="/app/web-cloud/dominios" icon={Globe} label="Dominios" value={otherDomains.length} />
          </div>
        </Panel>
      </section>

      {/* Credit and payment method */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card title="Mi saldo" link={{ href: "/app/billing/saldo", label: "Ver detalle" }}>
          {!credit.ok ? (
            <p className="text-sm text-text-muted">{credit.message}</p>
          ) : (
            <div className="flex items-center gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-beige">
                <Wallet aria-hidden className="h-4 w-4 text-text-muted" strokeWidth={1.7} />
              </span>
              <div>
                {owed && owed.totalCents > 0 ? (
                  <>
                    <p className="text-2xl font-light text-[#8a2d26]">−{formatCents(owed.totalCents)}</p>
                    <p className="text-xs text-text-muted">
                      Para estar al día hoy
                      {credit.data.balance > 0
                        ? ` · ${formatCents(credit.data.balance)} de crédito a tu favor`
                        : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-light text-text-base">{formatCents(credit.data.balance)}</p>
                    <p className="text-xs text-text-muted">
                      {credit.data.balance === 0
                        ? "Estás al día: nada pendiente de pago"
                        : credit.data.expiresAt
                          ? `Crédito a tu favor, caduca el ${formatDate(credit.data.expiresAt)}`
                          : "Crédito a tu favor, se aplica solo en tu próxima factura"}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Forma de pago" link={{ href: "/app/billing/metodos-de-pago", label: "Gestionar" }}>
          {!cards.ok ? (
            <p className="text-sm text-text-muted">{cards.message}</p>
          ) : defaultCard === null ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-text-muted">
                No tienes ninguna tarjeta. La necesitas para contratar y renovar.
              </p>
              <ButtonLink href="/app/billing/metodos-de-pago" variant="secondary">
                Añadir
              </ButtonLink>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface-beige">
                <CreditCard aria-hidden className="h-4 w-4 text-text-muted" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="text-text-base font-mono">
                  {(defaultCard.brand ?? "Tarjeta").toUpperCase()} ···· {defaultCard.last4 ?? "····"}
                </p>
                <p className="text-xs text-text-muted">
                  {defaultCard.expMonth && defaultCard.expYear
                    ? `Caduca ${String(defaultCard.expMonth).padStart(2, "0")}/${defaultCard.expYear}`
                    : "Predeterminada"}
                </p>
              </div>
              {cardExpiresSoon(defaultCard, now) ? (
                <span className="ml-auto">
                  <StatusBadge tone="warn">Caduca pronto</StatusBadge>
                </span>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function Card({
  title,
  count,
  link,
  className,
  children,
}: {
  title: string
  count?: number
  link?: { href: string; label: string }
  className?: string
  children: React.ReactNode
}) {
  return (
    <Panel className={cn("flex flex-col", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-normal tracking-tight text-text-base">
          {title}
          {count !== undefined ? (
            <span className="label-mono rounded-full border border-border-base px-2 py-0.5 text-[11px] text-text-muted">
              {count}
            </span>
          ) : null}
        </h2>
        {link ? (
          <Link
            href={link.href}
            className="label-mono inline-flex shrink-0 items-center gap-1 text-[11px] text-text-muted hover:text-text-base"
          >
            {link.label}
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="flex-1">{children}</div>
    </Panel>
  )
}

function Tile({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string
  icon: typeof Server
  label: string
  value: number
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border-base px-4 py-3.5 transition-colors hover:bg-surface-beige/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-beige">
        <Icon aria-hidden className="h-4 w-4 text-text-muted" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-text-base">{label}</span>
      <span className="text-lg font-light text-accent-ink">{value}</span>
    </Link>
  )
}
