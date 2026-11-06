/**
 * Representative props for every template, plus the key data each rendering must contain.
 *
 * Each case closes over its own props, which keeps the template name and the props type
 * bound together: a case built with mismatched props does not compile.
 */
import type {
  EmailMessage,
  EmailPropsMap,
  EmailTemplateName,
  OutboundEmail,
  RenderedEmail,
} from "../src/index"
import { renderEmail } from "../src/index"

export interface TemplateCase {
  /** Template under test. */
  template: EmailTemplateName
  /** Free-text label for the test name. */
  label: string
  /** Strings that must appear verbatim in both the HTML and the plain text. */
  expected: readonly string[]
  render: () => Promise<RenderedEmail>
  message: (to: string) => OutboundEmail
}

function testCase<K extends EmailTemplateName>(
  template: K,
  label: string,
  props: EmailPropsMap[K],
  expected: readonly string[] = [],
): TemplateCase {
  return {
    template,
    label,
    expected,
    render: () => renderEmail(template, props),
    // The pair (template, props) is correlated by construction; TypeScript cannot express
    // that correlation when widening to the union, hence the single assertion.
    message: (to) => ({ template, props, to }) as EmailMessage & { to: string },
  }
}

// A date inside CET (European DST starts on 29 March 2026), so the expected strings below
// are stable: 10:00 UTC is 11:00 in Europe/Madrid.
const MARCH_14 = new Date("2026-03-14T10:00:00Z")
const MARCH_16 = new Date("2026-03-16T10:00:00Z")
const MARCH_17 = new Date("2026-03-17T10:00:00Z")
const MARCH_24 = new Date("2026-03-24T09:00:00Z")
const APRIL_1 = new Date("2026-04-01T10:00:00Z")

const VERIFY_URL = "https://oladc.com/verify?token=abc123"
const RESET_URL = "https://oladc.com/reset-password?token=xyz789"
const PANEL_URL = "https://oladc.com/app/servers/srv_123"
const INVOICE_URL = "https://oladc.com/app/billing/FAC-2026-0101"

/** Full-props cases: these assert the key data survives both renderings. */
export const CASES: readonly TemplateCase[] = [
  testCase(
    "welcome-verify",
    "verificación de correo",
    { name: "Luis", verifyUrl: VERIFY_URL },
    [VERIFY_URL, "24 horas"],
  ),
  testCase(
    "phone-otp",
    "código de teléfono",
    { name: "Luis", code: "482913", phoneLast4: "6789" },
    ["482913", "10 minutos"],
  ),
  testCase(
    "password-reset",
    "restablecer contraseña",
    {
      name: "Luis",
      resetUrl: RESET_URL,
      expiresInMinutes: 60,
      requestedFromIp: "88.12.34.56",
    },
    [RESET_URL, "60 minutos", "88.12.34.56"],
  ),
  testCase(
    "account-verified",
    "cuenta verificada con crédito",
    { name: "Ana", creditCents: 1000, creditExpiresAt: MARCH_14 },
    ["10,00 €", "14 de marzo de 2026"],
  ),
  testCase(
    "order-received",
    "pago recibido",
    {
      name: "Ana",
      orderRef: "ORD-2026-0042",
      planName: "OLA VPS Start",
      amountCents: 1299,
      termLabel: "12 meses",
      expectedMinutes: 15,
      orderUrl: "https://oladc.com/app/orders/ORD-2026-0042",
    },
    ["ORD-2026-0042", "12,99 €", "15 minutos", "OLA VPS Start"],
  ),
  testCase(
    "server-ready",
    "servidor entregado con contraseña inicial",
    {
      name: "Ana",
      serverName: "vps-produccion",
      planName: "OLA VPS Pro",
      ipv4: "51.210.44.17",
      ipv6: "2001:41d0:304:200::b1f",
      datacenter: "Gravelines, Francia",
      os: "Debian 12",
      panelUrl: PANEL_URL,
      rootPassword: "T3mp-9fK2xQ",
    },
    [
      "51.210.44.17",
      "2001:41d0:304:200::b1f",
      "Gravelines, Francia",
      "Debian 12",
      "T3mp-9fK2xQ",
      "una sola vez",
    ],
  ),
  testCase(
    "order-delayed",
    "pedido con retraso",
    {
      orderRef: "ORD-2026-0043",
      planName: "OLA VPS Start",
      elapsedMinutes: 45,
      estimatedBy: MARCH_14,
      orderUrl: "https://oladc.com/app/orders/ORD-2026-0043",
    },
    ["ORD-2026-0043", "45 minutos", "14 de marzo de 2026, 11:00"],
  ),
  testCase(
    "order-failed",
    "pedido fallido con devolución",
    {
      orderRef: "ORD-2026-0044",
      planName: "OLA VPS Start",
      refundedCents: 2598,
      refundDays: 10,
      supportUrl: "https://oladc.com/app/support",
    },
    ["ORD-2026-0044", "25,98 €", "10 días"],
  ),
  testCase(
    "renewal-upcoming",
    "renovación próxima",
    {
      serviceName: "web-01",
      planName: "OLA VPS Start",
      invoiceRef: "FAC-2026-0101",
      amountCents: 1299,
      chargeDate: MARCH_14,
      cardBrand: "Visa",
      cardLast4: "4242",
      invoiceUrl: INVOICE_URL,
    },
    ["FAC-2026-0101", "12,99 €", "14 de marzo de 2026", "4242"],
  ),
  testCase(
    "payment-failed",
    "cobro rechazado",
    {
      serviceName: "web-01",
      invoiceRef: "FAC-2026-0101",
      amountCents: 1299,
      retryDate: MARCH_16,
      suspendDate: MARCH_17,
      deletionDate: MARCH_24,
      updateCardUrl: "https://oladc.com/app/billing/payment-methods",
      cardBrand: "Visa",
      cardLast4: "4242",
    },
    [
      "FAC-2026-0101",
      "12,99 €",
      "16 de marzo de 2026",
      "17 de marzo de 2026",
      "24 de marzo de 2026",
    ],
  ),
  testCase(
    "service-suspended",
    "servicio suspendido",
    {
      serviceName: "web-01",
      invoiceRef: "FAC-2026-0101",
      amountCents: 1299,
      suspendedAt: MARCH_17,
      deletionDate: MARCH_24,
      payUrl: INVOICE_URL,
    },
    ["12,99 €", "17 de marzo de 2026", "24 de marzo de 2026"],
  ),
  testCase(
    "service-terminating",
    "aviso final de eliminación",
    {
      serviceName: "web-01",
      invoiceRef: "FAC-2026-0101",
      amountCents: 1299,
      deletionDate: MARCH_24,
      payUrl: INVOICE_URL,
    },
    ["12,99 €", "24 de marzo de 2026, 10:00"],
  ),
  testCase(
    "upgrade-complete",
    "cambio de plan",
    {
      serviceName: "web-01",
      previousPlanName: "OLA VPS Start",
      newPlanName: "OLA VPS Pro",
      proratedCents: 743,
      nextInvoiceDate: APRIL_1,
      nextInvoiceCents: 2499,
      panelUrl: PANEL_URL,
    },
    ["OLA VPS Pro", "7,43 €", "24,99 €", "1 de abril de 2026"],
  ),
  testCase(
    "credit-expiring",
    "crédito a punto de caducar",
    { amountCents: 1000, days: 5, expiresAt: MARCH_14 },
    ["10,00 €", "5 días", "14 de marzo de 2026"],
  ),
  testCase(
    "admin-alert",
    "alerta interna",
    {
      severity: "critical",
      entity: "order",
      entityId: "ord_01HX",
      summary: "Entrega agotada tras el máximo de intentos",
      detail: "ovh task 12345 state=error attempts=3",
      occurredAt: MARCH_14,
      correlationId: "corr_abc",
      adminUrl: "https://oladc.com/admin/orders/ord_01HX",
    },
    ["ord_01HX", "corr_abc", "ovh task 12345 state=error attempts=3", "14 de marzo de 2026, 11:00"],
  ),
]

/**
 * The same templates with every optional prop omitted. These exist to catch an optional
 * value leaking into the output as "undefined".
 */
export const MINIMAL_CASES: readonly TemplateCase[] = [
  testCase("welcome-verify", "mínimo", { verifyUrl: VERIFY_URL }),
  testCase("phone-otp", "mínimo", { code: "100200" }, ["100200", "10 minutos"]),
  testCase("password-reset", "sin IP de origen", { resetUrl: RESET_URL, expiresInMinutes: 60 }, [
    RESET_URL,
    "60 minutos",
  ]),
  testCase("account-verified", "mínimo", { creditCents: 1000, creditExpiresAt: MARCH_14 }),
  testCase("order-received", "mínimo", {
    orderRef: "ORD-1",
    planName: "OLA VPS Start",
    amountCents: 500,
    orderUrl: PANEL_URL,
  }),
  testCase("server-ready", "sin contraseña inicial", {
    serverName: "vps-01",
    planName: "OLA VPS Start",
    ipv4: "10.0.0.1",
    datacenter: "Estrasburgo, Francia",
    os: "Ubuntu 24.04",
    panelUrl: PANEL_URL,
  }),
  testCase("order-delayed", "mínimo", { orderRef: "ORD-1", orderUrl: PANEL_URL }),
  testCase("order-failed", "mínimo", {
    orderRef: "ORD-1",
    refundedCents: 500,
    supportUrl: PANEL_URL,
  }),
  testCase("renewal-upcoming", "mínimo", {
    serviceName: "web-01",
    invoiceRef: "FAC-1",
    amountCents: 500,
    chargeDate: MARCH_14,
    invoiceUrl: INVOICE_URL,
  }),
  testCase("payment-failed", "mínimo", {
    serviceName: "web-01",
    invoiceRef: "FAC-1",
    amountCents: 500,
    retryDate: MARCH_16,
    suspendDate: MARCH_17,
    deletionDate: MARCH_24,
    updateCardUrl: INVOICE_URL,
  }),
  testCase("service-suspended", "mínimo", {
    serviceName: "web-01",
    invoiceRef: "FAC-1",
    amountCents: 500,
    suspendedAt: MARCH_17,
    deletionDate: MARCH_24,
    payUrl: INVOICE_URL,
  }),
  testCase("service-terminating", "mínimo", {
    serviceName: "web-01",
    deletionDate: MARCH_24,
    payUrl: INVOICE_URL,
  }),
  testCase("upgrade-complete", "mínimo", {
    serviceName: "web-01",
    newPlanName: "OLA VPS Pro",
    proratedCents: 743,
    panelUrl: PANEL_URL,
  }),
  testCase("credit-expiring", "un solo día", { amountCents: 250, days: 1, expiresAt: MARCH_14 }, [
    "1 día",
    "2,50 €",
  ]),
  testCase("admin-alert", "mínimo", {
    severity: "info",
    entity: "webhook",
    summary: "Evento duplicado descartado en el webhook",
    adminUrl: "https://oladc.com/admin",
  }),
]

export const ALL_CASES: readonly TemplateCase[] = [...CASES, ...MINIMAL_CASES]

/**
 * The full-props case for one template, by name. Addressing fixtures by position would let
 * a template added in its natural place silently repoint another suite's assertions at a
 * different email, so lookups go through here — and an unknown name throws instead of
 * handing back undefined.
 */
export function caseFor(template: EmailTemplateName): TemplateCase {
  // CASES comes first in ALL_CASES, so this finds the full-props case, not the minimal one.
  const found = ALL_CASES.find((testCase) => testCase.template === template)
  if (found === undefined) {
    throw new Error(`no hay caso de prueba para la plantilla "${template}"`)
  }
  return found
}

/** Visible text of a rendered email: no tags, no conditional comments, entities decoded. */
export function visibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#8202;|&#8203;|&nbsp;/g, " ")
}
