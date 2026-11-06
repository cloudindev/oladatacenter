import { describe, expect, it } from "vitest"
import { sanitizePendingOrder } from "./pending-order"

describe("sanitizePendingOrder", () => {
  it("keeps an order URL with its configuration", () => {
    const href = "/app/servers/new?plan=m&dc=gravelines&os=ubuntu-26-04&term=mensual"
    expect(sanitizePendingOrder(href)).toBe(href)
  })

  it("refuses anything that is not the order page", () => {
    expect(sanitizePendingOrder("/app/billing")).toBeNull()
    expect(sanitizePendingOrder("/app/servers/newx")).toBeNull()
    expect(sanitizePendingOrder("https://evil.example/app/servers/new")).toBeNull()
    expect(sanitizePendingOrder("//evil.example")).toBeNull()
    expect(sanitizePendingOrder("/app/servers/new?x=\\evil")).toBeNull()
    expect(sanitizePendingOrder(`/app/servers/new?${"a".repeat(600)}`)).toBeNull()
    expect(sanitizePendingOrder(undefined)).toBeNull()
  })
})
