import { describe, expect, it } from "vitest"
import {
  actionStatusFromOvhTask,
  isOvhTaskTerminal,
  parseCatalog,
  MVP_PLAN_CODES,
} from "@ola/core"
import { MockOvhClient } from "../src/mock-client.js"
import { isOvhApiError } from "../src/errors.js"
import type { CheckoutPreview } from "../src/types.js"

const PLAN = "vps-2027-model1"
const BACKUP = "option-auto-backup-2027-1-model1"
const SNAPSHOT_OPTION_MODEL2 = "option-snapshot-2027-model2"

function instant(): MockOvhClient {
  return new MockOvhClient({ deliveryMs: 0, taskMs: 0, now: () => 1_762_387_200_000 })
}

/** The whole order flow, up to the delivered service name. */
async function orderOneVps(
  client: MockOvhClient,
  options: { extraOptions?: readonly string[]; duration?: string } = {},
): Promise<{ orderId: number; preview: CheckoutPreview }> {
  const cart = await client.createCart({ description: "test" })
  await client.assignCart(cart.cartId)

  const duration = options.duration ?? "P1M"
  const item = await client.addVpsToCart({
    cartId: cart.cartId,
    planCode: PLAN,
    duration,
    pricingMode: "default",
    quantity: 1,
  })

  await client.configureItem({
    cartId: cart.cartId,
    itemId: item.itemId,
    label: "vps_datacenter",
    value: "GRA",
  })
  await client.configureItem({
    cartId: cart.cartId,
    itemId: item.itemId,
    label: "vps_os",
    value: "Debian 12",
  })

  for (const planCode of [BACKUP, ...(options.extraOptions ?? [])]) {
    await client.addOption({
      cartId: cart.cartId,
      itemId: item.itemId,
      planCode,
      duration,
      pricingMode: "default",
      quantity: 1,
    })
  }

  const preview = await client.getCheckoutPreview(cart.cartId)
  const order = await client.checkout({
    cartId: cart.cartId,
    autoPayWithPreferredPaymentMethod: true,
    waiveRetractationPeriod: true,
  })

  expect(order.orderId).not.toBeNull()
  return { orderId: Number(order.orderId), preview }
}

describe("catalog", () => {
  it("serves a catalog @ola/core can parse", async () => {
    const client = instant()
    const catalog = parseCatalog(await client.fetchPublicCatalog("ES"))
    expect(catalog.plans.map((plan) => plan.planCode).sort()).toEqual([...MVP_PLAN_CODES].sort())
  })

  it("prices cart offers and options from that same catalog", async () => {
    const client = instant()
    const cart = await client.createCart()

    const offers = await client.listCartVpsOffers(cart.cartId)
    const model1 = offers.find((offer) => offer.planCode === PLAN)
    expect(model1?.prices.find((p) => p.pricingMode === "default")?.price.value).toBe(4.49)
    expect(model1?.prices.find((p) => p.pricingMode === "upfront12")?.price.value).toBe(3.81)

    const options = await client.listCartOptions(cart.cartId, PLAN)
    const backup = options.find((option) => option.planCode === BACKUP)
    // Verified 2026-11-05: automatedBackup is mandatory AND priced.
    expect(backup?.family).toBe("automatedBackup")
    expect(backup?.mandatory).toBe(true)
    expect(backup?.prices.find((p) => p.pricingMode === "default")?.price.value).toBe(0.35)
  })
})

describe("order flow", () => {
  it("delivers a VPS with an IPv4 and an IPv6", async () => {
    const client = instant()
    const { orderId, preview } = await orderOneVps(client)

    // 4.49 + 0.35 = 4.84, plus 21 % VAT.
    expect(preview.prices.withoutTax.value).toBe(4.84)
    expect(preview.prices.tax.value).toBe(1.02)
    expect(preview.prices.withTax.value).toBe(5.86)
    expect(preview.details).toHaveLength(2)

    expect(await client.getOrderStatus(orderId)).toBe("delivered")
    expect(await client.getOrderDetails(orderId)).toHaveLength(2)
    expect((await client.getOrder(orderId)).priceWithTax.value).toBe(5.86)

    const names = await client.listVps()
    expect(names).toHaveLength(1)
    const serviceName = names[0] ?? ""

    const vps = await client.getVps(serviceName)
    expect(vps.state).toBe("running")
    expect(vps.zone).toBe("GRA")
    expect(vps.model.name).toBe(PLAN)
    expect(vps.vcore).toBe(2)

    const ips = await client.getVpsIps(serviceName)
    expect(ips.map((ip) => ip.version).sort()).toEqual([4, 6])

    const image = await client.getCurrentImage(serviceName)
    expect(image.id).toBe("Debian 12")

    const infos = await client.getServiceInfos(serviceName)
    expect(infos.status).toBe("ok")
    expect(infos.renew?.automatic).toBe(true)

    expect(await client.listOptions(serviceName)).toEqual(["automatedBackup"])
    expect((await client.getAutomatedBackup(serviceName)).state).toBe("enabled")
  })

  it("takes deliveryMs to deliver and reports delivering until then", async () => {
    const client = new MockOvhClient({ deliveryMs: 20_000, taskMs: 0, now: () => 0 })
    const { orderId } = await orderOneVps(client)

    expect(await client.getOrderStatus(orderId)).toBe("delivering")
    expect(await client.listVps()).toEqual([])

    client.advanceTime(19_999)
    expect(await client.getOrderStatus(orderId)).toBe("delivering")

    client.advanceTime(1)
    expect(await client.getOrderStatus(orderId)).toBe("delivered")
    expect(await client.listVps()).toHaveLength(1)
  })

  it("can be told to get stuck or to fail", async () => {
    const stuck = new MockOvhClient({ deliveryMs: 0, taskMs: 0, now: () => 0 })
    stuck.setDeliveryOutcome("stuck")
    const stuckOrder = await orderOneVps(stuck)
    stuck.advanceTime(3_600_000)
    expect(await stuck.getOrderStatus(stuckOrder.orderId)).toBe("delivering")
    expect(await stuck.listVps()).toEqual([])

    const broken = new MockOvhClient({ deliveryMs: 0, taskMs: 0, now: () => 0 })
    broken.setDeliveryOutcome("error")
    const brokenOrder = await orderOneVps(broken)
    expect(await broken.getOrderStatus(brokenOrder.orderId)).toBe("cancelled")
    expect(await broken.listVps()).toEqual([])
  })

  it("refuses a checkout on an unassigned cart, an empty cart and a used cart", async () => {
    const client = instant()

    const empty = await client.createCart()
    await expect(
      client.checkout({
        cartId: empty.cartId,
        autoPayWithPreferredPaymentMethod: true,
        waiveRetractationPeriod: true,
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "CART_NOT_ASSIGNED" })

    await client.assignCart(empty.cartId)
    await expect(
      client.checkout({
        cartId: empty.cartId,
        autoPayWithPreferredPaymentMethod: true,
        waiveRetractationPeriod: true,
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "EMPTY_CART" })

    const cart = await client.createCart()
    await client.assignCart(cart.cartId)
    const item = await client.addVpsToCart({
      cartId: cart.cartId,
      planCode: PLAN,
      duration: "P1M",
      pricingMode: "default",
      quantity: 1,
    })
    expect(await client.listCartItemConfigurations(cart.cartId, item.itemId)).toEqual([])
    await client.checkout({
      cartId: cart.cartId,
      autoPayWithPreferredPaymentMethod: true,
      waiveRetractationPeriod: true,
    })
    await expect(
      client.checkout({
        cartId: cart.cartId,
        autoPayWithPreferredPaymentMethod: true,
        waiveRetractationPeriod: true,
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "CART_READ_ONLY" })
  })

  it("rejects an unknown plan code, a bad configuration value and a foreign option", async () => {
    const client = instant()
    const cart = await client.createCart()

    await expect(
      client.addVpsToCart({
        cartId: cart.cartId,
        planCode: "vps-not-real",
        duration: "P1M",
        pricingMode: "default",
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "INVALID_PLAN_CODE" })

    const item = await client.addVpsToCart({
      cartId: cart.cartId,
      planCode: PLAN,
      duration: "P1M",
      pricingMode: "default",
    })

    await expect(
      client.configureItem({
        cartId: cart.cartId,
        itemId: item.itemId,
        label: "vps_datacenter",
        value: "MARS",
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "INVALID_CONFIGURATION_VALUE" })

    await expect(
      client.addOption({
        cartId: cart.cartId,
        itemId: item.itemId,
        planCode: "option-cpanel-not-of-this-plan",
        duration: "P1M",
        pricingMode: "default",
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "INVALID_OPTION" })
  })

  it("prices a yearly term over twelve months", async () => {
    const client = instant()
    const { preview } = await orderOneVps(client, { duration: "P1Y" })
    // upfront12: (3.81 + 0.30) * 12
    expect(preview.prices.withoutTax.value).toBe(58.08)
  })

  it("404s on an unknown cart, order or service", async () => {
    const client = instant()
    await expect(client.getCartSummary("nope")).rejects.toMatchObject({ httpStatus: 404 })
    await expect(client.getOrderStatus(1)).rejects.toMatchObject({ httpStatus: 404 })
    await expect(client.getVps("nope")).rejects.toMatchObject({ httpStatus: 404 })
  })
})

describe("service actions", () => {
  it("moves a task through todo -> doing -> done and applies the effect once", async () => {
    const client = new MockOvhClient({ deliveryMs: 0, taskMs: 1_000, now: () => 0 })
    const serviceName = client.seedService({ planCode: PLAN }).name

    const task = await client.stop(serviceName)
    expect(task.state).toBe("todo")
    expect(task.progress).toBe(0)
    expect(actionStatusFromOvhTask(task.state)).toBe("queued")
    // The VPS reports the transient state straight away, not a fake spinner.
    expect((await client.getVps(serviceName)).state).toBe("stopping")

    client.advanceTime(500)
    const doing = await client.getTask(serviceName, task.id)
    expect(doing.state).toBe("doing")
    expect(doing.progress).toBe(50)
    expect(actionStatusFromOvhTask(doing.state)).toBe("running")
    expect(isOvhTaskTerminal(doing.state)).toBe(false)

    client.advanceTime(500)
    const done = await client.getTask(serviceName, task.id)
    expect(done.state).toBe("done")
    expect(done.progress).toBe(100)
    expect(isOvhTaskTerminal(done.state)).toBe(true)
    expect((await client.getVps(serviceName)).state).toBe("stopped")

    const started = await client.start(serviceName)
    client.advanceTime(1_000)
    expect((await client.getTask(serviceName, started.id)).state).toBe("done")
    expect((await client.getVps(serviceName)).state).toBe("running")

    expect(await client.listTasks(serviceName)).toEqual([task.id, started.id])
    expect(await client.listTasks(serviceName, { type: "stopVm" })).toEqual([task.id])
  })

  it("reinstalls, changing the current image", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name

    const images = await client.listAvailableImages(serviceName)
    expect(images.length).toBeGreaterThan(0)
    const current = (await client.getCurrentImage(serviceName)).id
    const target = images.find((image) => image !== current)

    await expect(
      client.rebuild({ serviceName, imageId: "windows-3.11", doNotSendPassword: true }),
    ).rejects.toMatchObject({ ovhErrorCode: "INVALID_IMAGE" })

    const task = await client.rebuild({
      serviceName,
      imageId: target ?? images[0] ?? "",
      doNotSendPassword: true,
    })
    expect(task.state).toBe("done")
    expect((await client.getCurrentImage(serviceName)).id).toBe(target)
    expect((await client.getVps(serviceName)).state).toBe("running")
  })

  it("keeps snapshot state consistent", async () => {
    const client = instant()
    const withoutOption = client.seedService({ planCode: PLAN, options: [] }).name
    await expect(client.createSnapshot(withoutOption, "x")).rejects.toMatchObject({
      ovhErrorCode: "OPTION_MISSING",
    })

    const serviceName = client.seedService({
      planCode: PLAN,
      options: ["automatedBackup", "snapshot"],
    }).name

    await expect(client.getSnapshot(serviceName)).rejects.toMatchObject({ httpStatus: 404 })
    await client.createSnapshot(serviceName, "before upgrade")

    const snapshot = await client.getSnapshot(serviceName)
    expect(snapshot.description).toBe("before upgrade")

    await expect(client.createSnapshot(serviceName, "again")).rejects.toMatchObject({
      ovhErrorCode: "SNAPSHOT_EXISTS",
    })

    await client.revertSnapshot(serviceName)
    await client.deleteSnapshot(serviceName)
    await expect(client.getSnapshot(serviceName)).rejects.toMatchObject({ httpStatus: 404 })
  })

  it("restores an automated backup only when the option is active", async () => {
    const client = instant()
    const bare = client.seedService({ planCode: PLAN, options: [] }).name
    expect(await client.listRestorePoints(bare, "available")).toEqual([])
    await expect(
      client.restoreBackup({ serviceName: bare, restorePoint: "x", type: "full" }),
    ).rejects.toMatchObject({ ovhErrorCode: "OPTION_MISSING" })

    const serviceName = client.seedService({ planCode: PLAN }).name
    const points = await client.listRestorePoints(serviceName, "available")
    expect(points).toHaveLength(1)
    const restore = await client.restoreBackup({
      serviceName,
      restorePoint: points[0] ?? "",
      type: "full",
    })
    expect(restore.state).toBe("done")
  })

  it("sets rescue mode, the root password and a console URL", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name

    await client.setNetbootMode(serviceName, "rescue")
    expect((await client.getVps(serviceName)).netbootMode).toBe("rescue")
    await client.reboot(serviceName)
    await client.setNetbootMode(serviceName, "local")
    expect((await client.getVps(serviceName)).netbootMode).toBe("local")

    expect((await client.setPassword(serviceName)).type).toBe("changeRootPassword")
    expect(await client.getConsoleUrl(serviceName)).toContain(serviceName)
  })

  it("serves disk usage and the upgrades above the current model", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name

    const disks = await client.listDisks(serviceName)
    expect(disks).toEqual([1])
    expect(await client.getDiskUse(serviceName, 1, "max")).toEqual({ unit: "GB", value: 40 })
    expect((await client.getDiskUse(serviceName, 1, "used")).value).toBeLessThan(40)
    await expect(client.getDiskUse(serviceName, 99, "used")).rejects.toMatchObject({
      httpStatus: 404,
    })

    const upgrades = await client.listAvailableUpgrades(serviceName)
    expect(upgrades.map((model) => model.name)).toEqual([
      "vps-2027-model2",
      "vps-2027-model3",
      "vps-2027-model4",
    ])
  })

  it("updates renewal settings", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name

    await client.updateServiceInfos(serviceName, { renew: { automatic: false, period: 12 } })
    const infos = await client.getServiceInfos(serviceName)
    expect(infos.renew?.automatic).toBe(false)
    expect(infos.renew?.period).toBe(12)
    expect(infos.renew?.deleteAtExpiration).toBe(false)
  })

  it("terminates only with the token it handed out", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name

    await expect(
      client.confirmTermination(serviceName, { token: "guessed" }),
    ).rejects.toMatchObject({ ovhErrorCode: "INVALID_TOKEN" })

    const token = await client.terminate(serviceName)
    await client.confirmTermination(serviceName, { token, reason: "NOT_NEEDED_ANYMORE" })

    expect(await client.listVps()).toEqual([])
    await expect(client.getVps(serviceName)).rejects.toMatchObject({ httpStatus: 404 })
  })

  it("orders an upgrade and an extra option on a live service", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name

    const quote = await client.getUpgradeQuote(serviceName, "vps-2027-model2")
    expect(quote.order?.prices.withoutTax.value).toBe(8.49)
    expect(quote.operation?.status).toBe("TODO")

    const ordered = await client.orderUpgrade(serviceName, "vps-2027-model2", { quantity: 1 })
    expect(ordered.operation?.status).toBe("DOING")
    expect((await client.getVps(serviceName)).model.name).toBe("vps-2027-model2")

    const options = await client.getServiceOptionQuote(serviceName)
    expect(options.every((option) => !option.mandatory)).toBe(true)

    const cart = await client.createCart()
    await client.orderServiceOption(serviceName, {
      cartId: cart.cartId,
      planCode: SNAPSHOT_OPTION_MODEL2,
      duration: "P1M",
      pricingMode: "default",
      quantity: 1,
    })
    expect(await client.listOptions(serviceName)).toContain("snapshot")
  })
})

describe("network", () => {
  it("stores reverses, firewall rules and mitigation", async () => {
    const client = instant()
    const serviceName = client.seedService({ planCode: PLAN }).name
    const ips = await client.getVpsIps(serviceName)
    const ipv4 = ips.find((ip) => ip.version === 4)?.address ?? ""
    const block = `${ipv4}/32`

    expect(await client.listReverseIps(block)).toEqual([])
    const reverse = await client.setReverse(block, ipv4, "server.example.com")
    expect(reverse).toEqual({ ipReverse: ipv4, reverse: "server.example.com" })
    expect(await client.listReverseIps(block)).toEqual([ipv4])

    expect(await client.listFirewallRules(block, ipv4)).toEqual([])
    await client.enableFirewall(block, ipv4)
    const rule = await client.addFirewallRule({
      ipBlock: block,
      ipOnFirewall: ipv4,
      sequence: 0,
      action: "permit",
      protocol: "tcp",
      destinationPort: 443,
    })
    expect(rule.state).toBe("ok")
    expect(rule.destinationPort).toBe("443")
    expect(await client.listFirewallRules(block, ipv4)).toEqual([0])

    await expect(
      client.addFirewallRule({
        ipBlock: block,
        ipOnFirewall: ipv4,
        sequence: 0,
        action: "deny",
        protocol: "tcp",
      }),
    ).rejects.toMatchObject({ ovhErrorCode: "SEQUENCE_TAKEN" })

    expect(await client.getMitigation(block)).toEqual({ ipBlock: block, mitigatedIps: [] })
  })

  it("reads one reverse back and forgets it once deleted", async () => {
    const client = instant()
    const block = "203.0.113.0/24"

    await expect(client.getReverse(block, "203.0.113.7")).rejects.toMatchObject({
      httpStatus: 404,
    })

    await client.setReverse(block, "203.0.113.7", "server.example.com")
    await client.setReverse(block, "203.0.113.8", "other.example.com")
    expect(await client.getReverse(block, "203.0.113.7")).toEqual({
      ipReverse: "203.0.113.7",
      reverse: "server.example.com",
    })

    await client.deleteReverse(block, "203.0.113.7")
    await expect(client.getReverse(block, "203.0.113.7")).rejects.toMatchObject({
      httpStatus: 404,
    })
    await expect(client.deleteReverse(block, "203.0.113.7")).rejects.toMatchObject({
      httpStatus: 404,
    })
    // The other IP of the block is untouched.
    expect(await client.listReverseIps(block)).toEqual(["203.0.113.8"])
  })

  it("needs the firewall enabled before the first rule", async () => {
    const client = instant()
    const block = "203.0.113.0/24"
    const ip = "203.0.113.7"

    expect(await client.listFirewalledIps(block)).toEqual([])
    // Not enabled: no rules, but reading them must not throw.
    expect(await client.listFirewallRules(block, ip)).toEqual([])
    await expect(
      client.addFirewallRule({
        ipBlock: block,
        ipOnFirewall: ip,
        sequence: 0,
        action: "permit",
        protocol: "tcp",
      }),
    ).rejects.toMatchObject({ httpStatus: 404 })

    const firewall = await client.enableFirewall(block, ip)
    expect(firewall).toEqual({ ipOnFirewall: ip, enabled: true, state: "ok" })
    expect(await client.listFirewalledIps(block)).toEqual([ip])

    const rule = await client.addFirewallRule({
      ipBlock: block,
      ipOnFirewall: ip,
      sequence: 0,
      action: "permit",
      protocol: "tcp",
    })
    expect(rule.state).toBe("ok")

    // Enabling twice is harmless, and another IP of the block stays off the firewall.
    await client.enableFirewall(block, ip)
    expect(await client.listFirewalledIps(block)).toEqual([ip])
    expect(await client.listFirewallRules(block, "203.0.113.8")).toEqual([])
  })

  it("reports the firewall as pending until it is ready, and filters on that", async () => {
    const client = new MockOvhClient({ deliveryMs: 0, taskMs: 1_000, now: () => 0 })
    const block = "203.0.113.0/24"
    const ip = "203.0.113.7"

    const pending = await client.enableFirewall(block, ip)
    expect(pending).toEqual({
      ipOnFirewall: ip,
      enabled: false,
      state: "enableFirewallPending",
    })
    expect(await client.listFirewalledIps(block, { state: "enableFirewallPending" })).toEqual([ip])
    expect(await client.listFirewalledIps(block, { enabled: true })).toEqual([])

    client.advanceTime(1_000)
    expect(await client.listFirewalledIps(block, { enabled: true })).toEqual([ip])
    expect(await client.listFirewalledIps(block, { state: "ok" })).toEqual([ip])
    expect(await client.listFirewalledIps(block, { state: "disableFirewallPending" })).toEqual([])
  })

  it("reads one firewall rule back, and a deleted rule disappears from the list", async () => {
    const client = instant()
    const block = "203.0.113.0/24"
    const ip = "203.0.113.7"

    await client.enableFirewall(block, ip)
    await expect(client.getFirewallRule(block, ip, 0)).rejects.toMatchObject({ httpStatus: 404 })

    await client.addFirewallRule({
      ipBlock: block,
      ipOnFirewall: ip,
      sequence: 0,
      action: "permit",
      protocol: "tcp",
      destinationPort: 443,
    })
    await client.addFirewallRule({
      ipBlock: block,
      ipOnFirewall: ip,
      sequence: 1,
      action: "deny",
      protocol: "udp",
    })
    expect(await client.listFirewallRules(block, ip)).toEqual([0, 1])

    const rule = await client.getFirewallRule(block, ip, 0)
    expect(rule).toMatchObject({ sequence: 0, action: "permit", destinationPort: "443" })

    const removed = await client.deleteFirewallRule(block, ip, 0)
    expect(removed.sequence).toBe(0)
    expect(removed.state).toBe("removalPending")
    expect(await client.listFirewallRules(block, ip)).toEqual([1])
    await expect(client.getFirewallRule(block, ip, 0)).rejects.toMatchObject({ httpStatus: 404 })
    await expect(client.deleteFirewallRule(block, ip, 0)).rejects.toMatchObject({
      httpStatus: 404,
    })

    // The sequence is free again.
    await client.addFirewallRule({
      ipBlock: block,
      ipOnFirewall: ip,
      sequence: 0,
      action: "deny",
      protocol: "tcp",
    })
    expect((await client.getFirewallRule(block, ip, 0)).action).toBe("deny")
  })

  it("reports the real state of one mitigated IP", async () => {
    const client = instant()
    const block = "203.0.113.0/24"

    await expect(client.getMitigationIp(block, "203.0.113.7")).rejects.toMatchObject({
      httpStatus: 404,
    })

    client.seedMitigation(block, "203.0.113.7", { auto: true, state: "creationPending" })
    expect(await client.getMitigation(block)).toEqual({
      ipBlock: block,
      mitigatedIps: ["203.0.113.7"],
    })
    expect(await client.getMitigationIp(block, "203.0.113.7")).toEqual({
      ipOnMitigation: "203.0.113.7",
      auto: true,
      permanent: false,
      state: "creationPending",
    })

    client.seedMitigation(block, "203.0.113.7", { state: "ok", permanent: true })
    expect((await client.getMitigationIp(block, "203.0.113.7")).state).toBe("ok")
    expect(await client.getMitigation(block)).toEqual({
      ipBlock: block,
      mitigatedIps: ["203.0.113.7"],
    })
  })
})

describe("required configuration", () => {
  it("lists what an item still needs, and nothing once it is configured", async () => {
    const client = instant()
    const cart = await client.createCart()
    const item = await client.addVpsToCart({
      cartId: cart.cartId,
      planCode: PLAN,
      duration: "P1M",
      pricingMode: "default",
    })

    const required = await client.listCartItemRequiredConfiguration(cart.cartId, item.itemId)
    expect(required.map((entry) => entry.label)).toEqual(["vps_datacenter", "vps_os"])
    expect(required.find((entry) => entry.label === "vps_datacenter")?.required).toBe(true)
    expect(required.find((entry) => entry.label === "vps_os")?.required).toBe(false)

    await client.configureItem({
      cartId: cart.cartId,
      itemId: item.itemId,
      label: "vps_datacenter",
      value: "GRA",
    })
    expect(
      (await client.listCartItemRequiredConfiguration(cart.cartId, item.itemId)).map(
        (entry) => entry.label,
      ),
    ).toEqual(["vps_os"])

    await client.configureItem({
      cartId: cart.cartId,
      itemId: item.itemId,
      label: "vps_os",
      value: "Debian 12",
    })
    expect(await client.listCartItemRequiredConfiguration(cart.cartId, item.itemId)).toEqual([])
    // The two lists are different things: one is what is set, the other what is missing.
    expect(await client.listCartItemConfigurations(cart.cartId, item.itemId)).toHaveLength(2)
  })

  it("404s on an unknown item", async () => {
    const client = instant()
    const cart = await client.createCart()
    await expect(
      client.listCartItemRequiredConfiguration(cart.cartId, 999),
    ).rejects.toMatchObject({ httpStatus: 404 })
  })
})

describe("failNextCall", () => {
  it("surfaces the given error on the next call only", async () => {
    const client = instant()
    const boom = new Error("simulated OVH outage")
    client.failNextCall(boom)

    await expect(client.listVps()).rejects.toBe(boom)
    await expect(client.listVps()).resolves.toEqual([])
  })

  it("can fail in the middle of the order flow", async () => {
    const client = instant()
    const cart = await client.createCart()
    await client.assignCart(cart.cartId)
    client.failNextCall(new Error("cart exploded"))

    await expect(
      client.addVpsToCart({
        cartId: cart.cartId,
        planCode: PLAN,
        duration: "P1M",
        pricingMode: "default",
      }),
    ).rejects.toThrow("cart exploded")

    // State is untouched: the flow can simply be retried.
    const item = await client.addVpsToCart({
      cartId: cart.cartId,
      planCode: PLAN,
      duration: "P1M",
      pricingMode: "default",
    })
    expect(item.itemId).toBeGreaterThan(0)
  })

  it("throws OvhApiError-shaped failures that map to the domain like the real client", async () => {
    const client = instant()
    const error = await client.getVps("nope").catch((caught: unknown) => caught)
    expect(isOvhApiError(error)).toBe(true)
    if (!isOvhApiError(error)) return
    expect(error.httpStatus).toBe(404)
    expect(error.retryable).toBe(false)
  })
})
