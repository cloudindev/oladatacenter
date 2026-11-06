/**
 * The step interface the job logic is written against.
 *
 * Every job body takes `StepTools` instead of Inngest's own `step`, for two reasons:
 *  - the logic is unit-testable with an in-memory implementation that records which step
 *    ids ran, which is how "a retry resumes instead of repeating a paid action" is tested;
 *  - the Inngest `Jsonify<T>` return type stays contained in one adapter instead of
 *    leaking into every job signature.
 */
export interface StepTools {
  /** Runs `fn` exactly once per workflow attempt; the result is memoised by Inngest. */
  run<T>(id: string, fn: () => Promise<T>): Promise<T>
  /** Durable sleep. Milliseconds, converted to Inngest's duration string. */
  sleep(id: string, ms: number): Promise<void>
}

/** The shape of Inngest's `step` that this layer uses. */
export interface InngestStepLike {
  run(id: string, fn: () => unknown): Promise<unknown>
  sleep(id: string, time: string | number): Promise<unknown>
}

/**
 * Runs every step inline, with no durability.
 *
 * Used by the WHMCS webhook, which must answer in one request: WHMCS retries the hook,
 * and the `webhookEvents` table is what makes that safe.
 */
export const directStepTools: StepTools = {
  run<T>(_id: string, fn: () => Promise<T>): Promise<T> {
    return fn()
  },
  async sleep(): Promise<void> {
    // No durable timer outside a workflow: a webhook never waits.
  },
}

/**
 * Adapts Inngest's step tools to `StepTools`.
 *
 * The single cast in this file is deliberate: Inngest types `step.run` as returning
 * `Jsonify<T>` because the value is serialised between attempts. Every step in this layer
 * returns JSON-safe data (strings, numbers, plain objects or `null`), so `Jsonify<T>` and
 * `T` are the same shape at runtime.
 */
export function stepTools(step: InngestStepLike): StepTools {
  return {
    run<T>(id: string, fn: () => Promise<T>): Promise<T> {
      return step.run(id, fn) as unknown as Promise<T>
    },
    async sleep(id: string, ms: number): Promise<void> {
      await step.sleep(id, `${Math.max(0, Math.round(ms))}ms`)
    },
  }
}
