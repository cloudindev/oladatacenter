import type { NextRequest } from "next/server"
import { WEBHOOK_HEADERS, verifyWebhookSignature } from "@ola/whmcs"
import { env } from "@/lib/env"
import { runtimeDeps } from "@/inngest/runtime"
import { handleWhmcsWebhook } from "./handler"

/**
 * `POST /api/webhooks/whmcs` — the receiver for the WHMCS PHP hook.
 *
 * Route handler rules (App Router): one exported function per method, the raw body comes
 * from `request.text()` and no body-parser configuration exists or is needed. The body is
 * read verbatim because re-serialising JSON would invalidate the HMAC.
 *
 * `force-dynamic` so it is never cached, and the `nodejs` runtime because verification,
 * the database and the jobs need it.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<Response> {
  const correlationId =
    request.headers.get("x-correlation-id") ??
    request.headers.get(WEBHOOK_HEADERS.eventId) ??
    `whmcs-hook-${Date.now().toString(36)}`

  const rawBody = await request.text()
  const result = await handleWhmcsWebhook(runtimeDeps(), verifyWebhookSignature, {
    rawBody,
    signature: request.headers.get(WEBHOOK_HEADERS.signature),
    timestamp: request.headers.get(WEBHOOK_HEADERS.timestamp),
    secret: env().WHMCS_WEBHOOK_SECRET ?? null,
    correlationId,
  })

  return Response.json(result.body, { status: result.status })
}
