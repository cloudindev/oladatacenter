import { notFound } from "next/navigation"
import { Panel, SectionTitle } from "@/components/app/ui"
import { ConsoleLauncher } from "@/components/servers/ConsoleLauncher"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { actionGate, serviceForPage } from "@/server/services/page-data"

export default async function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <SectionTitle>Consola</SectionTitle>
        <div className="space-y-4 text-sm text-text-muted leading-relaxed max-w-2xl">
          <p>
            La consola es una pantalla y un teclado conectados directamente al servidor,
            como si estuvieras delante de la máquina. Funciona aunque la red del servidor
            esté mal configurada, aunque el cortafuegos te haya dejado fuera o aunque el
            SSH no arranque.
          </p>
          <p>
            Úsala para arreglar lo que te impide entrar por SSH, para ver los mensajes del
            arranque o para trabajar en el modo rescate. Para el día a día el SSH es más
            cómodo y más rápido.
          </p>
          <p>
            El enlace se genera en el momento, caduca en unos minutos y se abre en una
            pestaña nueva. No lo compartas: quien lo tenga entra en tu servidor.
          </p>
        </div>

        <div className="mt-6">
          <ConsoleLauncher serviceId={service.id} allowed={can("console")} />
        </div>
      </Panel>
    </div>
  )
}
