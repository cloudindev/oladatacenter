import type { Metadata } from "next"
import { Globe, HardDrive, Mail } from "lucide-react"
import { PageTitle, Panel } from "@/components/app/ui"

/** Web Cloud: announced, not sold yet. */

export const metadata: Metadata = {
  title: "Web Cloud · OLA",
}

const PRODUCTS = [
  { icon: HardDrive, title: "Alojamiento web", text: "Hosting gestionado para webs y tiendas online." },
  { icon: Globe, title: "Dominios", text: "Registro y gestión de dominios y DNS." },
  { icon: Mail, title: "Correo profesional", text: "Buzones con tu dominio, antispam incluido." },
] as const

export default function WebCloudPage() {
  return (
    <>
      <PageTitle description="Estamos preparando estos servicios. Aparecerán aquí en cuanto estén disponibles.">
        Web Cloud
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-3">
        {PRODUCTS.map(({ icon: Icon, title, text }) => (
          <Panel key={title}>
            <Icon aria-hidden className="h-5 w-5 text-text-muted mb-4" strokeWidth={1.6} />
            <p className="text-text-base mb-1">{title}</p>
            <p className="text-sm text-text-muted leading-relaxed mb-4">{text}</p>
            <span className="label-mono rounded bg-surface-beige px-2 py-1 text-[11px] text-text-muted">
              Próximamente
            </span>
          </Panel>
        ))}
      </div>
    </>
  )
}
