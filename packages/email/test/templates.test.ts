import { describe, expect, it } from "vitest"

import { EMAIL_TEMPLATE_NAMES, emailSubject, renderEmail, renderMessage } from "../src/index"
import { ALL_CASES, CASES, caseFor, visibleText } from "./fixtures"

/** Words that would mean an English string slipped into a customer-facing email. */
const ENGLISH_MARKERS = /\b(your|please|dear|regards|unsubscribe|password is|click here)\b/i

/** Common Spanish function words: a subject without any of them is almost certainly wrong. */
const SPANISH_MARKERS =
  /(^|\s)(tu|tus|de|del|la|el|los|las|no|para|en|por|y|ya|está|un|una)(\s|$)/i

describe("catálogo de plantillas", () => {
  it("cubre las quince plantillas del ciclo de vida", () => {
    expect(EMAIL_TEMPLATE_NAMES).toHaveLength(17)
    expect([...EMAIL_TEMPLATE_NAMES].sort()).toEqual(
      [
        "account-verified",
        "admin-alert",
        "credit-expiring",
        "deletion-warning",
        "order-delayed",
        "order-failed",
        "order-received",
        "password-reset",
        "payment-failed",
        "payment-reminder",
        "phone-otp",
        "renewal-upcoming",
        "server-ready",
        "service-suspended",
        "service-terminating",
        "upgrade-complete",
        "welcome-verify",
      ].sort(),
    )
  })

  it("tiene un caso de prueba por plantilla", () => {
    const covered = new Set(ALL_CASES.map((testCase) => testCase.template))
    for (const name of EMAIL_TEMPLATE_NAMES) {
      expect(covered.has(name), `falta un caso para ${name}`).toBe(true)
    }
  })
})

describe.each(CASES.map((testCase) => [`${testCase.template} · ${testCase.label}`, testCase] as const))(
  "%s",
  (_label, testCase) => {
    it("se renderiza con un asunto en español y un cuerpo no vacío", async () => {
      const rendered = await testCase.render()

      expect(rendered.subject.trim().length).toBeGreaterThan(10)
      expect(rendered.subject).toMatch(SPANISH_MARKERS)
      expect(rendered.subject).not.toMatch(ENGLISH_MARKERS)
      expect(rendered.html.length).toBeGreaterThan(500)
      expect(rendered.text.trim().length).toBeGreaterThan(80)
      expect(rendered.text).not.toMatch(ENGLISH_MARKERS)
    })

    it("conserva los datos clave en el HTML y en el texto plano", async () => {
      const rendered = await testCase.render()
      const text = visibleText(rendered.html)

      for (const value of testCase.expected) {
        expect(text, `el HTML no contiene "${value}"`).toContain(value)
        expect(rendered.text, `el texto plano no contiene "${value}"`).toContain(value)
      }
    })

    it("sirve con las imágenes desactivadas y sin CSS externo", async () => {
      const { html } = await testCase.render()

      // No images at all, so nothing to block; the wordmark is text.
      expect(html).not.toMatch(/<img\b/i)
      expect(html).toContain(">OLA<")
      // Inline styles only.
      expect(html).not.toMatch(/<link\b/i)
      expect(html).not.toMatch(/<style\b/i)
      expect(html).not.toMatch(/@import/i)
      expect(html).not.toMatch(/fonts\.googleapis\.com/i)
      // Table-based layout, capped width, light background.
      expect(html).toContain("<table")
      expect(html).toContain("max-width:560px")
      expect(html).toContain("background-color:#f7f7f5")
      // Gmail clips a message above ~102 KB.
      expect(html.length).toBeLessThan(100_000)
    })
  },
)

describe("robustez del renderizado", () => {
  it("nunca emite undefined, NaN ni [object Object]", async () => {
    for (const testCase of ALL_CASES) {
      const rendered = await testCase.render()
      for (const needle of ["undefined", "NaN", "[object Object]"]) {
        expect(rendered.subject, `${testCase.template} (asunto)`).not.toContain(needle)
        expect(rendered.html, `${testCase.template} (html)`).not.toContain(needle)
        expect(rendered.text, `${testCase.template} (texto)`).not.toContain(needle)
      }
    }
  })

  it("acepta fechas en ISO igual que objetos Date", async () => {
    const fromDate = await renderEmail("credit-expiring", {
      amountCents: 1000,
      days: 5,
      expiresAt: new Date("2026-03-14T10:00:00Z"),
    })
    const fromString = await renderEmail("credit-expiring", {
      amountCents: 1000,
      days: 5,
      expiresAt: "2026-03-14T10:00:00Z",
    })
    expect(fromString.text).toEqual(fromDate.text)
    expect(fromString.text).toContain("14 de marzo de 2026")
  })

  it("renderiza también a partir de un EmailMessage", async () => {
    const message = caseFor("welcome-verify").message("cliente@example.com")
    const rendered = await renderMessage(message)
    expect(rendered.subject).toEqual(emailSubject("welcome-verify", { verifyUrl: "x" }))
    expect(rendered.html).toContain("https://oladc.com/verify?token=abc123")
  })
})

describe("credenciales", () => {
  it("solo server-ready muestra una contraseña, y avisa de que se muestra una vez", async () => {
    const secret = "T3mp-9fK2xQ"
    for (const testCase of ALL_CASES) {
      const rendered = await testCase.render()
      if (testCase.template === "server-ready" && rendered.text.includes(secret)) {
        expect(rendered.text).toContain("una sola vez")
        expect(visibleText(rendered.html)).toContain("una sola vez")
        continue
      }
      expect(rendered.html, `${testCase.template} no debe incluir credenciales`).not.toContain(
        secret,
      )
      expect(rendered.text, `${testCase.template} no debe incluir credenciales`).not.toContain(
        secret,
      )
    }
  })

  it("el servidor sin contraseña inicial no inventa ninguna", async () => {
    const rendered = await renderEmail("server-ready", {
      serverName: "vps-01",
      planName: "OLA VPS Start",
      ipv4: "10.0.0.1",
      datacenter: "Estrasburgo, Francia",
      os: "Ubuntu 24.04",
      panelUrl: "https://oladc.com/app/servers/srv_1",
    })
    expect(rendered.text).not.toContain("Contraseña inicial")
    expect(rendered.text).toContain("clave SSH")
  })
})

describe("plantilla interna", () => {
  it("prefija el asunto con [OLA] y admite detalle técnico", async () => {
    const rendered = await renderEmail("admin-alert", {
      severity: "critical",
      entity: "order",
      entityId: "ord_01HX",
      summary: "Entrega agotada tras el máximo de intentos",
      detail: "ovh task 12345 state=error attempts=3",
      adminUrl: "https://oladc.com/admin/orders/ord_01HX",
    })
    expect(rendered.subject.startsWith("[OLA] ")).toBe(true)
    expect(rendered.subject).toContain("Crítico")
    expect(rendered.text).toContain("ovh task 12345 state=error attempts=3")
    // An internal alert does not offer the customer-area footer.
    expect(rendered.html).toContain("No reenviar fuera del equipo")
  })
})
