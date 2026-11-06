import "server-only"
import { cookies } from "next/headers"
import { PENDING_ORDER_COOKIE, sanitizePendingOrder } from "@/lib/pending-order"

/** The order URL the visitor configured and did not buy, if it is still remembered. */
export async function pendingOrderHref(): Promise<string | null> {
  const cookieStore = await cookies()
  return sanitizePendingOrder(cookieStore.get(PENDING_ORDER_COOKIE)?.value)
}

/** Forgets the pending order: the customer discarded it, or an order was created. */
export async function clearPendingOrder(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PENDING_ORDER_COOKIE)
}
