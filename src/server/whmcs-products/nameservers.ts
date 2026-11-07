import "server-only"
import { Resolver } from "node:dns/promises"

/**
 * The nameservers a domain really uses, from public DNS (its NS records).
 *
 * WHMCS cannot answer this for our domains: they have no registrar module attached
 * ("Registrar Function Not Supported"), and public DNS is the truth anyway. Each lookup
 * is bounded (2 s, one try) and cached for 10 minutes, so a slow or missing domain never
 * holds the page back; a failure is `null` and the page shows a dash.
 */

const TTL_MS = 10 * 60 * 1000
const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

const cache = new Map<string, { at: number; value: string[] | null }>()

function resolver(): Resolver {
  const instance = new Resolver({ timeout: 2000, tries: 1 })
  // Public resolvers: the server's own may cache stale answers or not exist on Vercel.
  instance.setServers(["1.1.1.1", "8.8.8.8"])
  return instance
}

export async function nameserversOf(domain: string): Promise<string[] | null> {
  const name = domain.trim().toLowerCase()
  if (!DOMAIN_PATTERN.test(name)) return null

  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  let value: string[] | null
  try {
    const records = await resolver().resolveNs(name)
    value = [...new Set(records.map((record) => record.toLowerCase().replace(/\.$/, "")))].sort()
  } catch {
    value = null
  }
  cache.set(name, { at: Date.now(), value })
  return value
}
