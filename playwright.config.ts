import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end configuration for OLA VPS Cloud.
 *
 * Everything here runs against the MOCK providers: `USE_MOCK_PROVIDERS=true`
 * swaps `MockOvhClient` + `MockWhmcsClient` + the mock email sender in
 * (see `src/server/providers.ts`), and both kill switches stay off. No real
 * order, no real charge, no real OVH call can escape an e2e run.
 *
 * Local prerequisites on the dev machine (see README.md — this matters):
 *
 *   unset NODE_OPTIONS
 *   export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"
 *   npx playwright install chromium   # browsers are NOT installed by npm ci
 *
 * The default `node` on that machine is v10, which Next.js cannot run. Playwright
 * inherits the PATH of the shell that launched it, so the web server inherits the
 * broken PATH too if the export above is skipped.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

/**
 * The `contract` project talks to the live OVH catalog over HTTP and needs
 * neither the app nor a browser. CI sets this so a contract run does not spend
 * two minutes booting Next.js for nothing.
 */
const skipWebServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1" || process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true"

/**
 * Environment for the application under test. Real values are taken from the
 * shell when present (a developer with a Neon branch in `.env.local` keeps
 * using it); the fallbacks only need to satisfy the zod schema in
 * `src/lib/env.ts` so the server boots.
 */
const webServerEnv: Record<string, string> = {
  USE_MOCK_PROVIDERS: "true",
  OVH_ORDERS_ENABLED: "false",
  WHMCS_WRITE_ENABLED: "false",
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/oladc_e2e",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-auth-secret-at-least-32-characters-long",
  AUTH_URL: BASE_URL,
  NEXT_PUBLIC_SITE_URL: BASE_URL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "sk_test_e2e_dummy",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_e2e_dummy",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_e2e_dummy",
  NEXT_TELEMETRY_DISABLED: "1",
}

export default defineConfig({
  testDir: "./e2e",

  /**
   * These specs share one database and one mock provider state (a customer, an
   * order, a server). Running them in parallel would have them stepping on each
   * other, and the failures would be blamed on the app. Serial, deliberately.
   */
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // 60 s per test: provisioning and server actions poll a (mock) OVH task.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // Traces are expensive; keep them for the retry that follows a failure,
    // which is the run an operator actually opens.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
  },

  projects: [
    /**
     * Not a UI test: asserts the live OVH public catalog still matches the
     * committed fixture. Browser-free, so it can run on a schedule without
     * `playwright install`. See .github/workflows/contract.yml.
     */
    {
      name: "contract",
      testMatch: /contract-.*\.spec\.ts/,
    },
    {
      name: "chromium-desktop",
      testIgnore: /contract-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    /**
     * 360 px wide, because the UI contract in docs/architecture.md says the
     * customer area must work down to 360 px. Not a popular phone size — the
     * narrowest one we promise to support.
     */
    {
      name: "mobile-360",
      testIgnore: /contract-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],

  webServer: skipWebServer
    ? undefined
    : {
        // `next dev` keeps the loop short locally. CI (or anyone wanting a
        // production-shaped run) overrides it:
        //   PLAYWRIGHT_WEB_SERVER_CMD="npm run build && npm run start"
        command: process.env.PLAYWRIGHT_WEB_SERVER_CMD ?? `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: webServerEnv,
      },
})
