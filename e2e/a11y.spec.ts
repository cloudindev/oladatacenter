import { expect, test, type Page } from "@playwright/test"
import { buyServer, createVerifiedCustomer, routes } from "./fixtures"

/**
 * Keyboard-only accessibility pass.
 *
 * The UI contract says: focus visible, keyboard reachable, AA contrast,
 * responsive to 360 px. This spec enforces the first two mechanically, on the
 * two screens that matter most — the page that takes the customer's money and
 * the page that controls their server.
 *
 * It uses no extra dependency: the checks are plain DOM queries, so they also
 * run in the 360 px project, where a drawer or a collapsed menu is the usual
 * place for a keyboard trap to hide.
 */

interface FocusedElement {
  tag: string
  /** How a person would recognise it: accessible name, or the text, or the id. */
  label: string
  /** outline / box-shadow actually painted while focused. */
  hasVisibleFocus: boolean
}

/** Describes whatever currently has focus, including inside open dialogs. */
async function describeFocus(page: Page): Promise<FocusedElement | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null

    const style = window.getComputedStyle(el)
    const outlineWidth = Number.parseFloat(style.outlineWidth || "0")
    const hasOutline = style.outlineStyle !== "none" && outlineWidth > 0
    const hasRing = style.boxShadow !== "none" && style.boxShadow !== ""

    const label =
      el.getAttribute("aria-label") ??
      (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
      el.textContent?.trim().slice(0, 60) ??
      el.id ??
      ""

    return {
      tag: el.tagName.toLowerCase(),
      label,
      hasVisibleFocus: hasOutline || hasRing,
    }
  })
}

/**
 * Tabs through the page and returns what it visited, in order.
 * Stops when focus returns to the first element (a full cycle) or after
 * `maxTabs` presses, which is also how a trap is detected.
 */
async function tabThrough(page: Page, maxTabs = 120): Promise<FocusedElement[]> {
  await page.locator("body").click({ position: { x: 1, y: 1 } })
  await page.keyboard.press("Tab")

  const visited: FocusedElement[] = []
  let first: string | null = null

  for (let i = 0; i < maxTabs; i += 1) {
    const focused = await describeFocus(page)
    if (!focused) break

    const key = `${focused.tag}:${focused.label}`
    if (first === null) first = key
    else if (key === first) break

    visited.push(focused)
    await page.keyboard.press("Tab")
  }

  return visited
}

/** Every visible, enabled, interactive element the page offers. */
async function interactiveElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled]):not([type=hidden])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ")

    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          el.getAttribute("aria-hidden") !== "true"
        )
      })
      .map((el) => {
        const label =
          el.getAttribute("aria-label") ??
          (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ??
          el.textContent?.trim().slice(0, 60) ??
          el.id ??
          ""
        return `${el.tagName.toLowerCase()}:${label}`
      })
  })
}

/** Asserts: nothing unreachable, focus always visible, no trap. */
async function expectFullyKeyboardOperable(page: Page): Promise<void> {
  const offered = await interactiveElements(page)
  const visited = await tabThrough(page)
  const visitedKeys = new Set(visited.map((item) => `${item.tag}:${item.label}`))

  expect(visited.length, "nothing at all received keyboard focus").toBeGreaterThan(0)

  const unreachable = offered.filter((key) => !visitedKeys.has(key))
  expect(
    unreachable,
    `These interactive elements cannot be reached with the Tab key:\n  ${unreachable.join("\n  ")}`,
  ).toEqual([])

  const invisibleFocus = visited.filter((item) => !item.hasVisibleFocus)
  expect(
    invisibleFocus.map((item) => `${item.tag}:${item.label}`),
    "These elements take focus without painting a visible focus ring",
  ).toEqual([])
}

// DEPENDS ON: /vps exists, but the skip link this asserts on does not. Also never run:
// no Playwright browser is installed on the dev machine.
test.fixme("the public plans page is fully operable with the keyboard", async ({ page }) => {
  await page.goto(routes.plans)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await expectFullyKeyboardOperable(page)

  // A skip link is the first stop, so a keyboard user is not forced through the nav.
  await page.locator("body").click({ position: { x: 1, y: 1 } })
  await page.keyboard.press("Tab")
  const firstStop = await describeFocus(page)
  expect(firstStop?.label ?? "").toMatch(/contenido|saltar/i)
})

// DEPENDS ON: nothing missing — /vps and /vps/configurar exist. Still fixme because
// no Playwright browser is installed on the dev machine, so it has never been run.
test.fixme("the plans page can be used end to end from the keyboard alone", async ({ page }) => {
  await page.goto(routes.plans)

  // Enter on the focused "configurar" link must navigate — not a div with onClick.
  const configure = page.getByRole("link", { name: /configurar/i }).first()
  await configure.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(new RegExp(routes.configurator))
})

// DEPENDS ON: /checkout and /app/servidores do not exist yet, so there is no server list to walk.
test.fixme("the server list is fully operable with the keyboard", async ({ page, request }) => {
  await createVerifiedCustomer(page, request, "a11y")
  await buyServer(page)

  await page.goto(routes.servers)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

  await expectFullyKeyboardOperable(page)
})

// DEPENDS ON: /app/servidores/[id] and its confirmation dialogs do not exist yet.
test.fixme("a confirmation dialog traps focus on purpose and Escape closes it", async ({
  page,
  request,
}) => {
  await createVerifiedCustomer(page, request, "a11y-dialog")
  const server = await buyServer(page)

  await page.goto(routes.server(server.id))
  await page.getByRole("button", { name: /reinstalar/i }).focus()
  await page.keyboard.press("Enter")

  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute("aria-modal", "true")

  // Focus moved into the dialog, and tabbing stays inside it.
  const inside = await tabThrough(page, 20)
  expect(inside.length, "a modal dialog must hold focus").toBeGreaterThan(0)

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  // And focus returns to the control that opened it.
  const restored = await describeFocus(page)
  expect(restored?.label ?? "").toMatch(/reinstalar/i)
})
