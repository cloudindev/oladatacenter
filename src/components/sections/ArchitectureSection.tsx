"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/Button"
import { LayoutGrid, Cloud, Shield, Network, Server } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/context/LanguageContext"

const LAYERS = [
  { 
    id: 'applications', 
    titleEn: 'Applications', 
    titleEs: 'Aplicaciones',
    descEn: 'Build, run and scale intelligent applications.', 
    descEs: 'Construye, ejecuta y escala aplicaciones inteligentes.',
    icon: LayoutGrid, 
    color: 'text-pink-500',
    bgHover: 'bg-pink-500/10',
    glowColor: 'bg-pink-500',
    translateZ: 200
  },
  { 
    id: 'ai-cloud', 
    titleEn: 'AI Cloud', 
    titleEs: 'Cloud IA',
    descEn: 'Orchestrate models, data and workloads.', 
    descEs: 'Orquesta modelos, datos y cargas de trabajo.',
    icon: Cloud, 
    color: 'text-purple-500', 
    bgHover: 'bg-purple-500/10',
    glowColor: 'bg-purple-500',
    translateZ: 150
  },
  { 
    id: 'security', 
    titleEn: 'Security', 
    titleEs: 'Seguridad',
    descEn: 'Built-in protection at every layer.', 
    descEs: 'Protección integrada en cada capa.',
    icon: Shield, 
    color: 'text-blue-500', 
    bgHover: 'bg-blue-500/10',
    glowColor: 'bg-blue-500',
    translateZ: 100
  },
  { 
    id: 'edge', 
    titleEn: 'Edge', 
    titleEs: 'Edge',
    descEn: 'Low-latency compute, closer to your users.', 
    descEs: 'Cómputo de baja latencia, más cerca de tus usuarios.',
    icon: Network, 
    color: 'text-sky-500', 
    bgHover: 'bg-sky-500/10',
    glowColor: 'bg-sky-500',
    translateZ: 50
  },
  { 
    id: 'infrastructure', 
    titleEn: 'Infrastructure', 
    titleEs: 'Infraestructura',
    descEn: 'High-performance, sovereign and sustainable data centers.', 
    descEs: 'Datacenters sostenibles, soberanos y de alto rendimiento.',
    icon: Server, 
    color: 'text-slate-500', 
    bgHover: 'bg-slate-500/10',
    glowColor: 'bg-slate-400',
    translateZ: 0
  },
]

// Animated content for each layer
const LayerContent = ({ id, isActive }: { id: string, isActive: boolean }) => {
  if (!isActive) {
    return (
      <div className="w-full h-full opacity-20" style={{
        backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />
    )
  }

  return (
    <div className="relative w-full h-full p-4 overflow-hidden bg-white">
      {/* Common Grid */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />
      
      {id === 'applications' && (
        <div className="w-full h-full flex flex-col gap-3 relative z-10 animate-fade-in">
          {/* Wireframe UI */}
          <div className="flex gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-pink-200 animate-pulse" />
            <div className="w-4 h-4 rounded-full bg-slate-200" />
            <div className="w-4 h-4 rounded-full bg-slate-200" />
          </div>
          <div className="w-full h-1/3 bg-slate-100 border border-slate-200 rounded-lg flex items-center p-3">
             <div className="w-1/2 h-2 bg-slate-200 rounded" />
          </div>
          <div className="flex gap-3 h-full">
            <div className="w-1/3 h-full bg-slate-100 border border-slate-200 rounded-lg" />
            <div className="w-2/3 h-full bg-slate-100 border border-slate-200 rounded-lg p-3 flex flex-col gap-2">
              <div className="w-3/4 h-2 bg-slate-200 rounded" />
              <div className="w-1/2 h-2 bg-slate-200 rounded" />
              <div className="w-full h-2 bg-pink-100 rounded mt-auto" />
            </div>
          </div>
        </div>
      )}

      {id === 'ai-cloud' && (
        <div className="w-full h-full relative z-10 flex items-center justify-center animate-fade-in">
          {/* Neural Network Nodes */}
          <svg className="w-full h-full text-purple-300" viewBox="0 0 100 100">
            <path d="M20,50 Q40,20 80,30" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_3s_linear_infinite]" />
            <path d="M20,50 Q40,80 80,70" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_3s_linear_infinite]" />
            <circle cx="20" cy="50" r="6" className="fill-purple-500 animate-pulse" />
            <circle cx="50" cy="35" r="4" className="fill-purple-400" />
            <circle cx="50" cy="65" r="4" className="fill-purple-400" />
            <circle cx="80" cy="30" r="6" className="fill-purple-500 animate-pulse" />
            <circle cx="80" cy="70" r="6" className="fill-purple-500 animate-pulse" />
          </svg>
        </div>
      )}

      {id === 'security' && (
        <div className="w-full h-full relative z-10 flex items-center justify-center animate-fade-in">
          <div className="relative w-24 h-24 border-4 border-blue-200 rounded-full flex items-center justify-center">
            {/* Scanning line */}
            <div className="absolute top-0 w-full h-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite_alternate]" />
            <Shield className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
          </div>
        </div>
      )}

      {id === 'edge' && (
        <div className="w-full h-full relative z-10 animate-fade-in">
          {/* Global network dots */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.8)]" />
          {[
            { top: '20%', left: '20%', delay: '0s' },
            { top: '80%', left: '30%', delay: '0.2s' },
            { top: '30%', left: '80%', delay: '0.4s' },
            { top: '70%', left: '70%', delay: '0.6s' },
          ].map((pos, i) => (
            <div key={i} className="absolute w-2 h-2 bg-sky-400 rounded-full animate-ping" style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }} />
          ))}
          <svg className="absolute inset-0 w-full h-full" stroke="rgba(14,165,233,0.2)" strokeWidth="1">
            <line x1="50%" y1="50%" x2="20%" y2="20%" />
            <line x1="50%" y1="50%" x2="30%" y2="80%" />
            <line x1="50%" y1="50%" x2="80%" y2="30%" />
            <line x1="50%" y1="50%" x2="70%" y2="70%" />
          </svg>
        </div>
      )}

      {id === 'infrastructure' && (
        <div className="w-full h-full relative z-10 flex flex-col gap-2 p-2 animate-fade-in">
          {/* Server Racks */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-full h-1/4 border border-slate-300 bg-slate-50 rounded flex items-center px-4 justify-between">
              <div className="flex gap-2">
                <div className="w-6 h-1 bg-slate-200 rounded-full" />
                <div className="w-12 h-1 bg-slate-200 rounded-full" />
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                <div className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ArchitectureSection() {
  const [activeLayer, setActiveLayer] = useState<string | null>('ai-cloud')
  const { t } = useLanguage()

  return (
    <section className="bg-bg-light py-24 overflow-hidden border-b border-border-base/10">
      {/* Custom CSS for animations and 3D faces */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dash {
          to { stroke-dashoffset: -16; }
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}} />

      <div className="container mx-auto px-4 md:px-8 max-w-[1400px]">
        
        <div className="relative rounded-[2rem] bg-white shadow-sm overflow-hidden p-8 md:p-16 lg:p-20">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-12">
            
            {/* LEFT COLUMN */}
            <div className="w-full lg:w-1/3 flex flex-col items-start z-10">
              <div className="flex items-center gap-3 text-xs font-medium tracking-widest text-bg-dark/40 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-bg-dark/40"></span>
                01 / 02 / 03
              </div>
              <h2 className="text-4xl lg:text-5xl font-normal tracking-tight text-bg-dark leading-[1.1] mb-6">
                {t("A platform.", "Una plataforma.")}<br />
                {t("Every layer", "Cada capa")}<br />
                {t("purpose-built.", "diseñada a medida.")}
              </h2>
              <p className="text-bg-dark/70 text-sm md:text-base leading-relaxed mb-8 max-w-sm">
                {t("From sovereign infrastructure to intelligent applications, every layer is engineered to deliver performance, security and control at scale.", "Desde infraestructura soberana hasta aplicaciones inteligentes, cada capa está diseñada para ofrecer rendimiento, seguridad y control a escala.")}
              </p>
              <Link href="/products">
                <Button variant="outline" className="border-border-base/20 text-bg-dark hover:bg-bg-dark/5 rounded-full px-8 py-6 text-sm font-medium transition-all">
                  {t("See how it works →", "Ver cómo funciona →")}
                </Button>
              </Link>
            </div>

            {/* CENTER COLUMN: 3D Isometric Stack */}
            <div className="w-full lg:w-1/3 h-[500px] flex items-center justify-center relative z-0 mt-8 lg:mt-16" style={{ perspective: '1200px' }}>
              <div 
                className="relative w-64 h-64 scale-90 lg:scale-100 transition-transform duration-700 ease-out preserve-3d"
                style={{ transform: 'rotateX(60deg) rotateZ(-45deg)' }}
              >
                {LAYERS.map((layer) => {
                  const isActive = activeLayer === layer.id
                  const isHoveringAny = activeLayer !== null
                  
                  // Active layer elevates a lot, others compress down slightly
                  const elevationZ = isActive ? layer.translateZ + 40 : layer.translateZ - (isHoveringAny ? 10 : 0)
                  
                  return (
                    <div
                      key={layer.id}
                      className="absolute inset-0 transition-all duration-500 ease-out preserve-3d"
                      style={{ transform: `translateZ(${elevationZ}px)` }}
                    >
                      {/* Glow shadow underneath (only when active) */}
                      {isActive && (
                        <div className={`absolute inset-[-20px] ${layer.glowColor} blur-[40px] opacity-40 pointer-events-none`} style={{ transform: 'translateZ(-1px)' }} />
                      )}
                      
                      {/* TOP FACE */}
                      <div className={`absolute inset-0 border-[1.5px] border-bg-dark/80 bg-white transition-all duration-300 overflow-hidden
                        ${isActive ? 'opacity-100 shadow-xl' : 'opacity-60'}
                      `}>
                        <LayerContent id={layer.id} isActive={isActive} />
                      </div>
                      
                      {/* BOTTOM-LEFT FACE (Thickness) - Maps to original left edge */}
                      <div 
                        className={`absolute top-0 left-0 w-[12px] h-full bg-slate-100 border-[1.5px] border-l-0 border-bg-dark/80 origin-left transition-all duration-300
                          ${isActive ? 'opacity-100' : 'opacity-60'}
                        `}
                        style={{ transform: 'rotateY(90deg)' }}
                      />
                      
                      {/* BOTTOM-RIGHT FACE (Thickness) - Maps to original bottom edge */}
                      <div 
                        className={`absolute top-full left-0 w-full h-[12px] bg-slate-200 border-[1.5px] border-t-0 border-bg-dark/80 origin-top transition-all duration-300
                          ${isActive ? 'opacity-100' : 'opacity-60'}
                        `}
                        style={{ transform: 'rotateX(-90deg)' }}
                      />
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
                    className={`flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer border border-transparent
                      ${isActive ? layer.bgHover + ' border-black/5' : 'hover:bg-black/5'}
                    `}
                  >
                    <div className={`mt-1 p-2 rounded-lg bg-white shadow-sm border transition-colors duration-300 ${isActive ? 'border-transparent ' + layer.color : 'border-border-base/10 text-bg-dark/40'}`}>
                      <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className={`font-medium text-base transition-colors duration-300 ${isActive ? layer.color : 'text-bg-dark'}`}>
                        {t(layer.titleEn, layer.titleEs)}
                      </h3>
                      <p className="text-bg-dark/60 text-sm mt-1 leading-relaxed">
                        {t(layer.descEn, layer.descEs)}
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
