import React from "react"

export function FeaturesBar() {
  const features = [
    {
      title: "Extreme\nPerformance",
      icon: (
        <svg className="w-8 h-8 text-[#cef79e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      )
    },
    {
      title: "Limitless\nScalability",
      icon: (
        <svg className="w-8 h-8 text-[#cef79e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      title: "Enterprise\nSecurity",
      icon: (
        <svg className="w-8 h-8 text-[#cef79e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      title: "Optimized for\nCloud & AI",
      icon: (
        <svg className="w-8 h-8 text-[#cef79e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      )
    }
  ]

  return (
    <section className="bg-bg-light py-10 border-b border-border-base/10">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {feature.icon}
              </div>
              <p className="text-sm font-medium text-bg-dark leading-snug whitespace-pre-line">
                {feature.title}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
