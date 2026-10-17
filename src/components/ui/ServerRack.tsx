import * as React from "react"
import { cn } from "@/lib/utils"

interface ServerRackProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "lg" | "md" | "sm"
  activeLeds?: number
  className?: string
}

export function ServerRack({ activeLeds = 5, className, ...props }: ServerRackProps) {
  // A dark server rack illustration with glowing cyan LEDs
  return (
    <div
      className={cn(
        "relative rounded-xl bg-[#0f172a] border border-[#1e293b] shadow-2xl overflow-hidden flex flex-col gap-1 p-2 pb-6",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      
      {/* Front bezel top */}
      <div className="h-4 w-full bg-[#121a2f] rounded-sm mb-2 flex items-center px-3 justify-between">
         <div className="flex gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse" />
           <div className="w-1.5 h-1.5 rounded-full bg-text-muted/50" />
         </div>
         <div className="text-[8px] text-text-muted font-mono tracking-widest">OLADC-AI</div>
      </div>

      {/* Servers (Units) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 w-full bg-[#0f172a] border border-[#1e293b]/50 rounded-sm relative group overflow-hidden flex items-center px-4">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Vents */}
          <div className="flex gap-2 w-1/2">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-10 w-3 bg-[#0f172a] rounded-sm shadow-inner" />
            ))}
          </div>

          <div className="flex-1" />

          {/* LEDs & Drives */}
          <div className="flex items-center gap-3 w-1/3 justify-end">
             {Array.from({ length: 4 }).map((_, k) => {
                const isLedActive = k < activeLeds;
                return (
                  <div key={k} className="h-8 w-12 border border-[#1e293b]/30 bg-[#0a0f1c] rounded-sm flex items-center justify-end px-1.5">
                     <div 
                       className={cn(
                         "w-1 h-3 rounded-sm transition-all duration-700",
                         isLedActive ? "bg-primary shadow-[0_0_8px_var(--color-primary)] animate-pulse" : "bg-[#1e293b]"
                       )} 
                     />
                  </div>
                )
             })}
          </div>
        </div>
      ))}
      
      {/* Bottom bezel */}
      <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#121a2f] flex items-center px-3 justify-between opacity-80">
         <div className="flex gap-1">
           <div className="w-1 h-1 rounded-full bg-[#1e293b]" />
           <div className="w-1 h-1 rounded-full bg-[#1e293b]" />
         </div>
      </div>
    </div>
  )
}
