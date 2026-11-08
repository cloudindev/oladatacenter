import { NextResponse } from "next/server"
import { requireUser } from "@/server/auth/session"
import { whmcsReader } from "@/server/providers"
import { customerWhmcsClientId, whmcsProductDetail } from "@/server/whmcs-products"

/**
 * "Acceder a Plesk": signs the customer into the WHMCS page of this hosting plan, where
 * the hosting module offers the one-click Plesk login. The single sign-on token is created
 * at click time and only after checking the plan belongs to the customer.
 *
 * A direct Plesk session (Plesk API per server) is a pending decision: see
 * docs/prompts/fase-6-detalle-de-servicios.md §3.3.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireUser()
  const { id } = await ctx.params
  const serviceId = Number(id)
  const back = new URL(`/app/web-cloud/alojamiento/${id}?error=plesk`, request.url)
  if (!session.customer || !Number.isInteger(serviceId) || serviceId <= 0) {
    return NextResponse.redirect(back)
  }

  const [clientId, detail] = await Promise.all([
    customerWhmcsClientId(session.customer.id),
    whmcsProductDetail(session.customer.id, serviceId),
  ])
  const owned = detail !== null && detail.state === "ok" && detail.items[0]?.kind === "web_hosting"
  if (clientId === null || !owned) return NextResponse.redirect(back)

  try {
    const { redirectUrl } = await whmcsReader().createSsoToken(clientId, "clientarea:product_details", {
      serviceId,
    })
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.warn("[plesk-link] sso failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.redirect(back)
  }
}
