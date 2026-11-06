import { z } from "zod"

/**
 * Environment contract. Every secret is server-only: nothing here may be imported
 * from a Client Component. The two `NEXT_PUBLIC_` values are the only exceptions.
 */
/**
 * Strict boolean for flags. `z.coerce.boolean()` is NOT usable here: it is `Boolean(value)`,
 * so the string "false" becomes true and would switch a kill switch ON. Only "true"/"1"
 * enable; "false"/"0"/empty disable; anything else fails validation loudly.
 */
export const envFlag = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((value) => value === "true" || value === "1")

/**
 * Optional per-provider override: unset means "follow USE_MOCK_PROVIDERS". Same strict
 * values as `envFlag`, so "false" can never be read as true.
 */
export const overrideFlag = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true" || value === "1"))

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
  OVH_ORDERS_ENABLED: envFlag,

  WHMCS_API_URL: z.string().url().optional(),
  WHMCS_API_IDENTIFIER: z.string().optional(),
  WHMCS_API_SECRET: z.string().optional(),
  /** Fixed-IP proxy, because Vercel egress IPs are not static. */
  WHMCS_PROXY_URL: z.string().url().optional(),
  /** Shared secret for the fixed-IP proxy (`X-Proxy-Token`). Required when the proxy is set. */
  WHMCS_PROXY_TOKEN: z.string().min(32).optional(),
  WHMCS_WRITE_ENABLED: envFlag,
  WHMCS_WEBHOOK_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("OLA <cloud@oladc.com>"),

  SMS_PROVIDER_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  PRICING_DEFAULT_MARGIN: z.coerce.number().default(0.7),
  ADDON_DEFAULT_MARGIN: z.coerce.number().default(0.5),
  /**
   * Alert threshold for the daily catalog sync: when an OVH cost rise would push a plan's
   * margin below this, the operator is told. Compared against the TRUE cost (plan plus the
   * mandatory addons), never the bare plan cost.
   */
  CATALOG_MARGIN_FLOOR: z.coerce.number().default(0.35),
  WELCOME_CREDIT_CENTS: z.coerce.number().int().default(1000),
  WELCOME_CREDIT_DAYS: z.coerce.number().int().default(30),

  ALERTS_EMAIL: z.string().optional(),
  ALERTS_SLACK_WEBHOOK: z.string().optional(),

  /** Use the in-memory mocks instead of the real providers. */
  USE_MOCK_PROVIDERS: envFlag,
  /** Per-provider overrides of USE_MOCK_PROVIDERS, to switch one provider on at a time. */
  MOCK_OVH: overrideFlag,
  MOCK_WHMCS: overrideFlag,
  MOCK_STRIPE: overrideFlag,
})

const clientSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("https://oladc.com"),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>

let cachedServer: ServerEnv | null = null

/**
 * `KEY=` in a .env file means "not set". Without this, a copy of `.env.example` fails
 * validation on every optional URL left blank (e.g. `WHMCS_PROXY_URL=`).
 */
export function withoutEmptyValues(
  source: Record<string, string | undefined>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== "") result[key] = value
  }
  return result
}

/**
 * Validated server environment. Throws on first use if something required is missing,
 * which fails the request loudly instead of half-working.
 */
export function env(): ServerEnv {
  if (cachedServer) return cachedServer
  const parsed = serverSchema.safeParse(withoutEmptyValues(process.env))
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

/**
 * True when the providers should be mocked (local dev and tests).
 *
 * Deliberately NOT called `useMocks`: eslint's react-hooks plugin treats any `use*()` call
 * as a hook, which made every call site outside a component a lint error.
 */
export function mocksEnabled(): boolean {
  const current = env()
  return current.USE_MOCK_PROVIDERS || current.NODE_ENV === "test"
}

export type MockableProvider = "ovh" | "whmcs" | "stripe"

type MockSettings = Pick<
  ServerEnv,
  "NODE_ENV" | "USE_MOCK_PROVIDERS" | "MOCK_OVH" | "MOCK_WHMCS" | "MOCK_STRIPE"
>

/** Pure resolution of one provider's mock switch; the test runner always mocks. */
export function resolveProviderMock(settings: MockSettings, provider: MockableProvider): boolean {
  if (settings.NODE_ENV === "test") return true
  const override = {
    ovh: settings.MOCK_OVH,
    whmcs: settings.MOCK_WHMCS,
    stripe: settings.MOCK_STRIPE,
  }[provider]
  return override ?? settings.USE_MOCK_PROVIDERS
}

/**
 * True when this provider runs on its in-memory mock. `USE_MOCK_PROVIDERS` sets the
 * default for all of them; `MOCK_OVH`, `MOCK_WHMCS` and `MOCK_STRIPE` override one each,
 * so WHMCS can go live while OVH orders stay simulated.
 */
export function providerMocked(provider: MockableProvider): boolean {
  return resolveProviderMock(env(), provider)
}
