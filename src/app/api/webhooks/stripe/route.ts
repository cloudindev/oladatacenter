import type { NextRequest } from "next/server"

import { handleStripeWebhook } from "@/server/billing/webhook"

/**
 * Stripe webhook endpoint.
 *
 * `request.text()` gives the body exactly as Stripe signed it — the signature is computed
 * over those bytes, so it must never be parsed and re-serialised before verification. In
 * the App Router there is no body parser to disable: the raw body is simply what
 * `text()` returns.
 *
 * Node runtime, because signature verification uses `node:crypto` and the Stripe SDK.
 * Dynamic, because a cached response here would be a silently dropped payment.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")

  const outcome = await handleStripeWebhook(rawBody, signature)

  return Response.json(
    {
      received: outcome.status === 200,
      result: outcome.result,
      ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
    },
    { status: outcome.status },
  )
}

/** A GET here is almost always a misconfigured endpoint; say so instead of 404. */
export function GET(): Response {
  return Response.json(
    { error: "Este endpoint solo acepta POST firmado por Stripe." },
    { status: 405, headers: { Allow: "POST" } },
  )
}
