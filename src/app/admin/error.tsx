"use client"

import { useEffect } from "react"
import { Button, Notice } from "@/components/app/ui"
import { RawError } from "@/components/admin/ui"

/**
 * The last line of defence for the internal panel.
 *
 * There is no database configured in this environment, and in production Supabase can be
 * down. Every read already degrades through `load()`, but anything that throws outside it
 * — a missing `AUTH_SECRET`, a bad Inngest key — lands here, and an operator gets the raw
 * message rather than a blank screen.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin] unhandled error", error)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="mb-4 text-2xl font-light tracking-tight text-text-base">
        El panel no ha podido cargar esta pantalla
      </h1>
      <Notice tone="danger" title="Algo ha fallado en el servidor">
        Es casi siempre la conexión con la base de datos o una variable de entorno que falta.
        El mensaje de abajo es el error sin filtrar.
      </Notice>
      <div className="mt-4">
        <RawError label={error.digest ? `error ${error.digest}` : "error sin filtrar"}>
          {error.message || "Sin mensaje"}
        </RawError>
      </div>
      <div className="mt-6">
        <Button type="button" onClick={reset}>
          Volver a intentarlo
        </Button>
      </div>
    </div>
  )
}
