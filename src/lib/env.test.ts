import { describe, expect, it } from "vitest"
import { envFlag, overrideFlag, resolveProviderMock, withoutEmptyValues } from "./env"

describe("withoutEmptyValues", () => {
  it("treats blank entries from a .env template as unset", () => {
    expect(withoutEmptyValues({ A: "x", B: "", C: "  ", D: undefined })).toEqual({ A: "x" })
  })
})

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

describe("per-provider mock switches", () => {
  const base = {
    NODE_ENV: "production" as const,
    USE_MOCK_PROVIDERS: true,
    MOCK_OVH: undefined,
    MOCK_WHMCS: undefined,
    MOCK_STRIPE: undefined,
  }

  it("follows USE_MOCK_PROVIDERS when no override is set", () => {
    expect(resolveProviderMock(base, "whmcs")).toBe(true)
    expect(resolveProviderMock({ ...base, USE_MOCK_PROVIDERS: false }, "whmcs")).toBe(false)
  })

  it("lets one provider go live while the others stay simulated", () => {
    const settings = { ...base, MOCK_WHMCS: false, MOCK_STRIPE: false }
    expect(resolveProviderMock(settings, "whmcs")).toBe(false)
    expect(resolveProviderMock(settings, "stripe")).toBe(false)
    expect(resolveProviderMock(settings, "ovh")).toBe(true)
  })

  it("always mocks under the test runner", () => {
    expect(resolveProviderMock({ ...base, NODE_ENV: "test", MOCK_OVH: false }, "ovh")).toBe(true)
  })

  it("parses overrides strictly and keeps unset distinct from false", () => {
    expect(overrideFlag.parse(undefined)).toBeUndefined()
    expect(overrideFlag.parse("false")).toBe(false)
    expect(overrideFlag.parse("1")).toBe(true)
    expect(overrideFlag.safeParse("no").success).toBe(false)
  })
})
