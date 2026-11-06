import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "e2e/**"],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["**/index.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      reporter: ["text", "html"],
    },
  },
  resolve: {
    alias: {
      "@ola/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@ola/db": resolve(__dirname, "packages/db/src/index.ts"),
      "@ola/ovh": resolve(__dirname, "packages/ovh/src/index.ts"),
      "@ola/whmcs": resolve(__dirname, "packages/whmcs/src/index.ts"),
      "@ola/email": resolve(__dirname, "packages/email/src/index.ts"),
      "@": resolve(__dirname, "src"),
    },
  },
})
