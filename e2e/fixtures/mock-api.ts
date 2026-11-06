import { expect, type APIRequestContext } from "@playwright/test"
import { DEV_API, type SentEmail } from "./app"

/**
 * Thin wrappers over the dev-only control plane described in `app.ts`.
 *
 * These are the only calls in the suite that are not a click or a navigation.
 * They stand in for the two things a browser cannot do: look inside the mock
 * email sender, and make time pass.
 */

async function expectOk(response: { ok(): boolean; status(): number; url(): string }) {
  expect(
    response.ok(),
    `${response.url()} returned ${response.status()}. The dev control plane is only mounted ` +
      `when USE_MOCK_PROVIDERS=true — check the web server env in playwright.config.ts.`,
  ).toBeTruthy()
}

/** Everything the mock sender sent to one address, newest first. */
export async function inbox(request: APIRequestContext, to: string): Promise<SentEmail[]> {
  const response = await request.get(DEV_API.emails, { params: { to } })
  await expectOk(response)
  const body = (await response.json()) as { emails: SentEmail[] }
  return body.emails
}

/**
 * Waits for one email of a given template to arrive. Emails are queued through
 * Inngest, so "already sent" is not a safe assumption.
 */
export async function waitForEmail(
  request: APIRequestContext,
  to: string,
  template: string,
  timeoutMs = 20_000,
): Promise<SentEmail> {
  const deadline = Date.now() + timeoutMs
  let seen: string[] = []

  while (Date.now() < deadline) {
    const emails = await inbox(request, to)
    seen = emails.map((email) => email.template)
    const match = emails.find((email) => email.template === template)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(
    `No "${template}" email reached ${to} within ${timeoutMs} ms. ` +
      `Templates seen: ${seen.length ? seen.join(", ") : "(none)"}.`,
  )
}

/** The first link in an email that points at the given path. */
export function linkContaining(email: SentEmail, fragment: string): string {
  const link = email.links.find((candidate) => candidate.includes(fragment))
  if (!link) {
    throw new Error(
      `The "${email.template}" email has no link containing "${fragment}". ` +
        `Links: ${email.links.join(", ") || "(none)"}.`,
    )
  }
  return link
}

export async function clearInbox(request: APIRequestContext): Promise<void> {
  const response = await request.delete(DEV_API.emails)
  await expectOk(response)
}

/** Moves the clock the renewal and dunning jobs read. */
export async function advanceDays(request: APIRequestContext, days: number): Promise<void> {
  const response = await request.post(DEV_API.clock, { data: { advanceDays: days } })
  await expectOk(response)
}

/**
 * Runs the due step of a scheduled job now instead of waiting for its cron.
 * `name` is the Inngest function id, e.g. "renewals.tick".
 */
export async function runJob(request: APIRequestContext, name: string): Promise<void> {
  const response = await request.post(DEV_API.runJob, { data: { name } })
  await expectOk(response)
}

/** Makes the next off-session charge decline, to drive the dunning path. */
export async function failNextPayment(request: APIRequestContext): Promise<void> {
  const response = await request.post(DEV_API.paymentFailNext, { data: {} })
  await expectOk(response)
}

/** Makes one mock OVH operation fail once, to drive the retry path. */
export async function failNextOvhCall(
  request: APIRequestContext,
  operation: string,
): Promise<void> {
  const response = await request.post(DEV_API.ovhFailNext, { data: { operation } })
  await expectOk(response)
}
