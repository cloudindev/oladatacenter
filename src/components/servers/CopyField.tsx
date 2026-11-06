"use client"

import { CopyValue } from "@/components/app/ui"

/**
 * `CopyValue` keeps state, so it can only render in a Client Component. This wrapper
 * is the client boundary that lets the Server Components of the panel use it.
 */
export function CopyField({ value, label }: { value: string; label?: string }) {
  return <CopyValue value={value} label={label} />
}
