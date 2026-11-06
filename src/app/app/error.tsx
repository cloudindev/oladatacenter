"use client"

import { Button, Notice, PageTitle } from "@/components/app/ui"

/**
 * Last line of defence for the customer area. Everything that can be handled is handled
 * where it happens; this is for what nobody saw coming. It says what we know, offers to
 * try again, and never shows a stack trace.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <PageTitle>Algo ha ido mal</PageTitle>
      <Notice
        tone="danger"
        title="No hemos podido mostrar esta página"
        action={
          <Button type="button" variant="secondary" onClick={reset}>
            Volver a intentarlo
          </Button>
        }
      >
        El problema es nuestro, no tuyo, y nuestro equipo ya está avisado. Tus servidores
        siguen funcionando con normalidad.
      </Notice>
    </>
  )
}
