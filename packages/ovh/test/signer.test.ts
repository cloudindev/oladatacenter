import { describe, expect, it, beforeEach } from "vitest"
import {
  OvhEndpointError,
  clockSkewSeconds,
  ovhSignature,
  peekClockSkew,
  resetClockSkew,
  resolveEndpoint,
  signedHeaders,
  signingTimestamp,
} from "../src/signer.js"

/**
 * The expected digests below were computed by hand, outside this code base:
 *
 *   printf '%s' 'secret+consumer+GET+https://eu.api.ovh.com/1.0/vps++1762387200' | shasum -a 1
 *     -> 953ce60b86c76d49652043b804e0a844730bd4e6
 *   printf '%s' 'appsecret+consumerkey+POST+https://eu.api.ovh.com/1.0/order/cart+{"ovhSubsidiary":"ES"}+1762387200' | shasum -a 1
 *     -> b8cfe435c79d094899f44c59a1f65fa5b1278390
 */
const TIMESTAMP = 1_762_387_200

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/plain" } })
}

describe("resolveEndpoint", () => {
  it("maps ovh-eu to the verified base URL", () => {
    expect(resolveEndpoint("ovh-eu")).toBe("https://eu.api.ovh.com/1.0")
  })

  it("accepts a full base URL and trims trailing slashes", () => {
    expect(resolveEndpoint("http://localhost:9999/1.0/")).toBe("http://localhost:9999/1.0")
  })

  it("rejects an unknown endpoint name", () => {
    expect(() => resolveEndpoint("ovh-moon")).toThrow(OvhEndpointError)
  })
})

describe("ovhSignature", () => {
  it("is exactly the documented sha1 of the documented string, without a body", () => {
    expect(
      ovhSignature({
        applicationSecret: "secret",
        consumerKey: "consumer",
        method: "GET",
        url: "https://eu.api.ovh.com/1.0/vps",
        body: "",
        timestamp: TIMESTAMP,
      }),
    ).toBe("$1$953ce60b86c76d49652043b804e0a844730bd4e6")
  })

  it("is exactly the documented sha1 of the documented string, with a body", () => {
    expect(
      ovhSignature({
        applicationSecret: "appsecret",
        consumerKey: "consumerkey",
        method: "POST",
        url: "https://eu.api.ovh.com/1.0/order/cart",
        body: '{"ovhSubsidiary":"ES"}',
        timestamp: TIMESTAMP,
      }),
    ).toBe("$1$b8cfe435c79d094899f44c59a1f65fa5b1278390")
  })

  it("uppercases the method before signing", () => {
    const lower = ovhSignature({
      applicationSecret: "secret",
      consumerKey: "consumer",
      method: "get",
      url: "https://eu.api.ovh.com/1.0/vps",
      body: "",
      timestamp: TIMESTAMP,
    })
    expect(lower).toBe("$1$953ce60b86c76d49652043b804e0a844730bd4e6")
  })

  it("changes when any part of the payload changes", () => {
    const base = {
      applicationSecret: "secret",
      consumerKey: "consumer",
      method: "GET",
      url: "https://eu.api.ovh.com/1.0/vps",
      body: "",
      timestamp: TIMESTAMP,
    }
    expect(ovhSignature({ ...base, timestamp: TIMESTAMP + 1 })).not.toBe(
      ovhSignature(base),
    )
    expect(ovhSignature({ ...base, url: `${base.url}/x` })).not.toBe(ovhSignature(base))
  })
})

describe("signedHeaders", () => {
  it("sends the four signing headers and nothing else", () => {
    const headers = signedHeaders({
      applicationKey: "appkey",
      applicationSecret: "secret",
      consumerKey: "consumer",
      method: "GET",
      url: "https://eu.api.ovh.com/1.0/vps",
      body: "",
      timestamp: TIMESTAMP,
    })
    expect(Object.keys(headers).sort()).toEqual([
      "X-Ovh-Application",
      "X-Ovh-Consumer",
      "X-Ovh-Signature",
      "X-Ovh-Timestamp",
    ])
    expect(headers["X-Ovh-Application"]).toBe("appkey")
    expect(headers["X-Ovh-Timestamp"]).toBe(String(TIMESTAMP))
    expect(headers["X-Ovh-Signature"]).toBe("$1$953ce60b86c76d49652043b804e0a844730bd4e6")
    // The secret itself is never a header value.
    expect(Object.values(headers)).not.toContain("secret")
  })
})

describe("clock skew", () => {
  beforeEach(() => {
    resetClockSkew()
  })

  it("is the difference between OVH's clock and ours, and is applied when signing", async () => {
    let calls = 0
    const fetchImpl = async (url: string): Promise<Response> => {
      calls += 1
      expect(url).toBe("https://eu.api.ovh.com/1.0/auth/time")
      return textResponse(String(TIMESTAMP + 120))
    }
    const now = () => TIMESTAMP * 1000

    const skew = await clockSkewSeconds({
      baseUrl: "https://eu.api.ovh.com/1.0",
      fetchImpl,
      now,
    })
    expect(skew).toBe(120)
    expect(peekClockSkew()).toBe(120)

    const timestamp = await signingTimestamp({
      baseUrl: "https://eu.api.ovh.com/1.0",
      fetchImpl,
      now,
    })
    expect(timestamp).toBe(TIMESTAMP + 120)
    // Fetched once for the process, then cached.
    expect(calls).toBe(1)
  })

  it("is re-fetched after resetClockSkew", async () => {
    let calls = 0
    const fetchImpl = async (): Promise<Response> => {
      calls += 1
      return textResponse(String(TIMESTAMP - 7))
    }
    const input = {
      baseUrl: "https://eu.api.ovh.com/1.0",
      fetchImpl,
      now: () => TIMESTAMP * 1000,
    }
    expect(await clockSkewSeconds(input)).toBe(-7)
    resetClockSkew()
    expect(peekClockSkew()).toBeNull()
    expect(await clockSkewSeconds(input)).toBe(-7)
    expect(calls).toBe(2)
  })

  it("falls back to no offset when /auth/time fails, and does not cache the failure", async () => {
    let calls = 0
    const fetchImpl = async (): Promise<Response> => {
      calls += 1
      if (calls === 1) throw new Error("socket hang up")
      return textResponse("not-a-timestamp")
    }
    const input = {
      baseUrl: "https://eu.api.ovh.com/1.0",
      fetchImpl,
      now: () => TIMESTAMP * 1000,
    }
    expect(await clockSkewSeconds(input)).toBe(0)
    expect(peekClockSkew()).toBeNull()
    expect(await clockSkewSeconds(input)).toBe(0)
    expect(calls).toBe(2)
  })
})
