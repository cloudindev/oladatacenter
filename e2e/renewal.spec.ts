import { expect, test } from "@playwright/test"
import {
  CARDS,
  advanceDays,
  buyServer,
  createVerifiedCustomer,
  failNextPayment,
  payWithCard,
  routes,
  runJob,
  waitForEmail,
} from "./fixtures"

/**
 * Renewal and dunning, on the calendar from `dunningSchedule`:
 *
 *   T-7   invoice issued + renewal_upcoming email
 *   T-0   off-session charge
 *   T+1   retry 1 + payment_failed email
 *   T+3   retry 2; on failure the server is STOPPED (suspended)
 *   T+10  marked at OVH for non-renewal (terminating)
 *
 * Paying before T+10 reactivates the server (`canReactivate`).
 *
 * Time is moved with the dev clock and the job is kicked by hand, because
 * waiting three real days is not a test.
 */

// DEPENDS ON: the dev clock /api/dev/clock, the renewal/dunning Inngest jobs and /app/servidores.
test.fixme(
  "a failed renewal retries, suspends the server at T+3 and reactivates on payment",
  async ({ page, request }) => {
    const account = await createVerifiedCustomer(page, request, "renewal")
    const server = await buyServer(page)

    // ── T-7: the invoice is issued and the customer is warned ────────────────
    await advanceDays(request, 23)
    await runJob(request, "renewals.tick")

    const upcoming = await waitForEmail(request, account.email, "renewal_upcoming")
    expect(upcoming.to).toBe(account.email)

    await page.goto(routes.invoices)
    await expect(page.getByText(/pendiente/i)).toBeVisible()

    // ── T-0: the charge is attempted and declined ────────────────────────────
    await advanceDays(request, 7)
    await failNextPayment(request)
    await runJob(request, "renewals.tick")

    // ── T+1: first retry, also declined, customer told ───────────────────────
    await advanceDays(request, 1)
    await failNextPayment(request)
    await runJob(request, "renewals.tick")

    const failed = await waitForEmail(request, account.email, "payment_failed")
    expect(failed.subject).toMatch(/pago/i)

    // The server is still running at this point: we do not stop it on day one.
    await page.goto(routes.server(server.id))
    await expect(page.getByText(/activo/i)).toBeVisible()

    // ── T+3: second retry fails, the server is suspended ─────────────────────
    await advanceDays(request, 2)
    await failNextPayment(request)
    await runJob(request, "renewals.tick")

    const suspended = await waitForEmail(request, account.email, "service_suspended")
    expect(suspended.to).toBe(account.email)

    await page.goto(routes.server(server.id))
    await expect(page.getByText(/suspendido/i)).toBeVisible()
    // A suspended server offers no actions except paying.
    await expect(page.getByRole("button", { name: /reiniciar/i })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /pagar/i })).toBeVisible()

    // ── Payment arrives before T+10: reactivated ──────────────────────────────
    await page.getByRole("link", { name: /pagar/i }).click()
    await payWithCard(page, CARDS.ok)

    await expect(page.getByText(/pago recibido|pagada/i)).toBeVisible()

    await page.goto(routes.server(server.id))
    await expect(page.getByText(/activo/i)).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole("button", { name: /reiniciar/i })).toBeVisible()
  },
)

// DEPENDS ON: the renewal job, the dev clock and /app/facturas do not exist yet.
test.fixme("a renewal that succeeds moves the due date and says nothing alarming", async ({
  page,
  request,
}) => {
  const account = await createVerifiedCustomer(page, request, "renewal-ok")
  const server = await buyServer(page)

  await advanceDays(request, 30)
  await runJob(request, "renewals.tick")

  await page.goto(routes.server(server.id))
  await expect(page.getByText(/activo/i)).toBeVisible()
  await expect(page.getByText(/suspendido|impago/i)).toHaveCount(0)

  await page.goto(routes.invoices)
  await expect(page.getByText(/pagada/i).first()).toBeVisible()

  const inbox = await waitForEmail(request, account.email, "renewal_upcoming")
  expect(inbox.to).toBe(account.email)
})

// DEPENDS ON: the dunning job, the T+10 termination path and /app/servidores are not built yet.
test.fixme("a service left unpaid until T+10 is marked for termination", async ({
  page,
  request,
}) => {
  const account = await createVerifiedCustomer(page, request, "terminate")
  const server = await buyServer(page)

  await advanceDays(request, 30)
  for (const day of [0, 1, 2, 7]) {
    if (day > 0) await advanceDays(request, day)
    await failNextPayment(request)
    await runJob(request, "renewals.tick")
  }

  const notice = await waitForEmail(request, account.email, "service_terminating")
  expect(notice.to).toBe(account.email)

  await page.goto(routes.server(server.id))
  await expect(page.getByText(/baja|cancelación/i)).toBeVisible()
  // Past T+10 there is no self-service rescue: `canReactivate` is false.
  await expect(page.getByRole("link", { name: /pagar/i })).toHaveCount(0)
})
