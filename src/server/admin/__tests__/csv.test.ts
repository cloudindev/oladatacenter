import { describe, expect, it } from "vitest"
import { csvDocument, csvRow, csvStream, escapeCsvField } from "../csv"
import { auditRow } from "./fakes"

describe("CSV escaping", () => {
  it("doubles an embedded quote and wraps the field", () => {
    expect(escapeCsvField('dijo "no"')).toBe('"dijo ""no"""')
  })

  it("quotes a field containing a comma", () => {
    expect(escapeCsvField("Madrid, España")).toBe('"Madrid, España"')
  })

  it("quotes a field containing a semicolon, because Excel splits on it in es-ES", () => {
    expect(escapeCsvField("a;b")).toBe('"a;b"')
  })

  it("keeps a newline inside the field instead of breaking the row", () => {
    expect(escapeCsvField("linea 1\nlinea 2")).toBe('"linea 1\nlinea 2"')
    expect(escapeCsvField("linea 1\r\nlinea 2")).toBe('"linea 1\r\nlinea 2"')
  })

  it("leaves a plain field alone", () => {
    expect(escapeCsvField("plan.price.changed")).toBe("plan.price.changed")
  })

  it("renders an empty field for null and undefined", () => {
    expect(escapeCsvField(null)).toBe("")
    expect(escapeCsvField(undefined)).toBe("")
  })

  it("serialises a diff object as JSON, quotes included", () => {
    expect(escapeCsvField({ priceMonth: { from: null, to: 899 } })).toBe(
      '"{""priceMonth"":{""from"":null,""to"":899}}"',
    )
  })

  it("neutralises a formula so a spreadsheet does not evaluate audit text", () => {
    expect(escapeCsvField("=1+1")).toBe("'=1+1")
    expect(escapeCsvField("@SUM(A1)")).toBe("'@SUM(A1)")
    // The guard must not break the quoting of a field that also needs it.
    expect(escapeCsvField("=cmd|'/c calc'!A1,x")).toBe(`"'=cmd|'/c calc'!A1,x"`)
  })

  it("writes dates as ISO 8601", () => {
    expect(escapeCsvField(new Date("2026-11-06T09:00:00.000Z"))).toBe("2026-11-06T09:00:00.000Z")
  })

  it("ends every row with CRLF", () => {
    expect(csvRow(["a", "b"])).toBe("a,b\r\n")
  })

  it("round-trips a nasty audit row into exactly one CSV record", () => {
    const row = auditRow({
      action: 'plan.price."changed"',
      // A newline inside the diff survives as `\n` once JSON-encoded, so the record stays
      // on one line; the quotes and the comma still have to be escaped.
      diff: { note: "subida\nde precio, 10 %" },
    })
    const document = csvDocument(["id", "accion", "diff"], [[row.id, row.action, row.diff]])

    expect(document).toBe(
      "id,accion,diff\r\n" +
        '01JAUDIT000000000000000001,"plan.price.""changed""",' +
        String.raw`"{""note"":""subida\nde precio, 10 %""}"` +
        "\r\n",
    )
    // One header record plus exactly one data record.
    expect(document.split("\r\n").filter((line) => line !== "")).toHaveLength(2)
  })

  it("keeps a real newline inside one quoted record", () => {
    const document = csvDocument(["a"], [["linea 1\nlinea 2"]])

    expect(document).toBe('a\r\n"linea 1\nlinea 2"\r\n')
    // Split on the record separator, not on any newline: still one data record.
    expect(document.split("\r\n").filter((line) => line !== "")).toHaveLength(2)
  })
})

describe("CSV streaming", () => {
  it("streams the header with a BOM and then one chunk per row", async () => {
    const stream = csvStream(["a", "b"], [
      ["1", "dos, tres"],
      ["3", '"cuatro"'],
    ])
    const reader = stream.getReader()
    // `ignoreBOM` so the assertion can see the BOM Excel needs instead of it being eaten.
    const decoder = new TextDecoder("utf-8", { ignoreBOM: true })
    const chunks: string[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value))
    }

    expect(chunks).toEqual([
      "﻿a,b\r\n",
      '1,"dos, tres"\r\n',
      '3,"""cuatro"""\r\n',
    ])
  })
})
