import { expect, test } from "@playwright/test"
import {
  CARDS,
  TEST_PLAN,
  choosePlan,
  configureServer,
  createVerifiedCustomer,
  failNextOvhCall,
  payWithCard,
  routes,
  waitForDeliveredServer,
  waitForEmail,
} from "./fixtures"

/**
 * The money path, end to end, with `MockOvhClient` and `MockWhmcsClient`:
 * configure -> checkout -> pay -> watch provisioning -> active server with an IP.
 *
 * Nothing real is ordered and nothing is charged: `OVH_ORDERS_ENABLED=false`
 * and `WHMCS_WRITE_ENABLED=false` in the e2e web server env, on top of the
 * mocks. See playwright.config.ts.
 */

// DEPENDS ON: nothing missing — /cloud/vps exists. Still fixme because no Playwright browser is
// installed on the dev machine, so the selectors have never been run against the real markup.
test.fixme("the public plans page quotes net prices and says so", async ({ page }) => {
  await page.goto(routes.plans)

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const card = page.getByRole("article").filter({ hasText: TEST_PLAN.label })
  await expect(card).toBeVisible()

  // Decision of 2026-11-05: public prices are net, labelled.
  await expect(card.getByText(/sin iva/i)).toBeVisible()
  // Never leak OVH's identifiers or our cost.
  await expect(page.getByText(/vps-2027/i)).toHaveCount(0)
  await expect(page.getByText(/coste|margen/i)).toHaveCount(0)
})

// DEPENDS ON: /cloud/vps/configurar exists, but the quote-total test id it asserts on does not.
test.fixme("the configurator prices the mandatory backup into the total", async ({ page }) => {
  await choosePlan(page)

  // `automatedBackup` is mandatory and priced; a quote without it is a loss.
  await expect(page.getByText(/copia de seguridad/i)).toBeVisible()

  const monthlyTotal = page.getByTestId("quote-total")
  await expect(monthlyTotal).toBeVisible()
  const before = await monthlyTotal.textContent()

  // Adding an optional addon must move the total.
  await page.getByRole("checkbox", { name: /snapshot/i }).check()
  await expect(monthlyTotal).not.toHaveText(before ?? "")
})

// DEPENDS ON: /checkout, the provisioning job and the customer area /app do not exist yet.
test.fixme("a customer buys a VPS and the server becomes active with an IP", async ({
  page,
  request,
}) => {
  const account = await createVerifiedCustomer(page, request, "order")

  await choosePlan(page)
  await configureServer(page)

  // Checkout shows the VAT breakdown; `checkoutTotals` applies credit first.
  await expect(page.getByText(/iva/i)).toBeVisible()
  await expect(page.getByTestId("checkout-total")).toBeVisible()

  await payWithCard(page, CARDS.ok)

  // Real step names from PROVISION_STEPS, not a decorative spinner.
  await expect(page.getByText(/aprovisionando|preparando tu servidor/i)).toBeVisible()

  const server = await waitForDeliveredServer(page)
  expect(server.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/)

  await expect(page.getByText(/activo/i)).toBeVisible()
  // The customer never sees the OVH service name.
  await expect(page.getByText(/^vps-[0-9a-z]+\.vps\.ovh\.net$/i)).toHaveCount(0)

  const received = await waitForEmail(request, account.email, "order_received")
  expect(received.to).toBe(account.email)
  const ready = await waitForEmail(request, account.email, "server_ready", 60_000)
  expect(ready.subject).toMatch(/servidor/i)

  await page.goto(routes.servers)
  await expect(page.getByRole("link", { name: new RegExp(TEST_PLAN.label, "i") })).toBeVisible()
})

// DEPENDS ON: /checkout and /app/servidores do not exist yet.
test.fixme("a declined card leaves no server and no order in a payable state", async ({
  page,
  request,
}) => {
  await createVerifiedCustomer(page, request, "declined")

  await choosePlan(page)
  await configureServer(page)
  await payWithCard(page, CARDS.declined)

  await expect(page.getByText(/no se ha podido|rechazada/i)).toBeVisible()

  await page.goto(routes.servers)
  // Empty state: one sentence plus one button.
  await expect(page.getByText(/todavía no tienes/i)).toBeVisible()
})

// DEPENDS ON: the dev control plane /api/dev/ovh/fail-next, the provisioning job and /app/pedidos.
test.fixme("a provisioning failure never orders twice at OVH", async ({ page, request }) => {
  // The mock OVH client is told to fail the checkout call once. The job must
  // resume from `orders.completedSteps`, and the retry must reuse the cart
  // instead of creating a second order. See docs/runbooks/pedido-atascado.md.
  await createVerifiedCustomer(page, request, "retry")
  await failNextOvhCall(request, "checkout")

  await choosePlan(page)
  await configureServer(page)
  await payWithCard(page, CARDS.ok)

  const server = await waitForDeliveredServer(page)
  expect(server.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/)

  await page.goto(routes.orders)
  await expect(page.getByText(/entregado/i)).toHaveCount(1)
})
