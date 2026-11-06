import { notFound } from "next/navigation"
import { Notice, Panel, SectionTitle } from "@/components/app/ui"
import { SnapshotPanel } from "@/components/servers/SnapshotPanel"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchSnapshot, fetchSnapshotOptionActive } from "@/server/services/provider"

/**
 * The snapshot slot. One per VPS: that is a provider limit, not ours.
 */
export default async function SnapshotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)

  const [snapshot, optionActive] = await Promise.all([
    load("fetchSnapshot", () => fetchSnapshot(service.ovhServiceName)),
    load("fetchSnapshotOption", () => fetchSnapshotOptionActive(service.ovhServiceName)),
  ])

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <SectionTitle>Snapshot</SectionTitle>

        {!snapshot.ok ? (
          <Notice tone="warn" title="No hemos podido consultar el snapshot">
            {snapshot.message}
          </Notice>
        ) : !optionActive.ok ? (
          <Notice tone="warn" title="No hemos podido consultar el snapshot">
            {optionActive.message}
          </Notice>
        ) : (
          <SnapshotPanel
            serviceId={service.id}
            serverName={service.name}
            optionActive={optionActive.data}
            snapshot={snapshot.data}
            canCreate={can("snapshot_create")}
            canRevert={can("snapshot_revert")}
            canDelete={can("snapshot_delete")}
          />
        )}
      </Panel>

      <Panel>
        <SectionTitle>Snapshot o backup</SectionTitle>
        <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
          El snapshot lo haces tú cuando quieres, es inmediato y sirve para probar algo
          con red de seguridad: si sale mal, reviertes. El backup automático lo hacemos
          nosotros cada día y sirve para cuando algo se rompió hace tiempo y no te diste
          cuenta. No se sustituyen: hacen cosas distintas.
        </p>
      </Panel>
    </div>
  )
}
