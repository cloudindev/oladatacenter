import { describe, expect, it } from "vitest"
import { envFlag } from "./env"

describe("envFlag", () => {
  it("only enables on true or 1", () => {
    expect(envFlag.parse("true")).toBe(true)
    expect(envFlag.parse("1")).toBe(true)
  })

  it("keeps kill switches off for false, 0, empty or unset", () => {
    expect(envFlag.parse("false")).toBe(false)
    expect(envFlag.parse("0")).toBe(false)
    expect(envFlag.parse("")).toBe(false)
    expect(envFlag.parse(undefined)).toBe(false)
  })

  it("rejects anything ambiguous instead of guessing", () => {
    expect(envFlag.safeParse("yes").success).toBe(false)
    expect(envFlag.safeParse("TRUE").success).toBe(false)
    expect(envFlag.safeParse(" false").success).toBe(false)
  })
})
