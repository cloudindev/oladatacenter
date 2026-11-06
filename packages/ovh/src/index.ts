/**
 * `@ola/ovh` — the only module in the repo that knows an OVH URL.
 *
 * Exports the port (`OvhClient`), the HTTP adapter, the in-memory mock, the validated
 * types and the error mapping. Routes are limited to `docs/ovh-api-verified.md`.
 */
export * from "./client"
export * from "./errors"
export * from "./http-client"
export * from "./mock-client"
export * from "./signer"
export * from "./types"
