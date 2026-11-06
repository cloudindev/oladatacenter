"use client"

import { useActionState } from "react"
import { Button } from "@/components/app/ui"
import { stopImpersonation } from "@/server/admin/actions"

/**
 * The banner that stays on screen for as long as an impersonation is active.
 *
 * Sticky, high contrast, and it names the customer. An operator must never be able to
 * forget whose account they are looking at — and the marker expires on its own after
 * thirty minutes in case they close the tab instead of this banner.
 */
export function ImpersonationBanner({
  customerEmail,
  startedAt,
}: {
  customerEmail: string
  startedAt: string
}) {
  const [result, submit, pending] = useActionState(stopImpersonation, null)

  return (
    <div
      role="alert"
      className="sticky top-0 z-30 border-b-2 border-[#8a2d26] bg-[#fdeceb] px-4 py-2.5 sm:px-6"
    >
      <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#8a2d26]">
          <span className="label-mono mr-2 rounded bg-[#8a2d26] px-1.5 py-0.5 text-[#fdeceb]">
            Suplantación activa
          </span>
          Estás viendo la cuenta de <strong className="font-medium">{customerEmail}</strong> desde{" "}
          <time dateTime={startedAt} className="font-mono text-xs">
            {startedAt.slice(0, 16).replace("T", " ")}
          </time>
          . Queda registrado en la auditoría.
        </p>
        <form action={submit}>
          <Button type="submit" variant="danger" loading={pending} className="h-9">
            Terminar suplantación
          </Button>
        </form>
      </div>
      {result && !result.ok ? (
        <p className="mx-auto mt-1 max-w-[110rem] text-xs text-[#8a2d26]">{result.message}</p>
      ) : null}
    </div>
  )
}
