import { expect, test } from "@playwright/test"
import {
  TEST_COMPANY,
  TEST_PASSWORD,
  completeOnboarding,
  linkContaining,
  routes,
  submitRegistration,
  uniqueEmail,
  waitForEmail,
} from "./fixtures"

/**
 * Register -> verify the address -> fill the billing details -> land in /app.
 *
 * Mock email sender, so the verification link is read back from the dev inbox
 * instead of a real mailbox.
 *
 * `/registro`, `/verificar-email` and `/onboarding` exist already. What is still
 * missing is the dev inbox (`/api/dev/emails`) and the customer area (`/app`).
 */

// DEPENDS ON: the dev inbox /api/dev/emails and the customer area /app do not exist yet.
test.fixme("a new customer registers, verifies the address and reaches the customer area", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("signup")

  await submitRegistration(page, email)

  // The customer is told to check their email, and is NOT signed in yet.
  await expect(page.getByText(/te hemos enviado un correo/i)).toBeVisible()

  const welcome = await waitForEmail(request, email, "welcome_verify")
  expect(welcome.to).toBe(email)
  expect(welcome.subject).toMatch(/verifica/i)

  await page.goto(linkContaining(welcome, routes.verifyEmail))

  await completeOnboarding(page)

  await expect(page).toHaveURL(new RegExp(`${routes.app}(/|$)`))
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  // The welcome credit from `decideWelcomeCredit` is visible from the first screen.
  await expect(page.getByText(/saldo|crédito/i)).toBeVisible()

  const confirmation = await waitForEmail(request, email, "account_verified")
  expect(confirmation.to).toBe(email)
})

// DEPENDS ON: the customer area /app does not exist yet, so there is nothing to be kept out of.
test.fixme("an unverified account cannot reach the customer area", async ({ page }) => {
  const email = uniqueEmail("unverified")
  await submitRegistration(page, email)

  await page.goto(routes.app)
  await expect(page).toHaveURL(new RegExp(routes.login))
})

// DEPENDS ON: the dev inbox /api/dev/emails does not exist yet.
test.fixme("the same address cannot register twice", async ({ page, request }) => {
  const email = uniqueEmail("duplicate")

  await submitRegistration(page, email)
  await waitForEmail(request, email, "welcome_verify")

  await submitRegistration(page, email)
  // No account enumeration: the same neutral message either way.
  await expect(page.getByText(/te hemos enviado un correo/i)).toBeVisible()
})

// DEPENDS ON: nothing missing — /registro exists. Still fixme because no Playwright browser is
// installed on the dev machine, so it has never been run. First spec to un-fixme.
test.fixme("the register form reports its own validation errors", async ({ page }) => {
  await page.goto(routes.register)
  await page.getByLabel(/correo electrónico/i).fill("no-es-un-correo")
  await page.getByLabel(/contraseña/i).fill("corta")
  await page.getByRole("button", { name: /crear cuenta/i }).click()

  // Errors are associated with the field, not shouted in a toast.
  await expect(page.getByLabel(/correo electrónico/i)).toHaveAttribute("aria-invalid", "true")
  await expect(page.getByText(/contraseña/i).first()).toBeVisible()
})

// DEPENDS ON: /app/cuenta and the VIES/VAT validation path are not built yet.
test.fixme("a company registration stores the tax id for the VAT rule", async ({
  page,
  request,
}) => {
  const email = uniqueEmail("empresa")
  await submitRegistration(page, email)
  const welcome = await waitForEmail(request, email, "welcome_verify")
  await page.goto(linkContaining(welcome, routes.verifyEmail))

  await completeOnboarding(page)

  await page.goto(`${routes.app}/cuenta`)
  await expect(page.getByText(TEST_COMPANY.taxId)).toBeVisible()
  await expect(page.getByText(TEST_COMPANY.name)).toBeVisible()
  // The password is never echoed anywhere.
  await expect(page.getByText(TEST_PASSWORD)).toHaveCount(0)
})
