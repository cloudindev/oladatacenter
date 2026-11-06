import "server-only"
import { cache } from "react"
import { unstable_rethrow } from "next/navigation"
import { allowedActions, customerMessageFor, type ServiceAction } from "@ola/core"
import { logger } from "@/lib/logger"
import { customerContext } from "./customer"
import { getServiceForCustomer } from "./repository"
import type { ServiceRecord } from "./types"

/**
 * One service, resolved once per request and shared by the server layout and the tab
 * page inside it (`cache` deduplicates the lookup).
 *
 * The three states are the three things that can happen, and each one has a different
 * answer: render the page, render a notice, or answer 404. A service that belongs to
 * another customer is `missing`, never `forbidden`.
 */
export type ServicePage =
  | { state: "ready"; customerId: string; email: string; service: ServiceRecord }
  | { state: "unavailable"; message: string }
  | { state: "missing" }

export const serviceForPage = cache(async (serviceId: string): Promise<ServicePage> => {
  const context = await customerContext()
  if (!context.ok) return { state: "unavailable", message: context.message }

  try {
    const service = await getServiceForCustomer(serviceId, context.customerId)
    if (!service) return { state: "missing" }
    return {
      state: "ready",
      customerId: context.customerId,
      email: context.email,
      service,
    }
  } catch (error) {
    unstable_rethrow(error)
    logger.error(
      { serviceId, error: error instanceof Error ? error.message : String(error) },
      "could not load the service",
    )
    return { state: "unavailable", message: customerMessageFor(error) }
  }
})

/** Which operations the current status allows, as a lookup the pages can read. */
export function actionGate(service: ServiceRecord): (action: ServiceAction) => boolean {
  const allowed = allowedActions(service.status)
  return (action) => allowed.includes(action)
}
