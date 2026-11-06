import { expect, type Page } from "@playwright/test"
import { CARDS, TEST_PLAN, routes, type TestCard } from "./app"

/**
 * Buying helpers. Again: the real flow, through the real UI, against the mock
 * providers. `MockOvhClient` delivers in seconds, so a spec can wait for an
 * active server instead of stubbing one into existence.
 */

export interface PurchasedServer {
  /** Our own public identifier, the one in the URL. Never an OVH serviceName. */
  id: string
  /** The IPv4 the customer is shown once delivery finishes. */
  ip: string
}

/** Picks a plan on the public page and goes to the configurator. */
export async function choosePlan(page: Page, label: string = TEST_PLAN.label): Promise<void> {
  await page.goto(routes.plans)
  await page
    .getByRole("article")
    .filter({ hasText: label })
    .getByRole("link", { name: /configurar|contratar/i })
    .click()
}

/** Datacenter, OS and term. Leaves optional addons alone. */
export async function configureServer(page: Page): Promise<void> {
  await page.getByRole("radio", { name: new RegExp(TEST_PLAN.datacenter, "i") }).check()
  await page.getByLabel(/sistema operativo/i).selectOption({ label: TEST_PLAN.os })
  await page.getByRole("radio", { name: /mensual/i }).check()
  await page.getByRole("button", { name: /continuar/i }).click()
  await expect(page).toHaveURL(new RegExp(routes.checkout))
}

/** Fills the Stripe payment element and confirms. */
export async function payWithCard(page: Page, card: TestCard = CARDS.ok): Promise<void> {
  // Stripe renders its fields in a cross-origin iframe; frameLocator is the
  // supported way in, and it survives Stripe changing its internal markup.
  const stripe = page.frameLocator('iframe[title*="payment" i], iframe[name^="__privateStripeFrame"]')
  await stripe.getByPlaceholder(/1234 1234 1234 1234|número de tarjeta/i).fill(card.number)
  await stripe.getByPlaceholder(/mm\s*\/\s*(aa|yy)/i).fill(card.exp)
  await stripe.getByPlaceholder(/cvc/i).fill(card.cvc)
  await page.getByRole("button", { name: /pagar|confirmar pago/i }).click()
}

/**
 * Waits for provisioning to finish and returns the delivered server.
 * The progress view shows real step names from `PROVISION_STEPS` — the UI
 * contract forbids a fake spinner, so there is always something to assert on.
 */
export async function waitForDeliveredServer(page: Page): Promise<PurchasedServer> {
  await expect(page.getByText(/aprovisionando|preparando tu servidor/i)).toBeVisible()
  await expect(page.getByText(/activo/i)).toBeVisible({ timeout: 45_000 })

  await page.getByRole("link", { name: /ver servidor|ir al servidor/i }).click()
  await expect(page).toHaveURL(/\/app\/servidores\/[^/]+$/)

  const id = page.url().split("/").pop() ?? ""
  const ip = (await page.getByTestId("server-ipv4").textContent())?.trim() ?? ""
  expect(ip, "a delivered server must show an IPv4 address").toMatch(/^\d+\.\d+\.\d+\.\d+$/)

  return { id, ip }
}

/** Plans -> configure -> checkout -> pay -> active. The whole purchase. */
export async function buyServer(page: Page): Promise<PurchasedServer> {
  await choosePlan(page)
  await configureServer(page)
  await payWithCard(page)
  return waitForDeliveredServer(page)
}
