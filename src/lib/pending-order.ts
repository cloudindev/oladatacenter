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
