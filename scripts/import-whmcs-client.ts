/**
 * Imports one existing WHMCS client into OLA: a login (user) and a billing identity
 * (customer) linked to that WHMCS client, so their new orders land on the same account.
 *
 *   OLA_IMPORT_PASSWORD='…' npx tsx scripts/import-whmcs-client.ts --client 16 [--weak-password-ok]
 *
 * Reads the client with `GetClientsDetails` through the fixed-IP proxy (WHMCS allowlists
 * IPs). Refuses when the email or the WHMCS id is already in OLA. The password comes from
 * the environment, never from a file or the command history of the repo; it is checked
 * against the platform policy unless `--weak-password-ok` is given on purpose.
 *
 * The email is marked as verified (the operator vouches for an existing customer). Phone
 * and card steps stay pending, as for any new account. One audit row records the import.
 */
import { hash } from "@node-rs/argon2"
import { eq, sql } from "drizzle-orm"
import { parsePhone } from "../packages/core/src/identity/phone"
import { passwordStrength } from "../packages/core/src/identity/password"
import { auditLog, closeDatabase, createDatabase, customers, users } from "../packages/db/src/index"

/** Same parameters as `src/server/auth/password.ts` (argon2id, OWASP 2024 minimum). */
const ARGON2_OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

interface WhmcsClientDetails {
  id: number
  firstname: string
  lastname: string
  companyname: string
  email: string
  address1: string
  address2: string
  city: string
  state: string
  postcode: string
  countrycode: string
  phonenumberformatted: string
  tax_id: string
}

async function fetchClient(clientId: number): Promise<WhmcsClientDetails> {
  const proxyToken = required("WHMCS_PROXY_TOKEN")
  const body = new URLSearchParams({
    identifier: required("WHMCS_API_IDENTIFIER"),
    secret: required("WHMCS_API_SECRET"),
    action: "GetClientsDetails",
    clientid: String(clientId),
    stats: "false",
    responsetype: "json",
    ola_proxy_token: proxyToken,
  })
  const response = await fetch(required("WHMCS_PROXY_URL"), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-ola-token": proxyToken,
      "x-target-url": required("WHMCS_API_URL"),
    },
    body,
  })
  const data = (await response.json()) as { result?: string; message?: string; client?: WhmcsClientDetails }
  if (data.result !== "success" || !data.client) {
    throw new Error(`WHMCS GetClientsDetails failed: ${data.message ?? response.status}`)
  }
  return data.client
}

async function main(): Promise<void> {
  const clientId = Number(argValue("--client"))
  if (!Number.isInteger(clientId) || clientId <= 0) throw new Error("--client <WHMCS id> is required")
  const password = required("OLA_IMPORT_PASSWORD")

  const client = await fetchClient(clientId)
  const email = client.email.trim().toLowerCase()

  const verdict = passwordStrength(password, email)
  if (!verdict.ok && !process.argv.includes("--weak-password-ok")) {
    throw new Error(`password rejected by the policy (${verdict.issues.join(", ")}); pass --weak-password-ok to override`)
  }

  const db = createDatabase(required("DATABASE_URL"), { max: 1 })
  try {
    const sameEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
    if (sameEmail.length > 0) throw new Error(`a user with ${email} already exists in OLA`)
    const sameClient = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.whmcsClientId, client.id))
    if (sameClient.length > 0) throw new Error(`WHMCS client ${client.id} is already linked in OLA`)

    const passwordHash = await hash(password, ARGON2_OPTIONS)
    const company = client.companyname.trim()
    const person = `${client.firstname} ${client.lastname}`.trim()

    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email, passwordHash, role: "customer", emailVerifiedAt: new Date() })
        .returning({ id: users.id })
      if (!user) throw new Error("user insert returned nothing")
      const [customer] = await tx
        .insert(customers)
        .values({
          userId: user.id,
          kind: company ? "company" : "individual",
          legalName: company || person || null,
          taxId: client.tax_id.trim() || null,
          addressLine1: client.address1.trim() || null,
          addressLine2: client.address2.trim() || null,
          city: client.city.trim() || null,
          postalCode: client.postcode.trim() || null,
          country: client.countrycode.trim().toUpperCase() || null,
          // A contact detail only: the phone step stays unverified.
          phone: parsePhone(client.phonenumberformatted.replace(".", "")),
          whmcsClientId: client.id,
          status: "unverified",
        })
        .returning({ id: customers.id })
      if (!customer) throw new Error("customer insert returned nothing")
      await tx.insert(auditLog).values({
        actorType: "system",
        entity: "customer",
        entityId: customer.id,
        action: "customer_imported_from_whmcs",
        diff: {
          whmcsClientId: client.id,
          email,
          weakPasswordAccepted: !verdict.ok,
        },
      })
      return { userId: user.id, customerId: customer.id }
    })

    console.log(
      `imported WHMCS client ${client.id} (${company || person}) as user ${created.userId}, customer ${created.customerId}`,
    )
  } finally {
    await closeDatabase(db)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
