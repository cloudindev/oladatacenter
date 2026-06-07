export function StatsBar() {
  return (
    <section className="bg-bg-light border-y border-border-base/40 py-16">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border-base/40 text-center md:text-left">
          
          <div className="pl-0 md:pl-8 first:pl-0">
            <div className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-2">
              99.99<span className="text-2xl text-text-muted">%</span>
            </div>
            <div className="text-sm font-medium text-text-muted uppercase tracking-wider">
              guaranteed uptime SLA
            </div>
          </div>

          <div className="pl-4 md:pl-8">
            <div className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-2">
              12<span className="text-2xl text-text-muted">ms</span>
            </div>
            <div className="text-sm font-medium text-text-muted uppercase tracking-wider">
              p50 latency · Iberia
            </div>
          </div>

          <div className="pl-4 md:pl-8">
            <div className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-2">
              132<span className="text-2xl text-text-muted">kW</span>
            </div>
            <div className="text-sm font-medium text-text-muted uppercase tracking-wider">
              per rack, AI hall
            </div>
          </div>

          <div className="pl-4 md:pl-8 border-r-0">
            <div className="text-4xl md:text-5xl font-bold tracking-tight text-text-base mb-2">
              24<span className="text-2xl text-text-muted">/7</span>
            </div>
            <div className="text-sm font-medium text-text-muted uppercase tracking-wider">
              in-house NOC & on-site team
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
