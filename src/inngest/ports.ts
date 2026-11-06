import { z } from "zod"
import type {
  Cents,
  DunningStage,
  OrderKind,
  OrderStatus,
  ProvisionStep,
  ServiceStatus,
  Term,
} from "@ola/core"
import type { EmailMessage } from "@ola/email"
import type { OvhClient } from "@ola/ovh"
import type { WhmcsClient } from "@ola/whmcs"
import type { AlertSeverity, OlaEvents } from "./client"

/**
 * The ports the background jobs run against.
 *
 * Nothing in `src/inngest/**` imports a database client, an HTTP client or an email
 * provider directly: every job receives a `JobDeps` and is therefore unit-testable with
 * fakes and without Postgres, OVH, WHMCS or an Inngest key.
 *
 * `OvhJobs` and `WhmcsJobs` are `Pick`s of the real `OvhClient` / `WhmcsClient` ports, so
 * the jobs can only call routes those packages actually expose and the two interfaces can
 * never drift from `packages/ovh` and `packages/whmcs`.
 */

/** Exactly the OVH routes the jobs layer is allowed to call. */
export type OvhJobs = Pick<
  OvhClient,
  | "fetchPublicCatalog"
  | "createCart"
  | "assignCart"
  | "listCartVpsOffers"
  | "addVpsToCart"
  | "configureItem"
  | "listCartOptions"
  | "addOption"
  | "getCheckoutPreview"
  | "checkout"
  | "getOrderStatus"
  | "getOrder"
  | "listVps"
  | "getVps"
  | "getVpsIps"
  | "getServiceInfos"
  | "updateServiceInfos"
  | "start"
  | "stop"
  | "getCurrentImage"
  | "rebuild"
  | "getTask"
>

/** Exactly the WHMCS operations the jobs layer is allowed to call. */
export type WhmcsJobs = Pick<
  WhmcsClient,
  | "findClientByEmail"
  | "createClient"
  | "createOrder"
  | "acceptOrder"
  | "recordPayment"
  | "createInvoice"
  | "getInvoice"
  | "listInvoices"
  | "updateService"
  | "listServices"
>

/* -------------------------------------------------------------------------- */
/* order payload stored in `orders.items`                                     */
/* -------------------------------------------------------------------------- */

/**
 * `orders.items` is the frozen quote: the checkout layer writes it and the jobs never
 * recompute a price from the catalog (schema.ts: "Never recomputed"). This schema is the
 * contract between the checkout layer and the provisioning job.
 */
export const orderItemsSchema = z
  .object({
    planCode: z.string().min(1),
    datacenter: z.string().min(1),
    operatingSystem: z.string().min(1),
    /**
     * Every OVH option plan code to add to the cart, mandatory families included,
     * exactly as `buildQuote` resolved them at order time.
     */
    addonCodes: z.array(z.string()).default([]),
    /** Customer-chosen label for the server. Ours only, never pushed to OVH. */
    displayName: z.string().optional(),
    /** Price locked at order time, cents per month. */
    monthlyPrice: z.number().int().nonnegative().optional(),
    /** OVH image id for the first boot. When absent it is resolved from the OS name. */
    imageId: z.string().optional(),
    /** Customer SSH key id to install on first boot. */
    sshKeyId: z.string().optional(),
    /** WHMCS product setup resolved at order time (see `buildConfigOptions`). */
    whmcs: z
      .object({
        productId: z.number().int().positive(),
        configOptions: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
        customFields: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
        /** WHMCS requires a non-empty "domain" per line; we send our own label. */
        domainLabel: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

export type OrderItems = z.infer<typeof orderItemsSchema>

/* -------------------------------------------------------------------------- */
/* database records                                                           */
/* -------------------------------------------------------------------------- */

export interface OrderRecord {
  id: string
  customerId: string
  kind: OrderKind
  status: OrderStatus
  serviceId: string | null
  items: Record<string, unknown>
  term: Term
  subtotal: Cents
  tax: Cents
  creditApplied: Cents
  total: Cents
  /** What we expect to pay OVH for one cycle. Checked with zero tolerance before checkout. */
  expectedCost: Cents
  stripePaymentIntentId: string | null
  whmcsOrderId: number | null
  whmcsInvoiceId: number | null
  ovhCartId: string | null
  ovhOrderId: number | null
  completedSteps: readonly ProvisionStep[]
  error: string | null
  errorCode: string | null
  paidAt: Date | null
  deliveredAt: Date | null
}

export interface OrderPatch {
  status?: OrderStatus
  serviceId?: string | null
  whmcsOrderId?: number | null
  whmcsInvoiceId?: number | null
  ovhCartId?: string | null
  ovhOrderId?: number | null
  error?: string | null
  errorCode?: string | null
  deliveredAt?: Date | null
}

export interface CustomerRecord {
  id: string
  userId: string
  /** Login email, from `users`. The only address we ever write to WHMCS. */
  email: string
  kind: "company" | "individual"
  legalName: string | null
  taxId: string | null
  taxIdValidated: boolean
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  phone: string | null
  whmcsClientId: number | null
  stripeCustomerId: string | null
  status: string
}

export interface CustomerProfilePatch {
  legalName?: string | null
  taxId?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
  phone?: string | null
}

export interface SshKeyRecord {
  id: string
  name: string
  publicKey: string
  fingerprint: string
}

export interface PlanRecord {
  id: string
  ovhPlanCode: string
  slug: string
  name: string
  costMonth: Cents
  cost12m: Cents
  trueCostMonth: Cents
  trueCost12m: Cents
  priceMonth: Cents | null
  price12m: Cents | null
  /** Basis points, e.g. 7500 = 75 %. */
  margin: number
  active: boolean
}

export interface AddonRecord {
  id: string
  ovhPlanCode: string
  family: string
  name: string
  costMonth: Cents
  cost12m: Cents
  priceMonth: Cents | null
  price12m: Cents | null
  margin: number
  active: boolean
}

export interface CostPatch {
  costMonth: Cents
  cost12m: Cents
  trueCostMonth?: Cents
  trueCost12m?: Cents
}

export interface ServiceRecord {
  id: string
  customerId: string
  planId: string
  orderId: string | null
  displayName: string | null
  ovhServiceName: string | null
  datacenter: string
  os: string
  ipv4: string | null
  ipv6: string | null
  status: ServiceStatus
  term: Term
  monthlyPrice: Cents
  nextDueAt: Date | null
  autoRenew: boolean
  dunningStage: DunningStage
  dunningCompleted: readonly DunningStage[]
  whmcsServiceId: number | null
  ovhExpiresAt: Date | null
  suspendedAt: Date | null
  terminatedAt: Date | null
  lastSyncedAt: Date | null
}

export interface CreateServiceInput {
  customerId: string
  planId: string
  orderId: string
  displayName: string | null
  ovhServiceName: string
  datacenter: string
  os: string
  ipv4: string | null
  ipv6: string | null
  term: Term
  monthlyPrice: Cents
  status: ServiceStatus
}

export interface ServicePatch {
  displayName?: string | null
  ovhServiceName?: string | null
  ipv4?: string | null
  ipv6?: string | null
  status?: ServiceStatus
  monthlyPrice?: Cents
  nextDueAt?: Date | null
  autoRenew?: boolean
  dunningStage?: DunningStage
  whmcsServiceId?: number | null
  ovhExpiresAt?: Date | null
  suspendedAt?: Date | null
  terminatedAt?: Date | null
  lastSyncedAt?: Date | null
}

export interface InvoiceRecord {
  id: string
  customerId: string
  serviceId: string | null
  orderId: string | null
  whmcsInvoiceId: number
  number: string | null
  status: "unpaid" | "paid" | "cancelled" | "refunded"
  subtotal: Cents
  tax: Cents
  credit: Cents
  total: Cents
  dueAt: Date | null
  paidAt: Date | null
}

export interface UpsertInvoiceInput {
  customerId: string
  serviceId?: string | null
  orderId?: string | null
  whmcsInvoiceId: number
  number?: string | null
  status?: InvoiceRecord["status"]
  subtotal?: Cents
  tax?: Cents
  credit?: Cents
  total?: Cents
  dueAt?: Date | null
  paidAt?: Date | null
}

export interface CatalogSnapshotRecord {
  id: string
  fetchedAt: Date
  /** Trimmed snapshot: only our plans and their addons. */
  raw: unknown
  diff: Record<string, unknown> | null
}

export interface ActionInput {
  serviceId: string
  type: string
  status?: "queued" | "running" | "done" | "error"
  ovhTaskId?: number | null
  payload?: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string | null
}

/* -------------------------------------------------------------------------- */
/* the database port                                                          */
/* -------------------------------------------------------------------------- */

export interface JobDb {
  // orders
  getOrder(orderId: string): Promise<OrderRecord | null>
  updateOrder(orderId: string, patch: OrderPatch): Promise<void>
  /** Appends one step to `orders.completedSteps` and returns the new list. */
  markOrderStepComplete(orderId: string, step: ProvisionStep): Promise<readonly ProvisionStep[]>

  // customers
  getCustomer(customerId: string): Promise<CustomerRecord | null>
  findCustomerByWhmcsClientId(whmcsClientId: number): Promise<CustomerRecord | null>
  setCustomerWhmcsClientId(customerId: string, whmcsClientId: number): Promise<void>
  /** Mirrors a WHMCS `ClientEdit` back into our own columns. Never touches the login email. */
  updateCustomerProfile(customerId: string, patch: CustomerProfilePatch): Promise<void>
  listSshKeys(customerId: string): Promise<readonly SshKeyRecord[]>

  // catalog
  findPlanByOvhCode(ovhPlanCode: string): Promise<PlanRecord | null>
  listPlans(): Promise<readonly PlanRecord[]>
  updatePlanCosts(planId: string, costs: CostPatch): Promise<void>
  findAddonByOvhCode(ovhPlanCode: string): Promise<AddonRecord | null>
  listAddons(): Promise<readonly AddonRecord[]>
  updateAddonCosts(addonId: string, costs: CostPatch): Promise<void>
  latestCatalogSnapshot(): Promise<CatalogSnapshotRecord | null>
  insertCatalogSnapshot(input: {
    fetchedAt: Date
    raw: unknown
    diff: Record<string, unknown> | null
  }): Promise<void>

  // services
  getService(serviceId: string): Promise<ServiceRecord | null>
  findServiceByOrderId(orderId: string): Promise<ServiceRecord | null>
  findServiceByOvhName(ovhServiceName: string): Promise<ServiceRecord | null>
  createService(input: CreateServiceInput): Promise<ServiceRecord>
  updateService(serviceId: string, patch: ServicePatch): Promise<void>
  /** Appends one stage to `services.dunningCompleted` and returns the new list. */
  appendDunningStage(serviceId: string, stage: DunningStage): Promise<readonly DunningStage[]>
  /** Clears the dunning calendar for a new cycle. */
  resetDunning(serviceId: string, stage: DunningStage): Promise<void>
  /** Services with a renewal calendar that may have a step due. */
  listServicesForDunning(): Promise<readonly ServiceRecord[]>
  /** Every non-terminated service, for the hourly reconciliation. */
  listServicesForSync(): Promise<readonly ServiceRecord[]>

  // invoices
  upsertInvoice(input: UpsertInvoiceInput): Promise<InvoiceRecord>
  findInvoiceByWhmcsId(whmcsInvoiceId: number): Promise<InvoiceRecord | null>
  findInvoice(invoiceId: string): Promise<InvoiceRecord | null>
  /** Newest unpaid invoice of a service — the one a renewal charge is for. */
  findLatestUnpaidInvoiceForService(serviceId: string): Promise<InvoiceRecord | null>
  updateInvoice(
    invoiceId: string,
    patch: { status?: InvoiceRecord["status"]; paidAt?: Date | null },
  ): Promise<void>

  // operations
  recordAction(input: ActionInput): Promise<string>
  /**
   * How many audit rows already exist for one action on one entity. The provisioning job
   * uses it as the "checkout attempted" marker: the audit row is written BEFORE the OVH
   * checkout POST, so a later run can tell that the call may already have gone through.
   */
  countAuditActions(entity: string, entityId: string, action: string): Promise<number>
  /**
   * The `diff` of the newest audit row for one action on one entity, or null. The
   * provisioning job reads its own checkout marker (the VPS inventory before checkout)
   * and an admin's manual VPS assignment back through it.
   */
  latestAuditDiff(
    entity: string,
    entityId: string,
    action: string,
  ): Promise<Record<string, unknown> | null>

  // webhooks
  /** `duplicate` when `(provider, eventId)` already exists: the caller returns 200 and stops. */
  claimWebhookEvent(input: {
    provider: "stripe" | "whmcs"
    eventId: string
    eventType: string | null
    payload: Record<string, unknown>
  }): Promise<"claimed" | "duplicate">
  markWebhookProcessed(
    provider: "stripe" | "whmcs",
    eventId: string,
    error?: string | null,
  ): Promise<void>
}

/* -------------------------------------------------------------------------- */
/* email, audit, alerts, events, clock                                        */
/* -------------------------------------------------------------------------- */

/**
 * One email, as `@ola/email` types it: the template name and its own props, checked
 * together. Customer-visible Spanish copy lives in the template, never here.
 */
export interface EmailPort {
  send(input: {
    message: EmailMessage
    to: string
    customerId?: string | null
    correlationId?: string | null
  }): Promise<void>
}

export interface AuditPort {
  record(entry: {
    actorId?: string | null
    actorType?: "user" | "admin" | "system" | "webhook"
    entity: string
    entityId?: string | null
    action: string
    diff?: Record<string, unknown>
    correlationId?: string | null
  }): Promise<void>
}

export interface AlertInput {
  severity: AlertSeverity
  title: string
  entity: string
  entityId?: string | null
  detail?: string
  correlationId?: string | null
}

export interface AlertPort {
  raise(input: AlertInput): Promise<void>
}

/** Minimal event bus so the jobs and the webhook can emit without importing Inngest. */
export interface EventBus {
  send<K extends keyof OlaEvents>(name: K, data: OlaEvents[K]["data"]): Promise<void>
}

export interface LogPort {
  info(fields: Record<string, unknown>, message?: string): void
  warn(fields: Record<string, unknown>, message?: string): void
  error(fields: Record<string, unknown>, message?: string): void
}

/* -------------------------------------------------------------------------- */
/* the dependency bundle                                                      */
/* -------------------------------------------------------------------------- */

export interface JobDeps {
  db: JobDb
  ovh: () => OvhJobs
  whmcs: () => WhmcsJobs
  email: EmailPort
  audit: AuditPort
  alerts: AlertPort
  events: EventBus
  log: (correlationId: string, extra?: Record<string, unknown>) => LogPort
  /** Hard gate: throws unless `OVH_ORDERS_ENABLED` is true. Called before every checkout. */
  assertOvhOrdersEnabled: () => void
  /** `nichandle.OvhSubsidiaryEnum`, e.g. "ES". Needed by the public catalog route. */
  ovhSubsidiary: string
  /** Base URL of the customer area, for the links inside emails. */
  customerAreaUrl: string
  /** Base URL of /admin, for the links inside alerts. */
  adminUrl: string
  now: () => Date
  /** Generates the one-time root password when the customer has no SSH key. */
  generatePassword: () => string
  /** Write-once storage for that password; see `src/server/jobs/secrets.ts`. */
  storeRootPasswordOnce: (serviceId: string, password: string) => Promise<void>
}
