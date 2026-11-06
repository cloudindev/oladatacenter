import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"
import { customerMessageFor, isDomainError } from "@ola/core"
import { toDomainError } from "@ola/ovh"
import { currentSession } from "@/server/auth/session"
import { ovh } from "@/server/providers"
import { logger } from "@/lib/logger"
import {
  getActionForService,
  getServiceForCustomer,
  updateActionFromTask,
} from "@/server/services/repository"
import type { TaskStateView } from "@/components/servers/types"

/**
 * Live state of one operation, so the UI can show the real OVH task instead of a
 * spinner that lies.
 *
 * On every poll: if the action still has a non-terminal OVH task, the task is read from
 * OVH and the `actions` row is updated. The answer is always what the provider says.
 *
 * Authorisation is the same as everywhere else — the action must belong to a service
 * that belongs to the signed-in customer, and anything else is a 404.
 */

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; actionId: string }> },
): Promise<NextResponse> {
  const { id, actionId } = await context.params

  const session = await currentSession()
  if (!session?.customer) {
    return NextResponse.json({ message: "No has iniciado sesión." }, { status: 401, headers: NO_STORE })
  }

  try {
    const service = await getServiceForCustomer(id, session.customer.id)
    if (!service) {
      return NextResponse.json(
        { message: "No encontramos este servidor." },
        { status: 404, headers: NO_STORE },
      )
    }

    const record = await getActionForService(actionId, service.id)
    if (!record) {
      return NextResponse.json(
        { message: "No encontramos esta operación." },
        { status: 404, headers: NO_STORE },
      )
    }

    let { view } = record
    if (!view.terminal && record.ovhTaskId !== null && service.ovhServiceName) {
      const task = await ovh().getTask(service.ovhServiceName, record.ovhTaskId)
      const updated = await updateActionFromTask(view.id, { id: task.id, state: task.state })
      view = { ...view, status: updated.status, terminal: updated.terminal }
    }

    // `actions.error` holds the provider's own wording, which is admin-only. The customer
    // always gets our message.
    const body: TaskStateView = {
      actionId: view.id,
      type: view.type,
      status: view.status,
      terminal: view.terminal,
      message:
        view.status === "error"
          ? "La operación no ha podido completarse. Nuestro equipo ya está avisado."
          : null,
    }
    return NextResponse.json(body, { headers: NO_STORE })
  } catch (error) {
    unstable_rethrow(error)
    const domain = isDomainError(error) ? error : toDomainError(error)
    logger.error({ code: domain.code, detail: domain.detail }, "task polling failed")
    return NextResponse.json(
      { message: customerMessageFor(domain) },
      { status: 503, headers: NO_STORE },
    )
  }
}
