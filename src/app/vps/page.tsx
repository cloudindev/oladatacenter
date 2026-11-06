/**
 * `/vps` — the public OLA VPS Cloud plans page.
 *
 * Server Component: every price comes from `listSellablePlans()`, which prices through
 * `buildQuote`. The only client islands are the term switch and the cards it drives.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { formatCents } from "@ola/core"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { SectionLabel } from "@/components/ui/SectionLabel"
import { PlanCards } from "@/components/vps/PlanCards"
import { PlanComparison } from "@/components/vps/PlanComparison"
import { VpsFaq } from "@/components/vps/VpsFaq"
import { listSellablePlans } from "@/server/catalog/service"
import { clientEnv } from "@/lib/env"

const TITLE = "Servidores VPS Cloud en Europa"
const DESCRIPTION =
  "Servidores VPS con vCores dedicados, disco NVMe, backup automático y anti-DDoS. " +
  "Precios sin IVA, alta en minutos y centros de datos en Europa."

export const metadata: Metadata = {
  title: `${TITLE} — OLA VPS Cloud`,
  description: DESCRIPTION,
  alternates: {
    canonical: new URL("/vps", clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
  },
  openGraph: {
    title: `${TITLE} — OLA VPS Cloud`,
    description: DESCRIPTION,
    url: new URL("/vps", clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
    type: "website",
    locale: "es_ES",
  },
}

// Statically rendered at build time; refreshed every 5 minutes so admin changes to
// prices or plan order reach the page without a redeploy.
export const revalidate = 300

const CONTAINER ="w-full max-w-[1600px] mx-auto px-6 md:px-[44px]"

export default async function VpsPlansPage() {
  const plans = await listSellablePlans()
  const entry = plans[0]

  return (
    <main className="flex min-h-screen flex-col bg-bg-light text-text-base selection:bg-primary selection:text-bg-dark">
      <Header />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className={`${CONTAINER} pt-[96px] md:pt-[148px] pb-12 md:pb-16`}>
        <SectionLabel>03 / Cloud · Servidores VPS</SectionLabel>
        <h1 className="text-[clamp(2.35rem,4.6vw,4.75rem)] font-normal leading-[1.02] tracking-[-0.03em] md:whitespace-nowrap">
          Servidores VPS <span className="text-text-sage">listos en minutos.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-text-muted">
          vCores dedicados, disco NVMe, backup automático y protección anti-DDoS desde el primer
          día. Eliges el centro de datos, el sistema y el periodo; nosotros lo entregamos
          configurado.
        </p>
        {entry ? (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
            Desde {formatCents(entry.price.P12M.monthly)} al mes, sin IVA
          </p>
        ) : null}
      </section>

      {/* ── Planes ─────────────────────────────────────────────────────────── */}
      <section className={`${CONTAINER} pb-16 md:pb-24`} id="planes">
        {plans.length > 0 ? (
          <PlanCards plans={plans} />
        ) : (
          <div className="rounded-[18px] border border-dashed border-bg-dark/20 px-6 py-12 text-center">
            <p className="mb-5 text-text-muted">
              El catálogo no está disponible en este momento.
            </p>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-bg-dark px-5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-dark"
            >
              Hablar con el equipo
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
      </section>

      {/* ── Comparativa (pantallas anchas) ─────────────────────────────────── */}
      {plans.length > 0 ? (
        <section className="border-t border-bg-dark/12 bg-surface-beige py-16 md:py-24">
          <div className={CONTAINER}>
            <SectionLabel>Comparativa</SectionLabel>
            <h2 className="mb-10 text-[clamp(1.85rem,3.2vw,3rem)] font-normal tracking-[-0.03em]">
              Todo lo que incluye cada plan
            </h2>
            <div className="hidden lg:block">
              <PlanComparison plans={plans} />
            </div>
            <p className="text-[15px] leading-relaxed text-text-muted lg:hidden">
              La tabla comparativa completa se muestra en pantallas anchas. En móvil tienes las
              mismas características en cada tarjeta de plan, y el configurador muestra el detalle
              de precios antes de continuar.
            </p>
          </div>
        </section>
      ) : null}

      {/* ── Preguntas frecuentes ───────────────────────────────────────────── */}
      <section className={`${CONTAINER} py-16 md:py-24`} id="faq">
        <SectionLabel>Preguntas frecuentes</SectionLabel>
        <h2 className="mb-10 text-[clamp(1.85rem,3.2vw,3rem)] font-normal tracking-[-0.03em]">
          Antes de contratar
        </h2>
        <VpsFaq datacenters={entry?.datacenters ?? []} />
        <p className="mt-10 text-[14px] text-text-muted">
          Todos los precios de esta página son netos, sin IVA. El impuesto se calcula y se muestra
          en el paso de pago según tu país y tu NIF.
        </p>
      </section>

      <Footer />
    </main>
  )
}
