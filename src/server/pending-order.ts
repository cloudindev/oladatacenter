import "server-only"
import { cookies } from "next/headers"
import { PENDING_ORDER_COOKIE, sanitizePendingOrder } from "@/lib/pending-order"

/** The order URL the visitor configured before signing up, if it is still remembered. */
export async function pendingOrderHref(): Promise<string | null> {
  const cookieStore = await cookies()
  return sanitizePendingOrder(cookieStore.get(PENDING_ORDER_COOKIE)?.value)
}
