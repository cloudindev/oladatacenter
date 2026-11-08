/**
 * Small flags for the countries we have datacenters in. Inline SVG, simplified for 20 px:
 * emoji flags do not render on Windows, and an image CDN would be one more third party.
 * Decorative: the country is always written next to it.
 */

const UNION_JACK = (
  <>
    <rect width="60" height="40" fill="#012169" />
    <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
    <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="3" />
    <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
    <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
  </>
)

const FLAGS: Readonly<Record<string, React.ReactNode>> = {
  FR: (
    <>
      <rect width="20" height="40" fill="#002395" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ED2939" />
    </>
  ),
  IT: (
    <>
      <rect width="20" height="40" fill="#009246" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#CE2B37" />
    </>
  ),
  DE: (
    <>
      <rect width="60" height="14" fill="#000" />
      <rect y="13" width="60" height="14" fill="#DD0000" />
      <rect y="26" width="60" height="14" fill="#FFCE00" />
    </>
  ),
  PL: (
    <>
      <rect width="60" height="20" fill="#fff" />
      <rect y="20" width="60" height="20" fill="#DC143C" />
    </>
  ),
  GB: UNION_JACK,
  CA: (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect width="15" height="40" fill="#D52B1E" />
      <rect x="45" width="15" height="40" fill="#D52B1E" />
      <path
        d="M30 9l2.4 4.6 2.8-1.2-1 6.4 3.6-3.4.8 2.4 3.6-.8-1.4 4.2 1.6.8-6.2 4.8.8 2.4-6-.8V33h-1.8v-4.6l-6 .8.8-2.4-6.2-4.8 1.6-.8-1.4-4.2 3.6.8.8-2.4 3.6 3.4-1-6.4 2.8 1.2z"
        fill="#D52B1E"
      />
    </>
  ),
  AU: (
    <>
      <rect width="60" height="40" fill="#012169" />
      <g transform="scale(.5)">{UNION_JACK}</g>
      <circle cx="15" cy="31" r="3.2" fill="#fff" />
      <circle cx="45" cy="9" r="1.6" fill="#fff" />
      <circle cx="50" cy="17" r="1.6" fill="#fff" />
      <circle cx="40" cy="20" r="1.6" fill="#fff" />
      <circle cx="45" cy="31" r="1.8" fill="#fff" />
    </>
  ),
  SG: (
    <>
      <rect width="60" height="20" fill="#EF3340" />
      <rect y="20" width="60" height="20" fill="#fff" />
      <circle cx="13" cy="10" r="6" fill="#fff" />
      <circle cx="15.5" cy="10" r="6" fill="#EF3340" />
      <g fill="#fff">
        <circle cx="17" cy="6" r="1" />
        <circle cx="20" cy="8" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="14.5" cy="8" r="1" />
      </g>
    </>
  ),
  IN: (
    <>
      <rect width="60" height="14" fill="#FF9933" />
      <rect y="13" width="60" height="14" fill="#fff" />
      <rect y="26" width="60" height="14" fill="#138808" />
      <circle cx="30" cy="20" r="5" fill="none" stroke="#000080" strokeWidth="1.4" />
      <circle cx="30" cy="20" r="1.2" fill="#000080" />
    </>
  ),
}

export function CountryFlag({ code, className }: { code: string; className?: string }) {
  const flag = FLAGS[code.toUpperCase()]
  if (!flag) return null
  return (
    <svg
      viewBox="0 0 60 40"
      aria-hidden
      className={className ?? "h-[14px] w-[21px] shrink-0 rounded-[2px] ring-1 ring-black/10"}
    >
      {flag}
    </svg>
  )
}
