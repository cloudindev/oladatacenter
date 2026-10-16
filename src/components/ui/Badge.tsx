import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline" | "new"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-surface-dark text-text-dark",
    outline: "border-border-base text-text-muted",
    new: "border-transparent bg-primary text-bg-dark",
  }

  return (
    <div
      className={cn(
        "label-mono inline-flex items-center rounded-sm border px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
