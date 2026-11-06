import "server-only"
import { Resend } from "resend"
import { MockEmailSender, ResendSender, type EmailSender } from "@ola/email"
import { HttpOvhClient, MockOvhClient, type OvhClient } from "@ola/ovh"
import { HttpWhmcsClient, MockWhmcsClient, type WhmcsClient } from "@ola/whmcs"
import { env, mocksEnabled } from "@/lib/env"

/**
 * The only place in the codebase where a provider adapter is constructed.
 * Everything else takes the port as a dependency.
 */

let ovhClient: OvhClient | null = null
let whmcsClient: WhmcsClient | null = null

export function ovh(): OvhClient {
  if (ovhClient) return ovhClient

  if (mocksEnabled()) {
    ovhClient = new MockOvhClient()
    return ovhClient
  }

  const config = env()
  if (!config.OVH_APP_KEY || !config.OVH_APP_SECRET || !config.OVH_CONSUMER_KEY) {
    throw new Error("OVH credentials are missing; set OVH_APP_KEY/SECRET/CONSUMER_KEY or USE_MOCK_PROVIDERS=true")
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

export function whmcs(): WhmcsClient {
  if (whmcsClient) return whmcsClient

  if (mocksEnabled()) {
    whmcsClient = new MockWhmcsClient()
    return whmcsClient
  }

  const config = env()
  if (!config.WHMCS_API_URL || !config.WHMCS_API_IDENTIFIER || !config.WHMCS_API_SECRET) {
    throw new Error("WHMCS credentials are missing; set WHMCS_API_* or USE_MOCK_PROVIDERS=true")
  }

  whmcsClient = new HttpWhmcsClient({
    apiUrl: config.WHMCS_API_URL,
    identifier: config.WHMCS_API_IDENTIFIER,
    secret: config.WHMCS_API_SECRET,
    proxyUrl: config.WHMCS_PROXY_URL,
    writeEnabled: config.WHMCS_WRITE_ENABLED,
  })
  return whmcsClient
}

let emailClient: EmailSender | null = null

/**
 * The shared outbound email sender.
 *
 * Falls back to the in-memory mock whenever the providers are mocked OR no Resend key is
 * configured, so a missing key degrades to "nothing was sent" rather than throwing inside
 * a paid order.
 */
export function emailSender(): EmailSender {
  if (emailClient) return emailClient

  const config = env()
  if (mocksEnabled() || !config.RESEND_API_KEY) {
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
  if (mocksEnabled()) return
  if (!env().OVH_ORDERS_ENABLED) {
    throw new Error("OVH_ORDERS_ENABLED is false; refusing to place a real order")
  }
}

/** Test seam: drop the cached singletons. */
export function resetProviders(): void {
  emailClient = null
  ovhClient = null
  whmcsClient = null
}
