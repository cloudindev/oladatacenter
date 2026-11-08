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

export interface PublicDnsRecord {
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "CAA"
  /** "@" for the apex, or the label, e.g. "www". */
  name: string
  value: string
  /** MX preference. */
  priority?: number
}

const zoneCache = new Map<string, { at: number; value: PublicDnsRecord[] | null }>()

async function settle<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work
  } catch {
    return null
  }
}

/**
 * The records anyone on the internet sees for the domain and its `www`: what the zone
 * publishes, read from public DNS. Read-only view of the zone; editing it is a separate
 * decision (it lives in Plesk or at the DNS provider, not in WHMCS).
 */
export async function publicDnsRecords(domain: string): Promise<PublicDnsRecord[] | null> {
  const name = domain.trim().toLowerCase()
  if (!DOMAIN_PATTERN.test(name)) return null
  const hit = zoneCache.get(name)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const dns = resolver()
  const www = `www.${name}`
  const [a, aaaa, mx, txt, caa, wwwCname, wwwA] = await Promise.all([
    settle(dns.resolve4(name)),
    settle(dns.resolve6(name)),
    settle(dns.resolveMx(name)),
    settle(dns.resolveTxt(name)),
    settle(dns.resolveCaa(name)),
    settle(dns.resolveCname(www)),
    settle(dns.resolve4(www)),
  ])

  const records: PublicDnsRecord[] = [
    ...(a ?? []).map((value) => ({ type: "A" as const, name: "@", value })),
    ...(aaaa ?? []).map((value) => ({ type: "AAAA" as const, name: "@", value })),
    ...(mx ?? [])
      .sort((x, y) => x.priority - y.priority)
      .map((record) => ({ type: "MX" as const, name: "@", value: record.exchange, priority: record.priority })),
    ...(txt ?? []).map((chunks) => ({ type: "TXT" as const, name: "@", value: chunks.join("") })),
    ...(caa ?? []).map((record) => ({
      type: "CAA" as const,
      name: "@",
      value: [record.issue && `issue "${record.issue}"`, record.issuewild && `issuewild "${record.issuewild}"`, record.iodef && `iodef "${record.iodef}"`]
        .filter(Boolean)
        .join(" ") || "(registro CAA)",
    })),
    ...(wwwCname && wwwCname.length > 0
      ? wwwCname.map((value) => ({ type: "CNAME" as const, name: "www", value }))
      : (wwwA ?? []).map((value) => ({ type: "A" as const, name: "www", value }))),
  ]
  // Every lookup failed (no such domain, resolver unreachable): say "unknown", not "empty".
  const value = [a, aaaa, mx, txt, caa, wwwCname, wwwA].every((part) => part === null) ? null : records
  zoneCache.set(name, { at: Date.now(), value })
  return value
}
