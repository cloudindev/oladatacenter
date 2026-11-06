import "server-only"
import Stripe from "stripe"

import { env, providerMocked } from "@/lib/env"
import { HttpStripeGateway } from "./http"
import { MockStripe } from "./mock"
import { STRIPE_API_VERSION, type StripeGateway } from "./types"

/**
 * The only place a Stripe client is constructed.
 *
 * `STRIPE_SECRET_KEY` is read lazily so importing this module never throws, and the key
 * never crosses into a Client Component: this file is `server-only`. The browser only ever
 * sees `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and per-intent client secrets.
 */

let gateway: StripeGateway | null = null

export function stripeGateway(): StripeGateway {
  if (gateway) return gateway

  if (providerMocked("stripe")) {
    gateway = new MockStripe({ webhookSecret: env().STRIPE_WEBHOOK_SECRET ?? "whsec_mock" })
    return gateway
  }

  const config = env()
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is missing; set it or MOCK_STRIPE=true")
  }

  gateway = new HttpStripeGateway(
    new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
      maxNetworkRetries: 2,
      appInfo: { name: "oladc.com", url: "https://oladc.com" },
    }),
    { webhookSecret: config.STRIPE_WEBHOOK_SECRET ?? null },
  )
  return gateway
}

/** Test and dev seam: drop the cached singleton. */
export function resetStripeGateway(next: StripeGateway | null = null): void {
  gateway = next
}

/** The publishable key the checkout page hands to Stripe.js. Public by design. */
export function stripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
}
