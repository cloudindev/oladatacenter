import { z } from "zod"
import { OVH_TASK_STATES } from "@ola/core"

/**
 * Zod schemas for every OVH payload `packages/ovh` consumes.
 *
 * Every field below was read out of the official OVH API schemas
 * (`https://eu.api.ovh.com/1.0/{vps,order,me,ip,services}.json`) on 2026-11-05 —
 * the same download that produced `docs/ovh-api-signatures.md`.
 *
 * Two deliberate rules:
 *
 *  1. Objects are parsed non-strictly (zod strips unknown keys). OVH adds fields to
 *     existing models regularly; an unknown field must never break a customer page.
 *  2. Enums are strict **only** where our own logic branches on the value and the value
 *     set is stable (task state, power state, order status, firewall/mitigation states).
 *     Descriptive enums that OVH extends with every new product generation
 *     (`vps.VpsOfferEnum`, `vps.VpsVersionEnum`, `vps.TaskTypeEnum`, …) are validated as
 *     strings, with the known values exported as constants for the UI. A new VPS range
 *     must not take the panel down.
 */

/* -------------------------------------------------------------------------- */
/* primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** OVH serialises `long`/`double` as numbers, but a handful of routes stringify them. */
const longish = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === "number" ? value : Number(value.trim())
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `not a number: ${String(value)}` })
    return z.NEVER
  }
  return parsed
})

/** An OVH `datetime` / `date`, kept as a `Date`. */
const ovhDate = z.coerce.date()

/** An OVH `datetime` kept verbatim, for values we must send back unchanged. */
const ovhDateString = z.string().min(1)

const ipString = z
  .string()
  .min(3)
  .refine((value) => value.includes(".") || value.includes(":"), {
    message: "not an IPv4/IPv6 address or block",
  })

/** Response schema for routes documented as returning `void`. */
export const voidSchema = z.unknown().transform(() => undefined)

/** Response schema for routes returning a bare JSON string. */
export const stringSchema = z.string()

export const longListSchema = z.array(longish)
export const stringListSchema = z.array(z.string())

/* -------------------------------------------------------------------------- */
/* vps — service                                                              */
/* -------------------------------------------------------------------------- */

/** `vps.VpsStateEnum` — verified 2026-11-05. */
export const VPS_STATES = [
  "backuping",
  "installing",
  "maintenance",
  "rebooting",
  "rescued",
  "running",
  "stopped",
  "stopping",
  "upgrading",
] as const
export type VpsState = (typeof VPS_STATES)[number]
export const vpsStateSchema = z.enum(VPS_STATES)

/** `vps.VpsNetbootEnum` — verified 2026-11-05. Rescue mode is set through this field. */
export const VPS_NETBOOT_MODES = ["distant", "local", "rescue"] as const
export type VpsNetbootMode = (typeof VPS_NETBOOT_MODES)[number]
export const vpsNetbootModeSchema = z.enum(VPS_NETBOOT_MODES)

/** `vps.ZoneTypeEnum` — verified 2026-11-05. */
export const VPS_ZONE_TYPES = ["localzone", "region"] as const
export type VpsZoneType = (typeof VPS_ZONE_TYPES)[number]
export const vpsZoneTypeSchema = z.enum(VPS_ZONE_TYPES)

/** `vps.VpsOfferEnum` — known values 2026-11-05. Validated as a string on purpose. */
export const KNOWN_VPS_OFFER_TYPES = [
  "beta-classic",
  "classic",
  "cloud",
  "cloudram",
  "game-classic",
  "lowlat",
  "ssd",
] as const

/** `vps.VpsOptionEnum` — verified 2026-11-05. */
export const VPS_OPTIONS = [
  "additionalDisk",
  "automatedBackup",
  "cpanel",
  "ftpbackup",
  "plesk",
  "snapshot",
  "veeam",
  "windows",
] as const
export type VpsOption = (typeof VPS_OPTIONS)[number]
export const vpsOptionSchema = z.enum(VPS_OPTIONS)
export const vpsOptionListSchema = z.array(vpsOptionSchema)

/** `vps.LockReasonEnum` — verified 2026-11-05. */
export const VPS_LOCK_REASONS = ["abuse"] as const
export const vpsLockStatusSchema = z.object({
  locked: z.boolean(),
  reason: z.string().nullish(),
})
export type VpsLockStatus = z.infer<typeof vpsLockStatusSchema>

/** `vps.Model`. `version` and `offer` stay strings: a new range adds new values. */
export const vpsModelSchema = z.object({
  name: z.string(),
  offer: z.string(),
  version: z.string(),
  vcore: longish,
  memory: longish,
  disk: longish,
  diskLocationType: z.string().nullish(),
  maximumAdditionnalIp: longish.nullish(),
  datacenter: z.array(z.string()).default([]),
  availableOptions: z.array(z.string()).default([]),
})
export type VpsModel = z.infer<typeof vpsModelSchema>
export const vpsModelListSchema = z.array(vpsModelSchema)

/**
 * `vps.VPS` / `vps.VPSWithIAM`, reduced to what the product needs.
 * `displayName` and `slaMonitoring` are nullable in the schema.
 */
export const vpsSummarySchema = z.object({
  name: z.string().min(1),
  displayName: z.string().nullish(),
  state: vpsStateSchema,
  model: vpsModelSchema,
  vcore: longish,
  memoryLimit: longish,
  netbootMode: vpsNetbootModeSchema,
  zone: z.string(),
  zoneType: vpsZoneTypeSchema.nullish(),
  offerType: z.string(),
  cluster: z.string().nullish(),
  slaMonitoring: z.boolean().nullish(),
  lockStatus: vpsLockStatusSchema.nullish(),
  monitoringIpBlocks: z.array(z.string()).default([]),
})
export type VpsSummary = z.infer<typeof vpsSummarySchema>

/**
 * `vps.TaskTypeEnum` — known values 2026-11-05. Validated as a string: OVH adds task
 * types with every feature, and an unknown type must not break task polling.
 */
export const KNOWN_VPS_TASK_TYPES = [
  "addVeeamBackupJob",
  "changeRootPassword",
  "createSnapshot",
  "deleteSnapshot",
  "deliverVm",
  "getConsoleUrl",
  "internalTask",
  "migrate",
  "openConsoleAccess",
  "provisioningAdditionalIp",
  "reOpenVm",
  "rebootVm",
  "reinstallVm",
  "removeVeeamBackup",
  "rescheduleAutoBackup",
  "restoreFullVeeamBackup",
  "restoreVeeamBackup",
  "restoreVm",
  "revertSnapshot",
  "setMonitoring",
  "setNetboot",
  "startVm",
  "stopVm",
  "upgradeVm",
] as const
export type KnownVpsTaskType = (typeof KNOWN_VPS_TASK_TYPES)[number]

/**
 * `vps.TaskStateEnum` — verified 2026-11-05, and the single source of truth is
 * `OVH_TASK_STATES` in `@ola/core` so the adapter and the state machine cannot drift.
 */
export const vpsTaskStateSchema = z.enum(OVH_TASK_STATES)

/** `vps.Task`. */
export const vpsTaskSchema = z.object({
  id: longish,
  state: vpsTaskStateSchema,
  type: z.string(),
  progress: longish,
  date: ovhDate,
})
export type VpsTask = z.infer<typeof vpsTaskSchema>

/** `vps.Image`. */
export const imageSchema = z.object({
  id: z.string(),
  name: z.string(),
})
export type Image = z.infer<typeof imageSchema>

/** `vps.Snapshot`. */
export const snapshotSchema = z.object({
  id: z.string(),
  description: z.string().default(""),
  creationDate: ovhDate,
  region: z.string().nullish(),
})
export type Snapshot = z.infer<typeof snapshotSchema>

/** `vps.BackupStateEnum` — verified 2026-11-05. */
export const BACKUP_STATES = ["disabled", "enabled"] as const
export type BackupState = (typeof BACKUP_STATES)[number]
export const backupStateSchema = z.enum(BACKUP_STATES)

/** `vps.AutomatedBackup`. */
export const automatedBackupSchema = z.object({
  state: backupStateSchema,
  serviceResourceName: z.string(),
  /** Retained restore points. Null while the option is being set up. */
  rotation: longish.nullish(),
  /** Cron-like schedule, e.g. "22:00". Null while the option is being set up. */
  schedule: z.string().nullish(),
})
export type AutomatedBackup = z.infer<typeof automatedBackupSchema>

/** `vps.RestoreStateEnum` — verified 2026-11-05. */
export const RESTORE_STATES = ["available", "restored", "restoring"] as const
export type RestoreState = (typeof RESTORE_STATES)[number]
export const restoreStateSchema = z.enum(RESTORE_STATES)

/** `vps.RestoreTypeEnum` — verified 2026-11-05. */
export const RESTORE_TYPES = ["file", "full"] as const
export type RestoreType = (typeof RESTORE_TYPES)[number]
export const restoreTypeSchema = z.enum(RESTORE_TYPES)

/**
 * Restore points are `datetime[]`. They are kept as the exact strings OVH returned,
 * because `POST /automatedBackup/restore` wants the value back byte for byte.
 */
export const restorePointListSchema = z.array(ovhDateString)

/** `vps.disk.StatisticTypeEnum` — verified 2026-11-05. */
export const DISK_STATISTIC_TYPES = ["max", "used"] as const
export type DiskStatisticType = (typeof DISK_STATISTIC_TYPES)[number]
export const diskStatisticTypeSchema = z.enum(DISK_STATISTIC_TYPES)

/** `complexType.UnitAndValue_double`, returned by `/disks/{id}/use`. */
export const diskUseSchema = z.object({
  unit: z.string(),
  value: longish,
})
export type DiskUse = z.infer<typeof diskUseSchema>

/* -------------------------------------------------------------------------- */
/* ip addresses                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `/vps/{serviceName}/ips` returns bare `ip` strings (an address or a block).
 * The adapter classifies them so callers never parse strings themselves.
 */
export interface IpAddress {
  address: string
  version: 4 | 6
  /** True for CIDR blocks such as `2001:41d0:1234:5678::/64`. */
  isBlock: boolean
}

export const ipListSchema = z.array(ipString)

export function toIpAddress(raw: string): IpAddress {
  return {
    address: raw,
    version: raw.includes(":") ? 6 : 4,
    isBlock: raw.includes("/"),
  }
}

/* -------------------------------------------------------------------------- */
/* services.Service — billing / renewal                                       */
/* -------------------------------------------------------------------------- */

/** `service.StateEnum` — verified 2026-11-05. */
export const SERVICE_INFO_STATES = [
  "autorenewInProgress",
  "expired",
  "inCreation",
  "ok",
  "pendingDebt",
  "unPaid",
] as const
export type ServiceInfoState = (typeof SERVICE_INFO_STATES)[number]
export const serviceInfoStateSchema = z.enum(SERVICE_INFO_STATES)

/** `service.RenewalTypeEnum` — verified 2026-11-05. */
export const RENEWAL_TYPES = [
  "automaticForcedProduct",
  "automaticV2012",
  "automaticV2014",
  "automaticV2016",
  "manual",
  "oneShot",
  "option",
] as const
export type RenewalType = (typeof RENEWAL_TYPES)[number]
export const renewalTypeSchema = z.enum(RENEWAL_TYPES)

/** `service.RenewType`. */
export const serviceRenewSchema = z.object({
  automatic: z.boolean(),
  deleteAtExpiration: z.boolean(),
  forced: z.boolean(),
  manualPayment: z.boolean().nullish(),
  /** Renewal period in months. */
  period: longish.nullish(),
})
export type ServiceRenew = z.infer<typeof serviceRenewSchema>

/** `services.Service`, reduced to the fields that drive renewals and termination. */
export const serviceInfosSchema = z.object({
  serviceId: longish,
  domain: z.string(),
  status: serviceInfoStateSchema,
  creation: ovhDate,
  expiration: ovhDate,
  engagedUpTo: ovhDate.nullish(),
  renewalType: renewalTypeSchema,
  renew: serviceRenewSchema.nullish(),
  canDeleteAtExpiration: z.boolean(),
  possibleRenewPeriod: z.array(longish).nullish(),
  contactAdmin: z.string().nullish(),
  contactBilling: z.string().nullish(),
  contactTech: z.string().nullish(),
})
export type ServiceInfos = z.infer<typeof serviceInfosSchema>

/** Body of `PUT /vps/{serviceName}/serviceInfos` — only the writable part of the model. */
export interface ServiceInfosUpdate {
  renew?: {
    automatic?: boolean
    deleteAtExpiration?: boolean
    forced?: boolean
    manualPayment?: boolean
    period?: number
  }
}

/** `service.TerminationReasonEnum` — verified 2026-11-05. */
export const TERMINATION_REASONS = [
  "FEATURES_DONT_SUIT_ME",
  "LACK_OF_PERFORMANCES",
  "MIGRATED_TO_ANOTHER_OVH_PRODUCT",
  "MIGRATED_TO_COMPETITOR",
  "NOT_ENOUGH_RECOGNITION",
  "NOT_NEEDED_ANYMORE",
  "NOT_RELIABLE",
  "NO_ANSWER",
  "OTHER",
  "PRODUCT_DIMENSION_DONT_SUIT_ME",
  "PRODUCT_TOOLS_DONT_SUIT_ME",
  "TOO_EXPENSIVE",
  "TOO_HARD_TO_USE",
  "UNSATIFIED_BY_CUSTOMER_SUPPORT",
] as const
export type TerminationReason = (typeof TERMINATION_REASONS)[number]

/** `service.TerminationFutureUseEnum` — verified 2026-11-05. */
export const TERMINATION_FUTURE_USES = [
  "NOT_REPLACING_SERVICE",
  "OTHER",
  "SUBSCRIBE_AN_OTHER_SERVICE",
  "SUBSCRIBE_OTHER_KIND_OF_SERVICE_WITH_COMPETITOR",
  "SUBSCRIBE_SIMILAR_SERVICE_WITH_COMPETITOR",
] as const
export type TerminationFutureUse = (typeof TERMINATION_FUTURE_USES)[number]

/** `services.confirmTermination` body. */
export interface ConfirmTerminationInput {
  token: string
  reason?: TerminationReason
  futureUse?: TerminationFutureUse
  commentary?: string
  commentaryReason?: string
  commentaryFutureUse?: string
}

/* -------------------------------------------------------------------------- */
/* ordering                                                                   */
/* -------------------------------------------------------------------------- */

/** `nichandle.OvhSubsidiaryEnum` — verified 2026-11-05. */
export const OVH_SUBSIDIARIES = [
  "CZ",
  "DE",
  "ES",
  "EU",
  "FI",
  "FR",
  "GB",
  "IE",
  "IT",
  "LT",
  "MA",
  "NL",
  "PL",
  "PT",
  "SN",
  "TN",
] as const
export type OvhSubsidiary = (typeof OVH_SUBSIDIARIES)[number]
export const ovhSubsidiarySchema = z.enum(OVH_SUBSIDIARIES)

/** `order.CurrencyCodeEnum` — known values 2026-11-05; validated as a string. */
export const KNOWN_CURRENCY_CODES = ["EUR", "GBP", "USD"] as const

/** `order.Price`. `priceInUcents` is in units of 1e-8 EUR, like the catalog. */
export const orderPriceSchema = z.object({
  currencyCode: z.string(),
  value: longish,
  text: z.string(),
  priceInUcents: longish.nullish(),
})
export type OrderPrice = z.infer<typeof orderPriceSchema>

/** `order.cart.PriceLabelEnum` — verified 2026-11-05. */
export const PRICE_LABELS = ["DISCOUNT", "FEE", "PRICE", "RENEW", "TOTAL"] as const
export type PriceLabel = (typeof PRICE_LABELS)[number]

/** `order.cart.Price`. */
export const cartPriceSchema = z.object({
  label: z.string(),
  price: orderPriceSchema,
})
export type CartPrice = z.infer<typeof cartPriceSchema>

/** `order.cart.Cart`. */
export const cartSchema = z.object({
  cartId: z.string().min(1),
  description: z.string().default(""),
  expire: ovhDate.nullish(),
  items: z.array(longish).default([]),
  readOnly: z.boolean().default(false),
})
export type Cart = z.infer<typeof cartSchema>

/** `order.cart.ItemSettings`. */
export const cartItemSettingsSchema = z.object({
  planCode: z.string().nullish(),
  pricingMode: z.string().nullish(),
  quantity: longish.nullish(),
})

/** `order.cart.Item`. */
export const cartItemSchema = z.object({
  cartId: z.string(),
  itemId: longish,
  productId: z.string(),
  offerId: z.string().nullish(),
  duration: z.string().nullish(),
  parentItemId: longish.nullish(),
  configurations: z.array(longish).nullish(),
  options: z.array(longish).default([]),
  prices: z.array(cartPriceSchema).default([]),
  settings: cartItemSettingsSchema.default({}),
})
export type CartItem = z.infer<typeof cartItemSchema>

/** `order.cart.ConfigurationItem`. */
export const cartConfigurationItemSchema = z.object({
  id: longish,
  label: z.string(),
  value: z.string(),
})
export type CartConfigurationItem = z.infer<typeof cartConfigurationItemSchema>

/** `order.cart.GenericProductPricingCapacitiesEnum` — verified 2026-11-05. */
export const PRICING_CAPACITIES = [
  "consumption",
  "detach",
  "downgrade",
  "dynamic",
  "installation",
  "renew",
  "upgrade",
] as const

/** `order.cart.GenericProductPricing`. */
export const genericProductPricingSchema = z.object({
  capacities: z.array(z.string()).default([]),
  description: z.string().default(""),
  duration: z.string(),
  /** Number of months the price covers — the same trap as in the public catalog. */
  interval: longish,
  pricingMode: z.string(),
  pricingType: z.string(),
  price: orderPriceSchema,
  priceInUcents: longish,
  minimumQuantity: longish,
  maximumQuantity: longish.nullish(),
  minimumRepeat: longish,
  maximumRepeat: longish.nullish(),
})
export type GenericProductPricing = z.infer<typeof genericProductPricingSchema>

/** `order.cart.GenericProductDefinition` — offers in `GET /order/cart/{cartId}/vps`. */
export const genericProductDefinitionSchema = z.object({
  planCode: z.string(),
  productName: z.string(),
  productType: z.string(),
  prices: z.array(genericProductPricingSchema).default([]),
})
export type GenericProductDefinition = z.infer<typeof genericProductDefinitionSchema>
export const genericProductDefinitionListSchema = z.array(genericProductDefinitionSchema)

/** `order.cart.GenericOptionDefinition` — addons for a plan. */
export const genericOptionDefinitionSchema = genericProductDefinitionSchema.extend({
  family: z.string(),
  mandatory: z.boolean(),
  exclusive: z.boolean(),
})
export type GenericOptionDefinition = z.infer<typeof genericOptionDefinitionSchema>
export const genericOptionDefinitionListSchema = z.array(genericOptionDefinitionSchema)

/** `order.cart.ConfigurationRequirements`. */
export const configurationRequirementSchema = z.object({
  label: z.string(),
  required: z.boolean(),
  type: z.string(),
  fields: z.array(z.string()).nullish(),
})
export type ConfigurationRequirement = z.infer<typeof configurationRequirementSchema>
export const configurationRequirementListSchema = z.array(configurationRequirementSchema)

/** `order.Contract`. */
export const orderContractSchema = z.object({
  name: z.string(),
  url: z.string(),
  content: z.string().default(""),
})
export type OrderContract = z.infer<typeof orderContractSchema>

/** `order.OrderDetailTypeEnum` — known values 2026-11-05; validated as a string. */
export const KNOWN_ORDER_DETAIL_TYPES = [
  "ACCESSORY",
  "CONSUMPTION",
  "CREATION",
  "DURATION",
  "GIFT",
  "INSTALLATION",
  "LICENSE",
  "OTHER",
  "QUANTITY",
  "REFUND",
  "RENEW",
  "SPECIAL",
  "SWITCH",
  "TRANSFER",
  "VOUCHER",
] as const

/** `order.OrderDetail` — one line of a cart/checkout order. */
export const orderDetailSchema = z.object({
  description: z.string(),
  domain: z.string(),
  quantity: longish,
  detailType: z.string().nullish(),
  cartItemID: longish.nullish(),
  unitPrice: orderPriceSchema,
  totalPrice: orderPriceSchema,
  originalTotalPrice: orderPriceSchema.nullish(),
  reductionTotalPrice: orderPriceSchema.nullish(),
})
export type OrderDetail = z.infer<typeof orderDetailSchema>

/** `order.OrderPrices`. */
export const orderPricesSchema = z.object({
  withTax: orderPriceSchema,
  withoutTax: orderPriceSchema,
  tax: orderPriceSchema,
  originalWithoutTax: orderPriceSchema.nullish(),
  reduction: orderPriceSchema.nullish(),
})
export type OrderPrices = z.infer<typeof orderPricesSchema>

/**
 * `order.Order` — the return type of the cart summary, the checkout preview and the
 * checkout itself. `orderId` is null until the order is actually created.
 */
export const checkoutPreviewSchema = z.object({
  orderId: longish.nullish(),
  url: z.string().nullish(),
  prices: orderPricesSchema,
  details: z.array(orderDetailSchema).default([]),
  contracts: z.array(orderContractSchema).default([]),
})
export type CheckoutPreview = z.infer<typeof checkoutPreviewSchema>

/** `billing.order.OrderStatusEnum` — verified 2026-11-05. */
export const ORDER_STATUSES_OVH = [
  "cancelled",
  "cancelling",
  "checking",
  "delivered",
  "delivering",
  "documentsRequested",
  "notPaid",
  "unknown",
] as const
export type OvhOrderStatus = (typeof ORDER_STATUSES_OVH)[number]
export const ovhOrderStatusSchema = z.enum(ORDER_STATUSES_OVH)

/** `billing.Order` — `GET /me/order/{orderId}`. */
export const orderSchema = z.object({
  orderId: longish,
  date: ovhDate.nullish(),
  expirationDate: ovhDate.nullish(),
  retractionDate: ovhDate.nullish(),
  pdfUrl: z.string().nullish(),
  url: z.string().nullish(),
  priceWithTax: orderPriceSchema,
  priceWithoutTax: orderPriceSchema,
  tax: orderPriceSchema,
})
export type Order = z.infer<typeof orderSchema>

/** `order.upgrade.OperationStatusEnum` — verified 2026-11-05. */
export const UPGRADE_OPERATION_STATUSES = [
  "CANCELLED",
  "DELAYED",
  "DOING",
  "DONE",
  "ERROR",
  "SCHEDULED",
  "TODO",
] as const
export type UpgradeOperationStatus = (typeof UPGRADE_OPERATION_STATUSES)[number]
export const upgradeOperationStatusSchema = z.enum(UPGRADE_OPERATION_STATUSES)

/** `order.upgrade.Operation`. */
export const upgradeOperationSchema = z.object({
  id: longish,
  status: upgradeOperationStatusSchema,
  type: z.string(),
  product: z
    .object({
      name: z.string(),
      description: z.string().default(""),
    })
    .nullish(),
})
export type UpgradeOperation = z.infer<typeof upgradeOperationSchema>

/** `order.upgrade.OperationAndOrder`. */
export const upgradeQuoteSchema = z.object({
  operation: upgradeOperationSchema.nullish(),
  order: checkoutPreviewSchema.nullish(),
})
export type UpgradeQuote = z.infer<typeof upgradeQuoteSchema>

/* -------------------------------------------------------------------------- */
/* network                                                                    */
/* -------------------------------------------------------------------------- */

/** `ip.ReverseIp`. */
export const reverseSchema = z.object({
  ipReverse: z.string(),
  reverse: z.string(),
})
export type Reverse = z.infer<typeof reverseSchema>

/** `ip.FirewallActionEnum` — verified 2026-11-05. */
export const FIREWALL_ACTIONS = ["deny", "permit"] as const
export type FirewallAction = (typeof FIREWALL_ACTIONS)[number]
export const firewallActionSchema = z.enum(FIREWALL_ACTIONS)

/** `ip.FirewallProtocolEnum` — verified 2026-11-05. */
export const FIREWALL_PROTOCOLS = ["ah", "esp", "gre", "icmp", "ipv4", "tcp", "udp"] as const
export type FirewallProtocol = (typeof FIREWALL_PROTOCOLS)[number]
export const firewallProtocolSchema = z.enum(FIREWALL_PROTOCOLS)

/** `ip.FirewallRuleStateEnum` — verified 2026-11-05. */
export const FIREWALL_RULE_STATES = ["creationPending", "ok", "removalPending"] as const
export type FirewallRuleState = (typeof FIREWALL_RULE_STATES)[number]
export const firewallRuleStateSchema = z.enum(FIREWALL_RULE_STATES)

/** `ip.FirewallStateEnum` — verified 2026-11-05 and re-read 2026-11-06. */
export const FIREWALL_STATES = [
  "disableFirewallPending",
  "enableFirewallPending",
  "ok",
] as const
export type FirewallState = (typeof FIREWALL_STATES)[number]
export const firewallStateSchema = z.enum(FIREWALL_STATES)

/** `ip.FirewallTCPOptionEnum` — verified 2026-11-05. */
export const FIREWALL_TCP_OPTIONS = ["established", "syn"] as const
export type FirewallTcpOption = (typeof FIREWALL_TCP_OPTIONS)[number]

/** `ip.FirewallSequenceRangeEnum` — 0..19, verified 2026-11-05. */
export const FIREWALL_SEQUENCE_MIN = 0
export const FIREWALL_SEQUENCE_MAX = 19

/**
 * `ip.FirewallIp` — one IP of a block that has been put on the OVH firewall.
 * Returned by `POST /ip/{ip}/firewall`; a rule can only be attached to an IP that exists
 * here.
 */
export const firewallIpSchema = z.object({
  ipOnFirewall: z.string(),
  enabled: z.boolean(),
  state: firewallStateSchema,
})
export type FirewallIp = z.infer<typeof firewallIpSchema>

/**
 * `ip.FirewallNetworkRule`. Ports come back as strings ("80", "any"), not numbers —
 * that is how the schema declares them.
 */
export const firewallRuleSchema = z.object({
  sequence: longish,
  action: firewallActionSchema,
  protocol: firewallProtocolSchema,
  state: firewallRuleStateSchema,
  rule: z.string(),
  source: z.string(),
  destination: z.string(),
  sourcePort: z.string().nullish(),
  destinationPort: z.string().nullish(),
  fragments: z.boolean().nullish(),
  l3PacketLength: z.string().nullish(),
  tcpOption: z.string().nullish(),
  creationDate: ovhDate,
})
export type FirewallRule = z.infer<typeof firewallRuleSchema>

/** `ip.MitigationStateEnum` — verified 2026-11-05. */
export const MITIGATION_STATES = ["creationPending", "ok", "removalPending"] as const
export type MitigationState = (typeof MITIGATION_STATES)[number]
export const mitigationStateSchema = z.enum(MITIGATION_STATES)

/** `ip.MitigationIp` — the shape `POST /ip/{ip}/mitigation` returns. */
export const mitigationIpSchema = z.object({
  ipOnMitigation: z.string(),
  auto: z.boolean(),
  permanent: z.boolean(),
  state: mitigationStateSchema,
})
export type MitigationIp = z.infer<typeof mitigationIpSchema>

/**
 * Adapter-level aggregate for `GET /ip/{ip}/mitigation`, which returns `ipv4[]`:
 * the IPs of the block currently under mitigation.
 *
 * Per-IP detail lives in `MitigationIp`, read with `getMitigationIp`
 * (`GET /ip/{ip}/mitigation/{ipOnMitigation}`, verified 2026-11-06).
 */
export interface Mitigation {
  ipBlock: string
  mitigatedIps: readonly string[]
}
