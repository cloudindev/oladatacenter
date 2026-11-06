import "server-only"
import { Resend } from "resend"
import { MockEmailSender, ResendSender, type EmailSender } from "@ola/email"
import { HttpOvhClient, MockOvhClient, type OvhClient } from "@ola/ovh"
import { HttpWhmcsClient, MockWhmcsClient, type WhmcsClient } from "@ola/whmcs"
import { env, providerMocked } from "@/lib/env"

/**
 * The only place in the codebase where a provider adapter is constructed.
 * Everything else takes the port as a dependency.
 */

let ovhClient: OvhClient | null = null
let whmcsClient: WhmcsClient | null = null

export function ovh(): OvhClient {
  if (ovhClient) return ovhClient

  if (providerMocked("ovh")) {
    ovhClient = new MockOvhClient()
    return ovhClient
  }

  const config = env()
  if (!config.OVH_APP_KEY || !config.OVH_APP_SECRET || !config.OVH_CONSUMER_KEY) {
    throw new Error("OVH credentials are missing; set OVH_APP_KEY/SECRET/CONSUMER_KEY or MOCK_OVH=true")
  }

  ovhClient = new HttpOvhClient({
    endpoint: config.OVH_ENDPOINT,
    applicationKey: config.OVH_APP_KEY,
    applicationSecret: config.OVH_APP_SECRET,
    consumerKey: config.OVH_CONSUMER_KEY,
    subsidiary: config.OVH_SUBSIDIARY,
  })
  return ovhClient
}

/** The OVH routes that need no account: public catalog and live stock. */
export type OvhPublic = Pick<OvhClient, "getDatacenterStock" | "fetchPublicCatalog">

let ovhPublicClient: OvhPublic | null = null

/**
 * OVH's unauthenticated, read-only routes. Real even when `USE_MOCK_PROVIDERS` is on:
 * they cannot order or change anything, and mocked stock would sell servers OVH does not
 * have. Only the test runner gets the mock, so tests never touch the network.
 */
export function ovhPublic(): OvhPublic {
  if (ovhPublicClient) return ovhPublicClient
  const config = env()
  ovhPublicClient =
    config.NODE_ENV === "test"
      ? new MockOvhClient()
      : new HttpOvhClient({
          endpoint: config.OVH_ENDPOINT,
          applicationKey: "",
          applicationSecret: "",
          consumerKey: "",
          subsidiary: config.OVH_SUBSIDIARY,
          maxAttempts: 2,
        })
  return ovhPublicClient
}

export function whmcs(): WhmcsClient {
  if (whmcsClient) return whmcsClient

  if (providerMocked("whmcs")) {
    whmcsClient = new MockWhmcsClient()
    return whmcsClient
  }

  const config = env()
  // An open proxy would let anyone reach WHMCS from an allowlisted IP.
  if (config.WHMCS_PROXY_URL && !config.WHMCS_PROXY_TOKEN) {
    throw new Error("WHMCS_PROXY_URL is set without WHMCS_PROXY_TOKEN; refusing an unauthenticated proxy")
  }
  // A simulated Stripe charge recorded in the real WHMCS would be a fake payment in the
  // books. Refuse the combination instead of trusting the operator to notice.
  if (config.WHMCS_WRITE_ENABLED && providerMocked("stripe")) {
    throw new Error(
      "WHMCS_WRITE_ENABLED is true while Stripe is mocked; refusing to book simulated payments in the real WHMCS",
    )
  }
  if (!config.WHMCS_API_URL || !config.WHMCS_API_IDENTIFIER || !config.WHMCS_API_SECRET) {
    throw new Error("WHMCS credentials are missing; set WHMCS_API_* or MOCK_WHMCS=true")
  }

  whmcsClient = new HttpWhmcsClient({
    apiUrl: config.WHMCS_API_URL,
    identifier: config.WHMCS_API_IDENTIFIER,
    secret: config.WHMCS_API_SECRET,
    proxyUrl: config.WHMCS_PROXY_URL,
    proxyToken: config.WHMCS_PROXY_TOKEN,
    writeEnabled: config.WHMCS_WRITE_ENABLED,
  })
  return whmcsClient
}

let emailClient: EmailSender | null = null

/**
 * The shared outbound email sender.
 *
 * Real whenever a Resend key is configured, even with `USE_MOCK_PROVIDERS` on: that flag
 * stands in for OVH and WHMCS until their credentials exist, and a sign-up whose
 * verification email never leaves is a dead end. Falls back to the in-memory mock when no
 * key is set (a missing key degrades to "nothing was sent" rather than throwing inside a
 * paid order) and always under the test runner, so tests never send mail.
 */
export function emailSender(): EmailSender {
  if (emailClient) return emailClient

  const config = env()
  if (config.NODE_ENV === "test" || !config.RESEND_API_KEY) {
    emailClient = new MockEmailSender()
    return emailClient
  }

  emailClient = new ResendSender(new Resend(config.RESEND_API_KEY), { from: config.EMAIL_FROM })
  return emailClient
}

/**
 * Hard gate on real OVH orders. Called immediately before any checkout so a
 * misconfigured environment can never spend money.
 */
export function assertOvhOrdersEnabled(): void {
  if (providerMocked("ovh")) return
  if (!env().OVH_ORDERS_ENABLED) {
    throw new Error("OVH_ORDERS_ENABLED is false; refusing to place a real order")
  }
  // A real server must never be bought for a payment that was only simulated.
  if (providerMocked("stripe")) {
    throw new Error("Stripe is mocked; refusing to place a real OVH order without a real payment")
  }
}

/** Test seam: drop the cached singletons. */
export function resetProviders(): void {
  emailClient = null
  ovhClient = null
  ovhPublicClient = null
  whmcsClient = null
}
