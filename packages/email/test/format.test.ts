import { describe, expect, it } from "vitest"

import {
  EmailFormatError,
  formatDate,
  formatDateTime,
  formatDays,
  formatMinutes,
  formatMoney,
  greeting,
  plainRows,
  plainText,
  spaceCode,
} from "../src/index"

describe("formato", () => {
  it("escribe los importes en euros con formato español", () => {
    expect(formatMoney(1000)).toEqual("10,00 €")
    expect(formatMoney(1299)).toEqual("12,99 €")
    expect(formatMoney(0)).toEqual("0,00 €")
    // es-ES only groups from five digits up ("min2" grouping in ICU).
    expect(formatMoney(123456)).toEqual("1.234,56 €")
    expect(formatMoney(1234567)).toEqual("12.345,67 €")
  })

  it("escribe las fechas en español y en la zona de Madrid", () => {
    expect(formatDate(new Date("2026-03-14T10:00:00Z"))).toEqual("14 de marzo de 2026")
    expect(formatDate("2026-04-01T22:30:00Z")).toEqual("2 de abril de 2026")
    expect(formatDateTime(new Date("2026-03-14T10:00:00Z"))).toEqual("14 de marzo de 2026, 11:00")
  })

  it("rechaza una fecha inválida en lugar de imprimirla", () => {
    expect(() => formatDate("no es una fecha")).toThrow(EmailFormatError)
    expect(() => formatDateTime(new Date(Number.NaN))).toThrow(EmailFormatError)
  })

  it("concuerda singular y plural", () => {
    expect(formatDays(1)).toEqual("1 día")
    expect(formatDays(7)).toEqual("7 días")
    expect(formatMinutes(1)).toEqual("1 minuto")
    expect(formatMinutes(15)).toEqual("15 minutos")
  })

  it("agrupa el código de seis dígitos solo en el texto plano", () => {
    expect(spaceCode("482913")).toEqual("482 913")
    expect(spaceCode("4829")).toEqual("4829")
  })

  it("saluda con el nombre cuando lo hay", () => {
    expect(greeting("Luis")).toEqual("Hola Luis,")
    expect(greeting("  ")).toEqual("Hola,")
    expect(greeting()).toEqual("Hola,")
  })

  it("descarta líneas y filas vacías al montar el texto plano", () => {
    const body = plainText(["Primera", null, undefined, false, "Segunda"])
    expect(body).toContain("Primera\nSegunda")
    expect(body).toContain("Equipo OLA")
    expect(body).toContain("Cloudin Hosting S.L. · Oviedo, España")
    expect(body).not.toContain("undefined")

    expect(plainRows([["Plan", "OLA VPS Start"], ["Periodo", undefined]])).toEqual([
      "Plan: OLA VPS Start",
    ])
  })

  it("omite el pie cuando el mensaje es interno", () => {
    expect(plainText(["Solo esto"], { footer: false })).toEqual("Solo esto\n")
  })
})
