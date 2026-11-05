import { z } from "zod"

/**
 * Environment contract. Every secret is server-only: nothing here may be imported
 * from a Client Component. The two `NEXT_PUBLIC_` values are the only exceptions.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),

  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),

  OVH_ENDPOINT: z.string().default("ovh-eu"),
  OVH_APP_KEY: z.string().optional(),
  OVH_APP_SECRET: z.string().optional(),
  OVH_CONSUMER_KEY: z.string().optional(),
  OVH_SUBSIDIARY: z.string().default("ES"),
  /** Kill switch. Real orders are only ever sent when this is explicitly "true". */
  OVH_ORDERS_ENABLED: z.coerce.boolean().default(false),

  WHMCS_API_URL: z.string().url().optional(),
  WHMCS_API_IDENTIFIER: z.string().optional(),
  WHMCS_API_SECRET: z.string().optional(),
  /** Fixed-IP proxy, because Vercel egress IPs are not static. */
  WHMCS_PROXY_URL: z.string().url().optional(),
  WHMCS_WRITE_ENABLED: z.coerce.boolean().default(false),
  WHMCS_WEBHOOK_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("OLA <cloud@oladc.com>"),

  SMS_PROVIDER_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  PRICING_DEFAULT_MARGIN: z.coerce.number().default(0.75),
  ADDON_DEFAULT_MARGIN: z.coerce.number().default(0.5),
  WELCOME_CREDIT_CENTS: z.coerce.number().int().default(1000),
  WELCOME_CREDIT_DAYS: z.coerce.number().int().default(30),

  ALERTS_EMAIL: z.string().optional(),
  ALERTS_SLACK_WEBHOOK: z.string().optional(),

  /** Use the in-memory mocks instead of the real providers. */
  USE_MOCK_PROVIDERS: z.coerce.boolean().default(false),
})

const clientSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://oladc.com"),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>

let cachedServer: ServerEnv | null = null

/**
 * Validated server environment. Throws on first use if something required is missing,
 * which fails the request loudly instead of half-working.
 */
export function env(): ServerEnv {
  if (cachedServer) return cachedServer
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
    throw new Error(`Invalid server environment: ${missing}`)
  }
  cachedServer = parsed.data
  return cachedServer
}

export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})

/** True when the providers should be mocked (local dev and tests). */
export function useMocks(): boolean {
  const current = env()
  return current.USE_MOCK_PROVIDERS || current.NODE_ENV === "test"
}
