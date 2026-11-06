/**
 * Identity validation helpers: Spanish tax identifiers, EU VAT shapes, password
 * strength, OpenSSH public keys and phone numbers.
 *
 * Everything here is pure, as `packages/core` requires: no network, no database and
 * no `process.env`. Import it as `@ola/core/identity/index`.
 */
export * from "./tax-id"
export * from "./vat"
export * from "./password"
export * from "./ssh"
export * from "./phone"
