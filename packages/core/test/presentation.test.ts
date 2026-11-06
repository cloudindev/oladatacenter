import { describe, expect, it } from "vitest"
import rawCatalog from "./fixtures/ovh-catalog-vps-es.json" with { type: "json" }
import {
  ADDON_FAMILY_LABELS,
  addonLabel,
  addonSlug,
  annualSavingPercent,
  applyDatacenterStock,
  baselineRequest,
  buildQuote,
  datacenterCodeForSlug,
  datacenterLabel,
  datacenterSlug,
  datacentersFor,
  defaultOsFor,
  encodeConfig,
  groupAddonsByFamily,
  groupOperatingSystems,
  osSlug,
  parseCatalog,
  parseTermParam,
  planCodeForSlug,
  planSlugForCode,
  PresentationError,
  resolveConfig,
  slugify,
  toPlanViewModel,
  toPublicQuote,
  toQuoteRequest,
  type AddonOption,
  type ParsedCatalog,
  type PublicConfig,
  type SellablePlan,
} from "../src/index.js"

const catalog: ParsedCatalog = parseCatalog(rawCatalog)

function planCost(code: string) {
  const found = catalog.plans.find((candidate) => candidate.planCode === code)
  if (!found) throw new Error(`fixture is missing ${code}`)
  return found
}

const planS = planCost("vps-2027-model1")
const planM = planCost("vps-2027-model2")

const plans: SellablePlan[] = catalog.plans
  .map((plan) => toPlanViewModel(plan, catalog))
  .sort((a, b) => a.sort - b.sort)

describe("slugify", () => {
  it("folds accents and punctuation into a URL-safe slug", () => {
    expect(slugify("Fráncfort")).toBe("francfort")
    expect(slugify("FreeBSD-15-zfs - UEFI")).toBe("freebsd-15-zfs-uefi")
    expect(slugify("  Ubuntu 24.04 ")).toBe("ubuntu-24-04")
  })
})

describe("plan slugs", () => {
  it("maps both ways between OVH codes and OLA slugs", () => {
    expect(planSlugForCode("vps-2027-model1")).toBe("s")
    expect(planCodeForSlug("xl")).toBe("vps-2027-model4")
    expect(planCodeForSlug("nope")).toBeNull()
    expect(planSlugForCode("vps-2027-modelX")).toBeNull()
  })
})

describe("datacenters", () => {
  it("labels a datacenter by city and country, never by its OVH code", () => {
    expect(datacenterLabel("EU-WEST-RBX")).toBe("Roubaix, Francia")
    expect(datacenterLabel("BHS")).toBe("Beauharnois, Canadá")
    expect(datacenterLabel("RBX-LZ")).toBeNull()
    expect(datacenterSlug("EU-WEST-RBX")).toBe("roubaix")
    expect(datacenterSlug("RBX-LZ")).toBeNull()
    expect(datacenterCodeForSlug("roubaix")).toBe("EU-WEST-RBX")
    expect(datacenterCodeForSlug("mars")).toBeNull()
  })

  it("only offers the sellable datacenters a plan actually has", () => {
    const dcs = datacentersFor(planS)
    expect(dcs.map((dc) => dc.slug)).toEqual([
      "gravelines",
      "estrasburgo",
      "roubaix",
      "limburgo",
      "londres",
      "varsovia",
      "milan",
      "beauharnois",
      "singapur",
      "sidney",
      "bombay",
    ])
    expect(dcs.filter((dc) => dc.region === "europe")).toHaveLength(7)
    expect(dcs.some((dc) => dc.label.includes("BHS"))).toBe(false)
  })
})

describe("operating systems", () => {
  const groups = groupOperatingSystems(planS)

  it("groups by distribution family, newest image first", () => {
    expect(groups.map((group) => group.family)).toEqual([
      "ubuntu",
      "debian",
      "almalinux",
      "rocky",
      "fedora",
      "freebsd",
      "apps",
    ])
    const debian = groups.find((group) => group.family === "debian")
    expect(debian?.options.map((option) => option.name)).toEqual(["Debian 13", "Debian 12"])
    const apps = groups.find((group) => group.family === "apps")
    expect(apps?.options.map((option) => option.name)).toEqual([
      "Debian 12 - n8n",
      "Debian 12 - Docker",
    ])
    const ubuntu = groups.find((group) => group.family === "ubuntu")
    expect(ubuntu?.options.map((option) => option.name)).toEqual([
      "Ubuntu 26.04",
      "Ubuntu 24.04",
      "Ubuntu 22.04",
    ])
  })

  it("hides images that need a licence we do not resell", () => {
    const names = groups.flatMap((group) => group.options.map((option) => option.name))
    expect(names.some((name) => /cPanel|Plesk|CloudLinux/i.test(name))).toBe(false)
  })

  it("lists Windows but never lets it be selected", () => {
    const windows = groupOperatingSystems(planM).find((group) => group.family === "windows")
    expect(windows).toBeDefined()
    expect(windows?.options.every((option) => option.disabled)).toBe(true)
    expect(windows?.options[0]?.note).toBe("disponible próximamente")
  })

  it("defaults to the newest Ubuntu", () => {
    expect(defaultOsFor(planS)?.name).toBe("Ubuntu 26.04")
    expect(osSlug("Ubuntu 26.04")).toBe("ubuntu-26-04")
  })

  it("returns no default when a plan has no sellable image", () => {
    expect(defaultOsFor({ ...planS, operatingSystems: ["AlmaLinux 9 - cPanel"] })).toBeNull()
  })
})

describe("addon slugs and labels", () => {
  function slugOf(code: string): string | null {
    const addon = catalog.addons.find((candidate) => candidate.planCode === code)
    if (!addon) throw new Error(`fixture is missing ${code}`)
    return addonSlug(addon)
  }

  it("never leaks an OVH plan code", () => {
    expect(slugOf("option-auto-backup-2027-1-model1")).toBe("backup-1d")
    expect(slugOf("option-auto-backup-2027-7-model1")).toBe("backup-7d")
    expect(slugOf("option-snapshot-2027-model1")).toBe("snapshot")
    expect(slugOf("option-additional-disk-2027-50g")).toBe("disco-50gb")
    expect(slugOf("option-additional-disk-2027-10000g")).toBe("disco-10tb")
    expect(slugOf("option-plesk-webpro")).toBe("plesk-web-pro")
    expect(slugOf("option-linux")).toBe("linux")
    expect(slugOf("option-windows-2027-model2")).toBe("windows")
    expect(slugOf("option-storage-local-2027-model1")).toBe("nvme-local")
    expect(slugOf("option-storage-remote-2027")).toBe("disco-remoto")
  })

  it("drops an option it cannot name, instead of publishing the raw code", () => {
    expect(
      addonSlug({
        planCode: "option-mystery-2027",
        invoiceName: "Mystery",
        family: "snapshot",
        monthlyCost: { P1M: 100, P12M: 100 },
      }),
    ).toBeNull()
  })

  it("reads in Spanish", () => {
    expect(addonLabel("backup-1d")).toBe("Backup automático de 1 día")
    expect(addonLabel("backup-7d")).toBe("Backup automático de 7 días")
    expect(addonLabel("disco-1tb")).toBe("Disco adicional de 1 TB")
    expect(addonLabel("plesk-web-host")).toBe("Plesk Web Host")
    expect(addonLabel("snapshot")).toBe("Snapshot bajo demanda")
    expect(addonLabel("linux")).toBe("Linux")
    expect(addonLabel("windows")).toBe("Windows Server")
    expect(addonLabel("nvme-local")).toBe("Disco NVMe local")
    expect(addonLabel("disco-remoto")).toBe("Disco remoto")
    expect(addonLabel("desconocido")).toBe("desconocido")
    expect(ADDON_FAMILY_LABELS.automatedBackup).toBe("Backup automático")
  })
})

describe("groupAddonsByFamily", () => {
  const option = (slug: string, family: AddonOption["family"]): AddonOption => ({
    slug,
    family,
    label: addonLabel(slug),
    monthlyPrice: { P1M: 100, P12M: 100 },
    included: false,
    mandatoryFamily: family === "automatedBackup",
    disabled: false,
  })

  it("orders the families as the configurator shows them", () => {
    const groups = groupAddonsByFamily([
      option("plesk-web-admin", "plesk"),
      option("snapshot", "snapshot"),
      option("backup-7d", "automatedBackup"),
    ])
    expect(groups.map((group) => group.family)).toEqual([
      "automatedBackup",
      "snapshot",
      "plesk",
    ])
    expect(groups[0]?.mandatory).toBe(true)
    expect(groups[1]?.mandatory).toBe(false)
    expect(groups[0]?.label).toBe("Backup automático")
    expect(groups[0]?.hint.length).toBeGreaterThan(0)
  })

  it("returns nothing for no options", () => {
    expect(groupAddonsByFamily([])).toEqual([])
  })
})

describe("annualSavingPercent", () => {
  it("reports the percent saved per month", () => {
    expect(annualSavingPercent(898, 798)).toBe(11)
    expect(annualSavingPercent(1000, 500)).toBe(50)
  })

  it("never reports a negative or undefined saving", () => {
    expect(annualSavingPercent(0, 0)).toBe(0)
    expect(annualSavingPercent(500, 600)).toBe(0)
    expect(annualSavingPercent(500, 500)).toBe(0)
  })
})

describe("toPlanViewModel", () => {
  const view = plans[0]

  it("uses the OLA identity, never OVH's", () => {
    expect(view?.slug).toBe("s")
    expect(view?.name).toBe("OLA VPS S")
    expect(JSON.stringify(view)).not.toMatch(/vps-2027|VPS-1|option-/)
  })

  it("publishes the specs of the branding table", () => {
    expect(view?.specs).toEqual({ vcores: 2, ramGb: 4, nvmeGb: 40, bandwidthMbps: 500 })
  })

  it("prices the plan with the mandatory backup included, through buildQuote", () => {
    // 7,99 plan + 0,99 mandatory 1-day backup = 8,98 net per month.
    expect(view?.price.P1M.monthly).toBe(898)
    expect(view?.price.P1M.cycle).toBe(898)
    expect(view?.price.P12M.monthly).toBe(798)
    expect(view?.price.P12M.cycle).toBe(798 * 12)
    expect(view?.price.P12M.months).toBe(12)
  })

  it("quotes the saving of the annual term", () => {
    expect(view?.savingPercent).toBe(11)
    expect(view?.savingPerYear).toBe(898 * 12 - 798 * 12)
  })

  it("honours admin overrides without recomputing anything itself", () => {
    const overridden = toPlanViewModel(planS, catalog, { manualPlanPrice: { P1M: 1000 } })
    expect(overridden.price.P1M.monthly).toBe(1000 + 99)
  })

  it("offers the optional families, with the included backup marked", () => {
    const families = view?.addons.map((group) => group.family)
    expect(families).toContain("automatedBackup")
    expect(families).toContain("snapshot")
    expect(families).toContain("additionalDisk")
    expect(families).toContain("plesk")

    const backups = view?.addons.find((group) => group.family === "automatedBackup")
    expect(backups?.options.find((option) => option.slug === "backup-1d")?.included).toBe(true)
    expect(backups?.options.find((option) => option.slug === "backup-7d")?.included).toBe(false)
    // 1,10 € cost * 1.5 -> ceil to ,99
    expect(backups?.options.find((option) => option.slug === "backup-7d")?.monthlyPrice.P1M).toBe(
      199,
    )
  })

  it("marks the Windows option as not yet available", () => {
    const m = plans.find((plan) => plan.slug === "m")
    const windows = m?.addons
      .find((group) => group.family === "os")
      ?.options.find((option) => option.slug === "windows")
    expect(windows?.disabled).toBe(true)
    expect(windows?.note).toBe("disponible próximamente")
  })

  it("keeps the four plans in commercial order", () => {
    expect(plans.map((plan) => plan.slug)).toEqual(["s", "m", "l", "xl"])
  })

  it("refuses a plan it cannot brand or configure", () => {
    expect(() => toPlanViewModel({ ...planS, planCode: "vps-unknown" }, catalog)).toThrow(
      PresentationError,
    )
    expect(() => baselineRequest({ ...planS, operatingSystems: [] }, "P1M")).toThrow(
      PresentationError,
    )
    expect(() => baselineRequest({ ...planS, datacenters: [] }, "P1M")).toThrow(PresentationError)
  })
})

describe("the shareable configuration", () => {
  it("parses the term in Spanish and in ISO form", () => {
    expect(parseTermParam("mensual")).toBe("P1M")
    expect(parseTermParam("anual")).toBe("P12M")
    expect(parseTermParam("P12M")).toBe("P12M")
    expect(parseTermParam("p1m")).toBe("P1M")
    expect(parseTermParam("trimestral")).toBeNull()
    expect(parseTermParam(undefined)).toBeNull()
  })

  it("restores a full configuration from the query string", () => {
    const config = resolveConfig(plans, {
      plan: "l",
      dc: "limburgo",
      os: "debian-13",
      term: "anual",
      addons: "snapshot,disco-200gb,plesk-web-pro",
    })
    expect(config).toEqual({
      plan: "l",
      dc: "limburgo",
      os: "debian-13",
      term: "P12M",
      addons: ["snapshot", "disco-200gb", "plesk-web-pro"],
    })
  })

  it("falls back to a sellable default for anything missing or stale", () => {
    const config = resolveConfig(plans, {})
    expect(config.plan).toBe("s")
    expect(config.dc).toBe("gravelines")
    expect(config.os).toBe("ubuntu-26-04")
    expect(config.term).toBe("P1M")
    expect(config.addons).toEqual([])

    const stale = resolveConfig(plans, {
      plan: "xxl",
      dc: "atlantis",
      os: "windows-server-2025-standard-desktop",
      term: "weekly",
      addons: "cpanel,backup-1d,desconocido",
    })
    expect(stale.plan).toBe("s")
    expect(stale.dc).toBe("gravelines")
    expect(stale.os).toBe("ubuntu-26-04")
    // backup-1d is already included, cpanel is out of scope: neither is a selectable option.
    expect(stale.addons).toEqual([])
  })

  it("takes the first value of a repeated parameter", () => {
    expect(resolveConfig(plans, { plan: ["m", "l"] }).plan).toBe("m")
  })

  it("refuses to resolve without a catalog", () => {
    expect(() => resolveConfig([], {})).toThrow(PresentationError)
  })

  it("round-trips through the canonical query string", () => {
    const config: PublicConfig = {
      plan: "m",
      dc: "roubaix",
      os: "debian-13",
      term: "P12M",
      addons: ["backup-7d", "snapshot"],
    }
    const query = encodeConfig(config)
    expect(query).toBe("plan=m&dc=roubaix&os=debian-13&term=anual&addons=backup-7d%2Csnapshot")
    expect(resolveConfig(plans, Object.fromEntries(new URLSearchParams(query)))).toEqual(config)
  })

  it("translates slugs into the OVH vocabulary for the pricing engine", () => {
    const request = toQuoteRequest(catalog, {
      plan: "s",
      dc: "gravelines",
      os: "debian-13",
      term: "P1M",
      addons: ["backup-7d", "disco-50gb"],
    })
    expect(request).toEqual({
      planCode: "vps-2027-model1",
      term: "P1M",
      datacenter: "GRA",
      operatingSystem: "Debian 13",
      addonCodes: ["option-auto-backup-2027-7-model1", "option-additional-disk-2027-50g"],
    })
    // The translated request is accepted by the engine as is.
    expect(buildQuote(catalog, request).monthlyPrice).toBeGreaterThan(0)
  })

  it("rejects a configuration the catalog cannot serve", () => {
    const base: PublicConfig = {
      plan: "s",
      dc: "gravelines",
      os: "debian-13",
      term: "P1M",
      addons: [],
    }
    expect(() => toQuoteRequest(catalog, { ...base, plan: "xxl" })).toThrow(/unknown plan/)
    expect(() => toQuoteRequest(catalog, { ...base, dc: "atlantis" })).toThrow(/unknown datacenter/)
    expect(() => toQuoteRequest(catalog, { ...base, os: "templeos" })).toThrow(
      /unknown operating system/,
    )
    expect(() => toQuoteRequest(catalog, { ...base, addons: ["cpanel"] })).toThrow(/unknown option/)
    // A Windows image is listed but never orderable.
    expect(() =>
      toQuoteRequest(catalog, { ...base, plan: "m", os: "windows-server-2025-standard-desktop" }),
    ).toThrow(/unknown operating system/)
  })
})

describe("toPublicQuote", () => {
  const config: PublicConfig = {
    plan: "s",
    dc: "roubaix",
    os: "debian-13",
    term: "P12M",
    addons: ["backup-7d", "snapshot"],
  }
  const quote = buildQuote(catalog, toQuoteRequest(catalog, config))
  const publicQuote = toPublicQuote(quote, catalog, config)

  it("strips our cost and OVH's names", () => {
    const serialised = JSON.stringify(publicQuote)
    expect(serialised).not.toMatch(/vps-2027|VPS-1|option-|Cost|cost/)
  })

  it("keeps the customer-facing totals of the quote untouched", () => {
    expect(publicQuote.monthlyPrice).toBe(quote.monthlyPrice)
    expect(publicQuote.cycleNet).toBe(quote.cycleNet)
    expect(publicQuote.months).toBe(12)
    expect(publicQuote.term).toBe("P12M")
  })

  it("names the plan, the datacenter and the image in Spanish", () => {
    expect(publicQuote.planName).toBe("OLA VPS S")
    expect(publicQuote.datacenter).toBe("Roubaix, Francia")
    expect(publicQuote.os).toBe("Debian 13")
    expect(publicQuote.included.length).toBeGreaterThan(0)
  })

  it("lists one line per billed item", () => {
    expect(publicQuote.lines[0]).toEqual({
      slug: "s",
      label: "OLA VPS S",
      family: "plan",
      monthlyPrice: 699,
      cyclePrice: 699 * 12,
      mandatory: true,
    })
    const slugs = publicQuote.lines.map((line) => line.slug)
    expect(slugs).toContain("backup-7d")
    expect(slugs).toContain("snapshot")
    expect(slugs).toContain("linux")
    expect(slugs).not.toContain("backup-1d")
  })

  it("drops a line it cannot name instead of leaking the code", () => {
    const polluted = {
      ...quote,
      lines: [
        ...quote.lines,
        {
          kind: "addon" as const,
          code: "option-mystery-2027",
          label: "Mystery",
          monthlyCost: 100,
          monthlyPrice: 199,
          cyclePrice: 199,
          mandatory: false,
        },
      ],
    }
    const result = toPublicQuote(polluted, catalog, config)
    expect(result.lines).toHaveLength(quote.lines.length)
  })

  it("refuses a quote for a plan it cannot brand", () => {
    expect(() => toPublicQuote({ ...quote, planCode: "vps-unknown" }, catalog, config)).toThrow(
      PresentationError,
    )
  })
})

describe("applyDatacenterStock", () => {
  const plan = plans.find((candidate) => candidate.slug === "s")
  if (!plan) throw new Error("fixture has no S plan")

  it("keeps everything available when stock is unknown", () => {
    const result = applyDatacenterStock(plan, null)
    expect(result.available).toBe(true)
    expect(result.datacenters.every((dc) => dc.available)).toBe(true)
  })

  it("marks only the datacenters with stock and the plan as available", () => {
    const result = applyDatacenterStock(plan, new Set(["GRA"]))
    expect(result.available).toBe(true)
    expect(result.datacenters.filter((dc) => dc.available).map((dc) => dc.slug)).toEqual([
      "gravelines",
    ])
  })

  it("marks the plan sold out when no sellable datacenter has stock", () => {
    const result = applyDatacenterStock(plan, new Set(["RBX-LZ"]))
    expect(result.available).toBe(false)
  })

  it("never resolves a configuration to a datacenter without stock", () => {
    const stocked = plans.map((candidate) =>
      applyDatacenterStock(candidate, new Set(["SBG"])),
    )
    const config = resolveConfig(stocked, { plan: "s", dc: "gravelines" })
    expect(config.dc).toBe("estrasburgo")
  })
})
