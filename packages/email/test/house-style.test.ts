import { describe, expect, it } from "vitest"

import { ALL_CASES, visibleText } from "./fixtures"

/**
 * House style: Spanish copy, sentence case, no exclamation marks. The rule is checked on
 * every rendering, subject and body, HTML and plain text.
 */
describe("estilo de la casa", () => {
  it("ningún asunto ni cuerpo lleva signos de exclamación", async () => {
    for (const testCase of ALL_CASES) {
      const rendered = await testCase.render()
      const where = `${testCase.template} · ${testCase.label}`

      expect(rendered.subject, `${where} (asunto)`).not.toMatch(/[!¡]/)
      expect(rendered.text, `${where} (texto plano)`).not.toMatch(/[!¡]/)
      // The HTML carries a doctype and Outlook conditional comments, which legitimately
      // contain "!", so the rule is applied to the visible text.
      expect(visibleText(rendered.html), `${where} (html visible)`).not.toMatch(/[!¡]/)
    }
  })

  it("los asuntos están en minúscula de frase, no en mayúsculas de título", async () => {
    for (const testCase of ALL_CASES) {
      const { subject } = await testCase.render()
      // The internal prefix is the one exception to sentence case.
      const body = subject.replace(/^\[OLA\]\s*/, "")
      const first = body.split(/\s+/)[0] ?? ""
      // A subject may legitimately open with a service name such as "web-01"; only a
      // plain word is expected to be capitalised.
      if (/^[a-záéíóúñü]+$/i.test(first)) {
        expect(body[0], `${testCase.template} empieza en minúscula`).toEqual(body[0]?.toUpperCase())
      }

      // Words long enough to matter, excluding the first one and any identifier.
      const words = body
        .split(/\s+/)
        .slice(1)
        .filter((word) => word.length >= 4 && !/[_@·]|\d/.test(word))
      const lowercase = words.filter((word) => /^[a-záéíóúñü]/.test(word))
      expect(
        lowercase.length / Math.max(words.length, 1),
        `${testCase.template} parece estar en mayúsculas de título: ${subject}`,
      ).toBeGreaterThanOrEqual(0.5)
    }
  })

  it("firma siempre como Equipo OLA", async () => {
    for (const testCase of ALL_CASES) {
      const rendered = await testCase.render()
      expect(visibleText(rendered.html), testCase.template).toContain("Equipo OLA")
      if (testCase.template !== "admin-alert") {
        expect(rendered.text, testCase.template).toContain("Equipo OLA")
      }
    }
  })

  it("el pie identifica a la empresa y el carácter transaccional del mensaje", async () => {
    for (const testCase of ALL_CASES) {
      const rendered = await testCase.render()
      const text = visibleText(rendered.html)
      expect(text, testCase.template).toContain("Cloudin Hosting S.L.")
      expect(text, testCase.template).toContain("Oviedo, España")
      if (testCase.template === "admin-alert") {
        expect(text).toContain("Aviso interno")
      } else {
        expect(text, testCase.template).toContain("mensaje transaccional")
        expect(text, testCase.template).toContain("Área de cliente")
        expect(rendered.text, testCase.template).toContain("https://oladc.com/app")
      }
    }
  })
})
