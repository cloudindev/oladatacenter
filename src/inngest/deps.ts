import type { JobDeps } from "./ports"
import { runtimeDeps } from "./runtime"

/**
 * Where the Inngest functions get their dependencies.
 *
 * The functions are the only modules that import this file; the job logic in
 * `src/inngest/jobs/**` always takes `JobDeps` as a parameter, so a test never touches
 * the database, OVH, WHMCS, Resend or an Inngest key.
 */
let override: JobDeps | null = null

/** Test seam. Pass `null` to go back to the real dependencies. */
export function setJobDeps(deps: JobDeps | null): void {
  override = deps
}

export function jobDeps(): JobDeps {
  return override ?? runtimeDeps()
}
