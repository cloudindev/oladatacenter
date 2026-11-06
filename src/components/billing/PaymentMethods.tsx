"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button, EmptyState, Notice, Spinner } from "@/components/app/ui"
import {
  beginCardSetupHere,
  makeCardDefault,
  removeCard,
  storeCardHere,
} from "@/app/app/billing/actions"
import { STRIPE_APPEARANCE, getStripe, type StripeElements, type StripeJs } from "./stripe-js"

/**
 * Cards on file: add, choose the default, remove.
 *
 * The card number never reaches us — the Payment Element talks straight to Stripe and we
 * only ever see the brand, the last four digits, the expiry and Stripe's fingerprint.
 * 3D Secure runs while the customer is here, once, so later renewals go through
 * off-session without waking them up.
 */

export interface CardView {
  id: string
  brand: string | null
  last4: string | null
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
  verified: boolean
}

export function PaymentMethods({
  cards,
  publishableKey,
}: {
  cards: readonly CardView[]
  publishableKey: string | null
}) {
  const router = useRouter()
  const [adding, setAdding] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function act(id: string, run: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null)
    setBusyId(id)
    const result = await run()
    setBusyId(null)
    if (!result.ok) setError(result.message ?? "No hemos podido completar la operación.")
    else router.refresh()
  }

  return (
    <div>
      {error ? (
        <div className="mb-5">
          <Notice tone="danger" title="No se ha podido cambiar la tarjeta">
            {error}
          </Notice>
        </div>
      ) : null}

      {cards.length === 0 && !adding ? (
        <EmptyState action={<Button onClick={() => setAdding(true)} withArrow>Añadir tarjeta</Button>}>
          Todavía no tienes ninguna tarjeta guardada.
        </EmptyState>
      ) : null}

      {cards.length > 0 ? (
        <ul className="border-t border-border-base">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-b border-border-base"
            >
              <div className="min-w-0">
                <p className="text-sm text-text-base font-mono">
                  {(card.brand ?? "tarjeta").toUpperCase()} ···· {card.last4 ?? "0000"}
                </p>
                <p className="label-mono text-text-muted mt-1">
                  {card.expMonth && card.expYear
                    ? `caduca ${String(card.expMonth).padStart(2, "0")}/${card.expYear}`
                    : "sin fecha de caducidad"}
                  {card.isDefault ? " · predeterminada" : ""}
                  {card.verified ? "" : " · sin verificar"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {busyId === card.id ? <Spinner /> : null}
                {card.isDefault ? null : (
                  <Button
                    variant="secondary"
                    disabled={busyId !== null}
                    onClick={() => void act(card.id, () => makeCardDefault(card.id))}
                  >
                    Usar esta
                  </Button>
                )}
                <Button
                  variant="danger"
                  disabled={busyId !== null}
                  onClick={() => void act(card.id, () => removeCard(card.id))}
                >
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {adding ? (
        <div className="mt-6">
          <AddCardForm
            publishableKey={publishableKey}
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false)
              router.refresh()
            }}
          />
        </div>
      ) : cards.length > 0 ? (
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Añadir otra tarjeta
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function AddCardForm({
  publishableKey,
  onCancel,
  onSaved,
}: {
  publishableKey: string | null
  onCancel: () => void
  onSaved: () => void
}) {
  const slot = React.useRef<HTMLDivElement | null>(null)
  const stripeRef = React.useRef<StripeJs | null>(null)
  const elementsRef = React.useRef<StripeElements | null>(null)
  const setupIntentRef = React.useRef<string | null>(null)

  const [loading, setLoading] = React.useState(publishableKey !== null)
  const [saving, setSaving] = React.useState(false)
  const [complete, setComplete] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Derived, not stored: a missing key is a render-time fact, not an event.
  const unavailable = publishableKey === null

  React.useEffect(() => {
    if (publishableKey === null) return

    let cancelled = false
    void (async () => {
      try {
        const ticket = await beginCardSetupHere()
        if (cancelled) return
        if (!ticket.ok) {
          setError(ticket.message)
          setLoading(false)
          return
        }
        setupIntentRef.current = ticket.setupIntentId

        const stripe = await getStripe(publishableKey)
        if (cancelled) return
        stripeRef.current = stripe

        const elements = stripe.elements({
          clientSecret: ticket.clientSecret,
          appearance: STRIPE_APPEARANCE,
        })
        elementsRef.current = elements
        const element = elements.create("payment", { layout: "tabs" })
        element.on("ready", () => {
          if (!cancelled) setLoading(false)
        })
        element.on("change", (payload) => {
          if (!cancelled) setComplete(payload.complete === true)
        })
        if (slot.current) element.mount(slot.current)
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : "No hemos podido cargar el formulario.")
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      elementsRef.current?.getElement("payment")?.destroy()
      elementsRef.current = null
    }
  }, [publishableKey])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)

    const stripe = stripeRef.current
    const elements = elementsRef.current
    const setupIntentId = setupIntentRef.current
    if (!stripe || !elements || !setupIntentId) {
      setError("El formulario no está listo todavía.")
      return
    }

    setSaving(true)
    const outcome = await stripe.confirmSetup({ elements, redirect: "if_required" })
    if (outcome.error) {
      setSaving(false)
      setError(outcome.error.message ?? "No hemos podido validar tu tarjeta.")
      return
    }

    const stored = await storeCardHere(setupIntentId)
    setSaving(false)
    if (!stored.ok) {
      setError(stored.message)
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="label-mono text-text-muted mb-3">Nueva tarjeta</p>
      <div ref={slot} className="min-h-[180px]" />
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Spinner /> Preparando el formulario
        </p>
      ) : null}

      {unavailable ? (
        <div className="my-4">
          <Notice tone="danger" title="El formulario de tarjeta no está disponible">
            Vuelve a intentarlo en unos minutos o escríbenos y lo resolvemos.
          </Notice>
        </div>
      ) : null}

      {error ? (
        <div className="my-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <Button
          type="submit"
          loading={saving}
          disabled={saving || !complete || unavailable}
          withArrow
        >
          Guardar tarjeta
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
        Haremos una verificación con tu banco sin cobrar nada, para que las renovaciones
        futuras no necesiten confirmación.
      </p>
    </form>
  )
}
