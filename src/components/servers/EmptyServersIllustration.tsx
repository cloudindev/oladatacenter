/**
 * Line drawing for the empty server list: a rack in the same blueprint style as the
 * colocation page, with one free slot highlighted where the customer's VPS will go.
 * No background or grid, so it sits on any surface. Decorative only.
 */
export function EmptyServersIllustration({ className }: { className?: string }) {
  const idle = [40, 70, 160, 190]
  return (
    <svg
      viewBox="0 0 470 236"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      {/* 19" rack rails */}
      <line x1="115" y1="24" x2="115" y2="224" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" />
      <line x1="127" y1="24" x2="127" y2="224" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.25" />
      <line x1="343" y1="24" x2="343" y2="224" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.25" />
      <line x1="355" y1="24" x2="355" y2="224" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.35" />

      {/* Occupied units, at rest */}
      {idle.map((y, index) => (
        <g key={y} opacity="0.38">
          <rect x="127" y={y} width="216" height="22" rx="2" stroke="currentColor" strokeWidth="1" />
          <line x1="138" y1={y + 11} x2="178" y2={y + 11} stroke="currentColor" strokeWidth="1" />
          <circle cx="322" cy={y + 11} r="2" fill="currentColor" />
          <circle cx="330" cy={y + 11} r="2" fill="currentColor" />
          <text x="92" y={y + 14} fill="currentColor" fontSize="9" fontFamily="monospace">
            {`0${index < 2 ? index + 1 : index + 2}U`}
          </text>
        </g>
      ))}

      {/* The free slot: where the customer's server goes */}
      <g>
        <rect
          x="105"
          y="100"
          width="260"
          height="46"
          rx="4"
          fill="#cef79e"
          fillOpacity="0.55"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <rect x="111" y="106" width="8" height="34" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="351" y="106" width="8" height="34" rx="1" stroke="currentColor" strokeWidth="1.1" />

        {/* "+" in the middle of the slot */}
        <circle cx="235" cy="123" r="13" fill="#f7f7f5" stroke="currentColor" strokeWidth="1.2" />
        <line x1="229" y1="123" x2="241" y2="123" stroke="currentColor" strokeWidth="1.4" />
        <line x1="235" y1="117" x2="235" y2="129" stroke="currentColor" strokeWidth="1.4" />

        {/* Callouts */}
        <line x1="66" y1="123" x2="100" y2="123" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="66" cy="123" r="3" fill="currentColor" />
        <text x="34" y="126" fill="currentColor" fontSize="10" fontFamily="monospace">
          03U
        </text>

        <line x1="370" y1="123" x2="404" y2="123" stroke="currentColor" strokeWidth="1.1" />
        <text x="409" y="126" fill="currentColor" fontSize="9" fontFamily="monospace">
          TU VPS
        </text>
      </g>
    </svg>
  )
}
