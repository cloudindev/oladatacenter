import { notFound } from "next/navigation"
import { Notice, Panel, SectionTitle } from "@/components/app/ui"
import { ReinstallForm } from "@/components/servers/ReinstallForm"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchAvailableImages, fetchCurrentImage } from "@/server/services/provider"
import { listSshKeysForCustomer } from "@/server/services/repository"

/**
 * Reinstall.
 *
 * The image list is the real one from the provider for this exact service, not a
 * hardcoded catalogue, so it already excludes what this plan cannot run.
 */
export default async function ReinstallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)

  const [images, currentImage, keys] = await Promise.all([
    load("fetchAvailableImages", () => fetchAvailableImages(service.ovhServiceName)),
    load("fetchCurrentImage", () => fetchCurrentImage(service.ovhServiceName)),
    load("listSshKeys", () => listSshKeysForCustomer(service.customerId)),
  ])

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <SectionTitle>Reinstalar el servidor</SectionTitle>
        <p className="mb-6 text-sm text-text-muted leading-relaxed max-w-2xl">
          Reinstalar deja el servidor como recién entregado: se formatea el disco y se
          instala el sistema que elijas. Mantiene la misma IP, el mismo plan y la misma
          ubicación.
        </p>

        {!images.ok ? (
          <Notice tone="warn" title="No hemos podido leer las imágenes disponibles">
            {images.message}
          </Notice>
        ) : (
          <ReinstallForm
            serviceId={service.id}
            serverName={service.name}
            images={images.data}
            currentImage={currentImage.ok ? currentImage.data : null}
            sshKeys={
              keys.ok
                ? keys.data.map((key) => ({
                    id: key.id,
                    name: key.name,
                    fingerprint: key.fingerprint,
                  }))
                : []
            }
            allowed={can("reinstall")}
          />
        )}

        {keys.ok && keys.data.length === 0 ? (
          <div className="mt-6">
            <Notice tone="neutral" title="Sin claves SSH">
              Puedes guardar tus claves SSH en la sección de cuenta. Con una clave no hace
              falta contraseña de root y el acceso es más seguro.
            </Notice>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
