import {
  DomainError,
  TERM_MONTHS,
  assertServiceTransition,
  canReactivate,
  dunningSchedule,
  isDomainError,
  nextDueDate,
  pendingStep,
  type Cents,
  type DunningStage,
  type DunningStep,
} from "@ola/core"
import type { DunningAction, PaymentFailedData, PaymentSucceededData } from "../client"
import type { StepTools } from "../steps"
import type { CustomerRecord, InvoiceRecord, JobDeps, ServiceRecord } from "../ports"

/**
 * Renewals and dunning.
 *
 * The calendar itself lives in `@ola/core` (`dunningSchedule` / `pendingStep`): this file
 * only executes one step at a time and records it in `services.dunningCompleted` before
 * anything else, so a retry never charges, suspends or terminates twice.
 *
 * This layer NEVER talks to Stripe. A charge is a request to the billing layer
 * (`ola/service.charge.requested`) and comes back as `ola/payment.succeeded` or
 * `ola/payment.failed`.
 */

const WHMCS_GATEWAY = "stripe"

/** Statuses whose renewal calendar we still run. */
const DUNNABLE: readonly ServiceRecord["status"][] = ["active", "stopped", "suspended"]

export interface DunningDispatch {
  serviceId: string
  stage: DunningStage
  action: DunningAction
  dueAt: string
}

function cycleAmount(service: ServiceRecord): Cents {
  return service.monthlyPrice * TERM_MONTHS[service.term]
}

/** Dates of the current dunning cycle, for the emails. */
function calendarOf(dueAt: Date): {
  chargeDate: Date
  retryDate: Date
  suspendDate: Date
  deletionDate: Date
} {
  const steps = dunningSchedule(dueAt)
  const at = (stage: DunningStage): Date =>
    steps.find((step) => step.stage === stage)?.at ?? dueAt
  return {
    chargeDate: at("charging"),
    retryDate: at("retry_1"),
    suspendDate: at("suspended"),
    deletionDate: at("terminating"),
  }
}

/** The customer's own label for the server. An OVH service name is never shown. */
function serverLabel(service: ServiceRecord): string {
  return service.displayName ?? "tu servidor"
}

function invoiceRef(invoice: { number: string | null; whmcsInvoiceId: number } | null): string {
  if (!invoice) return "pendiente"
  return invoice.number ?? `#${invoice.whmcsInvoiceId}`
}

function attemptOf(stage: DunningStage): number {
  if (stage === "retry_1") return 1
  if (stage === "retry_2") return 2
  return 0
}

function technicalDetail(error: unknown): string {
  if (isDomainError(error)) return error.detail ?? error.code
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

function mentionsAlreadyDone(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return message.includes("already") || message.includes("duplicate")
}

/* -------------------------------------------------------------------------- */
/* the daily scan                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Finds every service with a dunning step due and returns the events to emit.
 *
 * A step is dispatched once: either it is already in `dunningCompleted` (it ran) or it is
 * the current `dunningStage` (it was dispatched and is being handled).
 */
export async function scanDunning(deps: JobDeps, now: Date): Promise<readonly DunningDispatch[]> {
  const services = await deps.db.listServicesForDunning()
  const dispatches: DunningDispatch[] = []

  for (const service of services) {
    if (!DUNNABLE.includes(service.status)) continue
    if (service.nextDueAt === null) continue
    if (!service.autoRenew && service.dunningStage === "scheduled") continue

    const step = pendingStep(service.nextDueAt, now, service.dunningCompleted)
    if (!step) continue
    if (service.dunningStage === step.stage) continue

    dispatches.push({
      serviceId: service.id,
      stage: step.stage,
      action: step.action,
      dueAt: step.at.toISOString(),
    })
  }

  return dispatches
}

/** Emits one `ola/service.dunning.step` per due step. */
export async function dispatchDunning(
  deps: JobDeps,
  now: Date,
  correlationId: string,
): Promise<readonly DunningDispatch[]> {
  const dispatches = await scanDunning(deps, now)
  const log = deps.log(correlationId, { job: "renewals" })
  for (const dispatch of dispatches) {
    await deps.events.send("ola/service.dunning.step", { ...dispatch, correlationId })
    log.info({ ...dispatch }, "dunning step dispatched")
  }
  return dispatches
}

/* -------------------------------------------------------------------------- */
/* one dunning step                                                           */
/* -------------------------------------------------------------------------- */

export interface DunningStepInput {
  serviceId: string
  stage: DunningStage
  action: DunningAction
  dueAt: string
  correlationId: string
}

export type DunningOutcome =
  | { status: "done"; stage: DunningStage }
  | { status: "skipped"; reason: string }
  | { status: "failed"; detail: string }

export async function runDunningStep(
  deps: JobDeps,
  step: StepTools,
  input: DunningStepInput,
): Promise<DunningOutcome> {
  const log = deps.log(input.correlationId, {
    job: "dunning",
    serviceId: input.serviceId,
    stage: input.stage,
  })

  const service = await deps.db.getService(input.serviceId)
  if (!service) return { status: "skipped", reason: "service_not_found" }
  if (service.status === "terminated") return { status: "skipped", reason: "terminated" }
  if (service.dunningCompleted.includes(input.stage)) {
    return { status: "skipped", reason: "stage_already_completed" }
  }

  const customer = await deps.db.getCustomer(service.customerId)
  if (!customer) return { status: "skipped", reason: "customer_not_found" }

  const scheduled: DunningStep | undefined = service.nextDueAt
    ? dunningSchedule(service.nextDueAt).find((candidate) => candidate.stage === input.stage)
    : undefined

  try {
    switch (input.action) {
      case "issue_invoice":
        await step.run(`issue-invoice-${input.stage}`, () =>
          issueRenewalInvoice(deps, service, customer, input),
        )
        break
      case "charge":
      case "retry_charge":
        await step.run(`request-charge-${input.stage}`, () =>
          requestCharge(deps, service, customer, input, scheduled?.email ?? null),
        )
        break
      case "suspend":
        await step.run(`suspend-${input.stage}`, () => suspendService(deps, service, customer, input))
        break
      case "terminate":
        await step.run(`terminate-${input.stage}`, () =>
          terminateService(deps, service, customer, input),
        )
        break
    }
  } catch (error) {
    const detail = technicalDetail(error)
    log.error({ error: detail }, "dunning step failed")
    await deps.alerts.raise({
      severity: "critical",
      title: `Paso de dunning fallido (${input.stage})`,
      entity: "service",
      entityId: service.id,
      detail,
      correlationId: input.correlationId,
    })
    return { status: "failed", detail }
  }

  // Persisted last and always: the stage is only "done" once its action succeeded.
  await deps.db.appendDunningStage(service.id, input.stage)
  await deps.db.updateService(service.id, { dunningStage: input.stage })
  log.info({ action: input.action }, "dunning step completed")
  return { status: "done", stage: input.stage }
}

/* -------------------------------------------------------------------------- */
/* T-7 — issue the invoice                                                    */
/* -------------------------------------------------------------------------- */

async function sendRenewalUpcoming(
  deps: JobDeps,
  service: ServiceRecord,
  customer: CustomerRecord,
  input: DunningStepInput,
  invoice: InvoiceRecord,
  amount: Cents,
  dueAt: Date,
): Promise<void> {
  await deps.email.send({
    to: customer.email,
    customerId: customer.id,
    correlationId: input.correlationId,
    message: {
      template: "renewal-upcoming",
      props: {
        name: customer.legalName ?? undefined,
        serviceName: serverLabel(service),
        invoiceRef: invoiceRef(invoice),
        amountCents: amount,
        chargeDate: calendarOf(dueAt).chargeDate,
        invoiceUrl: `${deps.customerAreaUrl}/facturas/${invoice.id}`,
        customerAreaUrl: deps.customerAreaUrl,
      },
    },
  })
}

async function issueRenewalInvoice(
  deps: JobDeps,
  service: ServiceRecord,
  customer: CustomerRecord,
  input: DunningStepInput,
): Promise<null> {
  if (customer.whmcsClientId === null) {
    throw new DomainError("billing_unavailable", {
      detail: `customer ${customer.id} has no WHMCS client id`,
    })
  }
  const amount = cycleAmount(service)
  const dueAt = service.nextDueAt ?? new Date(input.dueAt)

  // An invoice for this cycle may already exist from an interrupted run.
  const existing = await deps.db.findLatestUnpaidInvoiceForService(service.id)
  if (existing && existing.total === amount) {
    await sendRenewalUpcoming(deps, service, customer, input, existing, amount, dueAt)
    return null
  }

  const created = await deps.whmcs().createInvoice({
    clientId: customer.whmcsClientId,
    status: "Unpaid",
    paymentMethod: WHMCS_GATEWAY,
    dueDate: dueAt,
    sendInvoice: false,
    lines: [
      {
        description: `Renovación ${service.displayName ?? "servidor VPS"} (${
          service.term === "P12M" ? "12 meses" : "1 mes"
        })`,
        amount,
        taxed: true,
      },
    ],
  })

  const invoice = await deps.db.upsertInvoice({
    customerId: customer.id,
    serviceId: service.id,
    whmcsInvoiceId: created.invoiceId,
    status: "unpaid",
    subtotal: amount,
    total: amount,
    dueAt,
  })

  await sendRenewalUpcoming(deps, service, customer, input, invoice, amount, dueAt)
  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "renewal.invoice.issued",
    diff: { whmcsInvoiceId: created.invoiceId, invoiceId: invoice.id, amount },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* T-0 / T+1 / T+3 — ask billing for the charge                               */
/* -------------------------------------------------------------------------- */

async function requestCharge(
  deps: JobDeps,
  service: ServiceRecord,
  customer: CustomerRecord,
  input: DunningStepInput,
  email: DunningStep["email"],
): Promise<null> {
  const invoice = await deps.db.findLatestUnpaidInvoiceForService(service.id)
  const amount = invoice?.total ?? cycleAmount(service)

  await deps.events.send("ola/service.charge.requested", {
    serviceId: service.id,
    customerId: customer.id,
    invoiceId: invoice?.id,
    whmcsInvoiceId: invoice?.whmcsInvoiceId,
    amountCents: amount,
    attempt: attemptOf(input.stage),
    stage: input.stage,
    correlationId: input.correlationId,
  })

  // The calendar owns the customer email: `payment_failed` on the retry steps only.
  if (email === "payment_failed") {
    const dates = calendarOf(service.nextDueAt ?? new Date(input.dueAt))
    await deps.email.send({
      to: customer.email,
      customerId: customer.id,
      correlationId: input.correlationId,
      message: {
        template: "payment-failed",
        props: {
          name: customer.legalName ?? undefined,
          serviceName: serverLabel(service),
          invoiceRef: invoiceRef(invoice),
          amountCents: amount,
          retryDate: input.stage === "retry_1" ? dates.suspendDate : dates.retryDate,
          suspendDate: dates.suspendDate,
          deletionDate: dates.deletionDate,
          updateCardUrl: `${deps.customerAreaUrl}/facturacion/metodos-de-pago`,
          customerAreaUrl: deps.customerAreaUrl,
        },
      },
    })
  }

  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "renewal.charge.requested",
    diff: { amount, attempt: attemptOf(input.stage), stage: input.stage },
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* T+3 — suspend                                                              */
/* -------------------------------------------------------------------------- */

async function suspendService(
  deps: JobDeps,
  service: ServiceRecord,
  customer: CustomerRecord,
  input: DunningStepInput,
): Promise<null> {
  if (service.ovhServiceName) {
    const task = await deps.ovh().stop(service.ovhServiceName)
    await deps.db.recordAction({
      serviceId: service.id,
      type: "dunning_suspend",
      status: "running",
      ovhTaskId: task.id,
    })
  }

  if (service.status !== "suspended") {
    assertServiceTransition(service.status, "suspended")
    await deps.db.updateService(service.id, { status: "suspended", suspendedAt: deps.now() })
  }

  if (service.whmcsServiceId !== null) {
    await deps.whmcs().updateService({ serviceId: service.whmcsServiceId, status: "Suspended" })
  }

  const suspendInvoice = await deps.db.findLatestUnpaidInvoiceForService(service.id)
  const suspendDates = calendarOf(service.nextDueAt ?? new Date(input.dueAt))
  await deps.email.send({
    to: customer.email,
    customerId: customer.id,
    correlationId: input.correlationId,
    message: {
      template: "service-suspended",
      props: {
        name: customer.legalName ?? undefined,
        serviceName: serverLabel(service),
        invoiceRef: invoiceRef(suspendInvoice),
        amountCents: suspendInvoice?.total ?? cycleAmount(service),
        suspendedAt: deps.now(),
        deletionDate: suspendDates.deletionDate,
        payUrl: `${deps.customerAreaUrl}/facturas`,
        customerAreaUrl: deps.customerAreaUrl,
      },
    },
  })
  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "service.suspended",
    diff: { reason: "unpaid", stage: input.stage },
    correlationId: input.correlationId,
  })
  await deps.alerts.raise({
    severity: "warning",
    title: "Servidor suspendido por impago",
    entity: "service",
    entityId: service.id,
    detail: `stage=${input.stage} amount=${cycleAmount(service)}`,
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* T+10 — mark for deletion at expiry                                         */
/* -------------------------------------------------------------------------- */

async function terminateService(
  deps: JobDeps,
  service: ServiceRecord,
  customer: CustomerRecord,
  input: DunningStepInput,
): Promise<null> {
  if (service.ovhServiceName) {
    // Not a deletion: OVH stops renewing and removes the VPS when it expires.
    await deps.ovh().updateServiceInfos(service.ovhServiceName, {
      renew: { automatic: false, deleteAtExpiration: true },
    })
  }

  if (service.status !== "terminating") {
    assertServiceTransition(service.status, "terminating")
    await deps.db.updateService(service.id, { status: "terminating", autoRenew: false })
  }

  const pending = await deps.db.findLatestUnpaidInvoiceForService(service.id)
  await deps.email.send({
    to: customer.email,
    customerId: customer.id,
    correlationId: input.correlationId,
    message: {
      template: "service-terminating",
      props: {
        name: customer.legalName ?? undefined,
        serviceName: serverLabel(service),
        invoiceRef: pending ? invoiceRef(pending) : undefined,
        amountCents: pending?.total,
        deletionDate: service.ovhExpiresAt ?? calendarOf(service.nextDueAt ?? new Date(input.dueAt)).deletionDate,
        payUrl: `${deps.customerAreaUrl}/facturas`,
        customerAreaUrl: deps.customerAreaUrl,
      },
    },
  })
  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "service.terminating",
    diff: { reason: "unpaid", stage: input.stage },
    correlationId: input.correlationId,
  })
  await deps.alerts.raise({
    severity: "critical",
    title: "Servidor marcado para borrado por impago",
    entity: "service",
    entityId: service.id,
    detail: `stage=${input.stage} ovhServiceName=${service.ovhServiceName ?? "null"}`,
    correlationId: input.correlationId,
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* payment events from the billing layer                                      */
/* -------------------------------------------------------------------------- */

export type PaymentOutcome =
  | { status: "reactivated"; serviceId: string }
  | { status: "renewed"; serviceId: string }
  | { status: "recorded" }
  | { status: "skipped"; reason: string }

/**
 * A renewal was paid — by card off-session, or by hand inside WHMCS (see the WHMCS
 * webhook, which emits the same event). Registers it, moves the due date and brings a
 * suspended server back.
 */
export async function handlePaymentSucceeded(
  deps: JobDeps,
  step: StepTools,
  data: PaymentSucceededData,
): Promise<PaymentOutcome> {
  const correlationId = data.correlationId ?? `payment-${data.stripePaymentIntentId}`
  const log = deps.log(correlationId, { job: "payment-succeeded" })
  const paidAt = data.paidAt ? new Date(data.paidAt) : deps.now()

  const invoice =
    (data.invoiceId ? await deps.db.findInvoice(data.invoiceId) : null) ??
    (data.whmcsInvoiceId ? await deps.db.findInvoiceByWhmcsId(data.whmcsInvoiceId) : null)

  if (invoice && invoice.status !== "paid") {
    await step.run("mark-invoice-paid", async () => {
      await deps.db.updateInvoice(invoice.id, { status: "paid", paidAt })
      return null
    })
  }

  const serviceId = data.serviceId ?? invoice?.serviceId ?? null
  if (serviceId === null) {
    log.info({}, "payment without a service; nothing to renew")
    return { status: "recorded" }
  }

  const service = await deps.db.getService(serviceId)
  if (!service) return { status: "skipped", reason: "service_not_found" }

  const whmcsInvoiceId = data.whmcsInvoiceId ?? invoice?.whmcsInvoiceId ?? null
  // A payment taken inside WHMCS is already on its books; registering it again would be
  // a duplicate transaction.
  if (whmcsInvoiceId !== null && data.amountCents > 0 && data.source !== "whmcs") {
    await step.run("whmcs-record-payment", async () => {
      try {
        await deps.whmcs().recordPayment({
          invoiceId: whmcsInvoiceId,
          amount: data.amountCents,
          transactionId: data.stripePaymentIntentId,
          gateway: WHMCS_GATEWAY,
          date: paidAt,
        })
      } catch (error) {
        if (!mentionsAlreadyDone(error)) throw error
        log.warn({ whmcsInvoiceId }, "payment already registered in WHMCS")
      }
      return null
    })
  }

  const renewed = await step.run("advance-due-date", async () => {
    const months = TERM_MONTHS[service.term]
    const due = nextDueDate(service.nextDueAt ?? paidAt, months)
    await deps.db.updateService(service.id, { nextDueAt: due, lastSyncedAt: deps.now() })
    await deps.db.resetDunning(service.id, "scheduled")
    if (service.whmcsServiceId !== null) {
      await deps.whmcs().updateService({ serviceId: service.whmcsServiceId, nextDueDate: due })
    }
    await deps.audit.record({
      entity: "service",
      entityId: service.id,
      action: "renewal.paid",
      diff: {
        nextDueAt: { from: service.nextDueAt?.toISOString() ?? null, to: due.toISOString() },
        amount: data.amountCents,
      },
      correlationId,
    })
    return due.toISOString()
  })
  log.info({ nextDueAt: renewed }, "renewal registered")

  if (service.status === "suspended") {
    if (!canReactivate(service.dunningStage)) {
      await deps.alerts.raise({
        severity: "critical",
        title: "Pago recibido sobre un servidor ya en borrado",
        entity: "service",
        entityId: service.id,
        detail: `dunningStage=${service.dunningStage}; requires manual recovery at OVH`,
        correlationId,
      })
      return { status: "skipped", reason: "not_reactivatable" }
    }
    await step.run("reactivate-service", () => reactivate(deps, service, correlationId))
    return { status: "reactivated", serviceId: service.id }
  }

  if (service.status === "terminating") {
    await deps.alerts.raise({
      severity: "critical",
      title: "Pago recibido sobre un servidor en terminación",
      entity: "service",
      entityId: service.id,
      detail: "the OVH service is flagged for deletion at expiry; an admin must undo it",
      correlationId,
    })
    return { status: "skipped", reason: "terminating" }
  }

  return { status: "renewed", serviceId: service.id }
}

/** Starts the VPS again and returns the service to `active`. */
async function reactivate(
  deps: JobDeps,
  service: ServiceRecord,
  correlationId: string,
): Promise<null> {
  if (service.ovhServiceName) {
    const task = await deps.ovh().start(service.ovhServiceName)
    await deps.db.recordAction({
      serviceId: service.id,
      type: "dunning_reactivate",
      status: "running",
      ovhTaskId: task.id,
    })
  }
  assertServiceTransition(service.status, "active")
  await deps.db.updateService(service.id, { status: "active", suspendedAt: null })
  if (service.whmcsServiceId !== null) {
    await deps.whmcs().updateService({ serviceId: service.whmcsServiceId, status: "Active" })
  }
  await deps.audit.record({
    entity: "service",
    entityId: service.id,
    action: "service.reactivated",
    diff: { status: { from: service.status, to: "active" } },
    correlationId,
  })
  return null
}

/**
 * A charge failed. The calendar, not this handler, decides what happens next: the retry
 * and suspension steps are already on `services.nextDueAt`'s schedule.
 */
export async function handlePaymentFailed(
  deps: JobDeps,
  data: PaymentFailedData,
): Promise<{ status: "recorded" | "skipped" }> {
  const correlationId = data.correlationId ?? `payment-failed-${data.customerId}`
  if (!data.serviceId) return { status: "skipped" }

  await deps.audit.record({
    entity: "service",
    entityId: data.serviceId,
    action: "renewal.charge.failed",
    diff: {
      amount: data.amountCents,
      failureCode: data.failureCode ?? null,
      failureMessage: data.failureMessage ?? null,
    },
    correlationId,
  })
  await deps.alerts.raise({
    severity: "warning",
    title: "Cobro de renovación rechazado",
    entity: "service",
    entityId: data.serviceId,
    detail: `code=${data.failureCode ?? "unknown"} amount=${data.amountCents}`,
    correlationId,
  })
  return { status: "recorded" }
}
