import "server-only"
import { cookies } from "next/headers"
import { readSignedCookieValue, signCookieValue } from "@/lib/crypto"
import { env } from "@/lib/env"
import type { ImpersonationPort, ImpersonationState } from "./deps"

/**
 * Impersonation, as a signed marker this module owns end to end.
 *
 * What it is: an HMAC-signed, httpOnly cookie that says "admin X is looking at customer
 * Y, since Z". `src/server/admin/**` is the only code that reads it, the admin shell
 * shows a banner the whole time it is set, and starting or stopping it writes an
 * `auditLog` row. It cannot be forged — the signature is keyed with `AUTH_SECRET`, the
 * same primitive the second-factor marker uses.
 *
 * What it deliberately is NOT: a way to become the customer. It does not touch
 * `sessions`, it does not change what `currentSession()` returns, and it grants no access
 * to `/app`. The admin keeps their own admin session and their own audit trail.
 *
 * TODO(integration): `src/server/auth/session.ts` exposes no documented helper for
 * assuming another user's identity (no `impersonate`, no `actOnBehalfOf`). Rather than
 * write a second session implementation in the admin package, this marker drives the
 * admin's own read-only view of the customer. When such a helper lands, call it here and
 * keep this cookie as the visible flag and the audit anchor.
 */

export const IMPERSONATION_COOKIE = "ola_admin_impersonation"

/** Short on purpose: an impersonation left open is an audit problem. */
const IMPERSONATION_TTL_MS = 30 * 60 * 1000

interface CookiePayload {
  c: string
  e: string
  a: string
  t: number
}

function encode(state: ImpersonationState): string {
  const payload: CookiePayload = {
    c: state.customerId,
    e: state.customerEmail,
    a: state.adminUserId,
    t: state.startedAt.getTime(),
  }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function decode(raw: string): ImpersonationState | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    if (typeof parsed !== "object" || parsed === null) return null
    const payload = parsed as Partial<CookiePayload>
    if (
      typeof payload.c !== "string" ||
      typeof payload.e !== "string" ||
      typeof payload.a !== "string" ||
      typeof payload.t !== "number"
    ) {
      return null
    }
    return {
      customerId: payload.c,
      customerEmail: payload.e,
      adminUserId: payload.a,
      startedAt: new Date(payload.t),
    }
  } catch {
    return null
  }
}

export function impersonationCookies(): ImpersonationPort {
  return {
    async read(): Promise<ImpersonationState | null> {
      const store = await cookies()
      const raw = store.get(IMPERSONATION_COOKIE)?.value
      if (!raw) return null
      const value = readSignedCookieValue(raw, env().AUTH_SECRET)
      if (!value) return null
      const state = decode(value)
      if (!state) return null
      // An expired marker is treated as absent, so a stale cookie cannot keep the banner
      // up or make an admin think they are still scoped to a customer.
      if (Date.now() - state.startedAt.getTime() > IMPERSONATION_TTL_MS) return null
      return state
    },

    async start(state: ImpersonationState): Promise<void> {
      const store = await cookies()
      store.set(IMPERSONATION_COOKIE, signCookieValue(encode(state), env().AUTH_SECRET), {
        httpOnly: true,
        secure: env().NODE_ENV === "production",
        sameSite: "lax",
        path: "/admin",
        expires: new Date(state.startedAt.getTime() + IMPERSONATION_TTL_MS),
      })
    },

    async stop(): Promise<void> {
      const store = await cookies()
      store.delete(IMPERSONATION_COOKIE)
    },
  }
}
