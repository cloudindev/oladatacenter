import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

export * from "./schema"
export { schema }

export type Database = ReturnType<typeof createDatabase>

/**
 * Supabase Postgres. On Vercel the URL must be the transaction pooler (Supavisor, port
 * 6543), which does not support prepared statements, hence `prepare: false`. Each
 * serverless instance keeps a small pool; the pooler multiplexes them.
 */
export function createDatabase(connectionString: string, options: { max?: number } = {}) {
  if (!connectionString) throw new Error("DATABASE_URL is required")
  const client = postgres(connectionString, { prepare: false, max: options.max ?? 5 })
  return drizzle(client, { schema })
}

let cached: Database | null = null

/** Lazily created singleton for the app. Never call this from `packages/core`. */
export function db(): Database {
  if (!cached) cached = createDatabase(process.env.DATABASE_URL ?? "")
  return cached
}

/** Closes a database's connections so a one-off script (seed, migration) can exit. */
export async function closeDatabase(database: Database): Promise<void> {
  await database.$client.end()
}
