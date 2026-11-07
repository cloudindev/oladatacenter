/**
 * The last server a visitor configured and did not buy.
 *
 * The configurator hands off to `/app/servers/new?…`. The proxy remembers that URL in a
 * cookie on every visit, signed in or not, so the choice survives sign-up, email
 * verification, onboarding and simply leaving. The panel keeps offering it until the
 * customer discards it or an order is actually created. Holds no personal data: only the
 * public configuration.
 */

export const PENDING_ORDER_COOKIE = "ola_pending_order"
export const PENDING_ORDER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const ORDER_PATH = "/app/servers/new"

/** Accepts only the order page with a query string, so the cookie can never redirect elsewhere. */
export function sanitizePendingOrder(value: string | undefined | null): string | null {
  if (!value) return null
  if (value.length > 512) return null
  if (value !== ORDER_PATH && !value.startsWith(`${ORDER_PATH}?`)) return null
  if (/[\s\\]/.test(value)) return null
  return value
}

export function isOrderPath(pathname: string): boolean {
  return pathname === ORDER_PATH
}

/**
 * Cookie payload: `<owner>|<href>`. The owner is the sha256 of the session token that
 * configured the order (the same value `sessions.token` stores, never the token itself),
 * or empty when a visitor without a session configured it. Only that owner, or the same
 * user after signing in again, is ever shown the order: one browser can be shared.
 */
export interface PendingOrder {
  owner: string | null
  href: string
}

const OWNER_PATTERN = /^[0-9a-f]{64}$/

export function encodePendingOrder(href: string, owner: string | null): string {
  return `${owner ?? ""}|${href}`
}

/** Null for anything malformed, including the old owner-less format. */
export function decodePendingOrder(value: string | undefined | null): PendingOrder | null {
  if (!value) return null
  const separator = value.indexOf("|")
  if (separator < 0) return null
  const owner = value.slice(0, separator)
  const href = sanitizePendingOrder(value.slice(separator + 1))
  if (!href) return null
  if (owner !== "" && !OWNER_PATTERN.test(owner)) return null
  return { owner: owner === "" ? null : owner, href }
}

/** sha256 hex with Web Crypto, so the proxy can compute the owner without Node APIs. */
export async function sessionOwnerTag(sessionToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionToken))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
