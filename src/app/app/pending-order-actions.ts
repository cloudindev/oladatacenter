"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/server/auth/session"
import { clearPendingOrder } from "@/server/pending-order"

/** The customer no longer wants the server they left half-configured. */
export async function discardPendingOrder(): Promise<void> {
  await requireUser()
  await clearPendingOrder()
  revalidatePath("/app")
}
