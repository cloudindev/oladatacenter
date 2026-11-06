import { NextResponse, type NextRequest } from "next/server"
import {
  isOrderPath,
  PENDING_ORDER_COOKIE,
  PENDING_ORDER_MAX_AGE_SECONDS,
  sanitizePendingOrder,
} from "@/lib/pending-order"

/**
 * Sends visitors without a session from the customer area to the login page with a
 * `next` that brings them back to the page they asked for, and remembers a configured
 * order across sign-up. Only checks that the cookie exists: whether the session is
 * valid is still decided by `requireUser()` on the server.
 *
 * Kept literal to avoid importing the auth module (and its database client) here.
 */
const SESSION_COOKIE = "ola_session"

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl
  const target = `${pathname}${search}`
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const pending = isOrderPath(pathname) ? sanitizePendingOrder(target) : null

  if (!hasSession) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", target)
    const response = NextResponse.redirect(login)
    if (pending) {
      response.cookies.set(PENDING_ORDER_COOKIE, pending, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: PENDING_ORDER_MAX_AGE_SECONDS,
      })
    }
    return response
  }

  // Signed in and on the order page: the remembered order has been picked up.
  if (isOrderPath(pathname) && request.cookies.get(PENDING_ORDER_COOKIE)) {
    const response = NextResponse.next()
    response.cookies.delete(PENDING_ORDER_COOKIE)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/app/:path*"],
}
