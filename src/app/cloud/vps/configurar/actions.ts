"use server"

/**
 * The configurator never prices anything in the browser: it sends the configuration here
 * and renders whatever comes back.
 *
 * The action is reachable by a direct POST, so the input is never trusted: it is a raw
 * query string, and `resolveConfig` reduces it to a configuration we actually sell before
 * it reaches the pricing engine.
 */
import { resolveConfig, type PublicConfig, type PublicQuote } from "@ola/core"
import { listSellablePlans, publicQuoteFor } from "@/server/catalog/service"
import { logger } from "@/lib/logger"

export type QuoteActionResult =
  | { ok: true; config: PublicConfig; quote: PublicQuote }
  | { ok: false; message: string }

/** Anything longer than this is not a configuration. */
const MAX_QUERY_LENGTH = 512

export async function quoteAction(search: string): Promise<QuoteActionResult> {
  if (typeof search !== "string" || search.length > MAX_QUERY_LENGTH) {
    return { ok: false, message: "La configuración no es válida." }
  }

  try {
    const plans = await listSellablePlans()
    const config = resolveConfig(plans, Object.fromEntries(new URLSearchParams(search)))
    const quote = await publicQuoteFor(config)
    return { ok: true, config, quote }
  } catch (error) {
    logger.error(
      {
        event: "vps.quote.failed",
        error: error instanceof Error ? error.message : String(error),
      },
      "could not price a public configuration",
    )
    return {
      ok: false,
      message: "No hemos podido calcular el precio. Revisa la configuración o inténtalo de nuevo.",
    }
  }
}
