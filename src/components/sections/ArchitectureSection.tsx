import React, { useState } from "react"
import { Button } from "@/components/ui/Button"
import { LayoutGrid, Cloud, Shield, Network, Server } from "lucide-react"
import Link from "next/link"

const LAYERS = [
  { 
    id: 'applications', 
    title: 'Applications', 
    desc: 'Build, run and scale intelligent applications.', 
    icon: LayoutGrid, 
    color: 'text-pink-500', 
    bgHover: 'bg-pink-500/10',
    layerFill: 'bg-pink-500/20', 
    layerBorder: 'border-pink-300', 
    layerShadow: 'shadow-[0_0_40px_rgba(236,72,153,0.4)]',
    translateZ: 160
  },
  { 
    id: 'ai-cloud', 
    title: 'AI Cloud', 
    desc: 'Orchestrate models, data and workloads.', 
    icon: Cloud, 
    color: 'text-purple-500', 
    bgHover: 'bg-purple-500/10',
    layerFill: 'bg-purple-500/20', 
    layerBorder: 'border-purple-300', 
    layerShadow: 'shadow-[0_0_40px_rgba(168,85,247,0.4)]',
    translateZ: 120
  },
  { 
    id: 'security', 
    title: 'Security', 
    desc: 'Built-in protection at every layer.', 
    icon: Shield, 
    color: 'text-blue-500', 
    bgHover: 'bg-blue-500/10',
    layerFill: 'bg-blue-500/20', 
    layerBorder: 'border-blue-300', 
    layerShadow: 'shadow-[0_0_40px_rgba(59,130,246,0.4)]',
    translateZ: 80
  },
  { 
    id: 'edge', 
    title: 'Edge', 
    desc: 'Low-latency compute, closer to your users.', 
    icon: Network, 
    color: 'text-sky-500', 
    bgHover: 'bg-sky-500/10',
    layerFill: 'bg-sky-500/20', 
    layerBorder: 'border-sky-300', 
    layerShadow: 'shadow-[0_0_40px_rgba(14,165,233,0.4)]',
    translateZ: 40
  },
  { 
    id: 'infrastructure', 
    title: 'Infrastructure', 
    desc: 'High-performance, sovereign and sustainable data centers.', 
    icon: Server, 
    color: 'text-slate-500', 
    bgHover: 'bg-slate-500/10',
    layerFill: 'bg-slate-100', 
    layerBorder: 'border-slate-300', 
    layerShadow: 'shadow-[0_0_40px_rgba(148,163,184,0.4)]',
    translateZ: 0
  },
]

export function ArchitectureSection() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null)

  return (
    <section className="bg-bg-light py-16 overflow-hidden border-b border-border-base/10">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px]">
        
        {/* Main wrapper simulating the frosted glass box if desired, or just clean layout */}
        <div className="relative rounded-3xl border border-border-base/10 bg-white shadow-sm overflow-hidden p-8 md:p-12">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
            
            {/* LEFT COLUMN: Text Content */}
            <div className="w-full lg:w-1/3 flex flex-col items-start z-10">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-bg-dark/40 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-bg-dark/40"></span>
                01 / 02 / 03
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-bg-dark leading-[1.1] mb-6">
                A platform.<br />
                Every layer<br />
                purpose-built.
              </h2>
              <p className="text-bg-dark/70 text-sm md:text-base leading-relaxed mb-8 max-w-sm">
                From sovereign infrastructure to intelligent applications, every layer is engineered to deliver performance, security and control at scale.
              </p>
              <Link href="#platform">
                <Button variant="outline" className="border-border-base/20 text-bg-dark hover:bg-bg-dark/5 rounded-lg px-6 py-5 text-sm font-semibold transition-all">
                  See how it works →
                </Button>
              </Link>
            </div>

            {/* CENTER COLUMN: 3D Isometric Stack */}
            <div className="w-full lg:w-1/3 h-[400px] flex items-center justify-center relative z-0" style={{ perspective: '1000px' }}>
              <div 
                className="relative w-64 h-64 scale-100 lg:scale-110 transition-transform duration-500"
                style={{ transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(-45deg)' }}
              >
                {LAYERS.map((layer) => {
                  const isActive = activeLayer === layer.id
                  // Normal translation Z
                  const baseTZ = layer.translateZ
                  // Elevated translation Z if active
                  const currentTZ = isActive ? baseTZ + 30 : baseTZ
                  
                  return (
                    <div
                      key={layer.id}
                      className={`absolute inset-0 border-2 rounded-xl backdrop-blur-md transition-all duration-500 ease-out flex items-center justify-center overflow-hidden
                        ${layer.layerBorder} 
                        ${isActive ? layer.layerFill : 'bg-white/40'}
                        ${isActive ? layer.layerShadow : 'shadow-sm'}
                      `}
                      style={{
                        transform: `translateZ(${currentTZ}px)`,
                        // Inner grid pattern
                        backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)`,
                        backgroundSize: '20px 20px'
                      }}
                    >
                      {/* Subtle vector details inside each layer */}
                      <div className="absolute inset-4 border border-black/5 rounded-lg"></div>
                      <div className="absolute top-8 left-8 w-12 h-12 border border-black/5 rounded bg-black/5"></div>
                      <div className="absolute top-8 right-8 w-20 h-4 border border-black/5 rounded bg-black/5"></div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Layer List */}
            <div className="w-full lg:w-1/3 flex flex-col gap-2 z-10">
              {LAYERS.map((layer) => {
                const Icon = layer.icon
                const isActive = activeLayer === layer.id
                
                return (
                  <div 
                    key={layer.id}
                    onMouseEnter={() => setActiveLayer(layer.id)}
                    onMouseLeave={() => setActiveLayer(null)}
                    className={`flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer border border-transparent
                      ${isActive ? layer.bgHover + ' border-black/5' : 'hover:bg-black/5'}
                    `}
                  >
                    <div className={`mt-1 p-2 rounded-lg bg-white shadow-sm border border-black/5 transition-colors duration-300 ${isActive ? layer.color : 'text-bg-dark/40'}`}>
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className={`font-semibold text-base transition-colors duration-300 ${isActive ? layer.color : 'text-bg-dark'}`}>
                        {layer.title}
                      </h3>
                      <p className="text-bg-dark/60 text-sm mt-1 leading-relaxed">
                        {layer.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * ----------------------------------------------------------------------------
 * DOCUMENTACIÓN DE MEMORIA - ANTIGRAVITY PRINCIPAL ENGINEER
 * ----------------------------------------------------------------------------
 * Decisión Técnica:
 * Se ha sustituido el antiguo bloque de iconos estáticos por una visualización 
 * interactiva en 3D isométrico.
 * 
 * - Se han utilizado transformaciones 3D puras de CSS (rotateX, rotateZ, translateZ) 
 *   en lugar de bibliotecas externas (como framer-motion o Three.js) para mantener 
 *   el coste de renderizado mínimo y maximizar el rendimiento.
 * - La interacción entre la lista de la derecha (hover) y el stack central se 
 *   gestiona mediante un estado local `activeLayer`.
 * - Se aplica `backdrop-blur-md` y variables de Tailwind para la retroiluminación 
 *   y sombras personalizadas (efecto vectorial) solicitado por el usuario.
 * - Todo el diseño se ha compactado (menos altura) usando `py-16` y reduciendo
 *   la dispersión vertical.
 * 
 * Prevención de Errores:
 * - Evitado el uso de `any` en tipado (tipos inferidos o definidos en `useState<string | null>`).
 * - Hooks (useState) definidos a nivel superior del componente.
 * - Uso estricto de utilidades de Tailwind en vez de CSS en línea (excepto en transformaciones dinámicas).
 */
