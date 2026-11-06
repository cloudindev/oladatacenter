import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  cancelAndRefundOrder,
  changeServiceNextDueAt,
  changeServiceStatus,
  forceServiceSync,
  grantManualCredit,
  retryOrderProvisioning,
  retryRenewalCharge,
  setAddonActive,
  setCustomerBlocked,
  setFeatureFlag,
  setPlanActive,
  setPlanSort,
  startImpersonation,
  stopImpersonation,
  syncCatalogNow,
  updateAddonPricing,
  updateMarginFloor,
  updatePlanPricing,
} from "../actions"
import { setAdminDeps } from "../deps"
import type { AdminActionResult } from "../results"
import {
  FakeAdminStore,
  addonRow,
  customerDetail,
  fakeDeps,
  formOf,
  orderDetail,
  paymentRow,
  planRow,
  serviceDetail,
  type FakeDeps,
} from "./fakes"

let deps: FakeDeps
let store: FakeAdminStore

function install(options: Parameters<typeof fakeDeps>[0] = {}): void {
  store =
    (options.store as FakeAdminStore | undefined) ??
    new FakeAdminStore({
      plans: [planRow()],
      addons: [addonRow(), addonRow({ id: "01JADDON000000000000000002", ovhPlanCode: "option-snapshot-2027", family: "snapshot", name: "Snapshot", mandatory: false, cost: { P1M: 100, P12M: 100 } })],
      orders: [orderDetail()],
      services: [serviceDetail()],
      customers: [customerDetail()],
      payments: [paymentRow()],
    })
  deps = fakeDeps({ ...options, store })
  setAdminDeps(deps)
}

beforeEach(() => install())
afterEach(() => setAdminDeps(null))

function audited(action: string): boolean {
  return deps.recordedAudit.some((row) => row.entry.action === action)
}

describe("the order retry refuses when it could cost money", () => {
  it("refuses with the kill switch off, and says which variable", async () => {
    install({ ovhOrdersEnabledInEnv: false, usingMocks: false })

    const result = await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    expect(result.ok).toBe(false)
    expect(result.message).toContain("OVH_ORDERS_ENABLED")
    expect(deps.recordedEvents).toHaveLength(0)
  })

  it("audits the refusal, because the attempt is part of the trail", async () => {
    install({ ovhOrdersEnabledInEnv: false, usingMocks: false })

    await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    const row = deps.recordedAudit.find((entry) => entry.entry.action === "order.retry.refused")
    expect(row).toBeDefined()
    expect(row?.actor.userId).toBe("01JADMIN00000000000000000A")
    expect(row?.entry.context).toMatchObject({ reason: "ovh_orders_disabled" })
  })

  it("refuses when OVH already took the order, naming the double-order risk", async () => {
    install({
      store: new FakeAdminStore({ orders: [orderDetail({ ovhOrderId: 99887766 })] }),
    })

    const result = await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    expect(result.ok).toBe(false)
    expect(result.message).toContain("99887766")
    expect(result.message).toContain("segundo servidor")
    expect(deps.recordedEvents).toHaveLength(0)
    expect(audited("order.retry.refused")).toBe(true)
  })

  it("refuses when an ovh.checkout.attempt marker exists even without an ovhOrderId", async () => {
    const seeded = new FakeAdminStore({ orders: [orderDetail({ ovhOrderId: null })] })
    seeded.checkoutAttempts.add(orderDetail().id)
    install({ store: seeded })

    const result = await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    expect(result.ok).toBe(false)
    expect(result.message).toContain("checkout")
    expect(deps.recordedEvents).toHaveLength(0)
    const row = deps.recordedAudit.find((entry) => entry.entry.action === "order.retry.refused")
    expect(row?.entry.context).toMatchObject({ reason: "ovh_checkout_attempted" })
  })

  it("proceeds once the operator acknowledges the existing OVH order", async () => {
    install({
      store: new FakeAdminStore({
        orders: [
          orderDetail({
            ovhOrderId: 99887766,
            completedSteps: [
              "whmcs_client",
              "whmcs_order",
              "whmcs_invoice",
              "whmcs_payment",
              "ovh_cart",
              "ovh_configure",
              "ovh_price_check",
              "ovh_checkout",
            ],
          }),
        ],
      }),
    })

    const result = await retryOrderProvisioning(
      null,
      formOf({ orderId: orderDetail().id, acknowledgeDoubleOrder: "on" }),
    )

    expect(result.ok).toBe(true)
    expect(deps.recordedEvents).toEqual([
      {
        name: "ola/order.provision",
        data: expect.objectContaining({ orderId: orderDetail().id, resume: true }),
      },
    ])
    expect(audited("order.retry.requested")).toBe(true)
  })

  it("does not gate on the kill switch once OVH checkout is already done", async () => {
    install({
      ovhOrdersEnabledInEnv: false,
      usingMocks: false,
      store: new FakeAdminStore({
        orders: [
          orderDetail({
            ovhOrderId: null,
            completedSteps: [
              "whmcs_client",
              "whmcs_order",
              "whmcs_invoice",
              "whmcs_payment",
              "ovh_cart",
              "ovh_configure",
              "ovh_price_check",
              "ovh_checkout",
            ],
          }),
        ],
      }),
    })

    const result = await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    expect(result.ok).toBe(true)
    expect(deps.recordedEvents).toHaveLength(1)
  })

  it("allows the retry with mocked providers, where nothing real is spent", async () => {
    install({ ovhOrdersEnabledInEnv: false, usingMocks: true })

    const result = await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    expect(result.ok).toBe(true)
    expect(deps.recordedEvents).toHaveLength(1)
  })

  it("refuses to retry a delivered order", async () => {
    install({
      store: new FakeAdminStore({ orders: [orderDetail({ status: "delivered" })] }),
    })

    const result = await retryOrderProvisioning(null, formOf({ orderId: orderDetail().id }))

    expect(result.ok).toBe(false)
    expect(deps.recordedEvents).toHaveLength(0)
  })
})

describe("money-moving actions check the confirmation against the live row", () => {
  it("refuses a refund whose confirmed amount does not match the order", async () => {
    const result = await cancelAndRefundOrder(
      null,
      formOf({ orderId: orderDetail().id, reason: "no entregado", confirmedTotal: "5,00" }),
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("9,67")
    expect(deps.recordedRefunds).toHaveLength(0)
  })

  it("refunds through the billing layer when the amount matches", async () => {
    const result = await cancelAndRefundOrder(
      null,
      formOf({ orderId: orderDetail().id, reason: "no entregado", confirmedTotal: "9,67" }),
    )

    expect(result.ok).toBe(true)
    expect(deps.recordedRefunds).toEqual([
      { orderId: orderDetail().id, reason: "no entregado" },
    ])
    expect(audited("order.refunded")).toBe(true)
  })

  it("surfaces the raw error when the billing layer is not wired, and moves no money", async () => {
    install({ billingUnavailable: true })

    const result = await cancelAndRefundOrder(
      null,
      formOf({ orderId: orderDetail().id, reason: "no entregado", confirmedTotal: "9,67" }),
    )

    expect(result.ok).toBe(false)
    expect(result.detail).toBe("billing not wired")
    expect(audited("order.refunded")).toBe(false)
  })

  it("refuses a renewal charge whose confirmed amount does not match the service", async () => {
    const result = await retryRenewalCharge(
      null,
      formOf({ serviceId: serviceDetail().id, confirmedAmount: "1,00" }),
    )

    expect(result.ok).toBe(false)
    expect(deps.recordedCharges).toHaveLength(0)
  })

  it("charges the renewal when the amount matches", async () => {
    const result = await retryRenewalCharge(
      null,
      formOf({ serviceId: serviceDetail().id, confirmedAmount: "7,99" }),
    )

    expect(result.ok).toBe(true)
    expect(deps.recordedCharges).toEqual([serviceDetail().id])
  })

  it("reports a Stripe decline as a failure and audits it, without throwing", async () => {
    install({ declineWith: "insufficient_funds" })

    const result = await retryRenewalCharge(
      null,
      formOf({ serviceId: serviceDetail().id, confirmedAmount: "7,99" }),
    )

    expect(result.ok).toBe(false)
    expect(result.detail).toContain("insufficient_funds")
    expect(audited("service.renewal.charge_declined")).toBe(true)
  })

  it("refuses to block a customer when the confirmed email does not match", async () => {
    const result = await setCustomerBlocked(
      null,
      formOf({
        customerId: customerDetail().id,
        blocked: "on",
        reason: "fraude",
        confirmedEmail: "otro@example.com",
      }),
    )

    expect(result.ok).toBe(false)
    expect(store.customers[0]?.status).toBe("verified")
  })
})

describe("the price change warns below the margin floor", () => {
  it("saves the price and says the real margin fell below the floor", async () => {
    // 5,20 € over a true cost of 4,84 € is a 7 % margin, far below the 30 % default floor.
    const result = await updatePlanPricing(
      null,
      formOf({
        planId: planRow().id,
        priceMonth: "5,20",
        price12m: "",
        marginPercent: "75",
        expectedMarginBasisPoints: "7500",
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.message).toContain("por debajo del mínimo")
    expect(store.plans[0]?.manualPrice.P1M).toBe(520)

    const row = deps.recordedAudit.find((entry) => entry.entry.action === "plan.price.changed")
    expect(row?.entry.context).toMatchObject({ belowFloor: true })
  })

  it("does not warn when the price stays above the floor", async () => {
    const result = await updatePlanPricing(
      null,
      formOf({
        planId: planRow().id,
        priceMonth: "8,99",
        price12m: "",
        marginPercent: "75",
        expectedMarginBasisPoints: "7500",
      }),
    )

    expect(result.ok).toBe(true)
    expect(result.message).not.toContain("por debajo")
    expect(store.plans[0]?.manualPrice.P1M).toBe(899)
  })

  it("honours a floor stored in featureFlags over the default", async () => {
    await updateMarginFloor(null, formOf({ floorPercent: "90", enforced: "on" }))

    const result = await updatePlanPricing(
      null,
      formOf({
        planId: planRow().id,
        priceMonth: "8,99",
        price12m: "",
        marginPercent: "75",
        expectedMarginBasisPoints: "7500",
      }),
    )

    expect(store.flags.find((flag) => flag.key === "margin_floor")?.description).toBe("9000")
    expect(result.message).toContain("por debajo del mínimo")
  })

  it("refuses a stale form instead of overwriting someone else's change", async () => {
    const result = await updatePlanPricing(
      null,
      formOf({
        planId: planRow().id,
        priceMonth: "8,99",
        marginPercent: "75",
        expectedMarginBasisPoints: "6000",
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("Recarga")
    expect(store.plans[0]?.manualPrice.P1M).toBeUndefined()
  })

  it("clears a manual PVP when the field is submitted empty", async () => {
    install({
      store: new FakeAdminStore({ plans: [planRow({ manualPrice: { P1M: 899 } })] }),
    })

    await updatePlanPricing(
      null,
      formOf({
        planId: planRow().id,
        priceMonth: "",
        price12m: "",
        marginPercent: "75",
        expectedMarginBasisPoints: "7500",
      }),
    )

    expect(store.plans[0]?.manualPrice.P1M).toBeUndefined()
  })
})

describe("the service state machine is enforced", () => {
  it("refuses a transition the domain forbids", async () => {
    install({
      store: new FakeAdminStore({ services: [serviceDetail({ status: "terminated" })] }),
    })

    const result = await changeServiceStatus(
      null,
      formOf({
        serviceId: serviceDetail().id,
        status: "active",
        confirmedCustomerId: serviceDetail().customerId,
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.message).toContain("No se puede pasar")
    expect(store.services[0]?.status).toBe("terminated")
  })

  it("requires a reason to mark a service as abuse", async () => {
    const result = await changeServiceStatus(
      null,
      formOf({
        serviceId: serviceDetail().id,
        status: "review",
        confirmedCustomerId: serviceDetail().customerId,
      }),
    )

    expect(result.ok).toBe(false)
    expect(store.services[0]?.status).toBe("active")
  })

  it("suspends and stamps `suspendedAt`", async () => {
    const result = await changeServiceStatus(
      null,
      formOf({
        serviceId: serviceDetail().id,
        status: "suspended",
        confirmedCustomerId: serviceDetail().customerId,
      }),
    )

    expect(result.ok).toBe(true)
    expect(store.services[0]?.status).toBe("suspended")
    expect(store.services[0]?.suspendedAt).not.toBeNull()
  })
})

describe("impersonation is loudly audited", () => {
  it("sets the flagged marker, writes an audit row and raises a critical alert", async () => {
    const result = await startImpersonation(
      null,
      formOf({ customerId: customerDetail().id, confirmedEmail: customerDetail().email }),
    )

    expect(result.ok).toBe(true)
    expect(deps.impersonated).toMatchObject({
      customerId: customerDetail().id,
      adminUserId: "01JADMIN00000000000000000A",
    })
    expect(audited("customer.impersonation.started")).toBe(true)
    expect(deps.recordedAlerts).toEqual([
      expect.objectContaining({ severity: "critical", entity: "customer" }),
    ])
  })

  it("clears the marker and audits the end", async () => {
    await startImpersonation(
      null,
      formOf({ customerId: customerDetail().id, confirmedEmail: customerDetail().email }),
    )
    const result = await stopImpersonation(null, formOf({}))

    expect(result.ok).toBe(true)
    expect(deps.impersonated).toBeNull()
    expect(audited("customer.impersonation.stopped")).toBe(true)
  })
})

describe("the ovh_orders flag says which switch is really in force", () => {
  it("names OVH_ORDERS_ENABLED when the row is flipped on", async () => {
    install({ ovhOrdersEnabledInEnv: false })

    const result = await setFeatureFlag(
      null,
      formOf({ key: "ovh_orders", confirmedKey: "ovh_orders", enabled: "on" }),
    )

    expect(result.ok).toBe(true)
    expect(result.message).toContain("OVH_ORDERS_ENABLED")
    expect(result.message).toContain("false")
  })

  it("refuses a key that is not one of the panel's flags", async () => {
    const result = await setFeatureFlag(
      null,
      formOf({ key: "delete_everything", confirmedKey: "delete_everything", enabled: "on" }),
    )

    expect(result.ok).toBe(false)
    expect(store.flags).toHaveLength(0)
  })

  it("refuses when the confirmation does not match the key", async () => {
    const result = await setFeatureFlag(
      null,
      formOf({ key: "windows", confirmedKey: "new_signups", enabled: "on" }),
    )

    expect(result.ok).toBe(false)
    expect(store.flags).toHaveLength(0)
  })
})

describe("mandatory addons cannot be switched off", () => {
  it("refuses to deactivate an addon OVH forces onto every cart", async () => {
    const result = await setAddonActive(null, formOf({ addonId: addonRow().id, active: "" }))

    expect(result.ok).toBe(false)
    expect(result.message).toContain("obligatoria")
    expect(store.addons[0]?.active).toBe(true)
  })
})

/**
 * The rule from the brief: EVERY mutation writes an `auditLog` row with
 * `actorType: "admin"`, the actor id and a diff payload. This walks every exported
 * Server Action that mutates something and asserts it did.
 */
describe("every admin Server Action writes an audit row", () => {
  const cases: {
    name: string
    run: () => Promise<AdminActionResult>
    action: string
  }[] = [
    {
      name: "updatePlanPricing",
      action: "plan.price.changed",
      run: () =>
        updatePlanPricing(
          null,
          formOf({
            planId: planRow().id,
            priceMonth: "8,99",
            marginPercent: "75",
            expectedMarginBasisPoints: "7500",
          }),
        ),
    },
    {
      name: "setPlanActive",
      action: "plan.deactivated",
      run: () => setPlanActive(null, formOf({ planId: planRow().id, active: "" })),
    },
    {
      name: "setPlanSort",
      action: "plan.sort.changed",
      run: () => setPlanSort(null, formOf({ planId: planRow().id, sort: "3" })),
    },
    {
      name: "updateAddonPricing",
      action: "addon.price.changed",
      run: () =>
        updateAddonPricing(
          null,
          formOf({
            addonId: addonRow().id,
            priceMonth: "0,99",
            marginPercent: "50",
            expectedMarginBasisPoints: "5000",
          }),
        ),
    },
    {
      name: "setAddonActive",
      action: "addon.deactivated",
      run: () =>
        setAddonActive(null, formOf({ addonId: "01JADDON000000000000000002", active: "" })),
    },
    {
      name: "updateMarginFloor",
      action: "margin_floor.changed",
      run: () => updateMarginFloor(null, formOf({ floorPercent: "35", enforced: "on" })),
    },
    {
      name: "syncCatalogNow",
      action: "catalog.sync.requested",
      run: () => syncCatalogNow(null, formOf({})),
    },
    {
      name: "retryOrderProvisioning",
      action: "order.retry.requested",
      run: () => retryOrderProvisioning(null, formOf({ orderId: orderDetail().id })),
    },
    {
      name: "cancelAndRefundOrder",
      action: "order.refunded",
      run: () =>
        cancelAndRefundOrder(
          null,
          formOf({ orderId: orderDetail().id, reason: "fallo", confirmedTotal: "9,67" }),
        ),
    },
    {
      name: "forceServiceSync",
      action: "service.sync.requested",
      run: () => forceServiceSync(null, formOf({ serviceId: serviceDetail().id })),
    },
    {
      name: "changeServiceStatus",
      action: "service.status.suspended",
      run: () =>
        changeServiceStatus(
          null,
          formOf({
            serviceId: serviceDetail().id,
            status: "suspended",
            confirmedCustomerId: serviceDetail().customerId,
          }),
        ),
    },
    {
      name: "changeServiceNextDueAt",
      action: "service.next_due_at.changed",
      run: () =>
        changeServiceNextDueAt(
          null,
          formOf({
            serviceId: serviceDetail().id,
            nextDueAt: "2027-01-15",
            confirmedCustomerId: serviceDetail().customerId,
          }),
        ),
    },
    {
      name: "setCustomerBlocked",
      action: "customer.blocked",
      run: () =>
        setCustomerBlocked(
          null,
          formOf({
            customerId: customerDetail().id,
            blocked: "on",
            reason: "chargeback",
            confirmedEmail: customerDetail().email,
          }),
        ),
    },
    {
      name: "grantManualCredit",
      action: "credit.granted_manually",
      run: () =>
        grantManualCredit(
          null,
          formOf({
            customerId: customerDetail().id,
            amount: "10,00",
            note: "incidencia de entrega",
            expiresAt: "2026-12-31",
            confirmedEmail: customerDetail().email,
          }),
        ),
    },
    {
      name: "startImpersonation",
      action: "customer.impersonation.started",
      run: () =>
        startImpersonation(
          null,
          formOf({ customerId: customerDetail().id, confirmedEmail: customerDetail().email }),
        ),
    },
    {
      name: "stopImpersonation",
      action: "customer.impersonation.stopped",
      run: () => stopImpersonation(null, formOf({})),
    },
    {
      name: "retryRenewalCharge",
      action: "service.renewal.charged_manually",
      run: () =>
        retryRenewalCharge(
          null,
          formOf({ serviceId: serviceDetail().id, confirmedAmount: "7,99" }),
        ),
    },
    {
      name: "setFeatureFlag",
      action: "flag.enabled",
      run: () =>
        setFeatureFlag(
          null,
          formOf({ key: "windows", confirmedKey: "windows", enabled: "on" }),
        ),
    },
  ]

  for (const testCase of cases) {
    it(`${testCase.name} audits as «${testCase.action}»`, async () => {
      install()
      const result = await testCase.run()

      expect(result.ok, `${testCase.name}: ${result.message} ${result.detail ?? ""}`).toBe(true)
      const row = deps.recordedAudit.find((entry) => entry.entry.action === testCase.action)
      expect(row, `${testCase.name} wrote no «${testCase.action}» audit row`).toBeDefined()
      expect(row?.actor.userId).toBe("01JADMIN00000000000000000A")
      expect(row?.entry.entity).toBeTruthy()
      // Either a field diff or explicit context — never an empty audit row.
      const hasPayload =
        row?.entry.before !== undefined ||
        row?.entry.after !== undefined ||
        row?.entry.context !== undefined
      expect(hasPayload, `${testCase.name} wrote an audit row with no payload`).toBe(true)
    })
  }

  it("covers every mutating action exported from actions.ts", async () => {
    const exported = Object.keys(await import("../actions")).sort()
    const covered = cases.map((testCase) => testCase.name).sort()

    expect(covered).toEqual(exported.filter((name) => name !== "refundPayment"))
  })
})

describe("refundPayment", () => {
  it("audits the refund of a payment tied to an order", async () => {
    const result = await refundPaymentAction()

    expect(result.ok).toBe(true)
    expect(audited("payment.refunded")).toBe(true)
  })

  it("refuses when the payment has no order to refund through", async () => {
    install({
      store: new FakeAdminStore({ payments: [paymentRow({ orderId: null })] }),
    })

    const result = await refundPaymentAction()

    expect(result.ok).toBe(false)
    expect(result.message).toContain("refundOrder")
    expect(deps.recordedRefunds).toHaveLength(0)
  })
})

async function refundPaymentAction(): Promise<AdminActionResult> {
  const { refundPayment } = await import("../actions")
  return refundPayment(
    null,
    formOf({
      paymentId: paymentRow().id,
      reason: "cargo duplicado",
      confirmedAmount: "9,67",
    }),
  )
}
