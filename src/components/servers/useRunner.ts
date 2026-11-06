"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * Calls one Server Action and keeps the three states the panel needs: busy, the
 * Spanish error it returned, and the successful result.
 *
 * Every Server Action in `src/server/services/actions.ts` answers with a discriminated
 * union, so the failure branch always carries a message that is safe to render.
 */

export type Failable = { ok: true } | { ok: false; message: string }

export interface Runner<R extends Failable> {
  busy: boolean
  error: string | null
  result: Extract<R, { ok: true }> | null
  run: (call: () => Promise<R>) => Promise<void>
  reset: () => void
}

export function useRunner<R extends Failable>(
  options: { refreshOnSuccess?: boolean } = {},
): Runner<R> {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<Extract<R, { ok: true }> | null>(null)
  const refresh = options.refreshOnSuccess ?? false

  const run = React.useCallback(
    async (call: () => Promise<R>) => {
      setBusy(true)
      setError(null)
      try {
        const answer = await call()
        if (answer.ok) {
          setResult(answer as Extract<R, { ok: true }>)
          if (refresh) router.refresh()
        } else {
          setResult(null)
          setError(answer.message)
        }
      } catch {
        setResult(null)
        setError("No hemos podido completar la operación. Inténtalo de nuevo.")
      } finally {
        setBusy(false)
      }
    },
    [refresh, router],
  )

  const reset = React.useCallback(() => {
    setError(null)
    setResult(null)
  }, [])

  return { busy, error, result, run, reset }
}
