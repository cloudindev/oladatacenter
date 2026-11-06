/**
 * The surface these e2e specs drive, in one place.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * READ THIS IF YOU ARE BUILDING THE FEATURES
 * ──────────────────────────────────────────────────────────────────────────────
 * Two things below are a *specification*, not a description of what exists:
 *
 *   1. `routes` — the URLs the specs navigate to.
 *   2. `DEV_API` — a dev-only control plane the specs need in order to test
 *      flows that are otherwise driven by time or by a provider: reading what
 *      the mock email sender sent, advancing the renewal clock, making the next
 *      payment fail. It MUST only be mounted when `USE_MOCK_PROVIDERS` is true
 *      and it MUST 404 in production. It is the one exception to "drive the app
 *      through its own flows", and it exists so the specs never touch SQL.
 *
 * If a route or payload ends up named differently, change it HERE and the specs
 * follow. Do not scatter literals through the specs.
 *
 * Nothing in this file writes to the database. State is always created by
 * walking the real UI (register, verify, order, pay), because a test that seeds
 * rows directly stops proving that the flow works.
 */

export const routes = {
  home: "/",
  plans: "/vps",
  configurator: "/vps/configurar",
  checkout: "/checkout",
  login: "/login",
  register: "/registro",
  verifyEmail: "/verificar-email",
  onboarding: "/onboarding",
  app: "/app",
  servers: "/app/servidores",
  server: (id: string) => `/app/servidores/${id}`,
  invoices: "/app/facturas",
  orders: "/app/pedidos",
  order: (id: string) => `/app/pedidos/${id}`,
  adminOrders: "/admin/pedidos",
  adminOrder: (id: string) => `/admin/pedidos/${id}`,
} as const

/**
 * Dev-only mock control plane. Guarded by `USE_MOCK_PROVIDERS=true`.
 */
export const DEV_API = {
  /** GET ?to=<email> -> { emails: SentEmail[] } (newest first). DELETE clears. */
  emails: "/api/dev/emails",
  /** POST { advanceDays: number } -> moves the clock the renewal jobs read. */
  clock: "/api/dev/clock",
  /** POST { name: string } -> runs the due step of a job synchronously. */
  runJob: "/api/dev/jobs/run",
  /** POST { operation: string } -> the mock OVH client fails that call once. */
  ovhFailNext: "/api/dev/ovh/fail-next",
  /** POST {} -> the next off-session charge is declined. */
  paymentFailNext: "/api/dev/payments/fail-next",
} as const

export interface SentEmail {
  to: string
  template: string
  subject: string
  html?: string
  text?: string
  /** Every absolute URL found in the body — verification and payment links. */
  links: string[]
  sentAt: string
}

export interface TestCard {
  number: string
  exp: string
  cvc: string
  postal: string
}

/** Stripe test cards. Documented at stripe.com/docs/testing. */
export const CARDS: Record<"ok" | "failsOnRenewal" | "declined", TestCard> = {
  /** Always succeeds. */
  ok: { number: "4242424242424242", exp: "12/34", cvc: "123", postal: "28001" },
  /** Attaches fine, then declines on the off-session renewal charge. */
  failsOnRenewal: { number: "4000000000000341", exp: "12/34", cvc: "123", postal: "28001" },
  /** Declined at checkout. */
  declined: { number: "4000000000000002", exp: "12/34", cvc: "123", postal: "28001" },
} as const

/** The plan the specs order unless they say otherwise. */
export const TEST_PLAN = {
  planCode: "vps-2027-model1",
  /** Commercial name shown to the customer — never the OVH plan name. */
  label: "VPS-1",
  datacenter: "GRA",
  os: "Ubuntu 24.04",
} as const

let counter = 0

/** A fresh address per test, so reruns never collide. */
export function uniqueEmail(prefix = "e2e"): string {
  counter += 1
  return `${prefix}+${Date.now()}-${counter}@e2e.oladc.test`
}

export const TEST_PASSWORD = "Pruebas-e2e-2026!"

/** Spanish company details used for the VAT path. */
export const TEST_COMPANY = {
  kind: "company" as const,
  name: "Pruebas E2E SL",
  taxId: "B12345678",
  country: "ES",
  address: "Calle Falsa 123",
  city: "Madrid",
  postalCode: "28001",
  phone: "+34600000000",
} as const
