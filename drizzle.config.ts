import { defineConfig } from "drizzle-kit"

// Migrations need a session connection: Supabase's direct URL or the session pooler
// (port 5432). The app's DATABASE_URL is the transaction pooler (6543), which cannot run
// them reliably, so DIRECT_URL wins when it is set.
export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
})
