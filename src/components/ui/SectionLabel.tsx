import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SectionLabel({ children, className, ...props }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "text-xs font-semibold tracking-wider text-primary uppercase flex items-center gap-2 mb-3",
        className
      )}
      {...props}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {children}
    </div>
  )
}
