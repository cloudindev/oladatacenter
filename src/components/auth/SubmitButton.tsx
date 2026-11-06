"use client"

import { useFormStatus } from "react-dom"
import { Button, type ButtonProps } from "@/components/app/ui"

/**
 * Submit button that knows when its own form is in flight. The only reason this is a
 * Client Component: `useFormStatus` needs one, and without it a slow argon2 hash or a
 * VIES call looks like a dead page.
 */
export function SubmitButton({
  children,
  variant = "primary",
  withArrow = true,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button {...props} type="submit" variant={variant} withArrow={withArrow} loading={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}
