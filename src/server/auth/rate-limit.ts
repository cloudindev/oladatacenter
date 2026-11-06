import "server-only"

/**
 * Fixed-window rate limiter, in memory.
 *
 * KNOWN MVP LIMITATION — read before trusting this for anything but abuse slowdown:
 *  - the counters live in the process, so on Vercel every lambda instance has its own
 *    window: the real ceiling is `limit × instances`;
 *  - a deploy or a cold start resets every window;
 *  - it is therefore a brake on scripted abuse, not a security control.
 * The durable version belongs in Postgres (one row per key) or in Upstash Redis. The
 * call sites do not change: `enforceRateLimit` keeps the same signature.
 */

export interface RateLimitRule {
  /** Attempts allowed inside the window. */
  limit: number
  windowMs: number
}

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 10 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  otpSend: { limit: 5, windowMs: 60 * 60 * 1000 },
  otpVerify: { limit: 10, windowMs: 15 * 60 * 1000 },
  totpVerify: { limit: 10, windowMs: 15 * 60 * 1000 },
  emailResend: { limit: 5, windowMs: 60 * 60 * 1000 },
  viesCheck: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitName = keyof typeof RATE_LIMITS

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()
/** Keeps the map from growing without bound in a long-lived process. */
const MAX_KEYS = 20_000

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/** Counts one attempt against `name:key`. */
export function checkRateLimit(name: RateLimitName, key: string): RateLimitResult {
  const rule = RATE_LIMITS[name]
  const mapKey = `${name}:${key}`
  const now = Date.now()

  if (windows.size > MAX_KEYS) sweep(now)

  const existing = windows.get(mapKey)
  if (!existing || existing.resetAt <= now) {
    windows.set(mapKey, { count: 1, resetAt: now + rule.windowMs })
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 }
  }

  existing.count += 1
  const allowed = existing.count <= rule.limit
  return {
    allowed,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  }
}

/** Clears the counter for a key, called after a success so one typo is not punished. */
export function resetRateLimit(name: RateLimitName, key: string): void {
  windows.delete(`${name}:${key}`)
}

export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super("rate limited")
    this.name = "RateLimitedError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Throws `RateLimitedError` when the window is exhausted. */
export function enforceRateLimit(name: RateLimitName, key: string): void {
  const result = checkRateLimit(name, key)
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds)
}

/** Minutes to show in the Spanish "try again later" message. */
export function retryAfterMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60))
}

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
}

/** Test seam. */
export function resetAllRateLimits(): void {
  windows.clear()
}
