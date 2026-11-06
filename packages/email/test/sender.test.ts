import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  EmailSendError,
  MockEmailSender,
  type OutboundEmail,
  ResendSender,
  type ResendLike,
} from "../src/index"
import { caseFor } from "./fixtures"

type SendPayload = Parameters<ResendLike["emails"]["send"]>[0]
type SendResponse = Awaited<ReturnType<ResendLike["emails"]["send"]>>

/** Scripted Resend double: one queued response per attempt. */
function fakeResend(responses: readonly (SendResponse | Error)[]): {
  client: ResendLike
  payloads: SendPayload[]
} {
  const payloads: SendPayload[] = []
  let index = 0
  const client: ResendLike = {
    emails: {
      send: async (payload) => {
        payloads.push(payload)
        const next = responses[Math.min(index, responses.length - 1)]
        index += 1
        if (next instanceof Error) throw next
        return next
      },
    },
  }
  return { client, payloads }
}

const ok = (id: string): SendResponse => ({ data: { id }, error: null })
const failure = (name: string): SendResponse => ({
  data: null,
  error: { name, message: `fallo simulado: ${name}` },
})

const welcome: OutboundEmail = caseFor("welcome-verify").message("cliente@example.com")

describe("MockEmailSender", () => {
  const sender = new MockEmailSender()
  beforeEach(() => {
    sender.reset()
  })

  it("registra todo lo enviado con asunto, html y texto", async () => {
    const result = await sender.send(welcome)

    expect(result.id).toEqual("mock-0001")
    expect(sender.sent).toHaveLength(1)
    const [entry] = sender.sent
    expect(entry.to).toEqual("cliente@example.com")
    expect(entry.template).toEqual("welcome-verify")
    expect(entry.subject).toEqual("Verifica tu correo para activar tu cuenta")
    expect(entry.html).toContain("https://oladc.com/verify?token=abc123")
    expect(entry.text).toContain("https://oladc.com/verify?token=abc123")
    expect(entry.sentAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(sender.last()).toEqual(entry)
  })

  it("acumula mensajes, los filtra por plantilla y se vacía con reset", async () => {
    const serverReady = caseFor("server-ready")
    await sender.send(welcome)
    await sender.send(serverReady.message("ana@example.com"))
    await sender.send(serverReady.message("ana@example.com"))

    expect(sender.sent.map((entry) => entry.id)).toEqual(["mock-0001", "mock-0002", "mock-0003"])
    expect(sender.byTemplate("server-ready")).toHaveLength(2)
    expect(sender.byTemplate("order-failed")).toHaveLength(0)

    sender.reset()
    expect(sender.sent).toHaveLength(0)
    expect(sender.last()).toBeUndefined()
    const after = await sender.send(welcome)
    expect(after.id).toEqual("mock-0001")
  })
})

describe("ResendSender", () => {
  it("envía desde la dirección inyectada y devuelve el id", async () => {
    const { client, payloads } = fakeResend([ok("re_123")])
    const sender = new ResendSender(client, {
      from: "OLA <no-reply@oladc.com>",
      replyTo: "soporte@oladc.com",
      retryDelayMs: 0,
    })

    const result = await sender.send(welcome)

    expect(result).toEqual({ id: "re_123" })
    expect(payloads).toHaveLength(1)
    expect(payloads[0].from).toEqual("OLA <no-reply@oladc.com>")
    expect(payloads[0].to).toEqual("cliente@example.com")
    expect(payloads[0].replyTo).toEqual("soporte@oladc.com")
    expect(payloads[0].subject).toEqual("Verifica tu correo para activar tu cuenta")
    expect(payloads[0].html).toContain("<table")
    expect(payloads[0].text).toContain("Equipo OLA")
  })

  it("reintenta una vez cuando el proveedor devuelve un 5xx", async () => {
    const { client, payloads } = fakeResend([failure("internal_server_error"), ok("re_456")])
    const sleep = vi.fn(async () => {})
    const sender = new ResendSender(client, {
      from: "OLA <no-reply@oladc.com>",
      retryDelayMs: 25,
      sleep,
    })

    await expect(sender.send(welcome)).resolves.toEqual({ id: "re_456" })
    expect(payloads).toHaveLength(2)
    expect(sleep).toHaveBeenCalledWith(25)
  })

  it("reintenta una vez cuando la petición lanza", async () => {
    const { client, payloads } = fakeResend([new Error("socket hang up"), ok("re_789")])
    const sender = new ResendSender(client, { from: "OLA <no-reply@oladc.com>", retryDelayMs: 0 })

    await expect(sender.send(welcome)).resolves.toEqual({ id: "re_789" })
    expect(payloads).toHaveLength(2)
  })

  it("no reintenta un error de validación", async () => {
    const { client, payloads } = fakeResend([failure("validation_error")])
    const sender = new ResendSender(client, { from: "OLA <no-reply@oladc.com>", retryDelayMs: 0 })

    await expect(sender.send(welcome)).rejects.toThrow(EmailSendError)
    expect(payloads).toHaveLength(1)
  })

  it("se rinde después de un único reintento", async () => {
    const { client, payloads } = fakeResend([
      failure("application_error"),
      failure("application_error"),
    ])
    const sender = new ResendSender(client, { from: "OLA <no-reply@oladc.com>", retryDelayMs: 0 })

    await expect(sender.send(welcome)).rejects.toThrow(/tras un reintento/)
    expect(payloads).toHaveLength(2)
  })

})

describe("configuración inyectada", () => {
  it("ningún fichero del paquete lee process.env", async () => {
    const { readdir, readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")
    const root = new URL("../src/", import.meta.url).pathname

    const walk = async (dir: string): Promise<string[]> => {
      const entries = await readdir(dir, { withFileTypes: true })
      const files = await Promise.all(
        entries.map(async (entry) => {
          const full = join(dir, entry.name)
          return entry.isDirectory() ? walk(full) : [full]
        }),
      )
      return files.flat()
    }

    const files = await walk(root)
    expect(files.length).toBeGreaterThan(15)
    for (const file of files) {
      const source = await readFile(file, "utf8")
      expect(source, file).not.toContain("process.env")
    }
  })
})
