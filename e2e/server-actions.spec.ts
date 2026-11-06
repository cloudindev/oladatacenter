import { expect, test, type Page } from "@playwright/test"
import { buyServer, createVerifiedCustomer, routes } from "./fixtures"

/**
 * Server actions: reboot, snapshot, rescue mode.
 *
 * Each one goes through OVH as a task. The UI contract is explicit: show the
 * real task state (`vps.Task.state` is one of blocked / cancelled / doing /
 * done / error / paused / todo / waitingAck), never a decorative spinner. So
 * these specs assert on a visible state that ends at "done" — if the UI faked
 * the progress, nothing here would catch it, which is why the assertion is on
 * the state text and not just on the final toast.
 *
 * `MockOvhClient` walks a task through todo -> doing -> done quickly.
 */

/** Waits for the task panel of an action to reach a terminal success. */
async function expectTaskDone(page: Page, actionLabel: RegExp): Promise<void> {
  const task = page.getByRole("status").filter({ hasText: actionLabel })
  await expect(task).toBeVisible()
  // A real state is shown while it runs...
  await expect(task.getByText(/en curso|pendiente/i)).toBeVisible()
  // ...and it ends done, not merely "hidden".
  await expect(task.getByText(/completad[oa]/i)).toBeVisible({ timeout: 45_000 })
}

// DEPENDS ON: /checkout and /app/servidores/[id] do not exist yet, so there is no server to act on.
// (`/api/services/[id]/actions/[actionId]` already exists — the UI around it does not.)
test.describe("server actions", () => {
  test.fixme("reboot asks for nothing, shows the OVH task and ends done", async ({
    page,
    request,
  }) => {
    await createVerifiedCustomer(page, request, "actions")
    const server = await buyServer(page)

    await page.goto(routes.server(server.id))
    await page.getByRole("button", { name: /reiniciar/i }).click()

    await expectTaskDone(page, /reinici/i)
    await expect(page.getByText(/activo/i)).toBeVisible()
  })

  test.fixme("creating a snapshot records a description and ends done", async ({
    page,
    request,
  }) => {
    await createVerifiedCustomer(page, request, "snapshot")
    const server = await buyServer(page)

    await page.goto(routes.server(server.id))
    await page.getByRole("button", { name: /crear snapshot/i }).click()
    await page.getByLabel(/descripción/i).fill("e2e snapshot")
    await page.getByRole("button", { name: /crear/i }).click()

    await expectTaskDone(page, /snapshot/i)
    await expect(page.getByText("e2e snapshot")).toBeVisible()

    // Only one snapshot is allowed at a time: the create button must be gone.
    await expect(page.getByRole("button", { name: /crear snapshot/i })).toHaveCount(0)
  })

  test.fixme("enabling rescue mode warns, reboots and reports the mode", async ({
    page,
    request,
  }) => {
    await createVerifiedCustomer(page, request, "rescue")
    const server = await buyServer(page)

    await page.goto(routes.server(server.id))
    await page.getByRole("button", { name: /modo rescate/i }).click()

    // Rescue reboots the machine, so it is one of the actions that must confirm.
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/reiniciar/i)).toBeVisible()
    await dialog.getByRole("button", { name: /activar/i }).click()

    await expectTaskDone(page, /rescate/i)
    await expect(page.getByText(/modo rescate activo/i)).toBeVisible()

    // And it can be turned off again.
    await page.getByRole("button", { name: /salir del modo rescate/i }).click()
    await page.getByRole("dialog").getByRole("button", { name: /desactivar/i }).click()
    await expectTaskDone(page, /rescate/i)
    await expect(page.getByText(/modo rescate activo/i)).toHaveCount(0)
  })

  test.fixme("a destructive action is refused without explicit confirmation", async ({
    page,
    request,
  }) => {
    await createVerifiedCustomer(page, request, "confirm")
    const server = await buyServer(page)

    await page.goto(routes.server(server.id))
    await page.getByRole("button", { name: /reinstalar/i }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    // The confirm button stays disabled until the customer types the name.
    const confirm = dialog.getByRole("button", { name: /reinstalar/i })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole("button", { name: /cancelar/i }).click()

    await expect(page.getByText(/activo/i)).toBeVisible()
  })

  test.fixme("an action that is not allowed in the current status is not offered", async ({
    page,
    request,
  }) => {
    // `allowedActions` in @ola/core is the single source of truth; the UI must
    // not render a button the domain would refuse.
    await createVerifiedCustomer(page, request, "allowed")
    const server = await buyServer(page)

    await page.goto(routes.server(server.id))
    await page.getByRole("button", { name: /apagar/i }).click()
    await page.getByRole("dialog").getByRole("button", { name: /apagar/i }).click()
    await expectTaskDone(page, /apag/i)

    await expect(page.getByText(/apagado/i)).toBeVisible()
    // Stopped server: no reboot, no rescue.
    await expect(page.getByRole("button", { name: /reiniciar/i })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /encender/i })).toBeVisible()
  })
})
