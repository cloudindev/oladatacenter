/**
 * The admin data port.
 *
 * Every read and write the admin panel needs, expressed as one interface. The Drizzle
 * implementation lives in `drizzle-store.ts`; the test suite passes an in-memory fake.
 * That is what makes the Server Actions testable with no Postgres anywhere near them.
 *
 * This file must stay free of `server-only`, `@ola/db` and `next/*` imports: it is
 * imported by the tests and by the Server Actions alike. Money is integer cents.
 */
import type {
  Cents,
  CreditReason,
  DunningStage,
  OrderKind,
  OrderStatus,
  ProvisionStep,
  ServiceStatus,
  Term,
} from "@ola/core"

// ─── dashboard ───────────────────────────────────────────────────────────────

/**
 * Only numbers an operator acts on. No vanity metrics: every field here has a filtered
 * list behind it and a reason to be looked at before lunch.
 */
export interface DashboardCounts {
  /** pending_payment + paid + provisioning. */
  ordersInProgress: number
  /** Paid but past the delivery SLA, computed with `deliveryState`. */
  ordersLate: number
  ordersFailed: number
  servicesSuspended: number
  servicesInReview: number
  /** Payments with a non-successful status settled today. */
  paymentsFailedToday: number
  /** Webhooks received and never processed, or processed with an error. */
  webhooksFailed: number
}

// ─── plans and addons ────────────────────────────────────────────────────────

/** One `plans` row, exactly as the pricing screen needs it. Costs included: internal view. */
export interface PlanRow {
  id: string
  ovhPlanCode: string
  slug: string
  name: string
  /** Bare plan cost per month, by term, as published by OVH. */
  cost: Record<Term, Cents>
  /** Plan cost plus mandatory addons, as stored. 0 means "not computed yet". */
  storedTrueCost: Record<Term, Cents>
  /** Manual PVP of the plan line; `null` means "use the margin rule". */
  manualPrice: Partial<Record<Term, Cents>>
  /** Margin in basis points, as stored. */
  marginBasisPoints: number
  active: boolean
  sort: number
}

export interface PlanPatch {
  priceMonth?: Cents | null
  price12m?: Cents | null
  marginBasisPoints?: number
  active?: boolean
  sort?: number
}

export interface AddonRow {
  id: string
  ovhPlanCode: string
  family: string
  name: string
  cost: Record<Term, Cents>
  manualPrice: Partial<Record<Term, Cents>>
  marginBasisPoints: number
  mandatory: boolean
  active: boolean
  sort: number
}

export interface AddonPatch {
  priceMonth?: Cents | null
  price12m?: Cents | null
  marginBasisPoints?: number
  active?: boolean
  sort?: number
}

// ─── catalog snapshots ───────────────────────────────────────────────────────

export interface SnapshotRow {
  id: string
  fetchedAt: Date
  /** Plan and addon costs extracted from the snapshot, keyed by OVH plan code. */
  costs: ReadonlyMap<string, SnapshotCost>
}

export interface SnapshotCost {
  code: string
  name: string
  kind: "plan" | "addon"
  cost: Record<Term, Cents>
}

// ─── orders ──────────────────────────────────────────────────────────────────

export interface OrderFilter {
  status?: readonly OrderStatus[]
  /** Free-text match on the customer email, the order id or a provider id. */
  query?: string
  from?: Date
  to?: Date
  limit?: number
}

export interface OrderRow {
  id: string
  customerId: string
  customerEmail: string
  kind: OrderKind
  status: OrderStatus
  term: Term
  total: Cents
  expectedCost: Cents
  completedSteps: readonly ProvisionStep[]
  ovhOrderId: number | null
  paidAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  errorCode: string | null
}

export interface OrderDetail extends OrderRow {
  serviceId: string | null
  subtotal: Cents
  tax: Cents
  creditApplied: Cents
  /** The frozen quote from `orders.items`. Never recomputed, shown raw. */
  items: Record<string, unknown>
  stripePaymentIntentId: string | null
  whmcsOrderId: number | null
  whmcsInvoiceId: number | null
  ovhCartId: string | null
  idempotencyKey: string
  /** Raw provider error. The admin panel is the one place this may be shown. */
  error: string | null
  updatedAt: Date
}

// ─── services ────────────────────────────────────────────────────────────────

export interface ServiceFilter {
  status?: readonly ServiceStatus[]
  datacenter?: string
  planId?: string
  query?: string
  limit?: number
}

export interface ServiceRow {
  id: string
  customerId: string
  customerEmail: string
  planId: string
  planName: string
  ovhPlanCode: string
  displayName: string | null
  ovhServiceName: string | null
  datacenter: string
  os: string
  ipv4: string | null
  status: ServiceStatus
  term: Term
  monthlyPrice: Cents
  nextDueAt: Date | null
  dunningStage: DunningStage
  autoRenew: boolean
  lastSyncedAt: Date | null
  createdAt: Date
}

export interface ServiceDetail extends ServiceRow {
  ipv6: string | null
  whmcsServiceId: number | null
  ovhExpiresAt: Date | null
  rescueMode: boolean
  suspendedAt: Date | null
  terminatedAt: Date | null
  dunningCompleted: readonly DunningStage[]
  orderId: string | null
}

export interface ServicePatch {
  status?: ServiceStatus
  nextDueAt?: Date | null
  autoRenew?: boolean
  suspendedAt?: Date | null
}

export interface ActionRow {
  id: string
  serviceId: string
  type: string
  status: "queued" | "running" | "done" | "error"
  ovhTaskId: number | null
  error: string | null
  createdAt: Date
  finishedAt: Date | null
}

// ─── customers ───────────────────────────────────────────────────────────────

export interface CustomerFilter {
  status?: readonly string[]
  query?: string
  limit?: number
}

export interface CustomerRow {
  id: string
  userId: string
  email: string
  kind: "company" | "individual"
  legalName: string | null
  country: string | null
  status: string
  taxIdValidated: boolean
  emailVerifiedAt: Date | null
  phoneVerifiedAt: Date | null
  firstPaidAt: Date | null
  whmcsClientId: number | null
  stripeCustomerId: string | null
  createdAt: Date
}

export interface CustomerCreditRow {
  id: string
  amount: Cents
  consumed: Cents
  reason: CreditReason
  note: string | null
  expiresAt: Date | null
  /** Fraud signals captured when the credit was granted. */
  signals: Record<string, string | null> | null
  createdAt: Date
}

export interface CustomerInvoiceRow {
  id: string
  whmcsInvoiceId: number
  number: string | null
  status: string
  total: Cents
  dueAt: Date | null
  paidAt: Date | null
}

export interface CustomerDetail extends CustomerRow {
  taxId: string | null
  phone: string | null
  riskNotes: string | null
  hasVerifiedCard: boolean
  billingComplete: boolean
  credits: readonly CustomerCreditRow[]
  services: readonly ServiceRow[]
  invoices: readonly CustomerInvoiceRow[]
}

export interface CustomerPatch {
  status?: string
  riskNotes?: string | null
}

export interface NewCredit {
  customerId: string
  amount: Cents
  reason: CreditReason
  note: string
  expiresAt: Date | null
}

// ─── payments ────────────────────────────────────────────────────────────────

export interface PaymentFilter {
  /** "failed" keeps everything that is not a settled success. */
  outcome?: "all" | "succeeded" | "failed" | "refunded" | "disputed"
  query?: string
  from?: Date
  to?: Date
  limit?: number
}

export interface PaymentRow {
  id: string
  customerId: string
  customerEmail: string
  orderId: string | null
  invoiceId: string | null
  serviceId: string | null
  /** Dunning stage of the service this payment belongs to, when there is one. */
  dunningStage: DunningStage | null
  stripePaymentIntentId: string | null
  amount: Cents
  status: string
  failureCode: string | null
  failureMessage: string | null
  refundedAmount: Cents
  settledAt: Date | null
  createdAt: Date
}

// ─── flags and settings ──────────────────────────────────────────────────────

export interface FlagRow {
  key: string
  enabled: boolean
  description: string | null
  updatedAt: Date | null
}

// ─── audit ───────────────────────────────────────────────────────────────────

export interface AuditFilter {
  entity?: string
  entityId?: string
  actorId?: string
  from?: Date
  to?: Date
  limit?: number
}

export interface AuditRow {
  id: string
  actorId: string | null
  actorType: string
  entity: string
  entityId: string | null
  action: string
  diff: Record<string, unknown> | null
  ip: string | null
  correlationId: string | null
  createdAt: Date
}

// ─── the port ────────────────────────────────────────────────────────────────

export interface AdminStore {
  dashboardCounts(now: Date): Promise<DashboardCounts>

  listPlans(): Promise<readonly PlanRow[]>
  getPlan(id: string): Promise<PlanRow | null>
  updatePlan(id: string, patch: PlanPatch): Promise<void>

  listAddons(): Promise<readonly AddonRow[]>
  getAddon(id: string): Promise<AddonRow | null>
  updateAddon(id: string, patch: AddonPatch): Promise<void>

  /** The newest snapshots, newest first. Two are enough for the diff. */
  listSnapshots(limit: number): Promise<readonly SnapshotRow[]>

  listOrders(filter: OrderFilter): Promise<readonly OrderRow[]>
  getOrder(id: string): Promise<OrderDetail | null>

  listServices(filter: ServiceFilter): Promise<readonly ServiceRow[]>
  getService(id: string): Promise<ServiceDetail | null>
  updateService(id: string, patch: ServicePatch): Promise<void>
  listServiceActions(serviceId: string, limit: number): Promise<readonly ActionRow[]>
  /** Distinct datacenters in use, for the filter. */
  listServiceDatacenters(): Promise<readonly string[]>

  listCustomers(filter: CustomerFilter): Promise<readonly CustomerRow[]>
  getCustomer(id: string): Promise<CustomerDetail | null>
  updateCustomer(id: string, patch: CustomerPatch): Promise<void>
  insertCredit(credit: NewCredit): Promise<{ id: string }>

  listPayments(filter: PaymentFilter): Promise<readonly PaymentRow[]>
  getPayment(id: string): Promise<PaymentRow | null>

  listFlags(): Promise<readonly FlagRow[]>
  getFlag(key: string): Promise<FlagRow | null>
  setFlag(key: string, enabled: boolean, description: string | null): Promise<void>

  searchAudit(filter: AuditFilter): Promise<readonly AuditRow[]>
  /**
   * True when the jobs layer wrote its `ovh.checkout.attempt` marker for this order. That
   * row is written BEFORE checkout is posted, so OVH may have taken the order even when we
   * never got `ovhOrderId` back.
   */
  hasCheckoutAttempt(orderId: string): Promise<boolean>
}
