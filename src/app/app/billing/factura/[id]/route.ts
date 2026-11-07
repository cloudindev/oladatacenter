import { NextResponse } from "next/server"
import { requireUser } from "@/server/auth/session"
import { whmcsReader } from "@/server/providers"
import { customerWhmcsClientId, whmcsInvoicesFor } from "@/server/whmcs-products"

/**
 * Opens one invoice in the WHMCS client area, already signed in.
 *
 * WHMCS is the book of record, so the PDF is its own. The single sign-on token is created
 * at click time (it expires in about a minute) and only after checking that the invoice
 * belongs to the customer asking for it.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireUser()
  const back = new URL("/app/billing?error=factura", request.url)
  const { id } = await ctx.params
  const invoiceId = Number(id)
  if (!session.customer || !Number.isInteger(invoiceId) || invoiceId <= 0) {
    return NextResponse.redirect(back)
  }

  const clientId = await customerWhmcsClientId(session.customer.id)
  const invoices = await whmcsInvoicesFor(session.customer.id)
  const owned = invoices.state === "ok" && invoices.items.some((invoice) => invoice.id === invoiceId)
  if (clientId === null || !owned) return NextResponse.redirect(back)

  try {
    const { redirectUrl } = await whmcsReader().createSsoToken(clientId, "sso:custom_redirect", {
      redirectPath: `viewinvoice.php?id=${invoiceId}`,
    })
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.warn("[invoice-link] sso failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.redirect(back)
  }
}
