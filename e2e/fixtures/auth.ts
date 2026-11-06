import { expect, type APIRequestContext, type Page } from "@playwright/test"
import {
  TEST_COMPANY,
  TEST_PASSWORD,
  routes,
  uniqueEmail,
} from "./app"
import { linkContaining, waitForEmail } from "./mock-api"

/**
 * Account helpers. Every one of them drives the real UI — no SQL, no direct
 * database writes, no session forging. If registering breaks, these break, and
 * that is the point: the helper is itself a test of the flow every customer
 * walks through.
 *
 * Selectors are by accessible role and label, in Spanish, because that is also
 * how a11y.spec.ts and a screen reader find them. A spec that needs a
 * `data-testid` to find a primary button has found an accessibility bug.
 */

export interface TestAccount {
  email: string
  password: string
}

/** Fills the register form and submits it. Does not verify the address. */
export async function submitRegistration(page: Page, email: string): Promise<TestAccount> {
  await page.goto(routes.register)
  await page.getByLabel(/correo electrónico/i).fill(email)
  await page.getByLabel(/contraseña/i).fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /crear cuenta/i }).click()
  return { email, password: TEST_PASSWORD }
}

/** Opens the verification link from the welcome email. */
export async function verifyEmail(
  page: Page,
  request: APIRequestContext,
  email: string,
): Promise<void> {
  const welcome = await waitForEmail(request, email, "welcome_verify")
  await page.goto(linkContaining(welcome, routes.verifyEmail))
}

/** Fills the billing details asked for after verification. */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.getByLabel(/empresa|autónomo|particular/i).first().check()
  await page.getByLabel(/razón social|nombre/i).fill(TEST_COMPANY.name)
  await page.getByLabel(/nif|cif|identificación fiscal/i).fill(TEST_COMPANY.taxId)
  await page.getByLabel(/dirección/i).fill(TEST_COMPANY.address)
  await page.getByLabel(/ciudad|localidad/i).fill(TEST_COMPANY.city)
  await page.getByLabel(/código postal/i).fill(TEST_COMPANY.postalCode)
  await page.getByLabel(/teléfono/i).fill(TEST_COMPANY.phone)
  await page.getByRole("button", { name: /continuar|guardar/i }).click()
}

/**
 * Register -> verify -> onboarding -> signed in at /app.
 * The one call other specs use when they just need a usable customer.
 */
export async function createVerifiedCustomer(
  page: Page,
  request: APIRequestContext,
  prefix = "e2e",
): Promise<TestAccount> {
  const account = await submitRegistration(page, uniqueEmail(prefix))
  await verifyEmail(page, request, account.email)
  await completeOnboarding(page)
  await expect(page).toHaveURL(new RegExp(`${routes.app}(/|$)`))
  return account
}

export async function signIn(page: Page, account: TestAccount): Promise<void> {
  await page.goto(routes.login)
  await page.getByLabel(/correo electrónico/i).fill(account.email)
  await page.getByLabel(/contraseña/i).fill(account.password)
  await page.getByRole("button", { name: /entrar|iniciar sesión/i }).click()
  await expect(page).toHaveURL(new RegExp(`${routes.app}(/|$)`))
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: /cerrar sesión/i }).click()
  await expect(page).toHaveURL(/\/(login)?$/)
}
