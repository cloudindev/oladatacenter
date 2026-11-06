"use client"

import { useFormStatus } from "react-dom"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { cn } from "@/lib/utils"

/**
 * The site's parallelogram CTA wired to a form's own pending state.
 *
 * `ArrowCta` takes no `disabled`, so while the action runs the button is wrapped in a
 * `pointer-events-none` span: a second click cannot queue a second submission, and
 * argon2 or a VIES call no longer looks like a dead page.
 */
export function ArrowSubmit({
  children,
  pendingLabel = "Enviando",
  variant = "dark",
}: {
  children: React.ReactNode
  pendingLabel?: string
  variant?: "dark" | "light"
}) {
  const { pending } = useFormStatus()
  return (
    <span
      aria-busy={pending}
      className={cn("inline-block", pending && "pointer-events-none opacity-60")}
    >
      <ArrowCta type="submit" variant={variant}>
        {pending ? pendingLabel : children}
      </ArrowCta>
    </span>
  )
}
