"use client"

import * as React from "react"
import { Button, DataRow, Field, Input, Notice } from "@/components/app/ui"
import { createSnapshot, deleteSnapshot, revertSnapshot } from "@/server/services/actions"
import { ActionButton } from "./ActionButton"
import { TaskProgress } from "./TaskProgress"
import { formatDateTime } from "./labels"
import type { ActionResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * The snapshot slot.
 *
 * OVH gives a VPS exactly one: taking a new one requires deleting the old one first.
 * The option has to be active on the service, which is a paid add-on.
 */
export function SnapshotPanel({
  serviceId,
  serverName,
  optionActive,
  snapshot,
  canCreate,
  canRevert,
  canDelete,
}: {
  serviceId: string
  serverName: string
  optionActive: boolean
  snapshot: { description: string; createdAt: Date } | null
  canCreate: boolean
  canRevert: boolean
  canDelete: boolean
}) {
  const runner = useRunner<ActionResult>()
  const [description, setDescription] = React.useState("")

  if (!optionActive) {
    return (
      <Notice tone="warn" title="La opción de snapshot no está activa">
        El snapshot es un servicio aparte que se contrata por unos céntimos al mes. Puedes
        añadirlo desde la pestaña de plan.
      </Notice>
    )
  }

  return (
    <div className="space-y-6">
      <Notice tone="neutral" title="Cómo funciona">
        Un snapshot es una foto del disco en un momento dado. Solo puedes tener uno a la
        vez: para hacer otro hay que borrar el que ya tienes. Revertir devuelve el disco
        exactamente al estado de esa foto.
      </Notice>

      {snapshot ? (
        <div>
          <dl>
            <DataRow label="Descripción">{snapshot.description || "Sin descripción"}</DataRow>
            <DataRow label="Fecha" mono>
              {formatDateTime(snapshot.createdAt)}
            </DataRow>
            <DataRow label="Tamaño">
              <span className="text-text-muted">
                El proveedor no informa del tamaño del snapshot
              </span>
            </DataRow>
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <ActionButton
              serviceId={serviceId}
              label="Revertir a este snapshot"
              variant="danger"
              disabled={!canRevert}
              disabledReason={canRevert ? undefined : "Disponible cuando el servidor no está suspendido."}
              run={() => revertSnapshot(serviceId)}
              confirm={{
                title: "Revertir al snapshot",
                consequence: (
                  <>
                    El disco de {serverName} vuelve al estado del{" "}
                    {formatDateTime(snapshot.createdAt)}. Todo lo que se haya escrito
                    después —archivos, correos, bases de datos— se pierde y no se puede
                    recuperar.
                  </>
                ),
                confirmLabel: "Revertir el disco",
                danger: true,
              }}
            />

            <ActionButton
              serviceId={serviceId}
              label="Eliminar el snapshot"
              variant="secondary"
              disabled={!canDelete}
              disabledReason={canDelete ? undefined : "Disponible cuando el servidor está activo."}
              run={() => deleteSnapshot(serviceId)}
              confirm={{
                title: "Eliminar el snapshot",
                consequence: (
                  <>
                    Se borra la foto del {formatDateTime(snapshot.createdAt)} y dejas de
                    poder volver a ese punto. El servidor no se toca.
                  </>
                ),
                confirmLabel: "Eliminar",
                danger: true,
              }}
            />
          </div>
        </div>
      ) : (
        <div>
          <Field
            label="Descripción"
            htmlFor="snapshot-description"
            hint="Para reconocerlo después, por ejemplo: antes de actualizar PHP."
          >
            <Input
              id="snapshot-description"
              value={description}
              maxLength={120}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Antes de actualizar"
            />
          </Field>

          {runner.error ? <Notice tone="danger">{runner.error}</Notice> : null}

          <Button
            type="button"
            variant="primary"
            withArrow
            loading={runner.busy}
            disabled={!canCreate}
            onClick={() => void runner.run(() => createSnapshot({ serviceId, description }))}
          >
            Crear el snapshot
          </Button>
          {!canCreate ? (
            <p className="mt-2 text-xs text-text-muted">
              Para crear un snapshot el servidor tiene que estar activo.
            </p>
          ) : null}

          {runner.result ? (
            <div className="mt-4">
              <TaskProgress serviceId={serviceId} actionId={runner.result.actionId} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
