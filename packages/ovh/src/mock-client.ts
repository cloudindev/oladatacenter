import { z } from "zod"
import { PLAN_BRANDING, type OvhTaskState } from "@ola/core"
import catalogFixture from "../../core/test/fixtures/ovh-catalog-vps-es.json"
import type {
  AddFirewallRuleInput,
  AddOptionInput,
  AddVpsToCartInput,
  CheckoutInput,
  ConfigureItemInput,
  CreateCartInput,
  ListTasksFilter,
  OrderServiceOptionInput,
  OrderUpgradeInput,
  OvhClient,
  RebuildInput,
  RestoreBackupInput,
} from "./client"
import { OvhApiError } from "./errors"
import {
  OVH_SUBSIDIARIES,
  VPS_OPTIONS,
  toIpAddress,
  type AutomatedBackup,
  type Cart,
  type CartConfigurationItem,
  type CartItem,
  type CartPrice,
  type CheckoutPreview,
  type ConfigurationRequirement,
  type ConfirmTerminationInput,
  type DiskStatisticType,
  type DiskUse,
  type FirewallIp,
  type FirewallRule,
  type FirewallState,
  type GenericOptionDefinition,
  type GenericProductDefinition,
  type GenericProductPricing,
  type Image,
  type IpAddress,
  type Mitigation,
  type MitigationIp,
  type Order,
  type OrderDetail,
  type OrderPrice,
  type OvhOrderStatus,
  type RestoreState,
  type Reverse,
  type ServiceInfos,
  type ServiceInfosUpdate,
  type Snapshot,
  type UpgradeQuote,
  type VpsModel,
  type VpsNetbootMode,
  type VpsOption,
  type VpsState,
  type VpsSummary,
  type VpsTask,
} from "./types"

/* -------------------------------------------------------------------------- */
/* the catalog fixture                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The mock is seeded from the same trimmed ES catalog the core tests use, so plan codes,
 * addon families, datacenters and prices in dev are the real ones.
 */
const fixturePricingSchema = z.object({
  mode: z.string(),
  interval: z.number(),
  price: z.number(),
  capacities: z.array(z.string()).default([]),
})

const fixtureSchema = z.object({
  plans: z.array(
    z.object({
      planCode: z.string(),
      invoiceName: z.string().default(""),
      pricings: z.array(fixturePricingSchema).default([]),
      configurations: z
        .array(z.object({ name: z.string(), values: z.array(z.string()).default([]) }))
        .default([]),
      addonFamilies: z
        .array(
          z.object({
            name: z.string(),
            mandatory: z.boolean().default(false),
            exclusive: z.boolean().default(false),
            addons: z.array(z.string()).default([]),
          }),
        )
        .default([]),
    }),
  ),
  addons: z.array(
    z.object({
      planCode: z.string(),
      invoiceName: z.string().default(""),
      pricings: z.array(fixturePricingSchema).default([]),
    }),
  ),
})

type Fixture = z.infer<typeof fixtureSchema>
type FixturePlan = Fixture["plans"][number]
type FixturePricing = z.infer<typeof fixturePricingSchema>

let parsedFixture: Fixture | null = null

function fixture(): Fixture {
  if (!parsedFixture) parsedFixture = fixtureSchema.parse(catalogFixture)
  return parsedFixture
}

/** Months covered by an ISO 8601 duration such as "P1M" or "P1Y". */
function durationMonths(duration: string): number {
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?$/.exec(duration)
  if (!match) return 1
  const years = match[1] ? Number(match[1]) : 0
  const months = match[2] ? Number(match[2]) : 0
  return Math.max(1, years * 12 + months)
}

const DURATION_BY_MODE: Readonly<Record<string, string>> = {
  default: "P1M",
  upfront6: "P6M",
  upfront12: "P1Y",
  degressivity12: "P1M",
  degressivity24: "P1M",
}

function durationForMode(mode: string): string {
  return DURATION_BY_MODE[mode] ?? "P1M"
}

/** The recurring price of a plan/addon for one pricing mode, in units of 1e-8 EUR per month. */
function monthlyUcents(pricings: readonly FixturePricing[], mode: string): number | null {
  const renewals = pricings.filter(
    (pricing) => pricing.mode === mode && pricing.capacities.includes("renew"),
  )
  if (renewals.length === 0) return null
  const pricing = renewals.reduce((best, candidate) =>
    candidate.interval < best.interval ? candidate : best,
  )
  const months = pricing.interval > 0 ? pricing.interval : 1
  return Math.round(pricing.price / months)
}

function findPlan(planCode: string): FixturePlan | null {
  return fixture().plans.find((plan) => plan.planCode === planCode) ?? null
}

function findAddon(planCode: string): Fixture["addons"][number] | null {
  return fixture().addons.find((addon) => addon.planCode === planCode) ?? null
}

function pricingsFor(planCode: string): readonly FixturePricing[] | null {
  return findPlan(planCode)?.pricings ?? findAddon(planCode)?.pricings ?? null
}

/* -------------------------------------------------------------------------- */
/* price helpers                                                              */
/* -------------------------------------------------------------------------- */

function price(ucents: number): OrderPrice {
  const value = Math.round(ucents / 1e6) / 100
  return {
    currencyCode: "EUR",
    value,
    text: `${value.toFixed(2)} €`,
    priceInUcents: ucents,
  }
}

function pricingEntry(mode: string, ucents: number): GenericProductPricing {
  return {
    capacities: ["renew"],
    description: mode,
    duration: durationForMode(mode),
    interval: 1,
    pricingMode: mode,
    pricingType: "rental",
    price: price(ucents),
    priceInUcents: ucents,
    minimumQuantity: 1,
    maximumQuantity: 1,
    minimumRepeat: 1,
    maximumRepeat: null,
  }
}

const SELLABLE_MODES = ["default", "upfront12"] as const

function pricingsOf(planCode: string): GenericProductPricing[] {
  const pricings = pricingsFor(planCode) ?? []
  const entries: GenericProductPricing[] = []
  for (const mode of SELLABLE_MODES) {
    const ucents = monthlyUcents(pricings, mode)
    if (ucents === null) continue
    entries.push(pricingEntry(mode, ucents))
  }
  return entries
}

/* -------------------------------------------------------------------------- */
/* internal state                                                             */
/* -------------------------------------------------------------------------- */

interface MockCartItem {
  itemId: number
  planCode: string
  duration: string
  pricingMode: string
  quantity: number
  parentItemId: number | null
  configurations: Map<number, CartConfigurationItem>
  optionItemIds: number[]
}

interface MockCart {
  cartId: string
  description: string
  expire: Date
  subsidiary: string
  assigned: boolean
  readOnly: boolean
  items: Map<number, MockCartItem>
}

interface MockOrder {
  orderId: number
  cartId: string
  createdAt: number
  status: OvhOrderStatus
  prices: CheckoutPreview["prices"]
  details: OrderDetail[]
  serviceName: string | null
}

interface MockVps {
  name: string
  displayName: string | null
  planCode: string
  state: VpsState
  netbootMode: VpsNetbootMode
  zone: string
  offerType: string
  imageId: string
  ips: string[]
  options: VpsOption[]
  snapshot: Snapshot | null
  automatedBackup: AutomatedBackup
  serviceInfos: ServiceInfos
  diskIds: number[]
  terminationToken: string | null
  terminated: boolean
}

interface MockTask {
  id: number
  serviceName: string
  type: string
  startedAt: number
  settled: boolean
  /** Forced terminal state, used by `failNextCall`-style scenarios. */
  forcedState: OvhTaskState | null
  effect: ((vps: MockVps) => void) | null
}

export type DeliveryOutcome = "delivered" | "stuck" | "error"

export interface SeedServiceInput {
  planCode: string
  datacenter?: string
  imageId?: string
  options?: readonly VpsOption[]
  state?: VpsState
}

export interface MockOvhClientOptions {
  subsidiary?: string
  /** Wall clock in milliseconds. Defaults to `Date.now`. */
  now?: () => number
  /** How long an order takes to deliver. Tests pass 0. */
  deliveryMs?: number
  /** How long a VPS task takes to go todo -> doing -> done. Tests pass 0. */
  taskMs?: number
  /** Pre-delivered services, so a dev environment is not empty. */
  seedServices?: readonly SeedServiceInput[]
}

/* -------------------------------------------------------------------------- */
/* the mock                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * In-memory, deterministic OVH. It supports the whole order flow (cart -> item ->
 * configuration -> options -> summary -> checkout -> order status -> the service shows up
 * in `listVps` with an IPv4 and an IPv6) and every service action, keeping its state
 * consistent: a stopped VPS stays stopped, a snapshot cannot be taken twice, a reinstall
 * changes the current image.
 *
 * Time is injected, never real: `deliveryMs: 0` and `taskMs: 0` make everything finish
 * immediately, and `advanceTime(ms)` walks the clock forward by hand.
 */
export class MockOvhClient implements OvhClient {
  private readonly clock: () => number
  private readonly subsidiary: string
  private readonly deliveryMs: number
  private readonly taskMs: number

  private offsetMs = 0
  private sequence = 0
  private deliveryOutcome: DeliveryOutcome = "delivered"
  private readonly failures: Error[] = []

  private readonly carts = new Map<string, MockCart>()
  private readonly orders = new Map<number, MockOrder>()
  private readonly services = new Map<string, MockVps>()
  private readonly tasks = new Map<number, MockTask>()
  /** ipBlock -> ip -> reverse hostname. */
  private readonly reverses = new Map<string, Map<string, string>>()
  /** ipBlock -> ipOnFirewall -> when it was put on the firewall. */
  private readonly firewalledIps = new Map<string, Map<string, number>>()
  /** `${ipBlock}|${ipOnFirewall}` -> sequence -> rule. */
  private readonly firewallRules = new Map<string, Map<number, FirewallRule>>()
  /** ipBlock -> the IPs of that block currently under mitigation. */
  private readonly mitigations = new Map<string, MitigationIp[]>()

  constructor(options: MockOvhClientOptions = {}) {
    this.clock = options.now ?? (() => Date.now())
    this.subsidiary = options.subsidiary ?? "ES"
    this.deliveryMs = options.deliveryMs ?? 20_000
    this.taskMs = options.taskMs ?? 2_000
    for (const seed of options.seedServices ?? []) this.seedService(seed)
  }

  /* --------------------------------------------------------- test helpers */

  /** Walk the simulated clock forward and settle anything that has become due. */
  advanceTime(ms: number): void {
    this.offsetMs += ms
    this.settle()
  }

  /** Make the next call — whichever it is — throw this error exactly once. */
  failNextCall(error: Error): void {
    this.failures.push(error)
  }

  /** What happens to orders placed from now on. */
  setDeliveryOutcome(outcome: DeliveryOutcome): void {
    this.deliveryOutcome = outcome
  }

  /**
   * Put an IP under mitigation. OVH decides this by itself when it sees an attack, so
   * there is no route that creates one for us: it is seeded instead.
   */
  seedMitigation(
    ipBlock: string,
    ipOnMitigation: string,
    options: { auto?: boolean; permanent?: boolean; state?: MitigationIp["state"] } = {},
  ): MitigationIp {
    const entry: MitigationIp = {
      ipOnMitigation,
      auto: options.auto ?? true,
      permanent: options.permanent ?? false,
      state: options.state ?? "ok",
    }
    const entries = this.mitigations.get(ipBlock) ?? []
    const existing = entries.findIndex((candidate) => candidate.ipOnMitigation === ipOnMitigation)
    if (existing >= 0) entries[existing] = entry
    else entries.push(entry)
    this.mitigations.set(ipBlock, entries)
    return entry
  }

  /** Add an already-delivered VPS, for dev environments and action tests. */
  seedService(input: SeedServiceInput): VpsSummary {
    const plan = findPlan(input.planCode)
    if (!plan) throw new Error(`unknown plan code in the catalog fixture: ${input.planCode}`)
    const datacenter = input.datacenter ?? plan.configurations.find((c) => c.name === "vps_datacenter")?.values[0] ?? "GRA"
    const vps = this.createService({
      planCode: input.planCode,
      datacenter,
      imageId: input.imageId ?? this.defaultImageId(plan),
      options: input.options ?? ["automatedBackup"],
      months: 1,
    })
    if (input.state) vps.state = input.state
    return this.toSummary(vps)
  }

  /* ------------------------------------------------------------- plumbing */

  private now(): number {
    return this.clock() + this.offsetMs
  }

  private nextId(): number {
    this.sequence += 1
    return this.sequence
  }

  /** Every public method starts here: it applies `failNextCall` and settles the clock. */
  private guard(): void {
    const failure = this.failures.shift()
    if (failure) throw failure
    this.settle()
  }

  private notFound(path: string, detail: string): OvhApiError {
    return new OvhApiError({
      kind: "http",
      method: "GET",
      path,
      httpStatus: 404,
      ovhErrorCode: "Client::NotFound",
      detail,
    })
  }

  private rejected(method: string, path: string, code: string, detail: string): OvhApiError {
    return new OvhApiError({
      kind: "http",
      method,
      path,
      httpStatus: 400,
      ovhErrorCode: code,
      detail,
    })
  }

  private cart(cartId: string): MockCart {
    const cart = this.carts.get(cartId)
    if (!cart) throw this.notFound(`/order/cart/${cartId}`, `cart ${cartId} does not exist`)
    return cart
  }

  private vps(serviceName: string): MockVps {
    const vps = this.services.get(serviceName)
    if (!vps || vps.terminated) {
      throw this.notFound(`/vps/${serviceName}`, `vps ${serviceName} does not exist`)
    }
    return vps
  }

  /* ---------------------------------------------------------------- tasks */

  private taskState(task: MockTask): OvhTaskState {
    if (task.forcedState) return task.forcedState
    const elapsed = this.now() - task.startedAt
    if (elapsed >= this.taskMs) return "done"
    if (elapsed * 2 >= this.taskMs) return "doing"
    return "todo"
  }

  private taskProgress(task: MockTask): number {
    switch (this.taskState(task)) {
      case "done":
        return 100
      case "doing":
        return 50
      default:
        return 0
    }
  }

  private openTask(
    serviceName: string,
    type: string,
    options: { immediate?: (vps: MockVps) => void; effect?: (vps: MockVps) => void } = {},
  ): VpsTask {
    const vps = this.vps(serviceName)
    options.immediate?.(vps)
    const task: MockTask = {
      id: this.nextId(),
      serviceName,
      type,
      startedAt: this.now(),
      settled: false,
      forcedState: null,
      effect: options.effect ?? null,
    }
    this.tasks.set(task.id, task)
    this.settle()
    return this.toTask(task)
  }

  private toTask(task: MockTask): VpsTask {
    return {
      id: task.id,
      state: this.taskState(task),
      type: task.type,
      progress: this.taskProgress(task),
      date: new Date(task.startedAt),
    }
  }

  /** Apply everything that has become due: finished tasks and delivered orders. */
  private settle(): void {
    for (const task of this.tasks.values()) {
      if (task.settled) continue
      if (this.taskState(task) !== "done") continue
      task.settled = true
      const vps = this.services.get(task.serviceName)
      if (vps && task.effect) task.effect(vps)
    }

    for (const order of this.orders.values()) {
      if (order.status === "delivered" || order.status === "cancelled") continue
      const elapsed = this.now() - order.createdAt
      if (elapsed < this.deliveryMs) {
        order.status = "delivering"
        continue
      }
      switch (this.deliveryOutcome) {
        case "stuck":
          order.status = "delivering"
          break
        case "error":
          order.status = "cancelled"
          break
        case "delivered":
          order.status = "delivered"
          if (!order.serviceName) order.serviceName = this.deliver(order)
          break
      }
    }
  }

  /* ------------------------------------------------------------- services */

  private defaultImageId(plan: FixturePlan): string {
    return plan.configurations.find((c) => c.name === "vps_os")?.values[0] ?? "debian12"
  }

  private modelOf(planCode: string): VpsModel {
    const plan = findPlan(planCode)
    const branding = PLAN_BRANDING[planCode]
    return {
      name: planCode,
      offer: plan?.invoiceName ?? planCode,
      version: "2025v1",
      vcore: branding?.vcores ?? 2,
      memory: (branding?.ramGb ?? 4) * 1024,
      disk: branding?.nvmeGb ?? 40,
      diskLocationType: "local",
      maximumAdditionnalIp: 16,
      datacenter: plan?.configurations.find((c) => c.name === "vps_datacenter")?.values ?? [],
      availableOptions: [...VPS_OPTIONS],
    }
  }

  private createService(input: {
    planCode: string
    datacenter: string
    imageId: string
    options: readonly VpsOption[]
    months: number
  }): MockVps {
    const index = this.nextId()
    const name = `vps-mock-${index}.ola.test`
    const createdAt = new Date(this.now())
    const expiration = new Date(createdAt)
    expiration.setMonth(expiration.getMonth() + input.months)

    const vps: MockVps = {
      name,
      displayName: null,
      planCode: input.planCode,
      state: "running",
      netbootMode: "local",
      zone: input.datacenter,
      offerType: "classic",
      imageId: input.imageId,
      ips: [`203.0.113.${(index % 250) + 1}`, `2001:db8:0:${index.toString(16)}::1`],
      options: [...input.options],
      snapshot: null,
      automatedBackup: {
        state: input.options.includes("automatedBackup") ? "enabled" : "disabled",
        serviceResourceName: name,
        rotation: input.options.includes("automatedBackup") ? 1 : null,
        schedule: input.options.includes("automatedBackup") ? "22:00" : null,
      },
      serviceInfos: {
        serviceId: 1_000_000 + index,
        domain: name,
        status: "ok",
        creation: createdAt,
        expiration,
        engagedUpTo: input.months > 1 ? expiration : null,
        renewalType: "automaticV2016",
        renew: {
          automatic: true,
          deleteAtExpiration: false,
          forced: false,
          manualPayment: false,
          period: input.months,
        },
        canDeleteAtExpiration: true,
        possibleRenewPeriod: [1, 12],
        contactAdmin: "ola-admin",
        contactBilling: "ola-admin",
        contactTech: "ola-admin",
      },
      diskIds: [1],
      terminationToken: null,
      terminated: false,
    }

    this.services.set(name, vps)
    return vps
  }

  private deliver(order: MockOrder): string {
    const cart = this.carts.get(order.cartId)
    if (!cart) return ""
    const root = [...cart.items.values()].find((item) => item.parentItemId === null)
    if (!root) return ""

    const configurations = [...root.configurations.values()]
    const datacenter = configurations.find((c) => c.label === "vps_datacenter")?.value ?? "GRA"
    const os = configurations.find((c) => c.label === "vps_os")?.value
    const plan = findPlan(root.planCode)

    const options: VpsOption[] = []
    for (const item of cart.items.values()) {
      if (item.parentItemId === null) continue
      const family = this.familyOf(root.planCode, item.planCode)
      if (family && (VPS_OPTIONS as readonly string[]).includes(family)) {
        options.push(family as VpsOption)
      }
    }

    const vps = this.createService({
      planCode: root.planCode,
      datacenter,
      imageId: os ?? (plan ? this.defaultImageId(plan) : "debian12"),
      options,
      months: durationMonths(root.duration),
    })
    return vps.name
  }

  private familyOf(planCode: string, addonCode: string): string | null {
    const plan = findPlan(planCode)
    if (!plan) return null
    for (const family of plan.addonFamilies) {
      if (family.addons.includes(addonCode)) return family.name
    }
    return null
  }

  private toSummary(vps: MockVps): VpsSummary {
    const model = this.modelOf(vps.planCode)
    return {
      name: vps.name,
      displayName: vps.displayName,
      state: vps.state,
      model,
      vcore: model.vcore,
      memoryLimit: model.memory,
      netbootMode: vps.netbootMode,
      zone: vps.zone,
      zoneType: "region",
      offerType: vps.offerType,
      cluster: `cluster-${vps.zone.toLowerCase()}`,
      slaMonitoring: false,
      lockStatus: { locked: false, reason: null },
      monitoringIpBlocks: [],
    }
  }

  /* ---------------------------------------------------------------- carts */

  private cartItemPrices(item: MockCartItem): CartPrice[] {
    const pricings = pricingsFor(item.planCode)
    const monthly = pricings ? monthlyUcents(pricings, item.pricingMode) : null
    if (monthly === null) return []
    const total = monthly * durationMonths(item.duration) * item.quantity
    return [
      { label: "PRICE", price: price(total) },
      { label: "RENEW", price: price(total) },
    ]
  }

  private toCartItem(cart: MockCart, item: MockCartItem): CartItem {
    return {
      cartId: cart.cartId,
      itemId: item.itemId,
      productId: "vps",
      offerId: item.planCode,
      duration: item.duration,
      parentItemId: item.parentItemId,
      configurations: [...item.configurations.keys()],
      options: [...item.optionItemIds],
      prices: this.cartItemPrices(item),
      settings: {
        planCode: item.planCode,
        pricingMode: item.pricingMode,
        quantity: item.quantity,
      },
    }
  }

  private priceCart(cart: MockCart): CheckoutPreview {
    const details: OrderDetail[] = []
    let withoutTaxUcents = 0

    for (const item of cart.items.values()) {
      const pricings = pricingsFor(item.planCode)
      const monthly = pricings ? monthlyUcents(pricings, item.pricingMode) : null
      if (monthly === null) continue
      const months = durationMonths(item.duration)
      const unit = monthly * months
      const total = unit * item.quantity
      withoutTaxUcents += total
      details.push({
        description: findPlan(item.planCode)?.invoiceName ?? findAddon(item.planCode)?.invoiceName ?? item.planCode,
        domain: item.planCode,
        quantity: item.quantity,
        detailType: "DURATION",
        cartItemID: item.itemId,
        unitPrice: price(unit),
        totalPrice: price(total),
        originalTotalPrice: price(total),
        reductionTotalPrice: price(0),
      })
    }

    const taxUcents = Math.round(withoutTaxUcents * 0.21)
    return {
      orderId: null,
      url: null,
      prices: {
        withoutTax: price(withoutTaxUcents),
        tax: price(taxUcents),
        withTax: price(withoutTaxUcents + taxUcents),
        originalWithoutTax: price(withoutTaxUcents),
        reduction: price(0),
      },
      details,
      contracts: [
        {
          name: "Contrato de servicios OVHcloud",
          url: "https://www.ovhcloud.com/es-es/terms-and-conditions/",
          content: "",
        },
      ],
    }
  }

  /* -------------------------------------------------------------- catalog */

  async fetchPublicCatalog(subsidiary: string): Promise<unknown> {
    this.guard()
    if (!(OVH_SUBSIDIARIES as readonly string[]).includes(subsidiary)) {
      throw this.rejected(
        "GET",
        "/order/catalog/public/vps",
        "INVALID_SUBSIDIARY",
        `${subsidiary} is not an OVH subsidiary`,
      )
    }
    return catalogFixture as unknown
  }

  /* ------------------------------------------------------------- ordering */

  async createCart(input: CreateCartInput = {}): Promise<Cart> {
    this.guard()
    const cartId = `mock-cart-${this.nextId()}`
    const expire = input.expire ?? new Date(this.now() + 24 * 60 * 60 * 1000)
    this.carts.set(cartId, {
      cartId,
      description: input.description ?? "OLA VPS Cloud",
      expire,
      subsidiary: input.ovhSubsidiary ?? this.subsidiary,
      assigned: false,
      readOnly: false,
      items: new Map(),
    })
    return { cartId, description: input.description ?? "OLA VPS Cloud", expire, items: [], readOnly: false }
  }

  async assignCart(cartId: string): Promise<void> {
    this.guard()
    this.cart(cartId).assigned = true
  }

  async listCartVpsOffers(cartId: string): Promise<readonly GenericProductDefinition[]> {
    this.guard()
    this.cart(cartId)
    return fixture().plans.map((plan) => ({
      planCode: plan.planCode,
      productName: plan.invoiceName,
      productType: "cloud_service",
      prices: pricingsOf(plan.planCode),
    }))
  }

  async addVpsToCart(input: AddVpsToCartInput): Promise<CartItem> {
    this.guard()
    const cart = this.cart(input.cartId)
    if (cart.readOnly) {
      throw this.rejected("POST", `/order/cart/${cart.cartId}/vps`, "CART_READ_ONLY", "cart already ordered")
    }
    if (!findPlan(input.planCode)) {
      throw this.rejected(
        "POST",
        `/order/cart/${cart.cartId}/vps`,
        "INVALID_PLAN_CODE",
        `unknown plan code ${input.planCode}`,
      )
    }
    const item: MockCartItem = {
      itemId: this.nextId(),
      planCode: input.planCode,
      duration: input.duration,
      pricingMode: input.pricingMode,
      quantity: input.quantity ?? 1,
      parentItemId: null,
      configurations: new Map(),
      optionItemIds: [],
    }
    cart.items.set(item.itemId, item)
    return this.toCartItem(cart, item)
  }

  async configureItem(input: ConfigureItemInput): Promise<CartConfigurationItem> {
    this.guard()
    const cart = this.cart(input.cartId)
    const item = cart.items.get(input.itemId)
    if (!item) {
      throw this.notFound(
        `/order/cart/${cart.cartId}/item/${input.itemId}`,
        `item ${input.itemId} does not exist`,
      )
    }
    const plan = findPlan(item.planCode)
    const allowed = plan?.configurations.find((c) => c.name === input.label)
    if (allowed && allowed.values.length > 0 && !allowed.values.includes(input.value)) {
      throw this.rejected(
        "POST",
        `/order/cart/${cart.cartId}/item/${input.itemId}/configuration`,
        "INVALID_CONFIGURATION_VALUE",
        `${input.value} is not a valid ${input.label}`,
      )
    }
    const configuration: CartConfigurationItem = {
      id: this.nextId(),
      label: input.label,
      value: input.value,
    }
    item.configurations.set(configuration.id, configuration)
    return configuration
  }

  async listCartItemConfigurations(cartId: string, itemId: number): Promise<readonly number[]> {
    this.guard()
    const cart = this.cart(cartId)
    const item = cart.items.get(itemId)
    if (!item) {
      throw this.notFound(`/order/cart/${cartId}/item/${itemId}`, `item ${itemId} does not exist`)
    }
    return [...item.configurations.keys()]
  }

  async listCartItemRequiredConfiguration(
    cartId: string,
    itemId: number,
  ): Promise<readonly ConfigurationRequirement[]> {
    this.guard()
    const cart = this.cart(cartId)
    const item = cart.items.get(itemId)
    if (!item) {
      throw this.notFound(`/order/cart/${cartId}/item/${itemId}`, `item ${itemId} does not exist`)
    }
    const plan = findPlan(item.planCode)
    if (!plan) return []
    const alreadySet = new Set([...item.configurations.values()].map((c) => c.label))
    return plan.configurations
      .filter((configuration) => !alreadySet.has(configuration.name))
      .map((configuration) => ({
        label: configuration.name,
        // Verified 2026-11-05: vps_datacenter is required, vps_os is optional.
        required: configuration.name === "vps_datacenter",
        type: "string",
        fields: null,
      }))
  }

  async listCartOptions(
    cartId: string,
    planCode: string,
  ): Promise<readonly GenericOptionDefinition[]> {
    this.guard()
    this.cart(cartId)
    const plan = findPlan(planCode)
    if (!plan) return []
    const definitions: GenericOptionDefinition[] = []
    for (const family of plan.addonFamilies) {
      for (const addonCode of family.addons) {
        const addon = findAddon(addonCode)
        definitions.push({
          planCode: addonCode,
          productName: addon?.invoiceName ?? addonCode,
          productType: "cloud_service",
          prices: pricingsOf(addonCode),
          family: family.name,
          mandatory: family.mandatory,
          exclusive: family.exclusive,
        })
      }
    }
    return definitions
  }

  async addOption(input: AddOptionInput): Promise<CartItem> {
    this.guard()
    const cart = this.cart(input.cartId)
    const parent = cart.items.get(input.itemId)
    if (!parent) {
      throw this.notFound(
        `/order/cart/${cart.cartId}/item/${input.itemId}`,
        `item ${input.itemId} does not exist`,
      )
    }
    if (!this.familyOf(parent.planCode, input.planCode)) {
      throw this.rejected(
        "POST",
        `/order/cart/${cart.cartId}/vps/options`,
        "INVALID_OPTION",
        `${input.planCode} is not an option of ${parent.planCode}`,
      )
    }
    const item: MockCartItem = {
      itemId: this.nextId(),
      planCode: input.planCode,
      duration: input.duration,
      pricingMode: input.pricingMode,
      quantity: input.quantity ?? 1,
      parentItemId: parent.itemId,
      configurations: new Map(),
      optionItemIds: [],
    }
    cart.items.set(item.itemId, item)
    parent.optionItemIds.push(item.itemId)
    return this.toCartItem(cart, item)
  }

  async getCartSummary(cartId: string): Promise<CheckoutPreview> {
    this.guard()
    return this.priceCart(this.cart(cartId))
  }

  async getCheckoutPreview(cartId: string): Promise<CheckoutPreview> {
    this.guard()
    return this.priceCart(this.cart(cartId))
  }

  async checkout(input: CheckoutInput): Promise<CheckoutPreview> {
    this.guard()
    const cart = this.cart(input.cartId)
    if (cart.readOnly) {
      throw this.rejected(
        "POST",
        `/order/cart/${cart.cartId}/checkout`,
        "CART_READ_ONLY",
        "cart already ordered",
      )
    }
    if (!cart.assigned) {
      throw this.rejected(
        "POST",
        `/order/cart/${cart.cartId}/checkout`,
        "CART_NOT_ASSIGNED",
        "cart must be assigned to an account before checkout",
      )
    }
    const root = [...cart.items.values()].find((item) => item.parentItemId === null)
    if (!root) {
      throw this.rejected(
        "POST",
        `/order/cart/${cart.cartId}/checkout`,
        "EMPTY_CART",
        "cart has no VPS item",
      )
    }

    const preview = this.priceCart(cart)
    const orderId = 10_000 + this.nextId()
    cart.readOnly = true
    this.orders.set(orderId, {
      orderId,
      cartId: cart.cartId,
      createdAt: this.now(),
      status: "checking",
      prices: preview.prices,
      details: preview.details,
      serviceName: null,
    })
    this.settle()

    return {
      ...preview,
      orderId,
      url: `https://www.ovh.com/manager/order/${orderId}`,
    }
  }

  /* --------------------------------------------------------------- orders */

  private order(orderId: number): MockOrder {
    const order = this.orders.get(orderId)
    if (!order) throw this.notFound(`/me/order/${orderId}`, `order ${orderId} does not exist`)
    return order
  }

  async getOrderStatus(orderId: number): Promise<OvhOrderStatus> {
    this.guard()
    return this.order(orderId).status
  }

  async getOrderDetails(orderId: number): Promise<readonly number[]> {
    this.guard()
    return this.order(orderId).details.map((_, index) => index + 1)
  }

  async getOrder(orderId: number): Promise<Order> {
    this.guard()
    const order = this.order(orderId)
    return {
      orderId: order.orderId,
      date: new Date(order.createdAt),
      expirationDate: new Date(order.createdAt + 7 * 24 * 60 * 60 * 1000),
      retractionDate: null,
      pdfUrl: `https://www.ovh.com/manager/order/${order.orderId}.pdf`,
      url: `https://www.ovh.com/manager/order/${order.orderId}`,
      priceWithTax: order.prices.withTax,
      priceWithoutTax: order.prices.withoutTax,
      tax: order.prices.tax,
    }
  }

  /** The service an order delivered, if any. Useful to tests and to dev tooling. */
  serviceNameForOrder(orderId: number): string | null {
    this.settle()
    return this.orders.get(orderId)?.serviceName ?? null
  }

  /* -------------------------------------------------------------- service */

  async listVps(): Promise<readonly string[]> {
    this.guard()
    return [...this.services.values()].filter((vps) => !vps.terminated).map((vps) => vps.name)
  }

  async getVps(serviceName: string): Promise<VpsSummary> {
    this.guard()
    return this.toSummary(this.vps(serviceName))
  }

  async getVpsIps(serviceName: string): Promise<readonly IpAddress[]> {
    this.guard()
    return this.vps(serviceName).ips.map(toIpAddress)
  }

  async getServiceInfos(serviceName: string): Promise<ServiceInfos> {
    this.guard()
    return this.vps(serviceName).serviceInfos
  }

  async updateServiceInfos(serviceName: string, update: ServiceInfosUpdate): Promise<void> {
    this.guard()
    const vps = this.vps(serviceName)
    const current = vps.serviceInfos.renew ?? {
      automatic: true,
      deleteAtExpiration: false,
      forced: false,
      manualPayment: false,
      period: 1,
    }
    vps.serviceInfos = {
      ...vps.serviceInfos,
      renew: { ...current, ...update.renew },
    }
  }

  async getTask(serviceName: string, taskId: number): Promise<VpsTask> {
    this.guard()
    this.vps(serviceName)
    const task = this.tasks.get(taskId)
    if (!task || task.serviceName !== serviceName) {
      throw this.notFound(`/vps/${serviceName}/tasks/${taskId}`, `task ${taskId} does not exist`)
    }
    return this.toTask(task)
  }

  async listTasks(serviceName: string, filter: ListTasksFilter = {}): Promise<readonly number[]> {
    this.guard()
    this.vps(serviceName)
    return [...this.tasks.values()]
      .filter((task) => task.serviceName === serviceName)
      .filter((task) => (filter.state ? this.taskState(task) === filter.state : true))
      .filter((task) => (filter.type ? task.type === filter.type : true))
      .map((task) => task.id)
  }

  async start(serviceName: string): Promise<VpsTask> {
    this.guard()
    return this.openTask(serviceName, "startVm", {
      effect: (vps) => {
        vps.state = "running"
      },
    })
  }

  async stop(serviceName: string): Promise<VpsTask> {
    this.guard()
    return this.openTask(serviceName, "stopVm", {
      immediate: (vps) => {
        vps.state = "stopping"
      },
      effect: (vps) => {
        vps.state = "stopped"
      },
    })
  }

  async reboot(serviceName: string): Promise<VpsTask> {
    this.guard()
    return this.openTask(serviceName, "rebootVm", {
      immediate: (vps) => {
        vps.state = "rebooting"
      },
      effect: (vps) => {
        vps.state = "running"
      },
    })
  }

  private availableImages(serviceName: string): readonly string[] {
    const vps = this.vps(serviceName)
    const plan = findPlan(vps.planCode)
    return plan?.configurations.find((c) => c.name === "vps_os")?.values ?? []
  }

  async listAvailableImages(serviceName: string): Promise<readonly string[]> {
    this.guard()
    return this.availableImages(serviceName)
  }

  async getCurrentImage(serviceName: string): Promise<Image> {
    this.guard()
    const vps = this.vps(serviceName)
    return { id: vps.imageId, name: vps.imageId }
  }

  async rebuild(input: RebuildInput): Promise<VpsTask> {
    this.guard()
    const available = this.availableImages(input.serviceName)
    if (available.length > 0 && !available.includes(input.imageId)) {
      throw this.rejected(
        "POST",
        `/vps/${input.serviceName}/rebuild`,
        "INVALID_IMAGE",
        `${input.imageId} is not available for this VPS`,
      )
    }
    return this.openTask(input.serviceName, "reinstallVm", {
      immediate: (vps) => {
        vps.state = "installing"
      },
      effect: (vps) => {
        vps.state = "running"
        vps.imageId = input.imageId
        vps.snapshot = null
      },
    })
  }

  async setPassword(serviceName: string): Promise<VpsTask> {
    this.guard()
    return this.openTask(serviceName, "changeRootPassword")
  }

  async getConsoleUrl(serviceName: string): Promise<string> {
    this.guard()
    this.vps(serviceName)
    return `https://mock-console.ola.test/${serviceName}?token=${this.nextId()}`
  }

  async setNetbootMode(serviceName: string, mode: VpsNetbootMode): Promise<void> {
    this.guard()
    this.vps(serviceName).netbootMode = mode
  }

  async createSnapshot(serviceName: string, description: string): Promise<VpsTask> {
    this.guard()
    const vps = this.vps(serviceName)
    if (!vps.options.includes("snapshot")) {
      throw this.rejected(
        "POST",
        `/vps/${serviceName}/createSnapshot`,
        "OPTION_MISSING",
        "the snapshot option is not active on this VPS",
      )
    }
    if (vps.snapshot) {
      throw this.rejected(
        "POST",
        `/vps/${serviceName}/createSnapshot`,
        "SNAPSHOT_EXISTS",
        "this VPS already has a snapshot",
      )
    }
    const createdAt = new Date(this.now())
    return this.openTask(serviceName, "createSnapshot", {
      immediate: (target) => {
        target.state = "backuping"
      },
      effect: (target) => {
        target.state = "running"
        target.snapshot = {
          id: `snap-${this.nextId()}`,
          description,
          creationDate: createdAt,
          region: target.zone,
        }
      },
    })
  }

  async getSnapshot(serviceName: string): Promise<Snapshot> {
    this.guard()
    const vps = this.vps(serviceName)
    if (!vps.snapshot) {
      throw this.notFound(`/vps/${serviceName}/snapshot`, "this VPS has no snapshot")
    }
    return vps.snapshot
  }

  async deleteSnapshot(serviceName: string): Promise<VpsTask> {
    this.guard()
    const vps = this.vps(serviceName)
    if (!vps.snapshot) {
      throw this.notFound(`/vps/${serviceName}/snapshot`, "this VPS has no snapshot")
    }
    return this.openTask(serviceName, "deleteSnapshot", {
      effect: (target) => {
        target.snapshot = null
      },
    })
  }

  async revertSnapshot(serviceName: string): Promise<VpsTask> {
    this.guard()
    const vps = this.vps(serviceName)
    if (!vps.snapshot) {
      throw this.notFound(`/vps/${serviceName}/snapshot`, "this VPS has no snapshot")
    }
    return this.openTask(serviceName, "revertSnapshot", {
      immediate: (target) => {
        target.state = "installing"
      },
      effect: (target) => {
        target.state = "running"
      },
    })
  }

  async getAutomatedBackup(serviceName: string): Promise<AutomatedBackup> {
    this.guard()
    return this.vps(serviceName).automatedBackup
  }

  async listRestorePoints(
    serviceName: string,
    state: RestoreState,
  ): Promise<readonly string[]> {
    this.guard()
    const vps = this.vps(serviceName)
    if (vps.automatedBackup.state === "disabled") return []
    if (state !== "available") return []
    const rotation = vps.automatedBackup.rotation ?? 1
    const day = 24 * 60 * 60 * 1000
    return Array.from({ length: rotation }, (_, index) =>
      new Date(this.now() - (index + 1) * day).toISOString(),
    )
  }

  async restoreBackup(input: RestoreBackupInput): Promise<VpsTask> {
    this.guard()
    const vps = this.vps(input.serviceName)
    if (vps.automatedBackup.state === "disabled") {
      throw this.rejected(
        "POST",
        `/vps/${input.serviceName}/automatedBackup/restore`,
        "OPTION_MISSING",
        "automated backup is not active on this VPS",
      )
    }
    return this.openTask(input.serviceName, "restoreVm", {
      immediate: (target) => {
        target.state = "installing"
      },
      effect: (target) => {
        target.state = "running"
      },
    })
  }

  async listDisks(serviceName: string): Promise<readonly number[]> {
    this.guard()
    return [...this.vps(serviceName).diskIds]
  }

  async getDiskUse(
    serviceName: string,
    diskId: number,
    type: DiskStatisticType,
  ): Promise<DiskUse> {
    this.guard()
    const vps = this.vps(serviceName)
    if (!vps.diskIds.includes(diskId)) {
      throw this.notFound(
        `/vps/${serviceName}/disks/${diskId}/use`,
        `disk ${diskId} does not exist`,
      )
    }
    const total = this.modelOf(vps.planCode).disk
    return { unit: "GB", value: type === "max" ? total : Math.round(total * 0.37) }
  }

  async listAvailableUpgrades(serviceName: string): Promise<readonly VpsModel[]> {
    this.guard()
    const vps = this.vps(serviceName)
    const current = this.modelOf(vps.planCode)
    return fixture()
      .plans.map((plan) => this.modelOf(plan.planCode))
      .filter((model) => model.vcore > current.vcore)
  }

  async terminate(serviceName: string): Promise<string> {
    this.guard()
    const vps = this.vps(serviceName)
    vps.terminationToken = `mock-termination-${this.nextId()}`
    return vps.terminationToken
  }

  async confirmTermination(
    serviceName: string,
    input: ConfirmTerminationInput,
  ): Promise<string> {
    this.guard()
    const vps = this.vps(serviceName)
    if (!vps.terminationToken || vps.terminationToken !== input.token) {
      throw this.rejected(
        "POST",
        `/vps/${serviceName}/confirmTermination`,
        "INVALID_TOKEN",
        "the termination token does not match",
      )
    }
    vps.terminated = true
    vps.state = "stopped"
    vps.serviceInfos = { ...vps.serviceInfos, status: "expired" }
    return "Your service has been terminated"
  }

  async listOptions(serviceName: string): Promise<readonly VpsOption[]> {
    this.guard()
    return [...this.vps(serviceName).options]
  }

  /* -------------------------------------------------------------- network */

  async listReverseIps(ipBlock: string): Promise<readonly string[]> {
    this.guard()
    return [...(this.reverses.get(ipBlock)?.keys() ?? [])]
  }

  async getReverse(ipBlock: string, ipReverse: string): Promise<Reverse> {
    this.guard()
    const reverse = this.reverses.get(ipBlock)?.get(ipReverse)
    if (reverse === undefined) {
      throw this.notFound(
        `/ip/${ipBlock}/reverse/${ipReverse}`,
        `${ipReverse} has no reverse configured`,
      )
    }
    return { ipReverse, reverse }
  }

  async setReverse(ipBlock: string, ipReverse: string, reverse: string): Promise<Reverse> {
    this.guard()
    const block = this.reverses.get(ipBlock) ?? new Map<string, string>()
    block.set(ipReverse, reverse)
    this.reverses.set(ipBlock, block)
    return { ipReverse, reverse }
  }

  async deleteReverse(ipBlock: string, ipReverse: string): Promise<void> {
    this.guard()
    const block = this.reverses.get(ipBlock)
    if (!block?.delete(ipReverse)) {
      throw this.notFound(
        `/ip/${ipBlock}/reverse/${ipReverse}`,
        `${ipReverse} has no reverse configured`,
      )
    }
  }

  /**
   * An IP goes `enableFirewallPending` -> `ok` over `taskMs`, like the real thing.
   * Returns null when the IP was never put on the firewall.
   */
  private firewallIp(ipBlock: string, ipOnFirewall: string): FirewallIp | null {
    const since = this.firewalledIps.get(ipBlock)?.get(ipOnFirewall)
    if (since === undefined) return null
    const ready = this.now() - since >= this.taskMs
    return {
      ipOnFirewall,
      enabled: ready,
      state: ready ? "ok" : "enableFirewallPending",
    }
  }

  async enableFirewall(ipBlock: string, ipOnFirewall: string): Promise<FirewallIp> {
    this.guard()
    const block = this.firewalledIps.get(ipBlock) ?? new Map<string, number>()
    if (!block.has(ipOnFirewall)) block.set(ipOnFirewall, this.now())
    this.firewalledIps.set(ipBlock, block)
    const firewall = this.firewallIp(ipBlock, ipOnFirewall)
    if (!firewall) {
      throw this.rejected(
        "POST",
        `/ip/${ipBlock}/firewall`,
        "FIREWALL_NOT_CREATED",
        `${ipOnFirewall} could not be put on the firewall`,
      )
    }
    return firewall
  }

  async listFirewalledIps(
    ipBlock: string,
    filter: { enabled?: boolean; state?: FirewallState } = {},
  ): Promise<readonly string[]> {
    this.guard()
    return [...(this.firewalledIps.get(ipBlock)?.keys() ?? [])]
      .map((ip) => this.firewallIp(ipBlock, ip))
      .filter((entry): entry is FirewallIp => entry !== null)
      .filter((entry) => (filter.enabled === undefined ? true : entry.enabled === filter.enabled))
      .filter((entry) => (filter.state === undefined ? true : entry.state === filter.state))
      .map((entry) => entry.ipOnFirewall)
  }

  async listFirewallRules(
    ipBlock: string,
    ipOnFirewall: string,
  ): Promise<readonly number[]> {
    this.guard()
    // An IP that is not on the firewall simply has no rules. The customer area treats a
    // 404 here as "not enabled", so this must not throw.
    return [...(this.firewallRules.get(`${ipBlock}|${ipOnFirewall}`)?.keys() ?? [])]
  }

  async addFirewallRule(input: AddFirewallRuleInput): Promise<FirewallRule> {
    this.guard()
    if (!this.firewallIp(input.ipBlock, input.ipOnFirewall)) {
      // This is how OVH rejects it: the rule collection does not exist until the IP is
      // on the firewall. Call `enableFirewall` first.
      throw this.notFound(
        `/ip/${input.ipBlock}/firewall/${input.ipOnFirewall}/rule`,
        `${input.ipOnFirewall} is not on the firewall`,
      )
    }
    const key = `${input.ipBlock}|${input.ipOnFirewall}`
    const rules = this.firewallRules.get(key) ?? new Map<number, FirewallRule>()
    if (rules.has(input.sequence)) {
      throw this.rejected(
        "POST",
        `/ip/${input.ipBlock}/firewall/${input.ipOnFirewall}/rule`,
        "SEQUENCE_TAKEN",
        `sequence ${input.sequence} already has a rule`,
      )
    }
    const source = input.source ?? "any"
    const destinationPort = input.destinationPort === undefined ? null : String(input.destinationPort)
    const rule: FirewallRule = {
      sequence: input.sequence,
      action: input.action,
      protocol: input.protocol,
      state: "ok",
      rule: `${input.action} ${input.protocol} from ${source}${destinationPort ? ` to port ${destinationPort}` : ""}`,
      source,
      destination: input.ipOnFirewall,
      sourcePort: input.sourcePort === undefined ? null : String(input.sourcePort),
      destinationPort,
      fragments: input.fragments ?? null,
      l3PacketLength: null,
      tcpOption: input.tcpOption ?? null,
      creationDate: new Date(this.now()),
    }
    rules.set(rule.sequence, rule)
    this.firewallRules.set(key, rules)
    return rule
  }

  async getFirewallRule(
    ipBlock: string,
    ipOnFirewall: string,
    sequence: number,
  ): Promise<FirewallRule> {
    this.guard()
    const rule = this.firewallRules.get(`${ipBlock}|${ipOnFirewall}`)?.get(sequence)
    if (!rule) {
      throw this.notFound(
        `/ip/${ipBlock}/firewall/${ipOnFirewall}/rule/${sequence}`,
        `rule ${sequence} does not exist`,
      )
    }
    return rule
  }

  async deleteFirewallRule(
    ipBlock: string,
    ipOnFirewall: string,
    sequence: number,
  ): Promise<FirewallRule> {
    this.guard()
    const key = `${ipBlock}|${ipOnFirewall}`
    const rules = this.firewallRules.get(key)
    const rule = rules?.get(sequence)
    if (!rules || !rule) {
      throw this.notFound(
        `/ip/${ipBlock}/firewall/${ipOnFirewall}/rule/${sequence}`,
        `rule ${sequence} does not exist`,
      )
    }
    rules.delete(sequence)
    // OVH answers with the rule it is about to remove.
    return { ...rule, state: "removalPending" }
  }

  async getMitigation(ipBlock: string): Promise<Mitigation> {
    this.guard()
    return { ipBlock, mitigatedIps: [...(this.mitigations.get(ipBlock) ?? [])].map((entry) => entry.ipOnMitigation) }
  }

  async getMitigationIp(ipBlock: string, ipOnMitigation: string): Promise<MitigationIp> {
    this.guard()
    const entry = this.mitigations
      .get(ipBlock)
      ?.find((candidate) => candidate.ipOnMitigation === ipOnMitigation)
    if (!entry) {
      throw this.notFound(
        `/ip/${ipBlock}/mitigation/${ipOnMitigation}`,
        `${ipOnMitigation} is not under mitigation`,
      )
    }
    return entry
  }

  /* ------------------------------------------- upgrades on a live service */

  private buildUpgradeQuote(
    serviceName: string,
    planCode: string,
    quantity: number,
  ): { operation: NonNullable<UpgradeQuote["operation"]>; order: CheckoutPreview } {
    this.vps(serviceName)
    const pricings = pricingsFor(planCode)
    const monthly = pricings ? monthlyUcents(pricings, "default") : null
    if (monthly === null) {
      throw this.notFound(
        `/order/upgrade/vps/${serviceName}/${planCode}`,
        `${planCode} is not an upgrade of this VPS`,
      )
    }
    const total = monthly * Math.max(1, quantity)
    const taxUcents = Math.round(total * 0.21)
    return {
      operation: {
        id: this.nextId(),
        status: "TODO",
        type: "UPGRADE",
        product: { name: planCode, description: findPlan(planCode)?.invoiceName ?? planCode },
      },
      order: {
        orderId: null,
        url: null,
        prices: {
          withoutTax: price(total),
          tax: price(taxUcents),
          withTax: price(total + taxUcents),
          originalWithoutTax: price(total),
          reduction: price(0),
        },
        details: [],
        contracts: [],
      },
    }
  }

  async getUpgradeQuote(
    serviceName: string,
    planCode: string,
    quantity = 1,
  ): Promise<UpgradeQuote> {
    this.guard()
    return this.buildUpgradeQuote(serviceName, planCode, quantity)
  }

  async orderUpgrade(
    serviceName: string,
    planCode: string,
    body: OrderUpgradeInput,
  ): Promise<UpgradeQuote> {
    this.guard()
    const quote = this.buildUpgradeQuote(serviceName, planCode, body.quantity)
    const vps = this.vps(serviceName)
    this.openTask(serviceName, "upgradeVm", {
      immediate: (target) => {
        target.state = "upgrading"
      },
      effect: (target) => {
        target.state = "running"
        target.planCode = planCode
      },
    })
    const orderId = 10_000 + this.nextId()
    this.orders.set(orderId, {
      orderId,
      cartId: `upgrade-${vps.name}`,
      createdAt: this.now(),
      status: "checking",
      prices: quote.order.prices,
      details: [],
      serviceName: vps.name,
    })
    this.settle()
    return {
      operation: { ...quote.operation, status: "DOING" },
      order: { ...quote.order, orderId },
    }
  }

  async getServiceOptionQuote(
    serviceName: string,
  ): Promise<readonly GenericOptionDefinition[]> {
    this.guard()
    const vps = this.vps(serviceName)
    const plan = findPlan(vps.planCode)
    if (!plan) return []
    const definitions: GenericOptionDefinition[] = []
    for (const family of plan.addonFamilies) {
      if (family.mandatory) continue
      for (const addonCode of family.addons) {
        const addon = findAddon(addonCode)
        definitions.push({
          planCode: addonCode,
          productName: addon?.invoiceName ?? addonCode,
          productType: "cloud_service",
          prices: pricingsOf(addonCode),
          family: family.name,
          mandatory: false,
          exclusive: family.exclusive,
        })
      }
    }
    return definitions
  }

  async orderServiceOption(
    serviceName: string,
    body: OrderServiceOptionInput,
  ): Promise<CartItem> {
    this.guard()
    const vps = this.vps(serviceName)
    const family = this.familyOf(vps.planCode, body.planCode)
    if (!family) {
      throw this.rejected(
        "POST",
        `/order/cartServiceOption/vps/${serviceName}`,
        "INVALID_OPTION",
        `${body.planCode} is not an option of ${vps.planCode}`,
      )
    }
    const cart = this.carts.get(body.cartId) ?? this.registerCart(body.cartId)
    const item: MockCartItem = {
      itemId: this.nextId(),
      planCode: body.planCode,
      duration: body.duration,
      pricingMode: body.pricingMode,
      quantity: body.quantity,
      parentItemId: null,
      configurations: new Map(),
      optionItemIds: [],
    }
    cart.items.set(item.itemId, item)
    if ((VPS_OPTIONS as readonly string[]).includes(family)) {
      const option = family as VpsOption
      if (!vps.options.includes(option)) vps.options.push(option)
      if (option === "automatedBackup") {
        vps.automatedBackup = {
          state: "enabled",
          serviceResourceName: vps.name,
          rotation: 1,
          schedule: "22:00",
        }
      }
    }
    return this.toCartItem(cart, item)
  }

  private registerCart(cartId: string): MockCart {
    const cart: MockCart = {
      cartId,
      description: "OLA VPS Cloud",
      expire: new Date(this.now() + 24 * 60 * 60 * 1000),
      subsidiary: this.subsidiary,
      assigned: true,
      readOnly: false,
      items: new Map(),
    }
    this.carts.set(cartId, cart)
    return cart
  }
}
