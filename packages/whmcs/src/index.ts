/**
 * `@ola/whmcs` — the only module in the repo that knows a WHMCS action name exists.
 *
 * Construct the adapter in `src/server/providers.ts` and nowhere else:
 *
 *   whmcs() -> mocksEnabled() ? new MockWhmcsClient() : new HttpWhmcsClient({ … })
 */

export type {
  CreateClientInput,
  CreateInvoiceInput,
  CreateInvoiceLine,
  CreateOrderInput,
  CreateSsoTokenOptions,
  ListInvoicesFilter,
  OlaConfigOptionIds,
  OlaConfigSelection,
  RecordPaymentInput,
  UpdateClientInput,
  UpdateServiceInput,
  WhmcsBillingCycle,
  WhmcsClient,
  WhmcsClientAccount,
  WhmcsClientStatus,
  WhmcsConfigOptions,
  WhmcsCustomFields,
  WhmcsInvoiceDetail,
  WhmcsInvoiceStatusFilter,
  WhmcsInvoiceSummary,
  WhmcsLogFields,
  WhmcsLogger,
  WhmcsService,
  WhmcsServiceStatus,
  WhmcsSsoDestination,
} from "./client"
export {
  billingCycleForTerm,
  buildConfigOptions,
  WHMCS_CLIENT_STATUSES,
  WHMCS_INVOICE_STATUS_FILTERS,
  WHMCS_SERVICE_STATUSES,
  WHMCS_SSO_DESTINATIONS,
} from "./client"

export { HttpWhmcsClient, centsToDecimal, formatWhmcsDate, formatWhmcsDateTime } from "./http-client"
export type { HttpWhmcsClientOptions } from "./http-client"

export { MockWhmcsClient, MOCK_DEFAULT_PRICE_CENTS } from "./mock-client"
export type { MockInvoice, MockOrder, MockWhmcsClientOptions } from "./mock-client"

export {
  WhmcsApiError,
  isWhmcsApiError,
  toBillingDomainError,
  writesDisabledError,
} from "./errors"
export type { WhmcsApiErrorOptions, WhmcsErrorKind } from "./errors"

export {
  WHMCS_INVOICE_STATUSES,
  whmcsInvoiceStatusToDomain,
  whmcsEnvelopeSchema,
  whmcsClientSchema,
  whmcsInvoiceRowSchema,
  whmcsServiceRowSchema,
  getClientsResponseSchema,
  getClientDetailsResponseSchema,
  getInvoiceResponseSchema,
  getInvoicesResponseSchema,
  getClientsProductsResponseSchema,
  addClientResponseSchema,
  addOrderResponseSchema,
  createInvoiceResponseSchema,
  createSsoTokenResponseSchema,
} from "./types"
export type {
  DomainInvoiceStatus,
  WhmcsClientRecord,
  WhmcsEnvelope,
  WhmcsInvoiceItem,
  WhmcsInvoiceRow,
  WhmcsInvoiceStatus,
  WhmcsResult,
  WhmcsServiceRecord,
} from "./types"

export {
  assertWebhookSignature,
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  signWebhookPayload,
  verifyWebhookSignature,
  WebhookSignatureError,
  WEBHOOK_HEADERS,
  WEBHOOK_SIGNATURE_PREFIX,
  WHMCS_WEBHOOK_EVENTS,
  whmcsWebhookEventSchema,
  webhookInvoiceDomainStatus,
} from "./webhook"
export type {
  VerifyWebhookSignatureInput,
  WebhookRejectionReason,
  WebhookVerification,
  WhmcsWebhookEvent,
  WhmcsWebhookEventName,
} from "./webhook"

export { encodePhpArrayParam, phpSerializeFlatArray } from "./php-serialize"
export type { PhpFlatArray, PhpScalar } from "./php-serialize"
