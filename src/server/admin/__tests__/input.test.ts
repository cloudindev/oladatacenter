import { describe, expect, it } from "vitest"
import { InputError, dateField, euroToCents, percentToBasisPoints } from "../input"

describe("euroToCents", () => {
  it("parses the Spanish decimal comma without a float multiply", () => {
    expect(euroToCents("7,99")).toBe(799)
    expect(euroToCents("8,10")).toBe(810)
    expect(euroToCents("0,35")).toBe(35)
    expect(euroToCents("41,99")).toBe(4199)
  })

  it("accepts a dot, a currency symbol and surrounding space", () => {
    expect(euroToCents(" 7.99 € ")).toBe(799)
  })

  it("pads a single decimal", () => {
    expect(euroToCents("7,9")).toBe(790)
  })

  it("treats a whole number as euros", () => {
    expect(euroToCents("12")).toBe(1200)
  })

  it("returns null for an empty field, which clears a manual PVP", () => {
    expect(euroToCents("")).toBeNull()
    expect(euroToCents("   ")).toBeNull()
  })

  it("rejects anything that is not an amount", () => {
    expect(() => euroToCents("mucho")).toThrow(InputError)
    expect(() => euroToCents("7,999")).toThrow(InputError)
    expect(() => euroToCents("1e3")).toThrow(InputError)
  })
})

describe("percentToBasisPoints", () => {
  it("converts whole and fractional percentages", () => {
    expect(percentToBasisPoints("75")).toBe(7500)
    expect(percentToBasisPoints("65,1")).toBe(6510)
    expect(percentToBasisPoints("30 %")).toBe(3000)
  })

  it("rejects a negative or unparseable margin", () => {
    expect(() => percentToBasisPoints("-10")).toThrow(InputError)
    expect(() => percentToBasisPoints("")).toThrow(InputError)
  })
})

describe("dateField", () => {
  it("reads a date input as UTC midnight", () => {
    expect(dateField("2026-12-31")?.toISOString()).toBe("2026-12-31T00:00:00.000Z")
  })

  it("reads a datetime-local input as UTC", () => {
    expect(dateField("2026-12-31T18:30")?.toISOString()).toBe("2026-12-31T18:30:00.000Z")
  })

  it("returns null for an empty field", () => {
    expect(dateField("")).toBeNull()
  })

  it("rejects a malformed date", () => {
    expect(() => dateField("31/12/2026")).toThrow(InputError)
  })
})
