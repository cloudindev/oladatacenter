"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button, Notice, Spinner } from "@/components/app/ui"
import type { CheckoutConfiguration } from "@/server/billing"
import {
  beginCardSetup,
  finishCheckout,
  startCheckout,
  storeCard,
} from "@/app/app/servers/new/actions"
import {
  STRIPE_APPEARANCE,
  getStripe,
  type StripeElements,
  type StripeJs,
} from "./stripe-js"

/**
 * The payment step.
 *
 * One primary button: "Pagar y crear servidor". Behind it, up to four things happen in
 * order, and the button says which one it is on so nothing looks stuck:
 *
 *   1. a new card is authenticated with 3D Secure and stored (SetupIntent),
 *   2. the order is created and charged on the SERVER from the stored quote,
 *   3. a 3DS challenge on the charge is run inline,
 *   4. the browser goes to the order progress screen.
 *
 * The component never sees a price. The amount is whatever the server computed; the label
 * on the button comes from the server-rendered breakdown.
 */

export interface CheckoutFormProps {
  configuration: CheckoutConfiguration
  /** Pre-formatted on the server. This component does no money arithmetic. */
  totalLabel: string
  publishableKey: string | null
  existingCard: { brand: string | null; last4: string | null } | null
  disabled: boolean
}

type Phase = "idle" | "loading_card_form" | "saving_card" | "paying" | "authenticating" | "done"

const PHASE_LABEL: Readonly<Record<Phase, string>> = {
  idle: "",
  loading_card_form: "Preparando el formulario de pago",
  saving_card: "Guardando la tarjeta",
  paying: "Procesando el pago",
  authenticating: "Esperando la confirmación de tu banco",
  done: "Pago confirmado",
}

export function CheckoutForm({
  configuration,
  totalLabel,
  publishableKey,
  existingCard,
  disabled,
}: CheckoutFormProps) {
  const router = useRouter()
  const cardSlot = React.useRef<HTMLDivElement | null>(null)
  const stripeRef = React.useRef<StripeJs | null>(null)
  const elementsRef = React.useRef<StripeElements | null>(null)
  const setupIntentRef = React.useRef<string | null>(null)

  // The card form starts loading on the first render when there is one to load, so the
  // initial phase is part of the initial state rather than something an effect sets.
  const [phase, setPhase] = React.useState<Phase>(
    existingCard === null && publishableKey !== null && !disabled ? "loading_card_form" : "idle",
  )
  const [error, setError] = React.useState<string | null>(null)
  const [cardReady, setCardReady] = React.useState(existingCard !== null)

  const needsCard = existingCard === null
  // Derived, not stored: a missing key is a render-time fact, not an event.
  const cardFormUnavailable = needsCard && publishableKey === null

  // Mount the Payment Element only when there is no card on file.
  React.useEffect(() => {
    if (!needsCard || disabled || publishableKey === null) return

    let cancelled = false

    void (async () => {
      try {
        const ticket = await beginCardSetup()
        if (cancelled) return
        if (!ticket.ok) {
          setError(ticket.message)
          setPhase("idle")
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
          if (!cancelled) setPhase("idle")
        })
        element.on("change", (payload) => {
          if (!cancelled) setCardReady(payload.complete === true)
        })
        if (cardSlot.current) element.mount(cardSlot.current)
      } catch (cause) {
        if (cancelled) return
        setError(
          cause instanceof Error
            ? cause.message
            : "No hemos podido cargar el formulario de pago.",
        )
        setPhase("idle")
      }
    })()

    return () => {
      cancelled = true
      elementsRef.current?.getElement("payment")?.destroy()
      elementsRef.current = null
    }
  }, [needsCard, disabled, publishableKey])

  async function runThreeDSecure(clientSecret: string, orderId: string): Promise<void> {
    if (!publishableKey) throw new Error("El pago con tarjeta no está disponible.")
    setPhase("authenticating")
    const stripe = stripeRef.current ?? (await getStripe(publishableKey))
    stripeRef.current = stripe

    const outcome = await stripe.handleNextAction({ clientSecret })
    if (outcome.error) {
      throw new Error(outcome.error.message ?? "Tu banco no ha autorizado el pago.")
    }

    // The server re-reads the PaymentIntent from Stripe: the browser's word is not enough.
    const confirmed = await finishCheckout(orderId)
    if (!confirmed.ok) throw new Error(confirmed.message)
    if (confirmed.status === "requires_action") {
      throw new Error("Tu banco sigue pidiendo autenticación. Inténtalo de nuevo.")
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (disabled) return
    setError(null)

    try {
      // 1. A new card: authenticate it with 3DS and store it before charging anything.
      if (needsCard) {
        const stripe = stripeRef.current
        const elements = elementsRef.current
        const setupIntentId = setupIntentRef.current
        if (!stripe || !elements || !setupIntentId) {
          throw new Error("El formulario de pago no está listo todavía.")
        }

        setPhase("saving_card")
        const setup = await stripe.confirmSetup({ elements, redirect: "if_required" })
        if (setup.error) {
          throw new Error(setup.error.message ?? "No hemos podido validar tu tarjeta.")
        }

        const stored = await storeCard(setupIntentId)
        if (!stored.ok) throw new Error(stored.message)
      }

      // 2. The order is created AND priced on the server. We send only the configuration.
      setPhase("paying")
      const result = await startCheckout(configuration)
      if (!result.ok) throw new Error(result.message)

      if (result.status === "requires_action") {
        await runThreeDSecure(result.clientSecret, result.orderId)
      }

      setPhase("done")
      router.push(`/app/servers/new/${result.orderId}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Algo ha ido mal. Inténtalo de nuevo.")
      setPhase("idle")
    }
  }

  const busy = phase !== "idle" && phase !== "done"
  const working = phase === "saving_card" || phase === "paying" || phase === "authenticating"

  return (
    <form onSubmit={handleSubmit} noValidate>
      {existingCard ? (
        <p className="text-sm text-text-base mb-5">
          Pagaremos con tu tarjeta guardada{" "}
          <span className="font-mono">
            {existingCard.brand ?? "tarjeta"} ···· {existingCard.last4 ?? "0000"}
          </span>
          .{" "}
          <a
            href="/app/billing/metodos-de-pago"
            className="underline decoration-border-base hover:decoration-accent-ink"
          >
            Cambiar tarjeta
          </a>
        </p>
      ) : (
        <div className="mb-5">
          <p className="label-mono text-text-muted mb-3">Datos de la tarjeta</p>
          {disabled ? (
            <p className="rounded-lg border border-dashed border-border-base px-4 py-6 text-sm text-text-muted">
              El formulario de la tarjeta aparece en cuanto termines de verificar tu cuenta.
            </p>
          ) : (
            <div ref={cardSlot} className="min-h-[180px]" />
          )}
          {phase === "loading_card_form" ? (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Spinner /> {PHASE_LABEL.loading_card_form}
            </p>
          ) : null}
          <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
            Los datos de la tarjeta viajan directamente a Stripe y nunca pasan por nuestros
            servidores. Pediremos la autenticación de tu banco una sola vez.
          </p>
        </div>
      )}

      {cardFormUnavailable ? (
        <div className="mb-5">
          <Notice tone="danger" title="El pago con tarjeta no está disponible">
            No podemos cargar el formulario de pago ahora mismo. Vuelve a intentarlo en unos
            minutos o escríbenos y lo resolvemos.
          </Notice>
        </div>
      ) : null}

      {error ? (
        <div className="mb-5">
          <Notice tone="danger" title="No hemos podido completar el pago">
            {error}
          </Notice>
        </div>
      ) : null}

      <Button
        type="submit"
        withArrow
        loading={working}
        disabled={disabled || busy || !cardReady || cardFormUnavailable}
        className="w-full sm:w-auto"
      >
        {working ? PHASE_LABEL[phase] : `Pagar y crear servidor · ${totalLabel}`}
      </Button>

      <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
        Al pagar aceptas las{" "}
        <a href="/legal/terms" className="underline decoration-border-base">
          condiciones del servicio
        </a>
        . El importe incluye los impuestos que se muestran arriba.
      </p>
    </form>
  )
}
