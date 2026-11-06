/**
 * `/vps/configurar` — the configurator.
 *
 * The page resolves the shared query string server side, prices it once with
 * `publicQuoteFor` and hands both to the client island. Every later recalculation goes
 * back to the server through `quoteAction`.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { resolveConfig } from "@ola/core"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { SectionLabel } from "@/components/ui/SectionLabel"
import { Configurator } from "@/components/vps/Configurator"
import { listSellablePlans, publicQuoteFor } from "@/server/catalog/service"
import { clientEnv } from "@/lib/env"

const TITLE = "Configura tu servidor VPS"
const DESCRIPTION =
  "Elige plan, centro de datos, sistema operativo y opciones. El precio se calcula al " +
  "instante, sin IVA, y el enlace guarda tu configuración."

export const metadata: Metadata = {
  title: `${TITLE} — OLA VPS Cloud`,
  description: DESCRIPTION,
  alternates: {
    canonical: new URL("/vps/configurar", clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
  },
  // The configuration lives in the query string: only the clean URL should be indexed.
  robots: { index: true, follow: true },
}

const CONTAINER = "w-full max-w-[1600px] mx-auto px-6 md:px-[44px]"

export default async function VpsConfiguratorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [plans, raw] = await Promise.all([listSellablePlans(), searchParams])

  return (
    <main className="flex min-h-screen flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      <section className={`${CONTAINER} pt-[96px] md:pt-[136px] pb-10`}>
        <SectionLabel>Cloud · Servidores VPS</SectionLabel>
        <h1 className="max-w-[24ch] text-[clamp(2rem,calc(2rem+0.04*(100vw-23rem)),4rem)] font-normal leading-[1.04] tracking-[-0.03em]">
          Configura tu servidor
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-text-muted">
          Cada cambio recalcula el precio en el servidor. Los importes son sin IVA: el impuesto se
          añade en el paso de pago.
        </p>
        <Link
          href="/vps"
          className="mt-6 inline-block font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted underline underline-offset-4 hover:text-text-base"
        >
          ← Volver a los planes
        </Link>
      </section>

      <section className={`${CONTAINER} pb-20 md:pb-28`}>
        {plans.length === 0 ? (
          <EmptyCatalog />
        ) : (
          <ConfiguratorIsland plans={plans} raw={raw} />
        )}
      </section>

      <Footer />
    </main>
  )
}

function EmptyCatalog() {
  return (
    <div className="rounded-[18px] border border-dashed border-bg-dark/20 px-6 py-12 text-center">
      <p className="mb-5 text-text-muted">
        El catálogo no está disponible en este momento, así que no podemos calcular el precio.
      </p>
      <Link
        href="/contact"
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-bg-dark px-5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-dark"
      >
        Hablar con el equipo
        <span aria-hidden>→</span>
      </Link>
    </div>
  )
}

async function ConfiguratorIsland({
  plans,
  raw,
}: {
  plans: Awaited<ReturnType<typeof listSellablePlans>>
  raw: Record<string, string | string[] | undefined>
}) {
  const config = resolveConfig(plans, raw)
  const quote = await publicQuoteFor(config)
  return <Configurator plans={plans} initialConfig={config} initialQuote={quote} />
}
