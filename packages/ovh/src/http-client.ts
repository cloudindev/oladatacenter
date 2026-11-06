import { ulid } from "ulid"
import { z } from "zod"
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
  OvhLogger,
  RebuildInput,
  RestoreBackupInput,
} from "./client"
import { OvhApiError } from "./errors"
import { resolveEndpoint, signingTimestamp, signedHeaders, type FetchLike } from "./signer"
import {
  automatedBackupSchema,
  cartConfigurationItemSchema,
  cartItemSchema,
  cartSchema,
  checkoutPreviewSchema,
  configurationRequirementListSchema,
  diskUseSchema,
  firewallIpSchema,
  firewallRuleSchema,
  genericOptionDefinitionListSchema,
  genericProductDefinitionListSchema,
  imageSchema,
  ipListSchema,
  longListSchema,
  mitigationIpSchema,
  orderSchema,
  ovhOrderStatusSchema,
  restorePointListSchema,
  reverseSchema,
  serviceInfosSchema,
  snapshotSchema,
  stringListSchema,
  stringSchema,
  toIpAddress,
  upgradeQuoteSchema,
  voidSchema,
  vpsModelListSchema,
  vpsOptionListSchema,
  vpsSummarySchema,
  vpsTaskSchema,
  type AutomatedBackup,
  type Cart,
  type CartConfigurationItem,
  type CartItem,
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
  type Image,
  type IpAddress,
  type Mitigation,
  type MitigationIp,
  type Order,
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
  type VpsSummary,
  type VpsTask,
} from "./types"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"

type QueryValue = string | number | boolean | undefined

export interface HttpOvhClientOptions {
  /** Endpoint name ("ovh-eu") or a full base URL (used by tests). */
  endpoint: string
  applicationKey: string
  applicationSecret: string
  consumerKey: string
  /** `nichandle.OvhSubsidiaryEnum`, e.g. "ES". Used as the default on new carts. */
  subsidiary: string
  fetchImpl?: FetchLike
  logger?: OvhLogger
  /** Wall clock in milliseconds. Injectable so tests are deterministic. */
  now?: () => number
  /** Total attempts for a retryable call, the first one included. */
  maxAttempts?: number
  /** First backoff step in milliseconds. */
  retryBaseMs?: number
  /** Backoff ceiling in milliseconds. */
  retryMaxMs?: number
  sleep?: (ms: number) => Promise<void>
  /** Jitter source in [0, 1). */
  random?: () => number
  /** One id per request, for correlating our logs with OVH's. */
  correlationId?: () => string
}

interface RequestSpec<S extends z.ZodTypeAny> {
  method: HttpMethod
  /** Path below the API root, already URL-encoded. Logged as-is. */
  path: string
  query?: Readonly<Record<string, QueryValue>>
  body?: unknown
  schema: S
  /** Signed by default. Only the public catalog opts out. */
  auth?: boolean
  /** Retried by default when the failure is transient. Checkout opts out. */
  retry?: boolean
}

type Attempt<T> =
  | { readonly ok: true; readonly value: T; readonly status: number }
  | {
      readonly ok: false
      readonly error: OvhApiError
      readonly status: number | null
      readonly retryAfterMs: number | null
    }

/** OVH error envelopes: `{ class, message }` or `{ errorCode, httpCode, message }`. */
const ovhErrorBodySchema = z.object({
  message: z.string().optional(),
  errorCode: z.string().optional(),
  class: z.string().optional(),
  httpCode: z.string().optional(),
})

function enc(value: string | number): string {
  return encodeURIComponent(String(value))
}

function buildQuery(query: Readonly<Record<string, QueryValue>> | undefined): string {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    params.set(key, String(value))
  }
  const serialised = params.toString()
  return serialised.length > 0 ? `?${serialised}` : ""
}

function parseRetryAfter(header: string | null, nowMs: number): number | null {
  if (!header) return null
  const seconds = Number(header.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  const date = Date.parse(header)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - nowMs)
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ")
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * The real OVH adapter.
 *
 * Properties worth keeping true:
 *  - every response is validated with zod before it leaves a method;
 *  - 429/5xx/network failures are retried with exponential backoff and jitter, honouring
 *    `Retry-After`, up to `maxAttempts`;
 *  - `POST /order/cart/{cartId}/checkout` is **never** retried;
 *  - the public catalog is fetched without auth headers;
 *  - logs carry method, path, status, duration and a correlation id. Nothing else.
 */
export class HttpOvhClient implements OvhClient {
  private readonly baseUrl: string
  private readonly applicationKey: string
  private readonly applicationSecret: string
  private readonly consumerKey: string
  private readonly subsidiary: string
  private readonly fetchImpl: FetchLike
  private readonly logger: OvhLogger | null
  private readonly now: () => number
  private readonly maxAttempts: number
  private readonly retryBaseMs: number
  private readonly retryMaxMs: number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number
  private readonly correlationId: () => string

  constructor(options: HttpOvhClientOptions) {
    this.baseUrl = resolveEndpoint(options.endpoint)
    this.applicationKey = options.applicationKey
    this.applicationSecret = options.applicationSecret
    this.consumerKey = options.consumerKey
    this.subsidiary = options.subsidiary
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.logger = options.logger ?? null
    this.now = options.now ?? (() => Date.now())
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 4)
    this.retryBaseMs = options.retryBaseMs ?? 300
    this.retryMaxMs = options.retryMaxMs ?? 8_000
    this.sleep = options.sleep ?? defaultSleep
    this.random = options.random ?? Math.random
    this.correlationId = options.correlationId ?? (() => ulid())
  }

  /* ------------------------------------------------------------ transport */

  private async attempt<S extends z.ZodTypeAny>(
    spec: RequestSpec<S>,
    correlationId: string,
    attempts: number,
  ): Promise<Attempt<z.output<S>>> {
    const url = `${this.baseUrl}${spec.path}${buildQuery(spec.query)}`
    const serialisedBody = spec.body === undefined ? "" : JSON.stringify(spec.body)
    const headers: Record<string, string> = { Accept: "application/json" }
    if (serialisedBody.length > 0) headers["Content-Type"] = "application/json"

    if (spec.auth !== false) {
      const timestamp = await signingTimestamp({
        baseUrl: this.baseUrl,
        fetchImpl: this.fetchImpl,
        now: this.now,
      })
      Object.assign(
        headers,
        signedHeaders({
          applicationKey: this.applicationKey,
          applicationSecret: this.applicationSecret,
          consumerKey: this.consumerKey,
          method: spec.method,
          url,
          body: serialisedBody,
          timestamp,
        }),
      )
    }

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: spec.method,
        headers,
        body: serialisedBody.length > 0 ? serialisedBody : undefined,
      })
    } catch (cause) {
      return {
        ok: false,
        status: null,
        retryAfterMs: null,
        error: new OvhApiError({
          kind: "network",
          method: spec.method,
          path: spec.path,
          detail: cause instanceof Error ? cause.message : String(cause),
          correlationId,
          attempts,
          cause,
        }),
      }
    }

    const text = await response.text()

    if (!response.ok) {
      const envelope = this.readErrorEnvelope(text)
      return {
        ok: false,
        status: response.status,
        retryAfterMs: parseRetryAfter(response.headers.get("Retry-After"), this.now()),
        error: new OvhApiError({
          kind: "http",
          method: spec.method,
          path: spec.path,
          httpStatus: response.status,
          ovhErrorCode: envelope.code,
          detail: envelope.message,
          correlationId,
          attempts,
        }),
      }
    }

    let payload: unknown
    if (text.trim().length === 0) {
      payload = undefined
    } else {
      try {
        payload = JSON.parse(text) as unknown
      } catch (cause) {
        return {
          ok: false,
          status: response.status,
          retryAfterMs: null,
          error: new OvhApiError({
            kind: "schema",
            method: spec.method,
            path: spec.path,
            httpStatus: response.status,
            detail: "response body is not valid JSON",
            correlationId,
            attempts,
            cause,
          }),
        }
      }
    }

    const parsed = spec.schema.safeParse(payload)
    if (!parsed.success) {
      return {
        ok: false,
        status: response.status,
        retryAfterMs: null,
        error: new OvhApiError({
          kind: "schema",
          method: spec.method,
          path: spec.path,
          httpStatus: response.status,
          detail: `unexpected response shape — ${describeIssues(parsed.error)}`,
          correlationId,
          attempts,
          cause: parsed.error,
        }),
      }
    }

    return { ok: true, value: parsed.data as z.output<S>, status: response.status }
  }

  private readErrorEnvelope(text: string): { code: string | null; message: string | null } {
    if (text.trim().length === 0) return { code: null, message: null }
    let payload: unknown
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      return { code: null, message: text.slice(0, 500) }
    }
    const parsed = ovhErrorBodySchema.safeParse(payload)
    if (!parsed.success) return { code: null, message: null }
    return {
      code: parsed.data.errorCode ?? parsed.data.class ?? null,
      message: parsed.data.message ?? null,
    }
  }

  private backoffMs(attempt: number, retryAfterMs: number | null): number {
    if (retryAfterMs !== null) return Math.min(retryAfterMs, 30_000)
    const exponential = Math.min(this.retryMaxMs, this.retryBaseMs * 2 ** (attempt - 1))
    return Math.round(exponential * (1 + this.random() * 0.25))
  }

  private async request<S extends z.ZodTypeAny>(spec: RequestSpec<S>): Promise<z.output<S>> {
    const correlationId = this.correlationId()
    const retryEnabled = spec.retry !== false
    const maxAttempts = retryEnabled ? this.maxAttempts : 1
    let lastError: OvhApiError | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = this.now()
      const result = await this.attempt(spec, correlationId, attempt)
      const durationMs = this.now() - startedAt

      if (result.ok) {
        this.logger?.info({
          method: spec.method,
          path: spec.path,
          status: result.status,
          durationMs,
          correlationId,
          attempt,
          outcome: "ok",
        })
        return result.value
      }

      lastError = result.error
      const willRetry = result.error.retryable && attempt < maxAttempts
      this.logger?.[willRetry ? "warn" : "error"]({
        method: spec.method,
        path: spec.path,
        status: result.status,
        durationMs,
        correlationId,
        attempt,
        outcome: willRetry ? "retrying" : "failed",
      })

      if (!willRetry) break
      await this.sleep(this.backoffMs(attempt, result.retryAfterMs))
    }

    throw (
      lastError ??
      new OvhApiError({
        kind: "network",
        method: spec.method,
        path: spec.path,
        detail: "no attempt was made",
        correlationId,
      })
    )
  }

  /* -------------------------------------------------------------- catalog */

  async fetchPublicCatalog(subsidiary: string): Promise<unknown> {
    // Unauthenticated on purpose: no signing headers are sent for this one.
    return this.request({
      method: "GET",
      path: "/order/catalog/public/vps",
      query: { ovhSubsidiary: subsidiary },
      schema: z.unknown(),
      auth: false,
    })
  }

  /* ------------------------------------------------------------- ordering */

  async createCart(input: CreateCartInput = {}): Promise<Cart> {
    return this.request({
      method: "POST",
      path: "/order/cart",
      body: {
        ovhSubsidiary: input.ovhSubsidiary ?? this.subsidiary,
        description: input.description,
        expire: input.expire?.toISOString(),
      },
      schema: cartSchema,
    })
  }

  async assignCart(cartId: string): Promise<void> {
    await this.request({
      method: "POST",
      path: `/order/cart/${enc(cartId)}/assign`,
      schema: voidSchema,
    })
  }

  async listCartVpsOffers(cartId: string): Promise<readonly GenericProductDefinition[]> {
    return this.request({
      method: "GET",
      path: `/order/cart/${enc(cartId)}/vps`,
      schema: genericProductDefinitionListSchema,
    })
  }

  async addVpsToCart(input: AddVpsToCartInput): Promise<CartItem> {
    return this.request({
      method: "POST",
      path: `/order/cart/${enc(input.cartId)}/vps`,
      body: {
        planCode: input.planCode,
        duration: input.duration,
        pricingMode: input.pricingMode,
        quantity: input.quantity ?? 1,
      },
      schema: cartItemSchema,
    })
  }

  async configureItem(input: ConfigureItemInput): Promise<CartConfigurationItem> {
    return this.request({
      method: "POST",
      path: `/order/cart/${enc(input.cartId)}/item/${enc(input.itemId)}/configuration`,
      body: { label: input.label, value: input.value },
      schema: cartConfigurationItemSchema,
    })
  }

  async listCartItemConfigurations(cartId: string, itemId: number): Promise<readonly number[]> {
    return this.request({
      method: "GET",
      path: `/order/cart/${enc(cartId)}/item/${enc(itemId)}/configuration`,
      schema: longListSchema,
    })
  }

  async listCartItemRequiredConfiguration(
    cartId: string,
    itemId: number,
  ): Promise<readonly ConfigurationRequirement[]> {
    return this.request({
      method: "GET",
      path: `/order/cart/${enc(cartId)}/item/${enc(itemId)}/requiredConfiguration`,
      schema: configurationRequirementListSchema,
    })
  }

  async listCartOptions(
    cartId: string,
    planCode: string,
  ): Promise<readonly GenericOptionDefinition[]> {
    return this.request({
      method: "GET",
      path: `/order/cart/${enc(cartId)}/vps/options`,
      query: { planCode },
      schema: genericOptionDefinitionListSchema,
    })
  }

  async addOption(input: AddOptionInput): Promise<CartItem> {
    return this.request({
      method: "POST",
      path: `/order/cart/${enc(input.cartId)}/vps/options`,
      body: {
        itemId: input.itemId,
        planCode: input.planCode,
        duration: input.duration,
        pricingMode: input.pricingMode,
        quantity: input.quantity ?? 1,
      },
      schema: cartItemSchema,
    })
  }

  async getCartSummary(cartId: string): Promise<CheckoutPreview> {
    return this.request({
      method: "GET",
      path: `/order/cart/${enc(cartId)}/summary`,
      schema: checkoutPreviewSchema,
    })
  }

  async getCheckoutPreview(cartId: string): Promise<CheckoutPreview> {
    return this.request({
      method: "GET",
      path: `/order/cart/${enc(cartId)}/checkout`,
      schema: checkoutPreviewSchema,
    })
  }

  async checkout(input: CheckoutInput): Promise<CheckoutPreview> {
    // Deliberately `retry: false`. A retried checkout can create a second order that
    // nobody is expecting; the caller verifies the outcome instead.
    return this.request({
      method: "POST",
      path: `/order/cart/${enc(input.cartId)}/checkout`,
      body: {
        autoPayWithPreferredPaymentMethod: input.autoPayWithPreferredPaymentMethod,
        waiveRetractationPeriod: input.waiveRetractationPeriod,
      },
      schema: checkoutPreviewSchema,
      retry: false,
    })
  }

  /* --------------------------------------------------------------- orders */

  async getOrderStatus(orderId: number): Promise<OvhOrderStatus> {
    return this.request({
      method: "GET",
      path: `/me/order/${enc(orderId)}/status`,
      schema: ovhOrderStatusSchema,
    })
  }

  async getOrderDetails(orderId: number): Promise<readonly number[]> {
    return this.request({
      method: "GET",
      path: `/me/order/${enc(orderId)}/details`,
      schema: longListSchema,
    })
  }

  async getOrder(orderId: number): Promise<Order> {
    return this.request({
      method: "GET",
      path: `/me/order/${enc(orderId)}`,
      schema: orderSchema,
    })
  }

  /* -------------------------------------------------------------- service */

  async listVps(): Promise<readonly string[]> {
    return this.request({ method: "GET", path: "/vps", schema: stringListSchema })
  }

  async getVps(serviceName: string): Promise<VpsSummary> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}`,
      schema: vpsSummarySchema,
    })
  }

  async getVpsIps(serviceName: string): Promise<readonly IpAddress[]> {
    const ips = await this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/ips`,
      schema: ipListSchema,
    })
    return ips.map(toIpAddress)
  }

  async getServiceInfos(serviceName: string): Promise<ServiceInfos> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/serviceInfos`,
      schema: serviceInfosSchema,
    })
  }

  async updateServiceInfos(serviceName: string, update: ServiceInfosUpdate): Promise<void> {
    await this.request({
      method: "PUT",
      path: `/vps/${enc(serviceName)}/serviceInfos`,
      body: update,
      schema: voidSchema,
    })
  }

  async getTask(serviceName: string, taskId: number): Promise<VpsTask> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/tasks/${enc(taskId)}`,
      schema: vpsTaskSchema,
    })
  }

  async listTasks(serviceName: string, filter: ListTasksFilter = {}): Promise<readonly number[]> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/tasks`,
      query: { state: filter.state, type: filter.type },
      schema: longListSchema,
    })
  }

  async start(serviceName: string): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/start`,
      schema: vpsTaskSchema,
    })
  }

  async stop(serviceName: string): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/stop`,
      schema: vpsTaskSchema,
    })
  }

  async reboot(serviceName: string): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/reboot`,
      schema: vpsTaskSchema,
    })
  }

  async listAvailableImages(serviceName: string): Promise<readonly string[]> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/images/available`,
      schema: stringListSchema,
    })
  }

  async getCurrentImage(serviceName: string): Promise<Image> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/images/current`,
      schema: imageSchema,
    })
  }

  async rebuild(input: RebuildInput): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(input.serviceName)}/rebuild`,
      body: {
        imageId: input.imageId,
        sshKey: input.sshKey,
        publicSshKey: input.publicSshKey,
        doNotSendPassword: input.doNotSendPassword,
        installRTM: input.installRTM,
        postInstallScript: input.postInstallScript,
      },
      schema: vpsTaskSchema,
    })
  }

  async setPassword(serviceName: string): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/setPassword`,
      schema: vpsTaskSchema,
    })
  }

  async getConsoleUrl(serviceName: string): Promise<string> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/getConsoleUrl`,
      schema: stringSchema,
    })
  }

  async setNetbootMode(serviceName: string, mode: VpsNetbootMode): Promise<void> {
    await this.request({
      method: "PUT",
      path: `/vps/${enc(serviceName)}`,
      body: { netbootMode: mode },
      schema: voidSchema,
    })
  }

  async createSnapshot(serviceName: string, description: string): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/createSnapshot`,
      body: { description },
      schema: vpsTaskSchema,
    })
  }

  async getSnapshot(serviceName: string): Promise<Snapshot> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/snapshot`,
      schema: snapshotSchema,
    })
  }

  async deleteSnapshot(serviceName: string): Promise<VpsTask> {
    return this.request({
      method: "DELETE",
      path: `/vps/${enc(serviceName)}/snapshot`,
      schema: vpsTaskSchema,
    })
  }

  async revertSnapshot(serviceName: string): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/snapshot/revert`,
      schema: vpsTaskSchema,
    })
  }

  async getAutomatedBackup(serviceName: string): Promise<AutomatedBackup> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/automatedBackup`,
      schema: automatedBackupSchema,
    })
  }

  async listRestorePoints(
    serviceName: string,
    state: RestoreState,
  ): Promise<readonly string[]> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/automatedBackup/restorePoints`,
      query: { state },
      schema: restorePointListSchema,
    })
  }

  async restoreBackup(input: RestoreBackupInput): Promise<VpsTask> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(input.serviceName)}/automatedBackup/restore`,
      body: {
        restorePoint: input.restorePoint,
        type: input.type,
        changePassword: input.changePassword ?? false,
      },
      schema: vpsTaskSchema,
    })
  }

  async listDisks(serviceName: string): Promise<readonly number[]> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/disks`,
      schema: longListSchema,
    })
  }

  async getDiskUse(
    serviceName: string,
    diskId: number,
    type: DiskStatisticType,
  ): Promise<DiskUse> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/disks/${enc(diskId)}/use`,
      query: { type },
      schema: diskUseSchema,
    })
  }

  async listAvailableUpgrades(serviceName: string): Promise<readonly VpsModel[]> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/availableUpgrade`,
      schema: vpsModelListSchema,
    })
  }

  async terminate(serviceName: string): Promise<string> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/terminate`,
      schema: stringSchema,
    })
  }

  async confirmTermination(
    serviceName: string,
    input: ConfirmTerminationInput,
  ): Promise<string> {
    return this.request({
      method: "POST",
      path: `/vps/${enc(serviceName)}/confirmTermination`,
      body: {
        token: input.token,
        reason: input.reason,
        futureUse: input.futureUse,
        commentary: input.commentary,
        commentaryReason: input.commentaryReason,
        commentaryFutureUse: input.commentaryFutureUse,
      },
      schema: stringSchema,
    })
  }

  async listOptions(serviceName: string): Promise<readonly VpsOption[]> {
    return this.request({
      method: "GET",
      path: `/vps/${enc(serviceName)}/option`,
      schema: vpsOptionListSchema,
    })
  }

  /* -------------------------------------------------------------- network */

  async listReverseIps(ipBlock: string): Promise<readonly string[]> {
    return this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/reverse`,
      schema: ipListSchema,
    })
  }

  async getReverse(ipBlock: string, ipReverse: string): Promise<Reverse> {
    return this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/reverse/${enc(ipReverse)}`,
      schema: reverseSchema,
    })
  }

  async setReverse(ipBlock: string, ipReverse: string, reverse: string): Promise<Reverse> {
    return this.request({
      method: "POST",
      path: `/ip/${enc(ipBlock)}/reverse`,
      body: { ipReverse, reverse },
      schema: reverseSchema,
    })
  }

  async deleteReverse(ipBlock: string, ipReverse: string): Promise<void> {
    await this.request({
      method: "DELETE",
      path: `/ip/${enc(ipBlock)}/reverse/${enc(ipReverse)}`,
      schema: voidSchema,
    })
  }

  async enableFirewall(ipBlock: string, ipOnFirewall: string): Promise<FirewallIp> {
    return this.request({
      method: "POST",
      path: `/ip/${enc(ipBlock)}/firewall`,
      body: { ipOnFirewall },
      schema: firewallIpSchema,
    })
  }

  async listFirewalledIps(
    ipBlock: string,
    filter: { enabled?: boolean; state?: FirewallState } = {},
  ): Promise<readonly string[]> {
    return this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/firewall`,
      query: { enabled: filter.enabled, state: filter.state },
      schema: ipListSchema,
    })
  }

  async listFirewallRules(
    ipBlock: string,
    ipOnFirewall: string,
  ): Promise<readonly number[]> {
    return this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/firewall/${enc(ipOnFirewall)}/rule`,
      schema: longListSchema,
    })
  }

  async addFirewallRule(input: AddFirewallRuleInput): Promise<FirewallRule> {
    return this.request({
      method: "POST",
      path: `/ip/${enc(input.ipBlock)}/firewall/${enc(input.ipOnFirewall)}/rule`,
      body: {
        sequence: input.sequence,
        action: input.action,
        protocol: input.protocol,
        source: input.source,
        sourcePort: input.sourcePort,
        destinationPort: input.destinationPort,
        tcpOption: input.tcpOption,
        fragments: input.fragments,
      },
      schema: firewallRuleSchema,
    })
  }

  async getFirewallRule(
    ipBlock: string,
    ipOnFirewall: string,
    sequence: number,
  ): Promise<FirewallRule> {
    return this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/firewall/${enc(ipOnFirewall)}/rule/${enc(sequence)}`,
      schema: firewallRuleSchema,
    })
  }

  async deleteFirewallRule(
    ipBlock: string,
    ipOnFirewall: string,
    sequence: number,
  ): Promise<FirewallRule> {
    return this.request({
      method: "DELETE",
      path: `/ip/${enc(ipBlock)}/firewall/${enc(ipOnFirewall)}/rule/${enc(sequence)}`,
      schema: firewallRuleSchema,
    })
  }

  async getMitigation(ipBlock: string): Promise<Mitigation> {
    const mitigatedIps = await this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/mitigation`,
      schema: ipListSchema,
    })
    return { ipBlock, mitigatedIps }
  }

  async getMitigationIp(ipBlock: string, ipOnMitigation: string): Promise<MitigationIp> {
    return this.request({
      method: "GET",
      path: `/ip/${enc(ipBlock)}/mitigation/${enc(ipOnMitigation)}`,
      schema: mitigationIpSchema,
    })
  }

  /* ------------------------------------------- upgrades on a live service */

  async getUpgradeQuote(
    serviceName: string,
    planCode: string,
    quantity = 1,
  ): Promise<UpgradeQuote> {
    return this.request({
      method: "GET",
      path: `/order/upgrade/vps/${enc(serviceName)}/${enc(planCode)}`,
      query: { quantity },
      schema: upgradeQuoteSchema,
    })
  }

  async orderUpgrade(
    serviceName: string,
    planCode: string,
    body: OrderUpgradeInput,
  ): Promise<UpgradeQuote> {
    return this.request({
      method: "POST",
      path: `/order/upgrade/vps/${enc(serviceName)}/${enc(planCode)}`,
      body: {
        quantity: body.quantity,
        autoPayWithPreferredPaymentMethod: body.autoPayWithPreferredPaymentMethod,
      },
      schema: upgradeQuoteSchema,
    })
  }

  async getServiceOptionQuote(
    serviceName: string,
  ): Promise<readonly GenericOptionDefinition[]> {
    return this.request({
      method: "GET",
      path: `/order/cartServiceOption/vps/${enc(serviceName)}`,
      schema: genericOptionDefinitionListSchema,
    })
  }

  async orderServiceOption(
    serviceName: string,
    body: OrderServiceOptionInput,
  ): Promise<CartItem> {
    // `planCode` travels in the body: the `/{planCode}` path does not exist.
    return this.request({
      method: "POST",
      path: `/order/cartServiceOption/vps/${enc(serviceName)}`,
      body: {
        cartId: body.cartId,
        planCode: body.planCode,
        duration: body.duration,
        pricingMode: body.pricingMode,
        quantity: body.quantity,
      },
      schema: cartItemSchema,
    })
  }
}
