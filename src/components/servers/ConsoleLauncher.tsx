"use client"

import * as React from "react"
import { Button, Notice } from "@/components/app/ui"
import { openConsole } from "@/server/services/actions"
import type { ConsoleResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * The KVM console.
 *
 * OVH answers `getConsoleUrl` with a short-lived URL, so it is requested on demand and
 * opened in a new tab. Nothing is stored: asking again produces a new URL.
 */
export function ConsoleLauncher({ serviceId, allowed }: { serviceId: string; allowed: boolean }) {
  const runner = useRunner<ConsoleResult>()
  const [opened, setOpened] = React.useState(false)

  const launch = async () => {
    setOpened(false)
    await runner.run(async () => {
      const result = await openConsole(serviceId)
      if (result.ok) {
        const win = window.open(result.url, "_blank", "noopener,noreferrer")
        setOpened(win !== null)
      }
      return result
    })
  }

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        withArrow
        loading={runner.busy}
        disabled={!allowed}
        onClick={() => void launch()}
      >
        Abrir la consola
      </Button>

      {!allowed ? (
        <p className="mt-3 text-sm text-text-muted">
          La consola está disponible cuando el servidor está activo o apagado.
        </p>
      ) : null}

      {runner.error ? (
        <div className="mt-4">
          <Notice tone="danger">{runner.error}</Notice>
        </div>
      ) : null}

      {runner.result && !opened ? (
        <div className="mt-4">
          <Notice tone="warn" title="El navegador ha bloqueado la ventana">
            Hemos pedido la consola correctamente, pero tu navegador no ha dejado abrir la
            pestaña nueva. Permite las ventanas emergentes de este sitio y vuelve a
            intentarlo.
          </Notice>
        </div>
      ) : null}

      {runner.result && opened ? (
        <div className="mt-4">
          <Notice tone="ok" title="Consola abierta en una pestaña nueva">
            El enlace caduca en unos minutos. Si se cierra, pídela otra vez.
          </Notice>
        </div>
      ) : null}
    </div>
  )
}
