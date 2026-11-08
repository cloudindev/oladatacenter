"use client"

import * as React from "react"
import { StatusBadge, type StatusTone } from "@/components/app/ui"
import { cn } from "@/lib/utils"

/**
 * The dashboard's billing card. Everything is computed on the server and arrives already
 * formatted; switching the period is instant, with no round trip.
 */

export interface BillingPeriodView {
  key: string
  label: string
  totalLabel: string
  countLabel: string
  paidLabel: string | null
  unpaidLabel: string | null
}

export interface BillingMonthView {
  key: string
  label: string
  total: number
  unpaid: number
  totalLabel: string
}

export interface BillingInvoiceRow {
  id: string
  reference: string
  dateLabel: string
  totalLabel: string
  statusLabel: string
  tone: StatusTone
  href: string | null
}

export function BillingWidget({
  periods,
  months,
  latest,
}: {
  periods: readonly BillingPeriodView[]
  months: readonly BillingMonthView[]
  latest: readonly BillingInvoiceRow[]
}) {
  const [current, setCurrent] = React.useState(periods[0]?.key ?? "")
  const period = periods.find((option) => option.key === current) ?? periods[0]
  const peak = Math.max(1, ...months.map((month) => month.total))

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Periodo">
        {periods.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={option.key === current}
            onClick={() => setCurrent(option.key)}
            className={cn(
              "label-mono rounded-md border px-2.5 py-1 text-[11px] transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
              option.key === current
                ? "border-text-base text-text-base"
                : "border-border-base text-text-muted hover:text-text-base",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period ? (
        <div className="text-center" role="tabpanel">
          <p className="text-4xl font-light tracking-tight text-text-base">{period.totalLabel}</p>
          <p className="mt-1 text-xs text-text-muted">{period.countLabel}</p>
          {period.paidLabel || period.unpaidLabel ? (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {period.paidLabel ? <StatusBadge tone="ok">Pagado {period.paidLabel}</StatusBadge> : null}
              {period.unpaidLabel ? (
                <StatusBadge tone="warn">Pendiente {period.unpaidLabel}</StatusBadge>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {months.length > 0 ? (
        <div className="mt-6" aria-label="Facturado por mes">
          <div className="flex h-20 items-end gap-1">
            {months.map((month) => {
              const height = month.total === 0 ? 2 : Math.max(6, Math.round((month.total / peak) * 80))
              const unpaidShare = month.total === 0 ? 0 : month.unpaid / month.total
              return (
                <div key={month.key} className="group relative flex flex-1 flex-col justify-end" title={`${month.label}: ${month.totalLabel}`}>
                  <div
                    className="w-full overflow-hidden rounded-sm bg-text-base/70"
                    style={{ height }}
                  >
                    {unpaidShare > 0 ? (
                      <div className="w-full bg-[#e0a43a]" style={{ height: `${Math.round(unpaidShare * 100)}%` }} />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {months.map((month) => (
              <span key={month.key} className="flex-1 text-center text-[10px] text-text-muted">
                {month.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {latest.length > 0 ? (
        <ul className="mt-6 divide-y divide-border-base border-t border-border-base">
          {latest.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                {invoice.href ? (
                  <a
                    href={invoice.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-text-base hover:text-accent-ink"
                  >
                    {invoice.reference}
                  </a>
                ) : (
                  <span className="font-mono text-text-base">{invoice.reference}</span>
                )}
                <p className="text-xs text-text-muted">{invoice.dateLabel}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-text-base">{invoice.totalLabel}</span>
                <StatusBadge tone={invoice.tone}>{invoice.statusLabel}</StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
