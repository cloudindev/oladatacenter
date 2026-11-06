/**
 * Minimal, fully typed façade over Stripe.js.
 *
 * `@stripe/stripe-js` is not a dependency of this project, so the script is loaded from
 * Stripe's own CDN — which is the only supported way to load it anyway: Stripe requires
 * `js.stripe.com/v3` to be fetched at runtime so PCI scope stays with them. Only the
 * handful of calls the checkout and the card form actually make are declared here, so
 * nothing is `any` and a typo does not compile.
 *
 * The publishable key is the only Stripe value that ever reaches the browser.
 */

const STRIPE_JS_URL = "https://js.stripe.com/v3"

export interface StripeElement {
  mount(target: string | HTMLElement): void
  unmount(): void
  destroy(): void
  on(event: "ready" | "change", handler: (payload: { complete?: boolean }) => void): void
}

export interface StripeElements {
  create(type: "payment", options?: Record<string, unknown>): StripeElement
  getElement(type: "payment"): StripeElement | null
}

export interface StripeJsError {
  type: string
  code?: string
  message?: string
}

export interface StripeSetupIntentResult {
  setupIntent?: { id: string; status: string }
  error?: StripeJsError
}

export interface StripePaymentIntentResult {
  paymentIntent?: { id: string; status: string }
  error?: StripeJsError
}

export interface StripeJs {
  elements(options: { clientSecret: string; appearance?: Record<string, unknown> }): StripeElements
  confirmSetup(options: {
    elements: StripeElements
    confirmParams?: { return_url?: string }
    redirect?: "always" | "if_required"
  }): Promise<StripeSetupIntentResult>
  /** Finishes a 3DS challenge on a PaymentIntent the server already confirmed. */
  handleNextAction(options: { clientSecret: string }): Promise<StripePaymentIntentResult>
}

interface StripeGlobal {
  (publishableKey: string, options?: { locale?: string }): StripeJs
}

declare global {
  interface Window {
    Stripe?: StripeGlobal
  }
}

let loading: Promise<StripeGlobal> | null = null

function loadScript(): Promise<StripeGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Stripe.js solo puede cargarse en el navegador"))
  }
  if (window.Stripe) return Promise.resolve(window.Stripe)
  if (loading) return loading

  loading = new Promise<StripeGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${STRIPE_JS_URL}"]`)
    const script = existing ?? document.createElement("script")

    const settle = (): void => {
      if (window.Stripe) resolve(window.Stripe)
      else reject(new Error("Stripe.js se ha cargado pero no está disponible"))
    }

    script.addEventListener("load", settle, { once: true })
    script.addEventListener(
      "error",
      () => reject(new Error("No hemos podido cargar el formulario de pago")),
      { once: true },
    )

    if (!existing) {
      script.src = STRIPE_JS_URL
      script.async = true
      document.head.appendChild(script)
    }
  })

  return loading
}

/** The Stripe.js instance, loaded once per page. */
export async function getStripe(publishableKey: string): Promise<StripeJs> {
  const factory = await loadScript()
  return factory(publishableKey, { locale: "es" })
}

/** Stripe's own appearance options, tuned to the oladc.com language. */
export const STRIPE_APPEARANCE: Record<string, unknown> = {
  theme: "flat",
  variables: {
    fontFamily: "inherit",
    borderRadius: "8px",
    colorPrimary: "#111111",
    colorText: "#111111",
    colorDanger: "#b3261e",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #e4e2dd", boxShadow: "none", padding: "10px 12px" },
    ".Input:focus": { border: "1px solid #111111", boxShadow: "none" },
    ".Label": { fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" },
  },
}
