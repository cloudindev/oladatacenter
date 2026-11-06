import "server-only"
import { formatCents, resolveConfig } from "@ola/core"
import { listSellablePlans, publicQuoteFor } from "@/server/catalog/service"

const TERM_TEXT = { P1M: "sin compromiso", P12M: "compromiso 12 meses" } as const

/**
 * One line describing a remembered order, e.g.
 * "OLA VPS L · Beauharnois, Canadá · sin compromiso · 21,98 € / mes".
 * Null when the configuration can no longer be priced; the reminder then falls back to
 * its generic text.
 */
export async function pendingOrderSummary(href: string): Promise<string | null> {
  try {
    const query = href.split("?")[1] ?? ""
    const params = Object.fromEntries(new URLSearchParams(query))
    const plans = await listSellablePlans()
    const config = resolveConfig(plans, params)
    const quote = await publicQuoteFor(config)
    return [
      quote.planName,
      quote.datacenter,
      TERM_TEXT[config.term],
      `${formatCents(quote.monthlyPrice)} / mes`,
    ]
      .filter(Boolean)
      .join(" · ")
  } catch {
    return null
  }
}
