"use client"

import * as React from "react"
import { Button, Field, Input, Notice } from "@/components/app/ui"
import { renameServer } from "@/server/services/actions"
import type { ActionResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * The server's name in this panel. It is ours: it is never sent to the provider and
 * changing it has no effect on the machine.
 */
export function RenameForm({
  serviceId,
  currentName,
}: {
  serviceId: string
  currentName: string
}) {
  const runner = useRunner<ActionResult>({ refreshOnSuccess: true })
  const [name, setName] = React.useState(currentName)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void runner.run(() => renameServer({ serviceId, displayName: name }))
      }}
    >
      <Field
        label="Nombre del servidor"
        htmlFor="server-name"
        hint="Solo lo ves tú, en este panel. No cambia el hostname de la máquina."
      >
        <Input
          id="server-name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </Field>

      {runner.error ? (
        <div className="mb-4">
          <Notice tone="danger">{runner.error}</Notice>
        </div>
      ) : null}
      {runner.result ? (
        <div className="mb-4">
          <Notice tone="ok">Nombre guardado.</Notice>
        </div>
      ) : null}

      <Button
        type="submit"
        variant="secondary"
        loading={runner.busy}
        disabled={name.trim().length < 2 || name.trim() === currentName}
      >
        Guardar el nombre
      </Button>
    </form>
  )
}
