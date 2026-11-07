import { describe, expect, it } from "vitest"
import {
  byRelevance,
  cycleLabel,
  domainStatusUi,
  kindOfProduct,
  parseWhmcsDate,
  productStatusUi,
  stillVisible,
} from "./model"

describe("WHMCS product classification", () => {
  it("knows the operator's product ids", () => {
    for (const pid of [1, 2, 3, 284, 4, 125, 8, 9, 10]) expect(kindOfProduct(pid)).toBe("web_hosting")
    for (const pid of [85, 14, 15, 5, 41, 42, 63]) expect(kindOfProduct(pid)).toBe("vps")
    expect(kindOfProduct(88)).toBe("plesk_licence")
    expect(kindOfProduct(64)).toBe("ip")
  })

  it("ignores everything else (web design, SEO, snapshots…)", () => {
    for (const pid of [32, 34, 40, 86, 87, 121]) expect(kindOfProduct(pid)).toBeNull()
  })
})

describe("WHMCS labels", () => {
  it("tells live services from finished ones", () => {
    expect(productStatusUi("Active")).toMatchObject({ label: "Activo", live: true })
    expect(productStatusUi("Terminated")).toMatchObject({ label: "Dado de baja", live: false })
    expect(domainStatusUi("Grace").live).toBe(true)
    expect(domainStatusUi("Transferred Away").live).toBe(false)
  })

  it("translates billing cycles and reads WHMCS dates", () => {
    expect(cycleLabel("Annually")).toBe("al año")
    expect(cycleLabel("One Time")).toBe("pago único")
    expect(parseWhmcsDate("2026-02-06")?.toISOString()).toBe("2026-02-06T00:00:00.000Z")
    expect(parseWhmcsDate(null)).toBeNull()
  })

  it("orders live first, then by the soonest due date", () => {
    const at = (iso: string | null) => (iso ? new Date(iso) : null)
    const items = [
      { id: "old", live: false, nextDueAt: at("2026-01-01"), registeredAt: null },
      { id: "late", live: true, nextDueAt: at("2027-01-01"), registeredAt: null },
      { id: "soon", live: true, nextDueAt: at("2026-12-01"), registeredAt: null },
    ]
    expect([...items].sort(byRelevance).map((item) => item.id)).toEqual(["soon", "late", "old"])
  })
})

describe("inactive items fade out after a month", () => {
  const now = new Date("2026-11-08T12:00:00Z")
  const ended = (iso: string | null) => ({ live: false, end: iso ? new Date(iso) : null })

  it("always keeps live items", () => {
    expect(stillVisible({ live: true, end: new Date("2020-01-01") }, now)).toBe(true)
  })

  it("keeps an inactive item for a month after it ended, then drops it", () => {
    expect(stillVisible(ended("2026-10-20"), now)).toBe(true)
    expect(stillVisible(ended("2026-10-01"), now)).toBe(false)
    expect(stillVisible(ended("2025-04-03"), now)).toBe(false)
  })

  it("drops an inactive item with no date at all", () => {
    expect(stillVisible(ended(null), now)).toBe(false)
  })
})
