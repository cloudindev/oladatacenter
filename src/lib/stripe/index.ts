/**
 * The Stripe port and its two adapters.
 *
 * `client.ts` is deliberately NOT re-exported here: it is `server-only` and importing this
 * barrel from a test or from a Client Component must not drag the secret key in.
 */
export * from "./types"
export * from "./failures"
export { MockStripe, mockFingerprint, parseWebhookBody } from "./mock"
export { HttpStripeGateway } from "./http"
