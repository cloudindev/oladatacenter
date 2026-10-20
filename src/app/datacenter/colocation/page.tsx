"use client"

/**
 * ColocationPage (`/datacenter/colocation`) — Página principal de Colocation
 * diseñada con la arquitectura visual de `integratedbio.com/company/` y la Home:
 *  - Hero editorial (`c-hero`) con revelación por cortina de palabra (`WordRevealText`),
 *    titular bicolor (`#222f30` + `#c9cbbe`), corchete inferior y botón `.scroll-btn`.
 *  - Imagen panorámica (`c-fs-media`) del pasillo de racks de alta densidad (`/ola-datacenter-racks.jpg`).
 *  - Bloque manifiesto (`c-hgroup`) con pastilla mono y titular revelado palabra por palabra.
 *  - Catálogo interactivo de los 5 productos de Colocation (`c-team-grid`) con ilustraciones
 *    vectoriales técnicas de líneas a medida para cada modalidad (`1U`, `Racks`, `Jaulas`, `Suites`, `Wholesale`),
 *    muesca curva inferior derecha (`87×90` SVG) y botón paralelogramo `.u-btn--2`.
 *  - 3 tarjetas arquitectónicas a sangre (`c-usp-cards`) en la paleta `#cef79e`, `#222f30`, `#e7e8e0`.
 *  - Bloque `Conectividad y Operación` (`c-hgroup` sin foto repetida) con acceso a visita.
 */

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ArrowCta } from "@/components/ui/ArrowCta"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"

// ─── 1. Interfaces ──────────────────────────────────────────────────────────
interface RevealWord {
  text: string
  muted?: boolean
  breakAfter?: boolean
}

interface WordRevealTextProps {
  words: RevealWord[]
  revealed: boolean
  staggerMs?: number
  baseDelayMs?: number
}

interface ColocationProductDef {
  slug: string
  index: string
  href: string
  titleEn: string
  titleEs: string
  tagEn: string
  tagEs: string
  descEn: string
  descEs: string
  specsEn: string[]
  specsEs: string[]
  ctaEn: string
  ctaEs: string
  diagram: React.ReactNode
}

interface UspCardDef {
  index: string
  bgClass: string
  textClass: string
  headingEn: string
  headingEs: string
  bodyEn: string
  bodyEs: string
  icon: React.ReactNode
}

interface MetricDef {
  value: string
  labelEn: string
  labelEs: string
}

// ─── 2. Dibujos Vectoriales de Líneas (Blueprints Técnicos de Colocation) ───

/**
 * 01. Vector lineal para "Colocation por U":
 * Bastidor técnico con unidades U numeradas y un chasis servidor 1U/2U destacado
 * con doble acometida eléctrica A+B.
 */
function VectorColocationPerU() {
  return (
    <svg
      viewBox="0 0 470 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Cuadrícula técnica sutil */}
      <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v-${i}`} x1={47 * (i + 1)} y1="0" x2={47 * (i + 1)} y2="300" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={50 * (i + 1)} x2="470" y2={50 * (i + 1)} />
        ))}
      </g>

      {/* Guías verticales del bastidor 19" */}
      <line x1="115" y1="36" x2="115" y2="264" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1="127" y1="36" x2="127" y2="264" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.25" />
      <line x1="343" y1="36" x2="343" y2="264" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.25" />
      <line x1="355" y1="36" x2="355" y2="264" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" />

      {/* Slots U en reposo */}
      {[52, 82, 168, 198, 228].map((y, idx) => (
        <g key={y} opacity="0.38">
          <rect x="127" y={y} width="216" height="22" rx="2" stroke="currentColor" strokeWidth="1" />
          <line x1="138" y1={y + 11} x2="178" y2={y + 11} stroke="currentColor" strokeWidth="1" />
          <circle cx="322" cy={y + 11} r="2" fill="currentColor" />
          <circle cx="330" cy={y + 11} r="2" fill="currentColor" />
          <text x="92" y={y + 14} fill="currentColor" fontSize="9" fontFamily="monospace">
            0{idx + 1}U
          </text>
        </g>
      ))}

      {/* Unidad 1U/2U Activa Destacada (Expandida con acento lima) */}
      <g>
        <rect
          x="105"
          y="112"
          width="260"
          height="46"
          rx="4"
          fill="#cef79e"
          fillOpacity="0.55"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* Orejetas de anclaje rack */}
        <rect x="111" y="118" width="8" height="34" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="351" y="118" width="8" height="34" rx="1" stroke="currentColor" strokeWidth="1.1" />
        {/* Bahías NVMe frontales */}
        {[0, 1, 2, 3, 4, 5].map((bay) => (
          <g key={bay}>
            <rect
              x={128 + bay * 28}
              y="121"
              width="23"
              height="28"
              rx="1.5"
              fill="#f7f7f5"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <line
              x1={132 + bay * 28}
              y1="127"
              x2={147 + bay * 28}
              y2="127"
              stroke="currentColor"
              strokeWidth="1"
            />
            <circle cx={146 + bay * 28} cy="143" r="1.5" fill="currentColor" />
          </g>
        ))}
        {/* Panel de control y puertos 10GbE */}
        <rect x="302" y="121" width="40" height="12" rx="1.5" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="302" y="137" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="324" y="137" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1" />

        {/* Cotas laterales A+B */}
        <line x1="66" y1="135" x2="100" y2="135" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="66" cy="135" r="3" fill="currentColor" />
        <text x="42" y="138" fill="currentColor" fontSize="10" fontFamily="monospace">
          1U
        </text>

        <line x1="370" y1="127" x2="408" y2="127" stroke="currentColor" strokeWidth="1.1" />
        <line x1="370" y1="143" x2="408" y2="143" stroke="currentColor" strokeWidth="1.1" />
        <text x="413" y="130" fill="currentColor" fontSize="9" fontFamily="monospace">
          PDU-A
        </text>
        <text x="413" y="146" fill="currentColor" fontSize="9" fontFamily="monospace">
          PDU-B
        </text>
      </g>
    </svg>
  )
}

/**
 * 02. Vector lineal para "Medio Rack / Rack Completo":
 * Comparativa arquitectónica lado a lado de un armario 21U (dividido) y un armario 42U–48U completo.
 */
function VectorHalfAndFullRack() {
  return (
    <svg
      viewBox="0 0 470 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Cuadrícula técnica */}
      <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v-${i}`} x1={47 * (i + 1)} y1="0" x2={47 * (i + 1)} y2="300" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={50 * (i + 1)} x2="470" y2={50 * (i + 1)} />
        ))}
      </g>

      {/* Bandeja superior de fibra (Overhead tray) */}
      <line x1="65" y1="28" x2="405" y2="28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" strokeOpacity="0.5" />
      <line x1="65" y1="34" x2="405" y2="34" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />

      {/* ARMARIO IZQUIERDO: MEDIO RACK (21U) */}
      <g>
        <rect x="95" y="46" width="118" height="216" rx="3" stroke="currentColor" strokeWidth="1.4" />
        {/* Mitad superior activa (21U) */}
        <rect
          x="101"
          y="52"
          width="106"
          height="100"
          rx="2"
          fill="#cef79e"
          fillOpacity="0.45"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {[0, 1, 2, 3, 4].map((row) => (
          <line
            key={row}
            x1="109"
            y1={66 + row * 18}
            x2="199"
            y2={66 + row * 18}
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.65"
          />
        ))}
        {/*Cerradura independiente mitad superior */}
        <circle cx="200" cy="102" r="2.5" fill="currentColor" />

        {/* Divisor físico central */}
        <line x1="95" y1="154" x2="213" y2="154" stroke="currentColor" strokeWidth="1.8" />

        {/* Mitad inferior en gris punteado */}
        <rect
          x="101"
          y="158"
          width="106"
          height="98"
          rx="2"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.35"
        />
        <text x="136" y="278" fill="currentColor" fontSize="10" fontFamily="monospace">
          21U HALF
        </text>
      </g>

      {/* ARMARIO DERECHO: RACK COMPLETO (42U–48U) */}
      <g>
        <rect x="255" y="46" width="124" height="216" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <rect
          x="261"
          y="52"
          width="112"
          height="204"
          rx="2"
          fill="#cef79e"
          fillOpacity="0.55"
          stroke="currentColor"
          strokeWidth="1.3"
        />
        {/* Servidores apilados en todo el armario */}
        {Array.from({ length: 11 }).map((_, row) => (
          <g key={row}>
            <line
              x1="270"
              y1={64 + row * 17.5}
              x2="356"
              y2={64 + row * 17.5}
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.7"
            />
            <circle cx="352" cy={60 + row * 17.5} r="1.3" fill="currentColor" />
          </g>
        ))}
        {/* Barra PDU vertical */}
        <rect x="362" y="56" width="6" height="196" fill="#f7f7f5" stroke="currentColor" strokeWidth="1" />
        <text x="285" y="278" fill="currentColor" fontSize="10" fontFamily="monospace">
          42U–48U FULL
        </text>
      </g>

      {/* Cota vertical de altura */}
      <line x1="398" y1="46" x2="398" y2="262" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="393" y1="46" x2="403" y2="46" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
      <line x1="393" y1="262" x2="403" y2="262" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
      <text x="407" y="158" fill="currentColor" fontSize="9" fontFamily="monospace">
        40kW
      </text>
    </svg>
  )
}

/**
 * 03. Vector lineal para "Jaulas Privadas (Cages)":
 * Cerramiento perimetral de malla técnica rodeando una batería de racks contiguos
 * con puerta esclusa y lector biométrico.
 */
function VectorPrivateCage() {
  return (
    <svg
      viewBox="0 0 470 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Cuadrícula técnica */}
      <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v-${i}`} x1={47 * (i + 1)} y1="0" x2={47 * (i + 1)} y2="300" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={50 * (i + 1)} x2="470" y2={50 * (i + 1)} />
        ))}
      </g>

      {/* Perímetro exterior de la Jaula (Malla de seguridad suelo a techo) */}
      <rect
        x="58"
        y="36"
        width="354"
        height="224"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="64"
        y="42"
        width="342"
        height="212"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="4 4"
        strokeOpacity="0.5"
      />

      {/* Postes estructurales del cerramiento */}
      {[58, 176, 294, 412].map((x) => (
        <g key={x}>
          <rect x={x - 3} y="33" width="6" height="6" fill="currentColor" />
          <rect x={x - 3} y="257" width="6" height="6" fill="currentColor" />
        </g>
      ))}

      {/* Batería interna de 4 Racks dentro de la jaula */}
      {[0, 1, 2, 3].map((idx) => {
        const rx = 86 + idx * 64
        return (
          <g key={idx}>
            <rect
              x={rx}
              y="66"
              width="52"
              height="148"
              rx="2"
              fill="#cef79e"
              fillOpacity={0.5}
              stroke="currentColor"
              strokeWidth="1.3"
            />
            {[0, 1, 2, 3, 4, 5, 6].map((u) => (
              <line
                key={u}
                x1={rx + 6}
                y1={80 + u * 19}
                x2={rx + 46}
                y2={80 + u * 19}
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.65"
              />
            ))}
            <text x={rx + 15} y="228" fill="currentColor" fontSize="9" fontFamily="monospace">
              R0{idx + 1}
            </text>
          </g>
        )
      })}

      {/* Trama de malla perimetral frontal superpuesta */}
      <g stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.9">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`m-${i}`} x1={74 + i * 24} y1="42" x2={74 + i * 24} y2="254" />
        ))}
      </g>

      {/* Módulo de control de acceso biométrico + cámara CCTV */}
      <rect
        x="348"
        y="112"
        width="44"
        height="68"
        rx="3"
        fill="#f7f7f5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="370" cy="136" r="10" fill="#cef79e" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="370" cy="136" r="3.5" fill="currentColor" />
      <line x1="358" y1="158" x2="382" y2="158" stroke="currentColor" strokeWidth="1.1" />
      <line x1="358" y1="166" x2="376" y2="166" stroke="currentColor" strokeWidth="1.1" />
      <text x="348" y="196" fill="currentColor" fontSize="9" fontFamily="monospace">
        BIO-LOCK
      </text>
    </svg>
  )
}

/**
 * 04. Vector lineal para "Suites Privadas":
 * Plano arquitectónico de sala técnica exclusiva con doble fila de racks enfrentados,
 * pasillo frío/caliente contenido, unidades CRAC N+1 y esclusa mantrap.
 */
function VectorPrivateSuite() {
  return (
    <svg
      viewBox="0 0 470 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Cuadrícula técnica */}
      <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v-${i}`} x1={47 * (i + 1)} y1="0" x2={47 * (i + 1)} y2="300" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={50 * (i + 1)} x2="470" y2={50 * (i + 1)} />
        ))}
      </g>

      {/* Muros de cerramiento de la Suite Privada */}
      <rect
        x="52"
        y="32"
        width="366"
        height="236"
        rx="6"
        fill="#f7f7f5"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      {/* Unidades de Climatización Dedicadas CRAC (Izquierda) */}
      {[56, 128, 200].map((y, idx) => (
        <g key={y}>
          <rect
            x="68"
            y={y}
            width="42"
            height="50"
            rx="2"
            fill="#cef79e"
            fillOpacity="0.4"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <circle cx="89" cy={y + 25} r="12" stroke="currentColor" strokeWidth="1.1" />
          <line x1="81" y1={y + 17} x2="97" y2={y + 33} stroke="currentColor" strokeWidth="1" />
          <line x1="97" y1={y + 17} x2="81" y2={y + 33} stroke="currentColor" strokeWidth="1" />
          <text x="72" y={y + 46} fill="currentColor" fontSize="7.5" fontFamily="monospace">
            CRAC-{idx + 1}
          </text>
        </g>
      ))}

      {/* Fila Superior de Racks (6 Racks de Alta Densidad) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect
          key={`top-${i}`}
          x={136 + i * 34}
          y="58"
          width="30"
          height="48"
          rx="1.5"
          fill="#cef79e"
          fillOpacity="0.65"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ))}

      {/* Pasillo contenido central (Cold Aisle Containment) */}
      <rect
        x="136"
        y="112"
        width="200"
        height="76"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="4 4"
      />
      <text x="180" y="154" fill="currentColor" fontSize="10" fontFamily="monospace">
        CONTAINED AISLE
      </text>

      {/* Fila Inferior de Racks (6 Racks de Alta Densidad) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect
          key={`bot-${i}`}
          x={136 + i * 34}
          y="194"
          width="30"
          height="48"
          rx="1.5"
          fill="#cef79e"
          fillOpacity="0.65"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ))}

      {/* Esclusa Mantrap y Cuadro Eléctrico PDU en lateral derecho */}
      <rect x="356" y="58" width="46" height="86" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <text x="364" y="104" fill="currentColor" fontSize="9" fontFamily="monospace">
        PDU 2N
      </text>

      <rect
        x="356"
        y="162"
        width="46"
        height="80"
        rx="2"
        fill="#cef79e"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M 356 188 A 24 24 0 0 1 380 212 L 356 212 Z" stroke="currentColor" strokeWidth="1" />
      <text x="361" y="234" fill="currentColor" fontSize="8" fontFamily="monospace">
        MANTRAP
      </text>
    </svg>
  )
}

/**
 * 05. Vector lineal para "Housing / Wholesale":
 * Topología de campus mayorista multi-sala con subestación 2N, bloques de megavatios (MW)
 * y anillos redundantes de fibra oscura.
 */
function VectorWholesaleCampus() {
  return (
    <svg
      viewBox="0 0 560 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      {/* Cuadrícula técnica */}
      <g stroke="currentColor" strokeOpacity="0.06" strokeWidth="1">
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`v-${i}`} x1={50 * (i + 1)} y1="0" x2={50 * (i + 1)} y2="300" />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`h-${i}`} x1="0" y1={50 * (i + 1)} x2="560" y2={50 * (i + 1)} />
        ))}
      </g>

      {/* Bus eléctrico superior A (2N Power Feed A) */}
      <path d="M 48 56 H 512" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="48" cy="56" r="4" fill="#cef79e" stroke="currentColor" strokeWidth="1.3" />
      <text x="60" y="46" fill="currentColor" fontSize="9.5" fontFamily="monospace">
        2N POWER RING A · 100% RENEWABLEMW
      </text>

      {/* 3 Grandes Bloques Mayoristas (Data Halls A, B, C) */}
      {[0, 1, 2].map((hall) => {
        const hx = 56 + hall * 156
        return (
          <g key={hall}>
            {/* Líneas de bajada de potencia */}
            <line x1={hx + 68} y1="56" x2={hx + 68} y2="82" stroke="currentColor" strokeWidth="1.2" />
            <line x1={hx + 68} y1="218" x2={hx + 68} y2="244" stroke="currentColor" strokeWidth="1.2" />

            <rect
              x={hx}
              y="82"
              width="136"
              height="136"
              rx="5"
              fill="#cef79e"
              fillOpacity={0.5 - hall * 0.08}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            {/* Matriz de racks mayorista dentro de cada hall */}
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={hx + 14 + c * 28}
                  y={98 + r * 28}
                  width="20"
                  height="18"
                  rx="1"
                  fill="#f7f7f5"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              ))
            )}
            <text x={hx + 14} y="204" fill="currentColor" fontSize="9.5" fontFamily="monospace">
              HALL 0{hall + 1} · MW BLOCK
            </text>
          </g>
        )
      })}

      {/* Anillo inferior de Fibra Oscura + MMR */}
      <path d="M 48 244 H 512" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" />
      <circle cx="512" cy="244" r="4" fill="#cef79e" stroke="currentColor" strokeWidth="1.3" />
      <text x="60" y="264" fill="currentColor" fontSize="9.5" fontFamily="monospace">
        DIVERSE DARK FIBER RING · CARRIER NEUTRAL MMR
      </text>
    </svg>
  )
}

const COLOCATION_PRODUCTS: ColocationProductDef[] = [
  {
    slug: "por-u",
    index: "01",
    href: "/datacenter/colocation/por-u",
    titleEn: "Colocation per U",
    titleEs: "Colocation por U",
    tagEn: "1U TO 10U · SHARED CABINET",
    tagEs: "1U A 10U · RACK COMPARTIDO",
    descEn:
      "Deploy individual servers, appliances, or edge nodes from a single rack unit (1U) with dual A+B power feeds and redundant fiber uplinks.",
    descEs:
      "Aloja servidores individuales, firewalls o nodos edge desde una sola U con doble línea eléctrica A+B y conectividad de fibra redundante.",
    specsEn: ["From 1U to 10U", "Dual A+B Power", "1 / 10 Gbps Uplink"],
    specsEs: ["Desde 1U hasta 10U", "Energía A+B", "Uplink 1 / 10 Gbps"],
    ctaEn: "Access Colocation per U",
    ctaEs: "Ver Colocation por U",
    diagram: <VectorColocationPerU />,
  },
  {
    slug: "racks",
    index: "02",
    href: "/datacenter/colocation/racks",
    titleEn: "Half Rack / Full Rack",
    titleEs: "Medio Rack / Rack Completo",
    tagEn: "21U OR 42U–48U · DEDICATED CABINET",
    tagEs: "21U O 42U–48U · ARMARIO DEDICADO",
    descEn:
      "Private lockable cabinets with metered redundant PDUs, hot/cold aisle containment, and scalable power density up to 40 kW per rack.",
    descEs:
      "Armarios exclusivos con cerradura independiente, doble PDU monitorizada, contención de pasillos y potencia escalable hasta 40 kW.",
    specsEn: ["21U Half / 42U–48U Full", "Up to 40 kW / Rack", "Independent Lock"],
    specsEs: ["Medio 21U / Completo 42U–48U", "Hasta 40 kW / Rack", "Cerradura propia"],
    ctaEn: "Access Dedicated Racks",
    ctaEs: "Ver Medio Rack y Rack Completo",
    diagram: <VectorHalfAndFullRack />,
  },
  {
    slug: "jaulas",
    index: "03",
    href: "/datacenter/colocation/jaulas",
    titleEn: "Private Cages",
    titleEs: "Jaulas Privadas",
    tagEn: "MULTI-RACK · PERIMETER SECURITY",
    tagEs: "MULTI-RACK · PERÍMETRO FÍSICO",
    descEn:
      "Custom-built physical security perimeter for multi-rack deployments, featuring dedicated biometric access control and 24×7 CCTV monitoring.",
    descEs:
      "Cerramiento perimetral de seguridad física a medida para múltiples racks, con control de acceso biométrico propio y cámaras CCTV dedicadas.",
    specsEn: ["3 to 20+ Racks", "Biometric Access", "ENS High / PCI-DSS"],
    specsEs: ["De 3 a 20+ Racks", "Acceso biométrico", "ENS Alto / PCI-DSS"],
    ctaEn: "Access Private Cages",
    ctaEs: "Ver Jaulas Privadas",
    diagram: <VectorPrivateCage />,
  },
  {
    slug: "suites",
    index: "04",
    href: "/datacenter/colocation/suites",
    titleEn: "Private Suites",
    titleEs: "Suites Privadas",
    tagEn: "DEDICATED HALL · HIGH DENSITY",
    tagEs: "SALA EXCLUSIVA · ALTA DENSIDAD",
    descEn:
      "Turnkey glass-enclosed or solid-walled technical rooms engineered for maximum privacy, custom cooling, and high-density AI/GPU clusters.",
    descEs:
      "Salas técnicas privadas llave en mano con climatización dedicada, aislamiento total y preparación para clústeres de IA y GPU de alta densidad.",
    specsEn: ["Private Technical Room", "Custom N+1 Cooling", "AI / Liquid Ready"],
    specsEs: ["Sala técnica exclusiva", "Climatización N+1", "Preparada para IA / GPU"],
    ctaEn: "Access Private Suites",
    ctaEs: "Ver Suites Privadas",
    diagram: <VectorPrivateSuite />,
  },
  {
    slug: "wholesale",
    index: "05",
    href: "/datacenter/colocation/wholesale",
    titleEn: "Housing / Wholesale",
    titleEs: "Housing / Wholesale",
    tagEn: "HYPERSCALE & CARRIER CAPACITY",
    tagEs: "CAPACIDAD MAYORISTA Y OPERADORES",
    descEn:
      "Large-scale power and custom white-space footprints designed for cloud providers, telecommunications carriers, and enterprise core infrastructure.",
    descEs:
      "Capacidad eléctrica y espacio técnico a gran escala para operadores de telecomunicaciones, proveedores cloud y despliegues corporativos críticos.",
    specsEn: ["250 kW to Multi-MW", "Dark Fiber Rings", "Custom SLA & Power"],
    specsEs: ["250 kW a Multi-MW", "Anillos fibra oscura", "SLA y potencia a medida"],
    ctaEn: "Access Housing / Wholesale",
    ctaEs: "Ver Housing / Wholesale",
    diagram: <VectorWholesaleCampus />,
  },
]

const USP_CARDS: UspCardDef[] = [
  {
    index: "01.",
    bgClass: "bg-primary",
    textClass: "text-bg-dark",
    headingEn: "2N Power & Precision Cooling",
    headingEs: "Energía 2N y Climatización de Precisión",
    bodyEn:
      "Dual A+B power feeds backed by N+1 generators, 100% renewable energy supply, and high-density cooling up to 40 kW per cabinet.",
    bodyEs:
      "Doble acometida eléctrica A+B con SAI/UPS simétrico, energía 100% renovable y refrigeración preparada para hasta 40 kW por rack.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 15 * Math.PI) / 180
          const x1 = 57 + Math.cos(angle) * 16
          const y1 = 57 + Math.sin(angle) * 16
          const x2 = 57 + Math.cos(angle) * 52
          const y2 = 57 + Math.sin(angle) * 52
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="1.2"
            />
          )
        })}
      </svg>
    ),
  },
  {
    index: "02.",
    bgClass: "bg-bg-dark",
    textClass: "text-text-dark",
    headingEn: "Carrier-Neutral Interconnectivity",
    headingEs: "Interconectividad Neutra Multi-Operador",
    bodyEn:
      "Redundant Meet-Me Rooms, direct cross-connects, dark fiber routes, and blended IP transit with sub-2ms latency across Spain.",
    bodyEs:
      "Meet-Me Rooms redundantes, cross-connects directos, rutas de fibra oscura y tránsito IP con latencia inferior a 2 ms en España.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {[48, 39, 30, 21, 12].map((r, i) => (
          <polygon
            key={i}
            points={[0, 1, 2, 3, 4, 5]
              .map((k) => {
                const a = ((k * 60 - 90) * Math.PI) / 180
                return `${57 + Math.cos(a) * r},${57 + Math.sin(a) * r}`
              })
              .join(" ")}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        ))}
      </svg>
    ),
  },
  {
    index: "03.",
    bgClass: "bg-surface-beige",
    textClass: "text-bg-dark",
    headingEn: "24×7 Security & Smart Hands",
    headingEs: "Seguridad Física y Smart Hands 24×7",
    bodyEn:
      "Biometric access controls, VESDA fire detection, and on-site NOC engineers ready to rack, cable, and maintain your hardware without travel.",
    bodyEs:
      "Control de acceso biométrico, extinción automática y equipo de ingeniería en planta 24×7 para operar tu hardware sin que tengas que desplazarte.",
    icon: (
      <svg viewBox="0 0 114 114" fill="none" className="w-[68px] h-[68px] lg:w-[114px] lg:h-[114px]">
        {[0, 1, 2].map((layer) => {
          const offset = (layer - 1) * 14
          const r = 34
          const pts = [0, 1, 2, 3, 4, 5].map((k) => {
            const a = ((k * 60 - 90) * Math.PI) / 180
            return [57 + Math.cos(a) * r, 57 + offset + Math.sin(a) * (r * 0.55)] as const
          })
          return (
            <g key={layer}>
              <polygon
                points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
                stroke="currentColor"
                strokeWidth="1.15"
              />
              {pts.map(([x, y], idx) => (
                <line
                  key={idx}
                  x1={57}
                  y1={57 + offset}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.9"
                  opacity="0.65"
                />
              ))}
            </g>
          )
        })}
      </svg>
    ),
  },
]

const COLOCATION_METRICS: MetricDef[] = [
  {
    value: "1U → MW",
    labelEn: "MODULAR SCALABILITY",
    labelEs: "ESCALABILIDAD MODULAR",
  },
  {
    value: "40 kW",
    labelEn: "MAX POWER PER RACK",
    labelEs: "POTENCIA MÁX. POR RACK",
  },
  {
    value: "2N",
    labelEn: "ELECTRICAL REDUNDANCY",
    labelEs: "REDUNDANCIA ELÉCTRICA",
  },
  {
    value: "24×7",
    labelEn: "REMOTE SMART HANDS",
    labelEs: "REMOTE SMART HANDS",
  },
]

function WordRevealText({
  words,
  revealed,
  staggerMs = 85,
  baseDelayMs = 0,
}: WordRevealTextProps) {
  return (
    <>
      {words.map((w, idx) => (
        <React.Fragment key={`${w.text}-${idx}`}>
          <span
            className={cn(
              "relative inline-block align-bottom",
              w.muted ? "text-[#c9cbbe]" : "text-text-base"
            )}
            style={{ clipPath: "inset(-0.12em)" }}
          >
            {w.text}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-[0.12em] bottom-[-0.12em] bg-current origin-bottom transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                transform: revealed ? "scaleY(0)" : "scaleY(1)",
                transitionDelay: `${baseDelayMs + idx * staggerMs}ms`,
              }}
            />
          </span>{" "}
          {w.breakAfter && <br className="hidden md:inline" />}
        </React.Fragment>
      ))}
    </>
  )
}

// ─── 3. Component Logic ─────────────────────────────────────────────────────
export default function ColocationPage() {
  const { lang, t } = useLanguage()

  const mediaBannerRef = useRef<HTMLElement>(null)
  const introRef = useRef<HTMLElement>(null)
  const catalogHeadingRef = useRef<HTMLElement>(null)
  const catalogGridRef = useRef<HTMLElement>(null)
  const uspRef = useRef<HTMLDivElement>(null)
  const opsRef = useRef<HTMLElement>(null)

  const [heroRevealed, setHeroRevealed] = useState(false)
  const [mediaRevealed, setMediaRevealed] = useState(false)
  const [introRevealed, setIntroRevealed] = useState(false)
  const [catalogHeadingRevealed, setCatalogHeadingRevealed] = useState(false)
  const [catalogGridRevealed, setCatalogGridRevealed] = useState(false)
  const [uspRevealed, setUspRevealed] = useState(false)
  const [opsRevealed, setOpsRevealed] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) {
      setHeroRevealed(true)
      setMediaRevealed(true)
      setIntroRevealed(true)
      setCatalogHeadingRevealed(true)
      setCatalogGridRevealed(true)
      setUspRevealed(true)
      setOpsRevealed(true)
      return
    }

    const heroTimer = window.setTimeout(() => setHeroRevealed(true), 60)

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target
          if (target === mediaBannerRef.current) setMediaRevealed(true)
          else if (target === introRef.current) setIntroRevealed(true)
          else if (target === catalogHeadingRef.current) setCatalogHeadingRevealed(true)
          else if (target === catalogGridRef.current) setCatalogGridRevealed(true)
          else if (target === uspRef.current) setUspRevealed(true)
          else if (target === opsRef.current) setOpsRevealed(true)
          obs.unobserve(target)
        })
      },
      { threshold: 0, rootMargin: "0px 0px -15% 0px" }
    )

    const targets = [
      mediaBannerRef.current,
      introRef.current,
      catalogHeadingRef.current,
      catalogGridRef.current,
      uspRef.current,
      opsRef.current,
    ]
    targets.forEach((el) => {
      if (el) obs.observe(el)
    })

    return () => {
      window.clearTimeout(heroTimer)
      obs.disconnect()
    }
  }, [])

  const handleScrollToProducts = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById("productos")
    if (target) {
      target.scrollIntoView({ behavior: "smooth" })
    }
  }

  const heroTitleWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Colocation", breakAfter: true },
          { text: "Edge", muted: true },
          { text: "Green", muted: true },
        ]
      : [
          { text: "Colocation", breakAfter: true },
          { text: "Edge", muted: true },
          { text: "Green", muted: true },
        ]

  const heroSubWords: RevealWord[] =
    lang === "es"
      ? "Escoge el espacio que necesitas, desde una U hasta una suite completa, en nuestro centro de datos en España con energía renovable."
          .split(" ")
          .map((text) => ({ text }))
      : "Choose the space you need, from a single U to a full private suite, in our Spanish data center powered by renewable energy."
          .split(" ")
          .map((text) => ({ text }))

  const introWords: RevealWord[] =
    lang === "es"
      ? [
          ..."Aloja tu infraestructura crítica en un entorno de máxima disponibilidad, con doble acometida eléctrica 2N, conectividad neutra multi-operador y"
            .split(" ")
            .map((text) => ({ text })),
          ...["escalabilidad", "desde", "1U", "hasta", "suites", "privadas."].map((text) => ({
            text,
            muted: true,
          })),
        ]
      : [
          ..."Host your mission-critical infrastructure in a high-availability environment with 2N redundant power, carrier-neutral connectivity, and"
            .split(" ")
            .map((text) => ({ text })),
          ...["seamless", "scalability", "from", "1U", "to", "private", "suites."].map((text) => ({
            text,
            muted: true,
          })),
        ]

  const catalogTitleWords: RevealWord[] =
    lang === "es"
      ? [
          { text: "Productos" },
          { text: "de" },
          { text: "Colocation", muted: true },
        ]
      : [
          { text: "Colocation" },
          { text: "Products", muted: true },
        ]

  const opsWords: RevealWord[] =
    lang === "es"
      ? [
          ..."Todo lo que tu despliegue de colocation necesita"
            .split(" ")
            .map((text) => ({ text })),
          ...["bajo", "un", "mismo", "techo."].map((text) => ({
            text,
            muted: true,
          })),
        ]
      : [
          ..."Everything your colocation deployment needs"
            .split(" ")
            .map((text) => ({ text })),
          ...["under", "one", "roof."].map((text) => ({
            text,
            muted: true,
          })),
        ]

  // ─── 4. Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── SECCIÓN 1: c-hero (Hero Editorial con Cortina por Palabra) ── */}
      <section className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[96px] md:pt-[148px] pb-[40px] md:pb-[50px]">
        <div className="flex flex-col gap-y-9 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,482px)] md:gap-x-[60px] md:gap-y-9">
          <h1 className="md:col-span-2 text-[clamp(2.35rem,calc(2.35rem+0.095*(100vw-23rem)),8.75rem)] font-normal tracking-[-0.03em] leading-[1.02] md:min-h-[380px] lg:min-h-[425px] pb-10 md:pb-[125px] relative after:content-[''] after:absolute after:bottom-0 after:inset-x-0 after:h-3 after:rounded-t-[8px] after:border-t after:border-l after:border-r after:border-bg-dark/10">
            <WordRevealText words={heroTitleWords} revealed={heroRevealed} staggerMs={110} />
          </h1>

          {/* Botón Scroll `.scroll-btn` */}
          <div className="hidden md:flex items-start">
            <a
              href="#productos"
              onClick={handleScrollToProducts}
              aria-label={t("Scroll to Colocation products", "Ir a los productos de Colocation")}
              className="group relative flex items-center justify-center w-12 h-12 rounded-[16px] bg-bg-dark text-white border border-bg-dark/10 overflow-hidden transition-colors duration-300 hover:bg-primary hover:border-primary hover:text-bg-dark"
            >
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:translate-y-8"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="rotate-180">
                  <path
                    fill="currentColor"
                    d="M5.25 2.869V12h1.5V2.869l4.2 4.2L12 6 6 0 0 6l1.05 1.069 4.2-4.2Z"
                  />
                </svg>
              </span>
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center bg-primary text-bg-dark rounded-[inherit] -translate-y-[110%] transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:translate-y-0"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="rotate-180">
                  <path
                    fill="currentColor"
                    d="M5.25 2.869V12h1.5V2.869l4.2 4.2L12 6 6 0 0 6l1.05 1.069 4.2-4.2Z"
                  />
                </svg>
              </span>
            </a>
          </div>

          <h2 className="text-[clamp(1.0625rem,calc(1.0625rem+0.007*(100vw-27.5rem)),1.5rem)] font-normal tracking-[-0.02em] leading-[1.22] max-w-[482px] text-pretty">
            <WordRevealText
              words={heroSubWords}
              revealed={heroRevealed}
              staggerMs={36}
              baseDelayMs={220}
            />
          </h2>
        </div>
      </section>

      {/* ── SECCIÓN 2: c-fs-media (Foto Panorámica de Pasillo de Racks OLA) ── */}
      <section ref={mediaBannerRef} className="w-full max-w-[1624px] mx-auto px-3 pb-3">
        <figure className="relative w-full aspect-[16/9] md:aspect-[1596/680] rounded-[12px] lg:rounded-[30px] overflow-hidden bg-bg-dark">
          <img
            src="/ola-datacenter-racks.jpg"
            alt={t(
              "High-density colocation server aisle at OLA Datacenter",
              "Pasillo técnico de racks de colocation en OLA Datacenter"
            )}
            fetchPriority="high"
            decoding="async"
            width={1024}
            height={682}
            className={cn(
              "w-full h-full object-cover object-center transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              mediaRevealed ? "scale-100" : "scale-[1.06]"
            )}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-dark/40 via-transparent to-transparent" />
          <figcaption className="absolute bottom-4 left-4 md:bottom-7 md:left-7 inline-flex items-center gap-2.5 bg-surface-light/90 backdrop-blur-md text-text-base rounded-[8px] py-2 px-3 font-mono uppercase text-[11px] tracking-[0.02em] leading-none">
            <span aria-hidden className="w-2 h-2 bg-primary-hover shrink-0" />
            {t(
              "COLOCATION · FROM 1U TO PRIVATE SUITES · SPAIN",
              "COLOCATION · DESDE 1U HASTA SUITES PRIVADAS · ESPAÑA"
            )}
          </figcaption>
        </figure>
      </section>

      {/* ── SECCIÓN 3: c-hgroup ("COLOCATION FLEXIBLE" + Manifiesto Bicolor) ── */}
      <section
        ref={introRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[60px] pb-[clamp(70px,calc(45px+6vw),140px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-11 lg:gap-x-10 items-start"
      >
        <aside className="w-full">
          <div
            className={cn(
              "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
              introRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
            {t("FLEXIBLE COLOCATION", "COLOCATION FLEXIBLE")}
          </div>
        </aside>

        <div className="w-full">
          <h3 className="text-[clamp(1.625rem,calc(1.625rem+0.02*(100vw-26.25rem)),3.125rem)] font-normal tracking-[-0.02em] leading-[1.12] text-balance">
            <WordRevealText words={introWords} revealed={introRevealed} staggerMs={40} />
          </h3>
        </div>
      </section>

      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]">
        <hr className="border-t border-bg-dark/10 m-0" />
      </div>

      {/* ── SECCIÓN 4: Catálogo de Productos de Colocation con Dibujos Vectoriales de Líneas ── */}
      <div id="productos" className="w-full">
        <section
          ref={catalogHeadingRef}
          className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(60px,calc(40px+4vw),115px)] pb-4"
        >
          <h2 className="text-[clamp(2.375rem,calc(2.375rem+0.068*(100vw-26.25rem)),7.25rem)] font-normal tracking-[-0.03em] leading-[1.05]">
            <WordRevealText
              words={catalogTitleWords}
              revealed={catalogHeadingRevealed}
              staggerMs={110}
            />
          </h2>
        </section>

        <section
          ref={catalogGridRef}
          className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[30px] pb-[clamp(80px,calc(50px+5vw),140px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-12 lg:gap-x-10 items-start"
        >
          {/* Sidebar izquierdo con corchete superior, métricas y CTA */}
          <aside className="relative w-full pt-12 flex flex-col gap-y-8 lg:sticky lg:top-28 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
            <div>
              <div
                className={cn(
                  "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
                  "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  catalogGridRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
              >
                <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
                {t("5 COLOCATION MODALITIES", "5 MODALIDADES DE ESPACIO")}
              </div>
            </div>

            <p
              className={cn(
                "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35] lg:max-w-[380px]",
                "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[100ms]",
                catalogGridRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              {t(
                "Select any Colocation product to explore its technical specifications, power allocations, security tiers, and direct deployment options.",
                "Selecciona cualquiera de nuestros productos de Colocation para consultar sus especificaciones técnicas, niveles de potencia, seguridad y opciones de contratación."
              )}
            </p>

            {/* Métricas rápidas */}
            <div className="grid grid-cols-2 gap-4 lg:max-w-[380px]">
              {COLOCATION_METRICS.map((m, idx) => (
                <div
                  key={m.value}
                  className={cn(
                    "bg-surface-light rounded-[12px] p-5 border border-bg-dark/5",
                    "transition-all duration-[700ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    catalogGridRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${160 + idx * 75}ms` }}
                >
                  <div className="text-[clamp(1.5rem,2.1vw,2.125rem)] font-normal tracking-[-0.03em] leading-none text-text-base mb-2">
                    {m.value}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.02em] text-text-base/55 leading-tight">
                    {t(m.labelEn, m.labelEs)}
                  </div>
                </div>
              ))}
            </div>

            <div
              className={cn(
                "pt-2 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[420ms]",
                catalogGridRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <ArrowCta href="/contact">
                {t("CONFIGURE YOUR SPACE", "CONFIGURAR MI ESPACIO")}
              </ArrowCta>
            </div>
          </aside>

          {/* Grid derecho con las 5 tarjetas de producto + dibujos vectoriales de líneas */}
          <div className="relative w-full pt-12 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
            {COLOCATION_PRODUCTS.map((product, idx) => {
              const specs = lang === "es" ? product.specsEs : product.specsEn
              const isFeaturedWide = idx === 4
              return (
                <Link
                  key={product.slug}
                  id={product.slug}
                  href={product.href}
                  className={cn(
                    "group relative flex flex-col min-h-[320px] p-3 rounded-t-[24px] rounded-bl-[24px] overflow-hidden text-text-base no-underline",
                    "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    isFeaturedWide &&
                      "md:col-span-2 md:grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-6 md:items-center",
                    catalogGridRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                  )}
                  style={{ transitionDelay: `${120 + idx * 110}ms` }}
                >
                  {/* Fondo blanco con recorte en esquina inferior derecha `.item_background` */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-surface-light rounded-t-[24px] rounded-bl-[24px] z-0 transition-colors duration-300 group-hover:bg-white"
                    style={{
                      clipPath:
                        "polygon(100% 0, 100% calc(100% - 75px), calc(100% - 75px) calc(100% - 75px), calc(100% - 75px) 100%, 0 100%, 0 0)",
                    }}
                  />

                  {/* Lienzo vectorial técnico de líneas */}
                  <figure
                    className={cn(
                      "relative z-10 w-full aspect-[470/300] rounded-[16px] overflow-hidden bg-[#f1f2ec] border border-bg-dark/8 text-bg-dark transition-colors duration-500 group-hover:bg-[#eaece3]",
                      isFeaturedWide ? "mb-4 md:mb-0 md:h-full" : "mb-[18px]"
                    )}
                  >
                    <div className="w-full h-full flex items-center justify-center p-2 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.03]">
                      {product.diagram}
                    </div>

                    {/* Índice + Pastilla pastel corporativa en esquina superior */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 bg-surface-light/95 backdrop-blur-md text-text-base rounded-[6px] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.02em] border border-bg-dark/8">
                        <span aria-hidden className="w-2 h-2 bg-primary-hover" />
                        {product.index}
                      </span>
                      <span className="inline-flex items-center bg-[#cef79e]/65 text-bg-dark rounded-[6px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.02em]">
                        {t(product.tagEn, product.tagEs)}
                      </span>
                    </div>
                  </figure>

                  {/* Contenido textual de la tarjeta */}
                  <div className="relative z-10 flex flex-col flex-1 gap-3 p-3 min-h-[210px]">
                    <h3 className="text-[clamp(1.375rem,1.8vw,1.625rem)] font-normal tracking-[-0.02em] leading-[1.1] text-text-base">
                      {t(product.titleEn, product.titleEs)}
                    </h3>

                    <p className="text-[15px] text-text-base/75 tracking-[-0.01em] leading-[1.38]">
                      {t(product.descEn, product.descEs)}
                    </p>

                    {/* Chips de especificaciones técnicas */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {specs.map((spec) => (
                        <span
                          key={spec}
                          className="inline-flex items-center bg-bg-light text-text-base/80 border border-bg-dark/10 rounded-[6px] px-2.5 py-1 font-mono text-[11px] tracking-[-0.01em] leading-none"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto pt-5 font-mono text-[12px] tracking-[-0.02em] leading-none uppercase text-text-base pr-16 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-hover transition-transform duration-300 group-hover:scale-150" />
                      {t(product.ctaEn, product.ctaEs)}
                    </div>
                  </div>

                  {/* Muesca curva SVG (`87x90`) + botón paralelogramo `.u-btn--2` (`51x48`) */}
                  <div className="pointer-events-none absolute right-0 bottom-0 w-[87px] h-[90px] z-10 flex items-end justify-end">
                    <svg
                      className="absolute inset-0 w-full h-full"
                      xmlns="http://www.w3.org/2000/svg"
                      width="87"
                      height="90"
                      fill="none"
                      viewBox="0 0 87 90"
                    >
                      <path
                        fill="#ffffff"
                        d="M35.43 45.104 23.71 81.57A12.146 12.146 0 0 1 12.145 90C5.438 90 0 84.562 0 77.854V16C0 7.163 7.163 0 16 0h55c8.837 0 16 7.163 16 16v2c0 8.837-7.163 16-16 16H50.663a16 16 0 0 0-15.232 11.104Z"
                      />
                    </svg>

                    <div className="relative z-10 w-[51px] h-[48px] flex items-center justify-center text-primary transition-all duration-300 group-hover:text-bg-dark group-hover:scale-[0.94]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="51"
                        height="48"
                        fill="none"
                        viewBox="0 0 51 48"
                        className="w-full h-full"
                      >
                        <path
                          fill="currentColor"
                          className="transition-colors duration-300"
                          d="M6.728 9.09A12 12 0 0 1 18.369 0H39c6.627 0 12 5.373 12 12v24c0 6.627-5.373 12-12 12H12.37C4.561 48-1.167 40.663.727 33.09l6-24Z"
                        />
                      </svg>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="absolute text-bg-dark transition-colors duration-300 group-hover:text-white rotate-90"
                      >
                        <path
                          fill="currentColor"
                          d="M5.25 2.869V12h1.5V2.869l4.2 4.2L12 6 6 0 0 6l1.05 1.069 4.2-4.2Z"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── SECCIÓN 5: c-usp-cards (3 Tarjetas Arquitectónicas a Sangre con Barrido Clip-Path) ── */}
      <div ref={uspRef} className="w-full grid grid-cols-1 lg:grid-cols-3">
        {USP_CARDS.map((card, cardIdx) => {
          const cardDelayMs = cardIdx * 150
          const contentBaseMs = 600 + cardIdx * 150
          return (
            <div
              key={card.index}
              className={cn(
                "relative flex flex-col justify-between min-h-[280px] lg:min-h-[420px] p-6 lg:p-10 overflow-hidden",
                "transition-[clip-path] duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                card.bgClass,
                card.textClass
              )}
              style={{
                clipPath: uspRevealed
                  ? "polygon(0 0, 100% 0, 100% 100%, 0% 100%)"
                  : "polygon(0 0, 0% 0, 0% 100%, 0% 100%)",
                transitionDelay: `${cardDelayMs}ms`,
              }}
            >
              <div
                className={cn(
                  "absolute top-6 right-6 lg:top-10 lg:right-10 font-mono text-[13px] tracking-[-0.02em] leading-none uppercase",
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  uspRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${contentBaseMs}ms` }}
              >
                {card.index}
              </div>

              <div
                className={cn(
                  "flex items-start justify-start",
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                  uspRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                )}
                style={{ transitionDelay: `${contentBaseMs + 160}ms` }}
              >
                {card.icon}
              </div>

              <div className="flex flex-col gap-4 mt-10">
                <h3
                  className={cn(
                    "text-[clamp(1.625rem,calc(1.625rem+0.002*(100vw-27.5rem)),1.75rem)] font-normal tracking-[-0.02em] leading-[1.1]",
                    "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    uspRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${contentBaseMs + 320}ms` }}
                >
                  {t(card.headingEn, card.headingEs)}
                </h3>
                <p
                  className={cn(
                    "text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.1875rem)] tracking-[-0.02em] leading-[1.3] opacity-75",
                    "transition-all duration-[600ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
                    uspRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
                  )}
                  style={{ transitionDelay: `${contentBaseMs + 480}ms` }}
                >
                  {t(card.bodyEn, card.bodyEs)}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── SECCIÓN 6: c-hgroup (Conectividad y Operación — sin foto lateral) ── */}
      <section
        ref={opsRef}
        className="w-full max-w-[1600px] mx-auto px-6 md:px-[44px] pt-[clamp(64px,calc(48px+4vw),120px)] pb-[clamp(80px,calc(60px+4vw),136px)] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-y-11 lg:gap-x-10 items-start"
      >
        <aside className="relative w-full pt-12 before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-3 before:rounded-t-[8px] before:border-t before:border-l before:border-r before:border-bg-dark/10">
          <div
            className={cn(
              "inline-flex items-center bg-surface-light text-text-base rounded-[8px] py-2 pl-2 pr-3 font-mono uppercase text-[12px] leading-none tracking-[0.02em] shadow-[0_1px_2px_rgba(10,15,28,0.04)]",
              "transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
              opsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <span aria-hidden className="w-2.5 h-2.5 bg-primary-hover mr-3 shrink-0" />
            {t("CONNECTIVITY & OPERATIONS", "CONECTIVIDAD Y OPERACIÓN")}
          </div>
        </aside>

        <div className="relative w-full lg:pt-12 flex flex-col items-start gap-y-9 lg:before:content-[''] lg:before:absolute lg:before:top-0 lg:before:left-0 lg:before:w-full lg:before:h-3 lg:before:rounded-t-[8px] lg:before:border-t lg:before:border-l lg:before:border-r lg:before:border-bg-dark/10">
          <h3 className="text-[clamp(1.75rem,calc(1.5rem+2vw),3.5rem)] font-normal tracking-[-0.02em] leading-[1.1] text-balance">
            <WordRevealText words={opsWords} revealed={opsRevealed} staggerMs={55} />
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-[780px] text-[clamp(1rem,calc(1rem+0.003*(100vw-27.5rem)),1.15rem)] text-text-base/80 tracking-[-0.02em] leading-[1.35]">
            <div
              className={cn(
                "flex flex-col gap-2.5 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[140ms]",
                opsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <span className="inline-block self-start px-2 py-1 rounded bg-[#cef79e]/45 font-mono text-[12px] uppercase tracking-[0.02em] text-bg-dark">
                {t("Connectivity", "Conectividad")}
              </span>
              <p>
                {t(
                  "Connect your racks via redundant fiber Cross-Connects, dual Meet-Me Rooms, and carrier-neutral IP Transit with direct peering.",
                  "Conecta tus racks mediante Cross-connects de fibra redundantes, doble Meet-me room y Tránsito IP neutro multi-operador."
                )}
              </p>
            </div>

            <div
              className={cn(
                "flex flex-col gap-2.5 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[220ms]",
                opsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
              )}
            >
              <span className="inline-block self-start px-2 py-1 rounded bg-[#cef79e]/22 font-mono text-[12px] uppercase tracking-[0.02em] text-bg-dark">
                {t("Operations Services", "Servicios de operación")}
              </span>
              <p>
                {t(
                  "24×7 Remote Smart Hands, hardware receiving, storage logistics, and full server installation & racking by our on-site engineers.",
                  "Remote smart hands 24×7, recepción y logística de equipamiento, e instalación y racking completo por nuestro equipo en planta."
                )}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "pt-2 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] delay-[300ms]",
              opsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            )}
          >
            <ArrowCta href="/contact">
              {t("BOOK A DATACENTER TOUR", "SOLICITAR VISITA AL DATACENTER")}
            </ArrowCta>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

/*
 * ─── 5. Memoria ─────────────────────────────────────────────────────────────
 * Por qué: el usuario pidió eliminar la fotografía lateral de la sección
 * `Conectividad y Operación` e implementar dibujos vectoriales de líneas en las
 * 5 soluciones de Colocation (`Colocation por U`, `Medio Rack / Rack Completo`,
 * `Jaulas Privadas`, `Suites Privadas`, `Housing / Wholesale`).
 * Decisiones técnicas:
 *  - Se crearon 5 componentes SVG vectoriales a medida (`VectorColocationPerU`,
 *    `VectorHalfAndFullRack`, `VectorPrivateCage`, `VectorPrivateSuite`, `VectorWholesaleCampus`)
 *    con estética de plano técnico de líneas finas y acentos `#cef79e`.
 *  - La sección `Conectividad y Operación` se transformó al formato limpio `c-hgroup`
 *    (1fr / 2fr con corchetes superiores y titular con cortina por palabra) sin foto.
 */
