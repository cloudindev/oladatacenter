import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { functions } from "@/inngest/functions"

/**
 * The Inngest endpoint.
 *
 * App Router route handlers export one function per HTTP method (see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`);
 * Inngest's `serve` returns the three it needs:
 *   PUT  — registration / sync from the Inngest dashboard,
 *   POST — run a function step,
 *   GET  — introspection.
 *
 * `nodejs` runtime because the jobs use the Postgres driver, `node:crypto` and pino.
 * `dynamic = "force-dynamic"` because a GET here must never be cached or prerendered.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
})
