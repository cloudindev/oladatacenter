"use client"

import * as React from "react"
import { SectionLabel } from "@/components/ui/SectionLabel"
import { ArrowRight, Server, Database, Box, Network, Shield, GitBranch } from "lucide-react"

export function CloudSection() {
  return (
    <section id="cloud" className="py-24 md:py-32 bg-bg-light border-b border-border-base/40">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <SectionLabel>03 · CLOUD</SectionLabel>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-4">
              From code to production in one git push.
            </h2>
            <p className="text-lg text-text-muted">
              The OLA Cloud platform — AI, compute, data and security on sovereign Spanish infrastructure.
            </p>
          </div>
          <a href="#" className="text-primary font-medium flex items-center hover:underline">
            olacloud.es <ArrowRight className="w-4 h-4 ml-1" />
          </a>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* Main Tile (AI Cloud) */}
          <div className="md:col-span-2 lg:col-span-2 bg-bg-dark border border-border-dark rounded-2xl p-8 flex flex-col justify-between hover:shadow-xl transition-shadow group">
            <div>
              <SectionLabel className="text-primary mb-2">PLATFORM</SectionLabel>
              <h3 className="text-3xl font-bold text-white mb-4">AI Cloud</h3>
              <p className="text-text-muted mb-6 text-lg max-w-md">
                On-demand GPU, Train, fine-tune and serve LLMs and RAG — no infra plumbing required.
              </p>
              <div className="flex gap-2 mb-8">
                <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">H100</span>
                <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">A100</span>
                <span className="text-xs font-medium text-text-muted bg-surface-dark px-2 py-1 rounded border border-border-dark">Sandbox</span>
              </div>
            </div>
            <div className="flex justify-end">
               <button className="text-primary font-medium flex items-center group-hover:underline">
                 Deploy <ArrowRight className="w-4 h-4 ml-1" />
               </button>
            </div>
          </div>

          {/* Small Tiles */}
          <div className="bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Server className="w-6 h-6 text-primary mb-4" />
               <h4 className="font-bold text-text-base mb-2">Compute</h4>
               <p className="text-sm text-text-muted">Cloud servers with autoscaling + CI/CD.</p>
            </div>
          </div>
          
          <div className="bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Database className="w-6 h-6 text-primary mb-4" />
               <h4 className="font-bold text-text-base mb-2">Database</h4>
               <p className="text-sm text-text-muted">Managed PostgreSQL, Redis & Mongo.</p>
            </div>
          </div>

          <div className="bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Box className="w-6 h-6 text-primary mb-4" />
               <h4 className="font-bold text-text-base mb-2">Storage</h4>
               <p className="text-sm text-text-muted">S3 compatible object storage, archive and backup.</p>
            </div>
          </div>



          <div className="md:col-span-2 bg-white border border-border-base rounded-2xl p-6 hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div>
               <Shield className="w-6 h-6 text-primary mb-4" />
               <div className="text-xs font-semibold text-primary mb-1 uppercase">PRIVATE CLOUD</div>
               <h4 className="font-bold text-text-base mb-2 text-lg">Private Cloud</h4>
               <p className="text-sm text-text-muted">Dedicated tenancy. Your data stays in Spain — encrypted, isolated, audited.</p>
            </div>
          </div>

          <div className="bg-bg-dark border border-border-dark rounded-2xl p-6 hover:shadow-xl transition-shadow group flex flex-col justify-between relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent pointer-events-none" />
            <div className="relative z-10">
               <GitBranch className="w-6 h-6 text-primary mb-4" />
               <div className="text-xs font-semibold text-primary mb-1 uppercase">git push → live</div>
               <h4 className="font-bold text-white mb-2 text-lg">Serverless Deploy</h4>
               <p className="text-sm text-text-muted">Push from your repo. We build, scale and serve — globally in minutes.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
