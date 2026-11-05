import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema.js"

export * from "./schema.js"
export { schema }

export type Database = ReturnType<typeof createDatabase>

export function createDatabase(connectionString: string) {
  if (!connectionString) throw new Error("DATABASE_URL is required")
  const sql = neon(connectionString)
  return drizzle(sql, { schema })
}

let cached: Database | null = null

/** Lazily created singleton for the app. Never call this from `packages/core`. */
export function db(): Database {
  if (!cached) cached = createDatabase(process.env.DATABASE_URL ?? "")
  return cached
}
