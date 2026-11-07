import "server-only"
import { desc, eq } from "drizzle-orm"
import { PLAN_BRANDING, type OrderKind, type OrderStatus, type Term } from "@ola/core"
import { db, orders } from "@ola/db"

/** One order as the customer area lists it. No provider identifier, no cost. */
export interface OrderListItem {
  id: string
  /** Short, human reference: the last 8 characters of the id, uppercased. */
  reference: string
  kind: OrderKind
  status: OrderStatus
  /** "OLA VPS L" when the plan is known. */
  planName: string | null
  term: Term
  total: number
  createdAt: Date
  paidAt: Date | null
  deliveredAt: Date | null
}

function planNameOf(items: Record<string, unknown>): string | null {
  const code = items["planCode"]
  return typeof code === "string" ? (PLAN_BRANDING[code]?.name ?? null) : null
}

/** The customer's orders, newest first. Drafts never paid are left out. */
export async function listOrdersForCustomer(
  customerId: string,
  limit = 50,
): Promise<OrderListItem[]> {
  const rows = await db()
    .select({
      id: orders.id,
      kind: orders.kind,
      status: orders.status,
      items: orders.items,
      term: orders.term,
      total: orders.total,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)

  return rows
    .filter((row) => row.status !== "draft")
    .map((row) => ({
      id: row.id,
      reference: row.id.slice(-8).toUpperCase(),
      kind: row.kind,
      status: row.status,
      planName: planNameOf(row.items),
      term: row.term,
      total: row.total,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      deliveredAt: row.deliveredAt,
    }))
}
