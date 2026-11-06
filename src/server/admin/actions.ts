"use server"

/**
 * Every admin Server Action.
 *
 * The shape of each one is identical and not negotiable:
 *
 *   1. `requireAdmin()` — via `deps.actor()`. There is no admin mutation without it.
 *   2. validate the input, and re-read the row it is about.
 *   3. for anything destructive or money-moving: check the confirmation the UI submitted
 *      against the live row. The operator confirmed an amount and a customer; if either
 *      changed since the page rendered, refuse and make them look again.
 *   4. mutate.
 *   5. write one `auditLog` row with `actorType: "admin"`, the actor id and a `diffOf`
 *      payload — including when a dangerous operation was REFUSED, because the attempt is
 *      part of the trail.
 *   6. revalidate the affected admin route.
 *
 * Actions are reachable by direct POST, not only through the UI, so none of them trusts a
 * price, an amount or a customer id that arrived in the form.
 */
import {
  PROVISION_STEPS,
  SERVICE_STATUSES,
  canTransitionService,
  formatCents,
  nextProvisionStep,
  type Cents,
  type ServiceStatus,
  type Term,
} from "@ola/core"
import { adminDeps, type AdminActor, type AdminDeps } from "./deps"
import {
  InputError,
  dateField,
  euroToCents,
  flag,
  percentToBasisPoints,
  requiredEuroToCents,
  requiredText,
  text,
} from "./input"
import { baselineFromRow, planBaselines } from "./baseline"
import { basisPointsToRatio, formatMargin, marginViewByTerm } from "./pricing"
import { fail, ok, type AdminActionResult } from "./results"
import {
  ADMIN_FLAG_KEYS,
  FLAG_DEFINITIONS,
  isAdminFlagKey,
  readMarginFloor,
  writeMarginFloor,
} from "./settings"

interface AdminContext {
  deps: AdminDeps
  actor: AdminActor
}

/**
 * Resolves the container and the actor, then runs the body.
 *
 * `deps.actor()` is called OUTSIDE the try: `requireAdmin()` redirects by throwing, and
 * swallowing that would render an admin page to someone who is not an admin.
 */
async function withAdmin(
  label: string,
  body: (context: AdminContext) => Promise<AdminActionResult>,
): Promise<AdminActionResult> {
  const deps = await adminDeps()
  const actor = await deps.actor()
  try {
    return await body({ deps, actor })
  } catch (error) {
    if (error instanceof InputError) return fail(error.message)
    const detail = error instanceof Error ? error.message : String(error)
    return fail(`No se ha podido completar «${label}».`, detail)
  }
}

function correlationId(prefix: string): string {
  return `admin-${prefix}-${Date.now().toString(36)}`
}

// ─── pricing ─────────────────────────────────────────────────────────────────

/**
 * Changes the manual PVP and/or the margin of one plan.
 *
 * The margin that matters is the one over the TRUE cost (plan + mandatory addons), and
 * the warning when it falls below the configured floor is part of the result, not a
 * suggestion: the UI shows it before and after the write.
 */
export async function updatePlanPricing(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("actualizar el precio del plan", async ({ deps, actor }) => {
    const planId = requiredText(form, "planId", "el plan")
    const plan = await deps.store.getPlan(planId)
    if (!plan) return fail("El plan no existe.")

    // Stale-form guard: the operator confirmed the figures they could see.
    const expectedMarginBp = Number(text(form, "expectedMarginBasisPoints"))
    if (Number.isFinite(expectedMarginBp) && expectedMarginBp !== plan.marginBasisPoints) {
      return fail("Los datos del plan han cambiado mientras editabas. Recarga y vuelve a intentarlo.")
    }

    const nextPriceMonth = euroToCents(text(form, "priceMonth"))
    const nextPrice12m = euroToCents(text(form, "price12m"))
    const marginText = text(form, "marginPercent")
    const nextMarginBp = marginText === "" ? plan.marginBasisPoints : percentToBasisPoints(marginText)

    const floor = await readMarginFloor(deps.store, deps.catalog.defaults().marginFloorBasisPoints)
    const [catalog, addonRows] = await Promise.all([
      deps.catalog.load(),
      deps.store.listAddons(),
    ])
    const baselines = planBaselines(catalog, [plan], addonRows, deps.catalog.defaults())
    const baseline = baselines.get(plan.ovhPlanCode) ?? baselineFromRow(plan)

    const before = marginViewByTerm({
      bareCost: baseline.bareCost,
      mandatory: baseline.mandatory,
      margin: basisPointsToRatio(plan.marginBasisPoints),
      manualPrice: plan.manualPrice,
      floor: floor.ratio,
    })
    const nextManual: Partial<Record<Term, Cents>> = {}
    if (nextPriceMonth !== null) nextManual.P1M = nextPriceMonth
    if (nextPrice12m !== null) nextManual.P12M = nextPrice12m
    const after = marginViewByTerm({
      bareCost: baseline.bareCost,
      mandatory: baseline.mandatory,
      margin: basisPointsToRatio(nextMarginBp),
      manualPrice: nextManual,
      floor: floor.ratio,
    })

    await deps.store.updatePlan(planId, {
      priceMonth: nextPriceMonth,
      price12m: nextPrice12m,
      marginBasisPoints: nextMarginBp,
    })

    await deps.audit(actor, {
      entity: "plan",
      entityId: planId,
      action: "plan.price.changed",
      before: {
        priceMonth: plan.manualPrice.P1M ?? null,
        price12m: plan.manualPrice.P12M ?? null,
        marginBasisPoints: plan.marginBasisPoints,
      },
      after: {
        priceMonth: nextPriceMonth,
        price12m: nextPrice12m,
        marginBasisPoints: nextMarginBp,
      },
      context: {
        ovhPlanCode: plan.ovhPlanCode,
        trueCostMonth: after.P1M.trueCost,
        totalPriceBefore: before.P1M.totalPrice,
        totalPriceAfter: after.P1M.totalPrice,
        trueMarginBefore: before.P1M.trueMargin,
        trueMarginAfter: after.P1M.trueMargin,
        marginFloorBasisPoints: floor.basisPoints,
        belowFloor: after.P1M.belowFloor || after.P12M.belowFloor,
      },
      correlationId: correlationId("plan-price"),
    })

    deps.cache.revalidate("/admin/planes")

    const summary =
      `${plan.name}: ${formatCents(before.P1M.totalPrice)} → ${formatCents(after.P1M.totalPrice)} al mes, ` +
      `margen real ${formatMargin(before.P1M.trueMargin)} → ${formatMargin(after.P1M.trueMargin)}`

    if (after.P1M.belowFloor || after.P12M.belowFloor) {
      const terms = [
        ...(after.P1M.belowFloor ? ["mensual"] : []),
        ...(after.P12M.belowFloor ? ["anual"] : []),
      ].join(" y ")
      return ok(
        `Precio guardado, pero el margen real queda por debajo del mínimo configurado ` +
          `(${formatMargin(floor.ratio)}) en el término ${terms}.`,
        summary,
      )
    }
    return ok("Precio actualizado.", summary)
  })
}

export async function setPlanActive(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cambiar la disponibilidad del plan", async ({ deps, actor }) => {
    const planId = requiredText(form, "planId", "el plan")
    const plan = await deps.store.getPlan(planId)
    if (!plan) return fail("El plan no existe.")

    const active = flag(form, "active")
    await deps.store.updatePlan(planId, { active })
    await deps.audit(actor, {
      entity: "plan",
      entityId: planId,
      action: active ? "plan.activated" : "plan.deactivated",
      before: { active: plan.active },
      after: { active },
      context: { ovhPlanCode: plan.ovhPlanCode, name: plan.name },
      correlationId: correlationId("plan-active"),
    })
    deps.cache.revalidate("/admin/planes")
    return ok(active ? `${plan.name} vuelve a venderse.` : `${plan.name} deja de venderse.`)
  })
}

export async function setPlanSort(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cambiar el orden del plan", async ({ deps, actor }) => {
    const planId = requiredText(form, "planId", "el plan")
    const plan = await deps.store.getPlan(planId)
    if (!plan) return fail("El plan no existe.")

    const parsed = Number(requiredText(form, "sort", "el orden"))
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
      return fail("El orden debe ser un número entero entre 0 y 999.")
    }

    await deps.store.updatePlan(planId, { sort: parsed })
    await deps.audit(actor, {
      entity: "plan",
      entityId: planId,
      action: "plan.sort.changed",
      before: { sort: plan.sort },
      after: { sort: parsed },
      correlationId: correlationId("plan-sort"),
    })
    deps.cache.revalidate("/admin/planes")
    return ok("Orden actualizado.")
  })
}

export async function updateAddonPricing(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("actualizar el precio de la opción", async ({ deps, actor }) => {
    const addonId = requiredText(form, "addonId", "la opción")
    const addon = await deps.store.getAddon(addonId)
    if (!addon) return fail("La opción no existe.")

    const expectedMarginBp = Number(text(form, "expectedMarginBasisPoints"))
    if (Number.isFinite(expectedMarginBp) && expectedMarginBp !== addon.marginBasisPoints) {
      return fail("Los datos de la opción han cambiado mientras editabas. Recarga y vuelve a intentarlo.")
    }

    const nextPriceMonth = euroToCents(text(form, "priceMonth"))
    const nextPrice12m = euroToCents(text(form, "price12m"))
    const marginText = text(form, "marginPercent")
    const nextMarginBp =
      marginText === "" ? addon.marginBasisPoints : percentToBasisPoints(marginText)

    const floor = await readMarginFloor(deps.store, deps.catalog.defaults().marginFloorBasisPoints)
    // An addon has no mandatory options of its own: its true cost IS its cost.
    const noMandatory = { P1M: { cost: 0, price: 0 }, P12M: { cost: 0, price: 0 } }
    const before = marginViewByTerm({
      bareCost: addon.cost,
      mandatory: noMandatory,
      margin: basisPointsToRatio(addon.marginBasisPoints),
      manualPrice: addon.manualPrice,
      floor: floor.ratio,
    })
    const nextManual: Partial<Record<Term, Cents>> = {}
    if (nextPriceMonth !== null) nextManual.P1M = nextPriceMonth
    if (nextPrice12m !== null) nextManual.P12M = nextPrice12m
    const after = marginViewByTerm({
      bareCost: addon.cost,
      mandatory: noMandatory,
      margin: basisPointsToRatio(nextMarginBp),
      manualPrice: nextManual,
      floor: floor.ratio,
    })

    await deps.store.updateAddon(addonId, {
      priceMonth: nextPriceMonth,
      price12m: nextPrice12m,
      marginBasisPoints: nextMarginBp,
    })

    await deps.audit(actor, {
      entity: "addon",
      entityId: addonId,
      action: "addon.price.changed",
      before: {
        priceMonth: addon.manualPrice.P1M ?? null,
        price12m: addon.manualPrice.P12M ?? null,
        marginBasisPoints: addon.marginBasisPoints,
      },
      after: {
        priceMonth: nextPriceMonth,
        price12m: nextPrice12m,
        marginBasisPoints: nextMarginBp,
      },
      context: {
        ovhPlanCode: addon.ovhPlanCode,
        family: addon.family,
        mandatory: addon.mandatory,
        trueMarginBefore: before.P1M.trueMargin,
        trueMarginAfter: after.P1M.trueMargin,
        belowFloor: after.P1M.belowFloor || after.P12M.belowFloor,
      },
      correlationId: correlationId("addon-price"),
    })

    deps.cache.revalidate("/admin/planes")

    if (after.P1M.belowFloor || after.P12M.belowFloor) {
      return ok(
        `Precio guardado, pero el margen queda por debajo del mínimo configurado (${formatMargin(floor.ratio)}).`,
        `${addon.name}: ${formatCents(before.P1M.totalPrice)} → ${formatCents(after.P1M.totalPrice)} al mes`,
      )
    }
    if (addon.mandatory) {
      return ok(
        "Precio actualizado. Es una opción obligatoria: afecta al precio final de todos los planes.",
      )
    }
    return ok("Precio actualizado.")
  })
}

export async function setAddonActive(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cambiar la disponibilidad de la opción", async ({ deps, actor }) => {
    const addonId = requiredText(form, "addonId", "la opción")
    const addon = await deps.store.getAddon(addonId)
    if (!addon) return fail("La opción no existe.")
    if (addon.mandatory) {
      return fail(
        "Es una opción obligatoria del catálogo de OVH: no puede desactivarse sin dejar de poder crear servidores.",
      )
    }

    const active = flag(form, "active")
    await deps.store.updateAddon(addonId, { active })
    await deps.audit(actor, {
      entity: "addon",
      entityId: addonId,
      action: active ? "addon.activated" : "addon.deactivated",
      before: { active: addon.active },
      after: { active },
      context: { ovhPlanCode: addon.ovhPlanCode, family: addon.family },
      correlationId: correlationId("addon-active"),
    })
    deps.cache.revalidate("/admin/planes")
    return ok(active ? `${addon.name} vuelve a ofrecerse.` : `${addon.name} deja de ofrecerse.`)
  })
}

export async function updateMarginFloor(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("actualizar el margen mínimo", async ({ deps, actor }) => {
    const basisPoints = percentToBasisPoints(requiredText(form, "floorPercent", "el margen mínimo"))
    if (basisPoints > 10_000) return fail("El margen mínimo no puede superar el 100 %.")
    const enforced = flag(form, "enforced")

    const current = await readMarginFloor(deps.store, deps.catalog.defaults().marginFloorBasisPoints)
    await writeMarginFloor(deps.store, basisPoints, enforced)
    await deps.audit(actor, {
      entity: "setting",
      entityId: "margin_floor",
      action: "margin_floor.changed",
      before: { basisPoints: current.basisPoints, enforced: current.enforced },
      after: { basisPoints, enforced },
      correlationId: correlationId("margin-floor"),
    })
    deps.cache.revalidate("/admin/planes")
    return ok(`Margen mínimo: ${formatMargin(basisPointsToRatio(basisPoints))}.`)
  })
}

// ─── catalog ─────────────────────────────────────────────────────────────────

export async function syncCatalogNow(
  _previous: AdminActionResult | null,
  _form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("sincronizar el catálogo", async ({ deps, actor }) => {
    const id = correlationId("catalog-sync")
    await deps.events.syncCatalog({ correlationId: id })
    await deps.audit(actor, {
      entity: "catalog",
      entityId: null,
      action: "catalog.sync.requested",
      context: { event: "ola/catalog.sync", reason: "manual" },
      correlationId: id,
    })
    deps.cache.revalidate("/admin/catalogo")
    return ok(
      "Sincronización solicitada. El trabajo escribe un snapshot nuevo cuando termina; recarga en un minuto.",
    )
  })
}

// ─── orders ──────────────────────────────────────────────────────────────────

/**
 * Re-runs the provisioning job for one order, resuming from `orders.completedSteps`.
 *
 * Two refusals, both of which cost real money if skipped:
 *  - `ovhOrderId` is already set: OVH took the order. A blind retry can order a second
 *    VPS the customer never asked for and we pay for. The operator has to acknowledge it.
 *  - `OVH_ORDERS_ENABLED` is false and OVH checkout has not happened yet: a retry would
 *    try to place a real order with the kill switch down.
 */
export async function retryOrderProvisioning(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("reintentar el pedido", async ({ deps, actor }) => {
    const orderId = requiredText(form, "orderId", "el pedido")
    const order = await deps.store.getOrder(orderId)
    if (!order) return fail("El pedido no existe.")

    if (order.status === "delivered" || order.status === "cancelled") {
      return fail(
        `El pedido está en estado «${order.status}»: no hay nada que reintentar.`,
      )
    }

    const acknowledged = flag(form, "acknowledgeDoubleOrder")
    const id = correlationId("order-retry")

    // `ovhOrderId` is proof OVH took the order; the `ovh.checkout.attempt` audit marker is
    // proof we POSTed checkout and may never have heard back. Either one means a blind
    // retry can buy a second VPS.
    const checkoutAttempted = await deps.store.hasCheckoutAttempt(orderId)
    if ((order.ovhOrderId !== null || checkoutAttempted) && !acknowledged) {
      await deps.audit(actor, {
        entity: "order",
        entityId: orderId,
        action: "order.retry.refused",
        context: {
          reason:
            order.ovhOrderId !== null ? "ovh_order_already_exists" : "ovh_checkout_attempted",
          ovhOrderId: order.ovhOrderId,
          checkoutAttempted,
          completedSteps: order.completedSteps,
        },
        correlationId: id,
      })
      return fail(
        order.ovhOrderId !== null
          ? `OVH ya aceptó el pedido ${order.ovhOrderId}. Reintentar sin revisarlo puede generar ` +
              "un segundo servidor que pagamos nosotros. Comprueba el pedido en OVH y marca la " +
              "casilla de confirmación si aun así quieres reintentar."
          : "Ya se intentó el checkout en OVH para este pedido y no consta el id de pedido: OVH " +
              "puede haberlo aceptado. Reintentar sin revisarlo puede generar un segundo " +
              "servidor. Revisa los pedidos recientes en OVH y marca la casilla si aun así " +
              "quieres reintentar.",
      )
    }

    // The gate only matters while a NEW order could still be placed. Once `ovh_checkout`
    // is recorded, the money is spent and the job is only polling for delivery.
    const next = nextProvisionStep(order.completedSteps)
    const checkoutIndex = PROVISION_STEPS.indexOf("ovh_checkout")
    const mayPlaceOrder = next !== null && PROVISION_STEPS.indexOf(next) <= checkoutIndex

    if (mayPlaceOrder && !deps.safety.usingMocks() && !deps.safety.ovhOrdersEnabledInEnv()) {
      await deps.audit(actor, {
        entity: "order",
        entityId: orderId,
        action: "order.retry.refused",
        context: { reason: "ovh_orders_disabled", nextStep: next },
        correlationId: id,
      })
      return fail(
        "OVH_ORDERS_ENABLED está en false: el reintento llegaría hasta el checkout de OVH y " +
          "se rechazaría. Activa la variable de entorno antes de reintentar este pedido.",
      )
    }
    // The hard gate, exactly as `src/server/providers.ts` defines it.
    if (mayPlaceOrder) deps.safety.assertOvhOrdersEnabled()

    await deps.events.retryProvision({ orderId, correlationId: id })
    await deps.audit(actor, {
      entity: "order",
      entityId: orderId,
      action: "order.retry.requested",
      context: {
        event: "ola/order.provision",
        resume: true,
        nextStep: next,
        completedSteps: order.completedSteps,
        ovhOrderId: order.ovhOrderId,
        checkoutAttempted,
        acknowledgedDoubleOrderRisk: acknowledged,
      },
      correlationId: id,
    })
    deps.cache.revalidate(`/admin/pedidos/${orderId}`)
    deps.cache.revalidate("/admin/pedidos")

    return ok(
      `Reintento lanzado desde el paso «${next ?? "final"}».`,
      acknowledged
        ? `Reintento confirmado pese al riesgo de duplicado (pedido OVH ${order.ovhOrderId ?? "desconocido"}).`
        : undefined,
    )
  })
}

export async function cancelAndRefundOrder(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cancelar y reembolsar el pedido", async ({ deps, actor }) => {
    const orderId = requiredText(form, "orderId", "el pedido")
    const reason = requiredText(form, "reason", "el motivo del reembolso")
    const order = await deps.store.getOrder(orderId)
    if (!order) return fail("El pedido no existe.")

    const confirmedTotal = requiredEuroToCents(
      requiredText(form, "confirmedTotal", "el importe confirmado"),
      "el importe confirmado",
    )
    if (confirmedTotal !== order.total) {
      return fail(
        `El importe confirmado (${formatCents(confirmedTotal)}) no coincide con el del pedido ` +
          `(${formatCents(order.total)}). Recarga la página y vuelve a confirmar.`,
      )
    }
    if (order.status === "cancelled") return fail("El pedido ya estaba cancelado.")

    const id = correlationId("order-refund")
    const result = await deps.billing.refundOrder(orderId, reason)

    await deps.audit(actor, {
      entity: "order",
      entityId: orderId,
      action: "order.refunded",
      before: { status: order.status },
      after: { status: "cancelled" },
      context: {
        reason,
        refunded: result.refunded,
        orderTotal: order.total,
        customerId: order.customerId,
        customerEmail: order.customerEmail,
        stripePaymentIntentId: order.stripePaymentIntentId,
      },
      correlationId: id,
    })
    await deps.alerts.raiseAlert({
      severity: "warning",
      title: "Pedido reembolsado desde el panel interno",
      entity: "order",
      entityId: orderId,
      detail: `${formatCents(result.refunded)} a ${order.customerEmail}: ${reason}`,
      correlationId: id,
    })

    deps.cache.revalidate(`/admin/pedidos/${orderId}`)
    deps.cache.revalidate("/admin/pedidos")
    return ok(`Reembolsados ${formatCents(result.refunded)} a ${order.customerEmail}.`)
  })
}

// ─── services ────────────────────────────────────────────────────────────────

export async function forceServiceSync(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("sincronizar el servicio con OVH", async ({ deps, actor }) => {
    const serviceId = requiredText(form, "serviceId", "el servicio")
    const service = await deps.store.getService(serviceId)
    if (!service) return fail("El servicio no existe.")

    const id = correlationId("service-sync")
    await deps.events.syncService({ serviceId, correlationId: id })
    await deps.audit(actor, {
      entity: "service",
      entityId: serviceId,
      action: "service.sync.requested",
      context: { event: "ola/service.sync", ovhServiceName: service.ovhServiceName },
      correlationId: id,
    })
    deps.cache.revalidate(`/admin/servicios/${serviceId}`)
    return ok("Sincronización solicitada. El estado se actualiza cuando el trabajo termina.")
  })
}

/**
 * Suspend, reactivate, or put a service under review for abuse.
 *
 * The transition is checked against the state machine in `@ola/core`, so the panel cannot
 * put a terminated server back into `active` by posting a form.
 */
export async function changeServiceStatus(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cambiar el estado del servicio", async ({ deps, actor }) => {
    const serviceId = requiredText(form, "serviceId", "el servicio")
    const service = await deps.store.getService(serviceId)
    if (!service) return fail("El servicio no existe.")

    const status = requiredText(form, "status", "el estado nuevo")
    if (!(SERVICE_STATUSES as readonly string[]).includes(status)) {
      return fail("Ese estado no existe.")
    }
    const next = status as ServiceStatus

    const confirmedCustomerId = requiredText(form, "confirmedCustomerId", "el cliente confirmado")
    if (confirmedCustomerId !== service.customerId) {
      return fail("El cliente confirmado no coincide con el del servicio. Recarga la página.")
    }
    if (!canTransitionService(service.status, next)) {
      return fail(`No se puede pasar de «${service.status}» a «${next}».`)
    }

    const reason = text(form, "reason")
    if (next === "review" && reason === "") {
      return fail("Marcar como abuso necesita un motivo.")
    }

    await deps.store.updateService(serviceId, {
      status: next,
      ...(next === "suspended" ? { suspendedAt: deps.now() } : {}),
      ...(service.status === "suspended" && next === "active" ? { suspendedAt: null } : {}),
    })

    await deps.audit(actor, {
      entity: "service",
      entityId: serviceId,
      action: next === "review" ? "service.flagged_abuse" : `service.status.${next}`,
      before: { status: service.status },
      after: { status: next },
      context: {
        reason: reason === "" ? null : reason,
        customerId: service.customerId,
        customerEmail: service.customerEmail,
        ovhServiceName: service.ovhServiceName,
      },
      correlationId: correlationId("service-status"),
    })

    deps.cache.revalidate(`/admin/servicios/${serviceId}`)
    deps.cache.revalidate("/admin/servicios")

    const labels: Partial<Record<ServiceStatus, string>> = {
      suspended: `Servidor de ${service.customerEmail} suspendido.`,
      active: `Servidor de ${service.customerEmail} reactivado.`,
      review: `Servidor de ${service.customerEmail} marcado como abuso y puesto en revisión.`,
      terminating: `Servidor de ${service.customerEmail} marcado para cancelación.`,
    }
    return ok(labels[next] ?? `Estado cambiado a «${next}».`)
  })
}

export async function changeServiceNextDueAt(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cambiar la próxima renovación", async ({ deps, actor }) => {
    const serviceId = requiredText(form, "serviceId", "el servicio")
    const service = await deps.store.getService(serviceId)
    if (!service) return fail("El servicio no existe.")

    const nextDueAt = dateField(text(form, "nextDueAt"))
    const confirmedCustomerId = requiredText(form, "confirmedCustomerId", "el cliente confirmado")
    if (confirmedCustomerId !== service.customerId) {
      return fail("El cliente confirmado no coincide con el del servicio. Recarga la página.")
    }

    await deps.store.updateService(serviceId, { nextDueAt })
    await deps.audit(actor, {
      entity: "service",
      entityId: serviceId,
      action: "service.next_due_at.changed",
      before: { nextDueAt: service.nextDueAt?.toISOString() ?? null },
      after: { nextDueAt: nextDueAt?.toISOString() ?? null },
      context: {
        customerId: service.customerId,
        customerEmail: service.customerEmail,
        monthlyPrice: service.monthlyPrice,
      },
      correlationId: correlationId("service-due"),
    })
    deps.cache.revalidate(`/admin/servicios/${serviceId}`)
    return ok(
      nextDueAt
        ? `Próxima renovación: ${nextDueAt.toISOString().slice(0, 10)}.`
        : "Renovación sin fecha: el calendario de cobros queda detenido para este servicio.",
    )
  })
}

// ─── customers ───────────────────────────────────────────────────────────────

export async function setCustomerBlocked(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("bloquear o desbloquear el cliente", async ({ deps, actor }) => {
    const customerId = requiredText(form, "customerId", "el cliente")
    const customer = await deps.store.getCustomer(customerId)
    if (!customer) return fail("El cliente no existe.")

    const confirmedEmail = requiredText(form, "confirmedEmail", "el correo confirmado")
    if (confirmedEmail.toLowerCase() !== customer.email.toLowerCase()) {
      return fail(
        `El correo confirmado no coincide con el del cliente (${customer.email}). Recarga la página.`,
      )
    }

    const blocked = flag(form, "blocked")
    const reason = requiredText(form, "reason", "el motivo")
    const status = blocked ? "blocked" : "verified"

    await deps.store.updateCustomer(customerId, {
      status,
      riskNotes: `${customer.riskNotes ? `${customer.riskNotes}\n` : ""}${deps
        .now()
        .toISOString()} ${actor.email}: ${blocked ? "bloqueo" : "desbloqueo"} — ${reason}`,
    })
    await deps.audit(actor, {
      entity: "customer",
      entityId: customerId,
      action: blocked ? "customer.blocked" : "customer.unblocked",
      before: { status: customer.status },
      after: { status },
      context: { reason, email: customer.email, servicesCount: customer.services.length },
      correlationId: correlationId("customer-block"),
    })
    deps.cache.revalidate(`/admin/clientes/${customerId}`)
    deps.cache.revalidate("/admin/clientes")
    return ok(
      blocked
        ? `${customer.email} bloqueado. No podrá iniciar sesión ni contratar.`
        : `${customer.email} desbloqueado.`,
    )
  })
}

export async function grantManualCredit(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("conceder crédito manual", async ({ deps, actor }) => {
    const customerId = requiredText(form, "customerId", "el cliente")
    const customer = await deps.store.getCustomer(customerId)
    if (!customer) return fail("El cliente no existe.")

    const confirmedEmail = requiredText(form, "confirmedEmail", "el correo confirmado")
    if (confirmedEmail.toLowerCase() !== customer.email.toLowerCase()) {
      return fail(
        `El correo confirmado no coincide con el del cliente (${customer.email}). Recarga la página.`,
      )
    }

    const amount = requiredEuroToCents(requiredText(form, "amount", "el importe"), "el importe")
    if (amount <= 0) return fail("El importe tiene que ser positivo.")
    if (amount > 50_000) {
      return fail("Un crédito manual de más de 500,00 € no se concede desde el panel.")
    }
    const note = requiredText(form, "note", "el motivo")
    const expiresAt = dateField(text(form, "expiresAt"))
    if (expiresAt && expiresAt.getTime() <= deps.now().getTime()) {
      return fail("La fecha de caducidad ya ha pasado.")
    }

    const inserted = await deps.store.insertCredit({
      customerId,
      amount,
      reason: "manual",
      note,
      expiresAt,
    })
    await deps.audit(actor, {
      entity: "credit",
      entityId: inserted.id,
      action: "credit.granted_manually",
      after: {
        amount,
        reason: "manual",
        note,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      context: { customerId, email: customer.email },
      correlationId: correlationId("credit-grant"),
    })
    deps.cache.revalidate(`/admin/clientes/${customerId}`)
    return ok(
      `Concedidos ${formatCents(amount)} de crédito a ${customer.email}` +
        `${expiresAt ? `, caduca el ${expiresAt.toISOString().slice(0, 10)}` : " sin caducidad"}.`,
    )
  })
}

/**
 * Starts an impersonation.
 *
 * This sets the signed marker `src/server/admin/impersonation.ts` owns and writes a
 * `critical` audit row. See that file for what the marker is and, more importantly, what
 * it is not: the admin keeps their own session and does not gain access to `/app`.
 */
export async function startImpersonation(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("iniciar la suplantación", async ({ deps, actor }) => {
    const customerId = requiredText(form, "customerId", "el cliente")
    const customer = await deps.store.getCustomer(customerId)
    if (!customer) return fail("El cliente no existe.")

    const confirmedEmail = requiredText(form, "confirmedEmail", "el correo confirmado")
    if (confirmedEmail.toLowerCase() !== customer.email.toLowerCase()) {
      return fail(
        `El correo confirmado no coincide con el del cliente (${customer.email}). Recarga la página.`,
      )
    }

    const startedAt = deps.now()
    const id = correlationId("impersonation")
    await deps.impersonation.start({
      customerId,
      customerEmail: customer.email,
      adminUserId: actor.userId,
      startedAt,
    })
    await deps.audit(actor, {
      entity: "customer",
      entityId: customerId,
      action: "customer.impersonation.started",
      context: {
        email: customer.email,
        adminEmail: actor.email,
        startedAt: startedAt.toISOString(),
        ip: actor.ip,
      },
      correlationId: id,
    })
    await deps.alerts.raiseAlert({
      severity: "critical",
      title: "Suplantación de cliente iniciada",
      entity: "customer",
      entityId: customerId,
      detail: `${actor.email} está viendo la cuenta de ${customer.email}`,
      correlationId: id,
    })
    deps.cache.revalidate("/admin")
    return ok(
      `Estás viendo el panel como ${customer.email}. Queda registrado y caduca en 30 minutos.`,
    )
  })
}

export async function stopImpersonation(
  _previous: AdminActionResult | null,
  _form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("terminar la suplantación", async ({ deps, actor }) => {
    const state = await deps.impersonation.read()
    await deps.impersonation.stop()
    await deps.audit(actor, {
      entity: "customer",
      entityId: state?.customerId ?? null,
      action: "customer.impersonation.stopped",
      context: {
        email: state?.customerEmail ?? null,
        startedAt: state?.startedAt.toISOString() ?? null,
        adminEmail: actor.email,
      },
      correlationId: correlationId("impersonation-stop"),
    })
    deps.cache.revalidate("/admin")
    return ok("Suplantación terminada.")
  })
}

// ─── payments ────────────────────────────────────────────────────────────────

export async function retryRenewalCharge(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("reintentar el cobro", async ({ deps, actor }) => {
    const serviceId = requiredText(form, "serviceId", "el servicio")
    const service = await deps.store.getService(serviceId)
    if (!service) return fail("El servicio no existe.")

    const confirmedAmount = requiredEuroToCents(
      requiredText(form, "confirmedAmount", "el importe confirmado"),
      "el importe confirmado",
    )
    if (confirmedAmount !== service.monthlyPrice) {
      return fail(
        `El importe confirmado (${formatCents(confirmedAmount)}) no coincide con la cuota del ` +
          `servicio (${formatCents(service.monthlyPrice)}). Recarga la página.`,
      )
    }

    const id = correlationId("charge-retry")
    const result = await deps.billing.chargeRenewal(serviceId)
    await deps.audit(actor, {
      entity: "service",
      entityId: serviceId,
      action: result.declined === null
        ? "service.renewal.charged_manually"
        : "service.renewal.charge_declined",
      context: {
        charged: result.charged,
        declined: result.declined,
        stripePaymentIntentId: result.paymentIntentId,
        customerId: service.customerId,
        customerEmail: service.customerEmail,
        dunningStage: service.dunningStage,
      },
      correlationId: id,
    })
    deps.cache.revalidate("/admin/pagos")
    deps.cache.revalidate(`/admin/servicios/${serviceId}`)
    if (result.declined !== null) {
      return fail(
        `Stripe ha rechazado el cobro de ${formatCents(service.monthlyPrice)} a ${service.customerEmail}.`,
        `Código: ${result.declined}`,
      )
    }
    return ok(`Cobrados ${formatCents(result.charged)} a ${service.customerEmail}.`)
  })
}

export async function refundPayment(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("reembolsar el cobro", async ({ deps, actor }) => {
    const paymentId = requiredText(form, "paymentId", "el cobro")
    const payment = await deps.store.getPayment(paymentId)
    if (!payment) return fail("El cobro no existe.")

    const confirmedAmount = requiredEuroToCents(
      requiredText(form, "confirmedAmount", "el importe confirmado"),
      "el importe confirmado",
    )
    if (confirmedAmount !== payment.amount) {
      return fail(
        `El importe confirmado (${formatCents(confirmedAmount)}) no coincide con el del cobro ` +
          `(${formatCents(payment.amount)}). Recarga la página.`,
      )
    }
    if (payment.refundedAmount >= payment.amount) {
      return fail("Este cobro ya está reembolsado por completo.")
    }
    if (!payment.orderId) {
      return fail(
        "El cobro no está asociado a un pedido, así que el reembolso no puede pasar por " +
          "`refundOrder`. Hazlo desde la factura o desde Stripe y anótalo aquí.",
      )
    }

    const reason = requiredText(form, "reason", "el motivo del reembolso")
    const id = correlationId("payment-refund")
    const result = await deps.billing.refundOrder(payment.orderId, reason)
    await deps.audit(actor, {
      entity: "payment",
      entityId: paymentId,
      action: "payment.refunded",
      before: { refundedAmount: payment.refundedAmount },
      after: { refundedAmount: result.refunded },
      context: {
        reason,
        orderId: payment.orderId,
        amount: payment.amount,
        customerId: payment.customerId,
        customerEmail: payment.customerEmail,
        stripePaymentIntentId: payment.stripePaymentIntentId,
      },
      correlationId: id,
    })
    deps.cache.revalidate("/admin/pagos")
    return ok(`Reembolsados ${formatCents(result.refunded)} a ${payment.customerEmail}.`)
  })
}

// ─── flags ───────────────────────────────────────────────────────────────────

export async function setFeatureFlag(
  _previous: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  return withAdmin("cambiar el flag", async ({ deps, actor }) => {
    const key = requiredText(form, "key", "el flag")
    if (!isAdminFlagKey(key)) {
      return fail(`«${key}» no es uno de los flags del panel: ${ADMIN_FLAG_KEYS.join(", ")}.`)
    }
    const confirmedKey = requiredText(form, "confirmedKey", "la confirmación")
    if (confirmedKey !== key) {
      return fail("La confirmación no coincide con el flag que estás cambiando.")
    }

    const enabled = flag(form, "enabled")
    const definition = FLAG_DEFINITIONS.find((candidate) => candidate.key === key)
    const current = await deps.store.getFlag(key)

    await deps.store.setFlag(key, enabled, definition?.label ?? null)
    await deps.audit(actor, {
      entity: "feature_flag",
      entityId: key,
      action: enabled ? "flag.enabled" : "flag.disabled",
      before: { enabled: current?.enabled ?? false },
      after: { enabled },
      context: {
        consequence: definition?.consequence ?? null,
        envBacked: definition?.envBacked ?? false,
        ovhOrdersEnabledInEnv: deps.safety.ovhOrdersEnabledInEnv(),
      },
      correlationId: correlationId("flag"),
    })
    deps.cache.revalidate("/admin/flags")

    if (key === "ovh_orders") {
      const envEnabled = deps.safety.ovhOrdersEnabledInEnv()
      return ok(
        `Flag ${key}: ${enabled ? "activado" : "desactivado"}. En vigor manda ` +
          `OVH_ORDERS_ENABLED, que ahora está en ${envEnabled ? "true" : "false"}.`,
      )
    }
    return ok(
      `Flag ${key}: ${enabled ? "activado" : "desactivado"}. Efecto: ${
        enabled ? "la función vuelve a estar disponible" : definition?.consequence ?? "—"
      }.`,
    )
  })
}
