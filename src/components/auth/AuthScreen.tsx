import * as React from "react"
import { bareLabelClass, fieldNumber, monoLineClass } from "./styles"
import { cn } from "@/lib/utils"

/**
 * The editorial frame every `(auth)` screen shares: an eyebrow, a large two-tone
 * headline and a lead paragraph on the left, the form on the right, separated by the
 * hairline rule the rest of oladc.com uses. Server Components throughout — only the
 * fields that need state are client islands.
 */

export function AuthScreen({
  eyebrow,
  title,
  titleMuted,
  lead,
  status,
  children,
  aside,
}: {
  eyebrow: string
  title: string
  /** Second line of the headline, in sage. */
  titleMuted?: string
  lead: React.ReactNode
  /** Optional monospace line under the lead, with a pulsing dot. */
  status?: string
  children: React.ReactNode
  /** Extra content under the form column, such as the secondary links. */
  aside?: React.ReactNode
}) {
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-16 items-start pt-6 md:pt-8 border-t border-bg-dark/12">
      <div className="lg:col-span-5">
        <div className={cn(monoLineClass, "text-[12px] tracking-[0.04em] text-text-base mb-7")}>
          <span aria-hidden className="w-2 h-2 bg-primary-hover inline-block" />
          <span>{eyebrow}</span>
        </div>

        <h1 className="text-[clamp(2.35rem,calc(2.35rem+0.07*(100vw-23rem)),6.75rem)] font-normal tracking-[-0.03em] leading-[1.02] mb-8">
          {title}
          {titleMuted ? (
            <>
              {" "}
              <span className="text-[#c9cbbe]">{titleMuted}</span>
            </>
          ) : null}
        </h1>

        <p className="text-[clamp(1.0625rem,calc(1.0625rem+0.005*(100vw-27.5rem)),1.3125rem)] font-normal tracking-[-0.015em] leading-[1.4] text-text-base/75 max-w-[42ch] mb-12">
          {lead}
        </p>

        {status ? (
          <div
            className={cn(
              monoLineClass,
              "gap-3 pt-6 border-t border-bg-dark/12 text-text-base/55",
            )}
          >
            <span className="w-2 h-2 rounded-full bg-primary-hover animate-pulse" aria-hidden />
            <span>{status}</span>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-5 lg:col-start-7 lg:pt-12">
        {children}
        {aside ? <div className="mt-12 pt-6 border-t border-bg-dark/12">{aside}</div> : null}
      </div>
    </div>
  )
}

/**
 * Bare field: a numbered monospace label, an optional action on the right of the label
 * row (the "forgot password" link), and the control itself.
 */
export function BareField({
  label,
  htmlFor,
  index,
  action,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  /** Position in the form, rendered as `01 /`. */
  index?: number
  action?: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <label htmlFor={htmlFor} className={bareLabelClass}>
          {index === undefined ? label : `${fieldNumber(index)} / ${label}`}
        </label>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
      {hint ? <p className="mt-2 text-xs text-text-base/50">{hint}</p> : null}
    </div>
  )
}

/**
 * Inline message. A rule on the left instead of a filled box, so the screens keep the
 * cardless look. `role="alert"` only for errors, so a success note is not announced as
 * a problem.
 */
export function AuthMessage({
  tone,
  children,
}: {
  tone: "error" | "ok"
  children: React.ReactNode
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "border-l-2 pl-4 py-1 text-sm leading-relaxed",
        tone === "error" ? "border-red-700 text-red-800" : "border-primary-hover text-text-base",
      )}
    >
      {children}
    </p>
  )
}
