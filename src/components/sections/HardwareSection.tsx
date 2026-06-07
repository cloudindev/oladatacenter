"use client"

import * as React from "react"
import { SectionLabel } from "@/components/ui/SectionLabel"
import { Badge } from "@/components/ui/Badge"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const SERVERS = [
  {
    id: "c1",
    badge: "1U · ENTRY",
    title: "OLADC C1",
    cpu: "AMD EPYC 9304",
    drives: "4 × NVMe U.2",
    ram: "up to 384 GB",
    net: "2 × 25 GbE",
    price: "from €129 /mo",
    highlight: false,
    new: false,
    rackSize: "1U",
  },
  {
    id: "c2",
    badge: "2U · BALANCED",
    title: "OLADC C2",
    cpu: "2 × EPYC 9334",
    drives: "12 × NVMe U.2",
    ram: "up to 2 TB",
    net: "2 × 100 GbE",
    price: "from €349 /mo",
    highlight: false,
    new: false,
    rackSize: "2U",
  },
  {
    id: "ai1",
    badge: "4U · AI / GPU",
    title: "OLADC AI1",
    cpu: "2 × EPYC 9004",
    drives: "NVLink + 400G",
    ram: "up to 3 TB",
    net: "2 × 400 GbE",
    price: "from €4,990 /mo",
    highlight: true,
    new: true,
    rackSize: "4U",
  }
]

export function HardwareSection() {
  return (
    <section id="servers" className="py-24 md:py-32 bg-[#e2e8f0]/30">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="mb-16">
          <SectionLabel>02 · HARDWARE</SectionLabel>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-4">
            The OLADC server line.
          </h2>
          <p className="text-lg text-text-muted">
            Built, sold and colocated in our own facility. Buy the box, operate it from anywhere.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SERVERS.map((server) => (
            <div 
              key={server.id} 
              className={cn(
                "bg-bg-dark border rounded-2xl p-8 flex flex-col hover:shadow-xl transition-shadow",
                server.highlight ? "border-primary shadow-primary/10 shadow-lg" : "border-border-dark"
              )}
            >
              <div className="flex items-center gap-2 mb-6">
                <Badge variant={server.highlight ? "new" : "default"} className={cn(!server.highlight && "bg-surface-dark text-text-muted")}>
                  {server.badge}
                </Badge>
                {server.new && <Badge variant="new">NEW</Badge>}
              </div>

              <h3 className="text-2xl font-bold text-white mb-6">{server.title}</h3>

              {/* Server Illustration */}
              <div className="mb-8 w-full h-16 bg-surface-dark border border-border-dark rounded flex items-center justify-center p-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                <div className="w-full flex justify-between items-center px-4">
                  <div className="flex gap-1">
                    <div className="w-8 h-2 bg-bg-dark rounded-sm" />
                    <div className="w-8 h-2 bg-bg-dark rounded-sm" />
                    {server.rackSize !== "1U" && <div className="w-8 h-2 bg-bg-dark rounded-sm" />}
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1e293b]" />
                  </div>
                </div>
              </div>

              {/* Specs */}
              <div className="space-y-4 mb-8 flex-1">
                <div className="flex justify-between border-b border-border-dark/50 pb-2">
                  <span className="text-text-muted text-sm">CPU</span>
                  <span className="text-white text-sm font-medium">{server.cpu}</span>
                </div>
                <div className="flex justify-between border-b border-border-dark/50 pb-2">
                  <span className="text-text-muted text-sm">{server.id === "ai1" ? "Interconnect" : "Drives"}</span>
                  <span className="text-white text-sm font-medium">{server.drives}</span>
                </div>
                <div className="flex justify-between border-b border-border-dark/50 pb-2">
                  <span className="text-text-muted text-sm">RAM</span>
                  <span className="text-white text-sm font-medium">{server.ram}</span>
                </div>
                <div className="flex justify-between border-b border-border-dark/50 pb-2">
                  <span className="text-text-muted text-sm">Net</span>
                  <span className="text-white text-sm font-medium">{server.net}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 mt-auto">
                <div className="text-white font-medium">
                  {server.price}
                </div>
                <span className="text-primary font-medium flex items-center group-hover:underline cursor-pointer text-sm">
                  Configure <ArrowRight className="w-4 h-4 ml-1" />
                </span>
              </div>

            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-text-base font-medium flex items-center justify-center gap-2 hover:text-primary cursor-pointer transition-colors">
            Buy the hardware and colocate it free for 12 months in OLA DC. Hardware-as-a-Service <ArrowRight className="w-4 h-4" />
          </p>
        </div>

      </div>
    </section>
  )
}
