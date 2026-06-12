import React from "react"

export function ArchitectureSection() {
  return (
    <section className="bg-bg-light py-20 overflow-hidden">
      <div className="container mx-auto px-4">
        
        <div className="relative rounded-3xl border border-border-base/10 bg-white/50 backdrop-blur-sm p-8 md:p-12 shadow-sm overflow-hidden group">
          {/* Subtle gradient border effect using pseudo element */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 opacity-50" />
          
          <div className="relative z-10">
            <div className="flex flex-col xl:flex-row items-center gap-12 xl:gap-8 justify-between">
              
              {/* Left Text */}
              <div className="w-full xl:w-1/3 flex flex-col items-start">
                <div className="text-xs font-bold text-bg-dark/40 tracking-widest mb-6">
                  01 / 02 / 03
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-bg-dark leading-[1.1]">
                  A platform.<br />
                  Every layer<br />
                  purpose-built.
                </h2>
              </div>
              
              {/* Right Diagram */}
              <div className="w-full xl:w-2/3">
                <div className="flex flex-wrap md:flex-nowrap items-center justify-center gap-4 md:gap-2">
                  
                  {/* Item 1: Infrastructure */}
                  <div className="flex flex-col items-center gap-4 group/item flex-1">
                    <div className="w-20 h-20 flex items-center justify-center relative">
                      <svg className="w-12 h-12 text-bg-dark/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-bg-dark">Infrastructure</span>
                  </div>

                  <Arrow className="text-blue-400" />

                  {/* Item 2: AI Cloud */}
                  <div className="flex flex-col items-center gap-4 group/item flex-1">
                    <div className="w-20 h-20 flex items-center justify-center relative">
                      <div className="absolute inset-2 bg-blue-100 rounded-lg transform rotate-45 -z-10 opacity-50" />
                      <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-bg-dark">AI Cloud</span>
                  </div>

                  <Arrow className="text-purple-400" />

                  {/* Item 3: Applications */}
                  <div className="flex flex-col items-center gap-4 group/item flex-1">
                    <div className="w-20 h-20 flex items-center justify-center relative">
                      <div className="absolute inset-2 bg-purple-100 rounded-lg transform rotate-45 -z-10 opacity-50" />
                      <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-bg-dark">Applications</span>
                  </div>

                  <Arrow className="text-pink-400" />

                  {/* Item 4: Security */}
                  <div className="flex flex-col items-center gap-4 group/item flex-1">
                    <div className="w-20 h-20 flex items-center justify-center relative">
                      <svg className="w-12 h-12 text-bg-dark/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-bg-dark">Security</span>
                  </div>

                  <Arrow className="text-orange-300" />

                  {/* Item 5: Edge */}
                  <div className="flex flex-col items-center gap-4 group/item flex-1">
                    <div className="w-20 h-20 flex items-center justify-center relative">
                      <svg className="w-12 h-12 text-bg-dark/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-bg-dark">Edge</span>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Arrow({ className }: { className?: string }) {
  return (
    <div className={`hidden md:block flex-shrink-0 w-8 ${className}`}>
      <svg viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 6h22m0 0l-5-5m5 5l-5 5" />
      </svg>
    </div>
  )
}
