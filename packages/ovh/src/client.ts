import type {
  AutomatedBackup,
  DatacenterStock,
  Cart,
  CartConfigurationItem,
  CartItem,
  CheckoutPreview,
  ConfigurationRequirement,
  ConfirmTerminationInput,
  DiskStatisticType,
  DiskUse,
  FirewallAction,
  FirewallIp,
  FirewallProtocol,
  FirewallRule,
  FirewallState,
  GenericOptionDefinition,
  GenericProductDefinition,
  Image,
  IpAddress,
  Mitigation,
  MitigationIp,
  Order,
  OvhOrderStatus,
  RestoreState,
  RestoreType,
  Reverse,
  ServiceInfos,
  ServiceInfosUpdate,
  Snapshot,
  UpgradeQuote,
  VpsModel,
  VpsNetbootMode,
  VpsOption,
  VpsSummary,
  VpsTask,
} from "./types"

/* -------------------------------------------------------------------------- */
/* inputs                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateCartInput {
  /** `nichandle.OvhSubsidiaryEnum`, e.g. "ES". Defaults to the client's subsidiary. */
  ovhSubsidiary?: string
  description?: string
  /** When the cart should expire. OVH defaults to a few hours. */
  expire?: Date
}

export interface AddVpsToCartInput {
  cartId: string
  planCode: string
  /** ISO 8601 duration from the catalog, e.g. "P1M" or "P1Y". */
  duration: string
  /** OVH pricing mode, e.g. "default" or "upfront12". */
  pricingMode: string
  quantity?: number
}

export interface ConfigureItemInput {
  cartId: string
  itemId: number
  /** Configuration name, e.g. "vps_datacenter" or "vps_os". */
  label: string
  value: string
}

export interface AddOptionInput {
  cartId: string
  /** The parent VPS item the option attaches to. */
  itemId: number
  planCode: string
  duration: string
  pricingMode: string
  quantity?: number
}

export interface CheckoutInput {
  cartId: string
  autoPayWithPreferredPaymentMethod: boolean
  waiveRetractationPeriod: boolean
}

export interface RebuildInput {
  serviceName: string
  imageId: string
  /** Name of an SSH key already registered in the OVH account. */
  sshKey?: string
  /** A raw public key, for accounts where the key is not registered. */
  publicSshKey?: string
  doNotSendPassword: boolean
  installRTM?: boolean
  postInstallScript?: string
}

export interface RestoreBackupInput {
  serviceName: string
  /** A value returned verbatim by `listRestorePoints`. */
  restorePoint: string
  type: RestoreType
  changePassword?: boolean
}

export interface AddFirewallRuleInput {
  ipBlock: string
  ipOnFirewall: string
  /** 0..19 — `ip.FirewallSequenceRangeEnum`. */
  sequence: number
  action: FirewallAction
  protocol: FirewallProtocol
  source?: string
  sourcePort?: number
  destinationPort?: number
  tcpOption?: string
  fragments?: boolean
}

export interface OrderUpgradeInput {
  quantity: number
  autoPayWithPreferredPaymentMethod?: boolean
}

export interface OrderServiceOptionInput {
  cartId: string
  planCode: string
  duration: string
  pricingMode: string
  quantity: number
}

export interface ListTasksFilter {
  /** `vps.TaskStateEnum`. */
  state?: string
  /** `vps.TaskTypeEnum`. */
  type?: string
}

/* -------------------------------------------------------------------------- */
/* the port                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The only way the application talks to OVH. Two implementations: `HttpOvhClient` and
 * `MockOvhClient`. Everything returned here has been validated with zod, so callers
 * never see an untyped OVH payload.
 *
 * Routes are limited to those listed in `docs/ovh-api-verified.md`.
 */
export interface OvhClient {
  /* ---------------------------------------------------------------- catalog */

  /**
   * `GET /order/catalog/public/vps?ovhSubsidiary=…` — unauthenticated, ~6 MB.
   * Returned raw on purpose: `parseCatalog` in `@ola/core` owns its schema.
   */
  fetchPublicCatalog(subsidiary: string): Promise<unknown>

  /**
   * `GET /vps/order/rule/datacenter?ovhSubsidiary=…&planCode=…` — unauthenticated.
   * Live stock per datacenter for one plan: what OVH will actually deliver right now.
   */
  getDatacenterStock(planCode: string, subsidiary: string): Promise<DatacenterStock[]>

  /* --------------------------------------------------------------- ordering */

  /** `POST /order/cart` */
  createCart(input?: CreateCartInput): Promise<Cart>
  /** `POST /order/cart/{cartId}/assign` — a cart must be assigned before checkout. */
  assignCart(cartId: string): Promise<void>
  /** `GET /order/cart/{cartId}/vps` — the offers orderable in this cart. */
  listCartVpsOffers(cartId: string): Promise<readonly GenericProductDefinition[]>
  /** `POST /order/cart/{cartId}/vps` */
  addVpsToCart(input: AddVpsToCartInput): Promise<CartItem>
  /** `POST /order/cart/{cartId}/item/{itemId}/configuration` */
  configureItem(input: ConfigureItemInput): Promise<CartConfigurationItem>
  /** `GET /order/cart/{cartId}/item/{itemId}/configuration` — ids of the configurations set. */
  listCartItemConfigurations(cartId: string, itemId: number): Promise<readonly number[]>
  /**
   * `GET /order/cart/{cartId}/item/{itemId}/requiredConfiguration` — the configurations the
   * item **still requires** (`vps_datacenter`, `vps_os`, …). Not the same thing as
   * `listCartItemConfigurations`, which lists the ones already set.
   */
  listCartItemRequiredConfiguration(
    cartId: string,
    itemId: number,
  ): Promise<readonly ConfigurationRequirement[]>
  /** `GET /order/cart/{cartId}/vps/options?planCode=…` */
  listCartOptions(cartId: string, planCode: string): Promise<readonly GenericOptionDefinition[]>
  /** `POST /order/cart/{cartId}/vps/options` */
  addOption(input: AddOptionInput): Promise<CartItem>
  /** `GET /order/cart/{cartId}/summary` */
  getCartSummary(cartId: string): Promise<CheckoutPreview>
  /** `GET /order/cart/{cartId}/checkout` — prices and contracts, nothing is ordered. */
  getCheckoutPreview(cartId: string): Promise<CheckoutPreview>
  /**
   * `POST /order/cart/{cartId}/checkout` — creates the order. **Never retried**: it is
   * attempted exactly once and the caller must verify the outcome before trying again.
   */
  checkout(input: CheckoutInput): Promise<CheckoutPreview>

  /* ----------------------------------------------------------------- orders */

  /** `GET /me/order/{orderId}/status` */
  getOrderStatus(orderId: number): Promise<OvhOrderStatus>
  /** `GET /me/order/{orderId}/details` — ids of the order lines. */
  getOrderDetails(orderId: number): Promise<readonly number[]>
  /** `GET /me/order/{orderId}` */
  getOrder(orderId: number): Promise<Order>

  /* ---------------------------------------------------------------- service */

  /** `GET /vps` */
  listVps(): Promise<readonly string[]>
  /** `GET /vps/{serviceName}` */
  getVps(serviceName: string): Promise<VpsSummary>
  /** `GET /vps/{serviceName}/ips` */
  getVpsIps(serviceName: string): Promise<readonly IpAddress[]>
  /** `GET /vps/{serviceName}/serviceInfos` */
  getServiceInfos(serviceName: string): Promise<ServiceInfos>
  /** `PUT /vps/{serviceName}/serviceInfos` — renewal settings. */
  updateServiceInfos(serviceName: string, update: ServiceInfosUpdate): Promise<void>
  /** `GET /vps/{serviceName}/tasks/{id}` — note the path parameter is `{id}`. */
  getTask(serviceName: string, taskId: number): Promise<VpsTask>
  /** `GET /vps/{serviceName}/tasks` */
  listTasks(serviceName: string, filter?: ListTasksFilter): Promise<readonly number[]>
  /** `POST /vps/{serviceName}/start` */
  start(serviceName: string): Promise<VpsTask>
  /** `POST /vps/{serviceName}/stop` */
  stop(serviceName: string): Promise<VpsTask>
  /** `POST /vps/{serviceName}/reboot` */
  reboot(serviceName: string): Promise<VpsTask>
  /** `GET /vps/{serviceName}/images/available` — image ids. */
  listAvailableImages(serviceName: string): Promise<readonly string[]>
  /** `GET /vps/{serviceName}/images/current` */
  getCurrentImage(serviceName: string): Promise<Image>
  /** `POST /vps/{serviceName}/rebuild` — reinstall. Destroys the disk. */
  rebuild(input: RebuildInput): Promise<VpsTask>
  /** `POST /vps/{serviceName}/setPassword` — OVH mails the new root password. */
  setPassword(serviceName: string): Promise<VpsTask>
  /** `POST /vps/{serviceName}/getConsoleUrl` — a short-lived KVM console URL. */
  getConsoleUrl(serviceName: string): Promise<string>
  /**
   * `PUT /vps/{serviceName}` with `netbootMode`. Rescue mode is this plus a reboot:
   * `setNetbootMode(name, "rescue")` then `reboot(name)`.
   */
  setNetbootMode(serviceName: string, mode: VpsNetbootMode): Promise<void>
  /** `POST /vps/{serviceName}/createSnapshot` — requires the snapshot option. */
  createSnapshot(serviceName: string, description: string): Promise<VpsTask>
  /** `GET /vps/{serviceName}/snapshot` */
  getSnapshot(serviceName: string): Promise<Snapshot>
  /** `DELETE /vps/{serviceName}/snapshot` */
  deleteSnapshot(serviceName: string): Promise<VpsTask>
  /** `POST /vps/{serviceName}/snapshot/revert` */
  revertSnapshot(serviceName: string): Promise<VpsTask>
  /** `GET /vps/{serviceName}/automatedBackup` */
  getAutomatedBackup(serviceName: string): Promise<AutomatedBackup>
  /** `GET /vps/{serviceName}/automatedBackup/restorePoints?state=…` — ISO datetimes, verbatim. */
  listRestorePoints(serviceName: string, state: RestoreState): Promise<readonly string[]>
  /** `POST /vps/{serviceName}/automatedBackup/restore` */
  restoreBackup(input: RestoreBackupInput): Promise<VpsTask>
  /** `GET /vps/{serviceName}/disks` — disk ids. */
  listDisks(serviceName: string): Promise<readonly number[]>
  /** `GET /vps/{serviceName}/disks/{id}/use?type=…` — the only real metric OVH exposes. */
  getDiskUse(serviceName: string, diskId: number, type: DiskStatisticType): Promise<DiskUse>
  /** `GET /vps/{serviceName}/availableUpgrade` */
  listAvailableUpgrades(serviceName: string): Promise<readonly VpsModel[]>
  /** `POST /vps/{serviceName}/terminate` — returns the token to confirm with. */
  terminate(serviceName: string): Promise<string>
  /** `POST /vps/{serviceName}/confirmTermination` */
  confirmTermination(serviceName: string, input: ConfirmTerminationInput): Promise<string>
  /** `GET /vps/{serviceName}/option` — options in use. */
  listOptions(serviceName: string): Promise<readonly VpsOption[]>

  /* ---------------------------------------------------------------- network */

  /**
   * `GET /ip/{ip}/reverse` — the IPs of the block that have a reverse configured.
   * Named for what it returns; `getReverse` reads one hostname.
   */
  listReverseIps(ipBlock: string): Promise<readonly string[]>
  /** `GET /ip/{ip}/reverse/{ipReverse}` — the reverse hostname of one IP. */
  getReverse(ipBlock: string, ipReverse: string): Promise<Reverse>
  /** `POST /ip/{ip}/reverse` */
  setReverse(ipBlock: string, ipReverse: string, reverse: string): Promise<Reverse>
  /** `DELETE /ip/{ip}/reverse/{ipReverse}` */
  deleteReverse(ipBlock: string, ipReverse: string): Promise<void>
  /**
   * `POST /ip/{ip}/firewall` — put one IP of the block on the OVH firewall. This is the
   * step before any rule: OVH rejects a rule attached to an IP that is not on the
   * firewall, so the first rule a customer creates must be preceded by this call.
   */
  enableFirewall(ipBlock: string, ipOnFirewall: string): Promise<FirewallIp>
  /**
   * `GET /ip/{ip}/firewall` — the IPs **of the block** that are on the firewall.
   * Not to be confused with `listFirewallRules`, which returns the rule sequence numbers
   * of a single IP.
   */
  listFirewalledIps(
    ipBlock: string,
    filter?: { enabled?: boolean; state?: FirewallState },
  ): Promise<readonly string[]>
  /**
   * `GET /ip/{ip}/firewall/{ipOnFirewall}/rule` — the rule sequence numbers of one IP.
   * Not to be confused with `listFirewalledIps`, which returns the IPs of a block.
   */
  listFirewallRules(ipBlock: string, ipOnFirewall: string): Promise<readonly number[]>
  /** `POST /ip/{ip}/firewall/{ipOnFirewall}/rule` */
  addFirewallRule(input: AddFirewallRuleInput): Promise<FirewallRule>
  /** `GET /ip/{ip}/firewall/{ipOnFirewall}/rule/{sequence}` */
  getFirewallRule(
    ipBlock: string,
    ipOnFirewall: string,
    sequence: number,
  ): Promise<FirewallRule>
  /**
   * `DELETE /ip/{ip}/firewall/{ipOnFirewall}/rule/{sequence}` — OVH answers with the rule
   * it is removing, whose state becomes `removalPending`.
   */
  deleteFirewallRule(
    ipBlock: string,
    ipOnFirewall: string,
    sequence: number,
  ): Promise<FirewallRule>
  /** `GET /ip/{ip}/mitigation` — which IPs of the block are listed. */
  getMitigation(ipBlock: string): Promise<Mitigation>
  /** `GET /ip/{ip}/mitigation/{ipOnMitigation}` — the real state of one IP. */
  getMitigationIp(ipBlock: string, ipOnMitigation: string): Promise<MitigationIp>

  /* -------------------------------------------- upgrades on a live service */

  /** `GET /order/upgrade/vps/{serviceName}/{planCode}?quantity=…` */
  getUpgradeQuote(serviceName: string, planCode: string, quantity?: number): Promise<UpgradeQuote>
  /** `POST /order/upgrade/vps/{serviceName}/{planCode}` */
  orderUpgrade(serviceName: string, planCode: string, body: OrderUpgradeInput): Promise<UpgradeQuote>
  /** `GET /order/cartServiceOption/vps/{serviceName}` */
  getServiceOptionQuote(serviceName: string): Promise<readonly GenericOptionDefinition[]>
  /**
   * `POST /order/cartServiceOption/vps/{serviceName}` — the `{planCode}` goes in the
   * body: the `/{planCode}` path from the brief does not exist.
   */
  orderServiceOption(serviceName: string, body: OrderServiceOptionInput): Promise<CartItem>
}

/* -------------------------------------------------------------------------- */
/* logging                                                                    */
/* -------------------------------------------------------------------------- */

/** What the adapter is allowed to log. No URL query, no headers, no body, ever. */
export interface OvhLogRecord {
  method: string
  path: string
  status: number | null
  durationMs: number
  correlationId: string
  attempt?: number
  outcome?: "ok" | "retrying" | "failed"
}

export interface OvhLogger {
  debug?(record: OvhLogRecord): void
  info(record: OvhLogRecord): void
  warn(record: OvhLogRecord): void
  error(record: OvhLogRecord): void
}
