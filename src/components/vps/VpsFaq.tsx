/**
 * Plain `<details>` FAQ: no JavaScript, open/close works everywhere and is keyboard
 * reachable by default. Server Component.
 */
import type { ReactNode } from "react"
import type { PublicDatacenter } from "@ola/core"

export function VpsFaq({ datacenters }: { datacenters: readonly PublicDatacenter[] }) {
  const cities = datacenters.map((dc) => dc.label).join(" · ")

  const items: { question: string; answer: ReactNode }[] = [
    {
      question: "Qué es un VPS",
      answer: (
        <p>
          Un servidor privado virtual es una máquina con recursos reservados para ti: vCores,
          memoria y disco NVMe propios, con acceso root y una dirección IP pública. Instalas lo que
          necesites y lo gestionas desde el panel o por SSH, sin compartir el sistema con nadie.
        </p>
      ),
    },
    {
      question: "Qué diferencia hay entre el pago mensual y el anual",
      answer: (
        <p>
          El plan mensual se renueva cada mes y puedes cancelarlo al final de cualquier ciclo. El
          plan anual se factura por doce meses de una vez y el precio por mes es más bajo. El
          servicio y los recursos son exactamente los mismos en los dos casos.
        </p>
      ),
    },
    {
      question: "Qué pasa si necesito más potencia",
      answer: (
        <p>
          Puedes subir de plan en cualquier momento: el cambio se aplica sobre el mismo servidor y
          solo pagas la diferencia proporcional de lo que quede de ciclo. Bajar de plan no es
          posible, porque el disco no se puede reducir; si necesitas menos recursos hay que crear un
          servidor nuevo y migrar los datos.
        </p>
      ),
    },
    {
      question: "Dónde están mis datos",
      answer: (
        <p>
          Eliges el centro de datos al configurar el servidor. Disponibles ahora mismo: {cities}.
          Los datos no salen de la región que elijas y la infraestructura está sujeta al RGPD.
        </p>
      ),
    },
    {
      question: "Qué incluye el backup",
      answer: (
        <p>
          Todos los planes incluyen una copia automática diaria con un día de retención, gestionada
          por nosotros y restaurable desde el panel. Si necesitas más histórico puedes ampliarla a
          siete días al configurar el servidor, y añadir snapshots manuales para guardar un punto
          concreto antes de un cambio.
        </p>
      ),
    },
  ]

  return (
    <div className="divide-y divide-bg-dark/12 border-y border-bg-dark/12">
      {items.map((item) => (
        <details key={item.question} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] tracking-[-0.01em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-ink">
            {item.question}
            <span
              aria-hidden
              className="font-mono text-[18px] leading-none text-text-muted transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="mt-3 max-w-3xl text-[15px] leading-relaxed text-text-muted">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  )
}
