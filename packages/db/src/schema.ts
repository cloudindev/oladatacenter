import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"
import { ulid } from "ulid"

/** Every id is a ULID: sortable by creation time, safe in URLs. */
const id = () =>
  varchar("id", { length: 26 })
    .primaryKey()
    .$defaultFn(() => ulid())

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

// ─── enums ───────────────────────────────────────────────────────────────────
export const userRole = pgEnum("user_role", ["customer", "admin"])
export const customerKind = pgEnum("customer_kind", ["company", "individual"])
export const customerStatus = pgEnum("customer_status", [
  "unverified",
  "verified",
  "review",
  "blocked",
])
export const orderKind = pgEnum("order_kind", ["new", "upgrade", "addon"])
export const orderStatus = pgEnum("order_status", [
  "draft",
  "pending_payment",
  "paid",
  "provisioning",
  "delivered",
  "delayed",
  "failed",
  "cancelled",
])
export const serviceStatus = pgEnum("service_status", [
  "provisioning",
  "active",
  "stopped",
  "suspended",
  "review",
  "terminating",
  "terminated",
])
export const billingTerm = pgEnum("billing_term", ["P1M", "P12M"])
export const invoiceStatus = pgEnum("invoice_status", ["unpaid", "paid", "cancelled", "refunded"])
export const creditReason = pgEnum("credit_reason", ["welcome", "manual", "refund"])
export const actionStatus = pgEnum("action_status", ["queued", "running", "done", "error"])
export const addonStatus = pgEnum("addon_status", ["pending", "active", "removed"])
export const webhookProvider = pgEnum("webhook_provider", ["stripe", "whmcs"])
export const actorType = pgEnum("actor_type", ["user", "admin", "system", "webhook"])
export const dunningStage = pgEnum("dunning_stage", [
  "scheduled",
  "invoiced",
  "charging",
  "retry_1",
  "retry_2",
  "suspended",
  "terminating",
  "paid",
])

// ─── auth ────────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: id(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash"),
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    role: userRole("role").notNull().default("customer"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
)

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: varchar("user_id", { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.token),
    index("sessions_user_idx").on(table.userId),
  ],
)

/** Single-use tokens: email verification, password reset, phone OTP. */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: id(),
    userId: varchar("user_id", { length: 26 }).references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 32 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    /** Destination for OTPs (phone number); null for email links. */
    target: varchar("target", { length: 320 }),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("verification_tokens_user_idx").on(table.userId),
    index("verification_tokens_hash_idx").on(table.tokenHash),
  ],
)

export const sshKeys = pgTable(
  "ssh_keys",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    publicKey: text("public_key").notNull(),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    ...timestamps,
  },
  (table) => [index("ssh_keys_customer_idx").on(table.customerId)],
)

// ─── customers and billing identity ──────────────────────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: id(),
    userId: varchar("user_id", { length: 26 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: customerKind("kind").notNull().default("company"),
    legalName: varchar("legal_name", { length: 200 }),
    taxId: varchar("tax_id", { length: 32 }),
    /** True only after a successful VIES check. Drives the reverse-charge decision. */
    taxIdValidated: boolean("tax_id_validated").notNull().default(false),
    taxIdValidatedAt: timestamp("tax_id_validated_at", { withTimezone: true }),
    addressLine1: varchar("address_line1", { length: 200 }),
    addressLine2: varchar("address_line2", { length: 200 }),
    city: varchar("city", { length: 120 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 2 }),
    phone: varchar("phone", { length: 32 }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    whmcsClientId: integer("whmcs_client_id"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
    status: customerStatus("status").notNull().default("unverified"),
    /** Set on the first non-credit payment; lifts the trial limits. */
    firstPaidAt: timestamp("first_paid_at", { withTimezone: true }),
    riskNotes: text("risk_notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("customers_user_unique").on(table.userId),
    index("customers_whmcs_idx").on(table.whmcsClientId),
    index("customers_stripe_idx").on(table.stripeCustomerId),
  ],
)

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    stripePaymentMethodId: varchar("stripe_payment_method_id", { length: 64 }).notNull(),
    /** Stripe's card fingerprint — one of the welcome-credit fraud signals. */
    fingerprint: varchar("fingerprint", { length: 64 }),
    brand: varchar("brand", { length: 24 }),
    last4: varchar("last4", { length: 4 }),
    expMonth: integer("exp_month"),
    expYear: integer("exp_year"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    isDefault: boolean("is_default").notNull().default(false),
    detachedAt: timestamp("detached_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payment_methods_stripe_unique").on(table.stripePaymentMethodId),
    index("payment_methods_customer_idx").on(table.customerId),
    index("payment_methods_fingerprint_idx").on(table.fingerprint),
  ],
)

// ─── catalog ─────────────────────────────────────────────────────────────────
export const plans = pgTable(
  "plans",
  {
    id: id(),
    ovhPlanCode: varchar("ovh_plan_code", { length: 64 }).notNull(),
    slug: varchar("slug", { length: 32 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    vcores: integer("vcores").notNull(),
    ramGb: integer("ram_gb").notNull(),
    nvmeGb: integer("nvme_gb").notNull(),
    bandwidthMbps: integer("bandwidth_mbps").notNull(),
    /** Plan cost only, cents per month, as published by OVH. */
    costMonth: integer("cost_month").notNull(),
    cost12m: integer("cost_12m").notNull(),
    /** Plan cost plus the mandatory addons OVH forces (the real floor). */
    trueCostMonth: integer("true_cost_month").notNull().default(0),
    trueCost12m: integer("true_cost_12m").notNull().default(0),
    /** Manual PVP; null means "use the margin rule". */
    priceMonth: integer("price_month"),
    price12m: integer("price_12m"),
    margin: integer("margin_basis_points").notNull().default(7500),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("plans_ovh_code_unique").on(table.ovhPlanCode)],
)

export const addons = pgTable(
  "addons",
  {
    id: id(),
    ovhPlanCode: varchar("ovh_plan_code", { length: 80 }).notNull(),
    family: varchar("family", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    costMonth: integer("cost_month").notNull(),
    cost12m: integer("cost_12m").notNull(),
    priceMonth: integer("price_month"),
    price12m: integer("price_12m"),
    margin: integer("margin_basis_points").notNull().default(5000),
    /** OVH plan codes this addon can be attached to. */
    appliesTo: jsonb("applies_to").$type<string[]>().notNull().default([]),
    mandatory: boolean("mandatory").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex("addons_ovh_code_unique").on(table.ovhPlanCode)],
)

export const ovhCatalogSnapshots = pgTable("ovh_catalog_snapshots", {
  id: id(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  /** Trimmed catalog: only our plans and their addons. The full 6 MB blob is not kept. */
  raw: jsonb("raw").notNull(),
  /** Differences against the previous snapshot, for the admin alert. */
  diff: jsonb("diff").$type<Record<string, unknown>>(),
  ...timestamps,
})

// ─── orders ──────────────────────────────────────────────────────────────────
export const orders = pgTable(
  "orders",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    kind: orderKind("kind").notNull().default("new"),
    status: orderStatus("status").notNull().default("draft"),
    /** Target service for upgrade/addon orders. */
    serviceId: varchar("service_id", { length: 26 }),
    /** Full quote at the moment of ordering: lines, codes, config. Never recomputed. */
    items: jsonb("items").$type<Record<string, unknown>>().notNull(),
    term: billingTerm("term").notNull().default("P1M"),
    subtotal: integer("subtotal").notNull(),
    tax: integer("tax").notNull().default(0),
    creditApplied: integer("credit_applied").notNull().default(0),
    total: integer("total").notNull(),
    /** What we expect to pay OVH for one cycle; checked before checkout. */
    expectedCost: integer("expected_cost").notNull().default(0),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 64 }),
    whmcsOrderId: integer("whmcs_order_id"),
    whmcsInvoiceId: integer("whmcs_invoice_id"),
    ovhCartId: varchar("ovh_cart_id", { length: 64 }),
    ovhOrderId: integer("ovh_order_id"),
    /** Provisioning steps already done, so a retry resumes instead of re-ordering. */
    completedSteps: jsonb("completed_steps").$type<string[]>().notNull().default([]),
    idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull(),
    error: text("error"),
    errorCode: varchar("error_code", { length: 40 }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("orders_idempotency_unique").on(table.idempotencyKey),
    index("orders_customer_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
    index("orders_stripe_pi_idx").on(table.stripePaymentIntentId),
  ],
)

// ─── services ────────────────────────────────────────────────────────────────
export const services = pgTable(
  "services",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    planId: varchar("plan_id", { length: 26 })
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    orderId: varchar("order_id", { length: 26 }).references(() => orders.id),
    /** Customer-chosen label. Ours only: never pushed to OVH. */
    displayName: varchar("display_name", { length: 80 }),
    /** OVH service identifier, e.g. vpsXXXXX.ovh.net. Never shown to the customer. */
    ovhServiceName: varchar("ovh_service_name", { length: 80 }),
    datacenter: varchar("datacenter", { length: 24 }).notNull(),
    os: varchar("os", { length: 80 }).notNull(),
    ipv4: varchar("ipv4", { length: 45 }),
    ipv6: varchar("ipv6", { length: 45 }),
    status: serviceStatus("status").notNull().default("provisioning"),
    term: billingTerm("term").notNull().default("P1M"),
    /** Price locked at order time, cents per month. Renewals use this. */
    monthlyPrice: integer("monthly_price").notNull(),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    autoRenew: boolean("auto_renew").notNull().default(true),
    dunningStage: dunningStage("dunning_stage").notNull().default("scheduled"),
    /** Dunning steps already executed for the current cycle. */
    dunningCompleted: jsonb("dunning_completed").$type<string[]>().notNull().default([]),
    whmcsServiceId: integer("whmcs_service_id"),
    ovhExpiresAt: timestamp("ovh_expires_at", { withTimezone: true }),
    rescueMode: boolean("rescue_mode").notNull().default(false),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("services_ovh_name_unique").on(table.ovhServiceName),
    index("services_customer_idx").on(table.customerId),
    index("services_status_idx").on(table.status),
    index("services_due_idx").on(table.nextDueAt),
  ],
)

export const serviceAddons = pgTable(
  "service_addons",
  {
    id: id(),
    serviceId: varchar("service_id", { length: 26 })
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    addonId: varchar("addon_id", { length: 26 })
      .notNull()
      .references(() => addons.id, { onDelete: "restrict" }),
    status: addonStatus("status").notNull().default("pending"),
    monthlyPrice: integer("monthly_price").notNull().default(0),
    ovhOptionRef: varchar("ovh_option_ref", { length: 120 }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("service_addons_service_idx").on(table.serviceId)],
)

// ─── money ───────────────────────────────────────────────────────────────────
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceId: varchar("service_id", { length: 26 }).references(() => services.id),
    orderId: varchar("order_id", { length: 26 }).references(() => orders.id),
    whmcsInvoiceId: integer("whmcs_invoice_id").notNull(),
    number: varchar("number", { length: 40 }),
    status: invoiceStatus("status").notNull().default("unpaid"),
    subtotal: integer("subtotal").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    credit: integer("credit").notNull().default(0),
    total: integer("total").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invoices_whmcs_unique").on(table.whmcsInvoiceId),
    index("invoices_customer_idx").on(table.customerId),
  ],
)

export const credits = pgTable(
  "credits",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    consumed: integer("consumed").notNull().default(0),
    reason: creditReason("reason").notNull(),
    note: text("note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Fraud signals captured when the credit was granted. */
    signals: jsonb("signals").$type<Record<string, string | null>>(),
    ...timestamps,
  },
  (table) => [index("credits_customer_idx").on(table.customerId)],
)

export const payments = pgTable(
  "payments",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 })
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderId: varchar("order_id", { length: 26 }).references(() => orders.id),
    invoiceId: varchar("invoice_id", { length: 26 }).references(() => invoices.id),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 64 }),
    amount: integer("amount").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    failureCode: varchar("failure_code", { length: 64 }),
    failureMessage: text("failure_message"),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("payments_customer_idx").on(table.customerId),
    index("payments_stripe_idx").on(table.stripePaymentIntentId),
  ],
)

// ─── operations ──────────────────────────────────────────────────────────────
export const actions = pgTable(
  "actions",
  {
    id: id(),
    serviceId: varchar("service_id", { length: 26 })
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 26 }).references(() => users.id),
    type: varchar("type", { length: 40 }).notNull(),
    status: actionStatus("status").notNull().default("queued"),
    ovhTaskId: integer("ovh_task_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("actions_service_idx").on(table.serviceId),
    index("actions_status_idx").on(table.status),
  ],
)

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: varchar("actor_id", { length: 26 }),
    actorType: actorType("actor_type").notNull().default("system"),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 26 }),
    action: varchar("action", { length: 60 }).notNull(),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    ip: varchar("ip", { length: 45 }),
    userAgent: text("user_agent"),
    correlationId: varchar("correlation_id", { length: 40 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_entity_idx").on(table.entity, table.entityId),
    index("audit_actor_idx").on(table.actorId),
    index("audit_created_idx").on(table.createdAt),
  ],
)

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: webhookProvider("provider").notNull(),
    eventId: varchar("event_id", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 80 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    ...timestamps,
  },
  (table) => [uniqueIndex("webhook_events_unique").on(table.provider, table.eventId)],
)

/** Operational switches the admin flips without a deploy. */
export const featureFlags = pgTable("feature_flags", {
  id: id(),
  key: varchar("key", { length: 60 }).notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  ...timestamps,
})

export const outboundEmails = pgTable(
  "outbound_emails",
  {
    id: id(),
    customerId: varchar("customer_id", { length: 26 }).references(() => customers.id),
    to: varchar("to", { length: 320 }).notNull(),
    template: varchar("template", { length: 60 }).notNull(),
    subject: text("subject").notNull(),
    providerId: varchar("provider_id", { length: 120 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
    ...timestamps,
  },
  (table) => [index("outbound_emails_customer_idx").on(table.customerId)],
)
