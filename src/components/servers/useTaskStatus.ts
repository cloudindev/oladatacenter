"use client"

import * as React from "react"
import type { TaskStateView } from "./types"

/**
 * Follows one operation until the OVH task really finishes.
 *
 * It polls `/api/services/{serviceId}/actions/{actionId}`, which reads the task from
 * OVH and writes the result on the `actions` row. Nothing here guesses progress: when
 * the endpoint cannot be reached the hook says so instead of pretending.
 *
 * The stored state is tagged with the action it belongs to, so a new operation starts
 * from scratch without having to reset state from inside an effect.
 */

const INTERVAL_MS = 2500
/** ~5 minutes of polling. A reinstall takes longer, and the UI says so rather than lie. */
const MAX_ATTEMPTS = 120

export interface TaskStatus {
  state: TaskStateView | null
  /** Set when we could not read the state at all. */
  error: string | null
  /** True while the task is still running and we are still polling. */
  polling: boolean
  /** True once we stopped polling without the task finishing. */
  gaveUp: boolean
}

const IDLE: TaskStatus = { state: null, error: null, polling: false, gaveUp: false }
const STARTING: TaskStatus = { state: null, error: null, polling: true, gaveUp: false }

interface Tracked {
  actionId: string
  status: TaskStatus
}

export function useTaskStatus(
  serviceId: string,
  actionId: string | null,
  options: { onDone?: () => void } = {},
): TaskStatus {
  const [tracked, setTracked] = React.useState<Tracked | null>(null)

  // Kept in a ref so a new callback identity does not restart the polling loop.
  const onDoneRef = React.useRef(options.onDone)
  React.useEffect(() => {
    onDoneRef.current = options.onDone
  }, [options.onDone])

  React.useEffect(() => {
    if (!actionId) return

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const write = (status: TaskStatus): void => {
      if (!cancelled) setTracked({ actionId, status })
    }

    const poll = async (): Promise<void> => {
      attempts += 1
      try {
        const response = await fetch(
          `/api/services/${encodeURIComponent(serviceId)}/actions/${encodeURIComponent(actionId)}`,
          { cache: "no-store" },
        )
        if (cancelled) return

        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null)
          write({
            state: null,
            error: readMessage(body) ?? "No hemos podido comprobar el estado de la operación.",
            polling: false,
            gaveUp: false,
          })
          return
        }

        const body = (await response.json()) as TaskStateView
        if (cancelled) return

        if (body.terminal) {
          write({ state: body, error: null, polling: false, gaveUp: false })
          onDoneRef.current?.()
          return
        }
        write({ state: body, error: null, polling: true, gaveUp: false })
      } catch {
        if (cancelled) return
        write({
          state: null,
          error: "No hemos podido comprobar el estado de la operación.",
          polling: true,
          gaveUp: false,
        })
      }

      if (attempts >= MAX_ATTEMPTS) {
        write({ state: null, error: null, polling: false, gaveUp: true })
        return
      }
      timer = setTimeout(() => void poll(), INTERVAL_MS)
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [serviceId, actionId])

  if (!actionId) return IDLE
  return tracked && tracked.actionId === actionId ? tracked.status : STARTING
}

function readMessage(body: unknown): string | null {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message
    if (typeof message === "string" && message.length > 0) return message
  }
  return null
}
