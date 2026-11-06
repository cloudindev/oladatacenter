/**
 * Dependency resolution for the billing services.
 *
 * Every public function takes an optional `BillingDepsOverride`. When nothing is passed,
 * the real wiring is loaded lazily from `integration.ts` — lazily so that a unit test which
 * always injects its own fakes never pulls in the database driver, the Stripe SDK, the
 * catalog service, the email package or the Inngest client.
 */
import type { BillingDeps, BillingDepsOverride } from "./ports"

let cached: BillingDeps | null = null

/** Test seam: pin the whole bundle, or clear it with `null`. */
export function setBillingDeps(deps: BillingDeps | null): void {
  cached = deps
}

export async function resolveDeps(override: BillingDepsOverride = {}): Promise<BillingDeps> {
  if (cached) return { ...cached, ...override }

  // A complete override needs no real wiring at all, which is the test path.
  if (isComplete(override)) return override

  const { liveBillingDeps } = await import("./integration")
  cached = liveBillingDeps()
  return { ...cached, ...override }
}

const REQUIRED_KEYS = [
  "store",
  "stripe",
  "catalog",
  "ledger",
  "notifier",
  "events",
  "audit",
  "now",
  "siteUrl",
] as const

function isComplete(override: BillingDepsOverride): override is BillingDeps {
  return REQUIRED_KEYS.every((key) => override[key] !== undefined)
}
