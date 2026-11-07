import { describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import {
  decodePendingOrder,
  encodePendingOrder,
  sanitizePendingOrder,
  sessionOwnerTag,
} from "./pending-order"

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

describe("pending order ownership", () => {
  const href = "/app/servers/new?plan=s&dc=gravelines"
  const owner = "a".repeat(64)

  it("round-trips the owner and the order", () => {
    expect(decodePendingOrder(encodePendingOrder(href, owner))).toEqual({ owner, href })
    expect(decodePendingOrder(encodePendingOrder(href, null))).toEqual({ owner: null, href })
  })

  it("drops the old owner-less cookies, which could belong to anyone", () => {
    expect(decodePendingOrder(href)).toBeNull()
  })

  it("refuses a forged owner or a forged order", () => {
    expect(decodePendingOrder(`not-a-hash|${href}`)).toBeNull()
    expect(decodePendingOrder(`${owner}|/app/billing`)).toBeNull()
  })

  it("tags with the same hash the sessions table stores", async () => {
    const token = "session-token-123"
    expect(await sessionOwnerTag(token)).toBe(createHash("sha256").update(token, "utf8").digest("hex"))
  })
})
