/**
 * Minimal PHP `serialize()` encoder for flat associative arrays.
 *
 * WHMCS's `AddOrder` documents `configoptions` and `customfields` as
 * "base64 encoded serialized array", i.e. `base64_encode(serialize($array))`.
 * WHMCS runs `unserialize(base64_decode($value))` on its side, so we only ever need to
 * produce the three node kinds that appear in such an array: the array header, integer
 * keys/values and string keys/values.
 *
 * Deliberately NOT a general-purpose serializer: no objects, no references, no nesting.
 * Anything we cannot represent exactly is rejected loudly instead of being silently coerced.
 */

export type PhpScalar = string | number | boolean | null

/** Keys are either WHMCS numeric ids (configurable option / custom field id) or field names. */
export type PhpFlatArray = Readonly<Record<string, PhpScalar>>

const encoder = new TextEncoder()

/** PHP counts bytes, not UTF-16 code units: `s:` lengths must be the UTF-8 byte length. */
function byteLength(value: string): number {
  return encoder.encode(value).length
}

function serializeString(value: string): string {
  return `s:${byteLength(value)}:"${value}";`
}

function serializeKey(key: string): string {
  // PHP normalises decimal integer-like string keys to integer keys. Mirror that so the
  // array WHMCS unserializes is byte-identical to the one it would have built itself.
  if (/^(0|-?[1-9][0-9]*)$/.test(key)) {
    const asNumber = Number(key)
    if (Number.isSafeInteger(asNumber)) return `i:${asNumber};`
  }
  return serializeString(key)
}

function serializeValue(value: PhpScalar, key: string): string {
  if (value === null) return "N;"
  switch (typeof value) {
    case "string":
      return serializeString(value)
    case "boolean":
      return `b:${value ? 1 : 0};`
    case "number": {
      if (!Number.isFinite(value)) {
        throw new TypeError(`cannot serialize non-finite number for key "${key}"`)
      }
      if (Number.isInteger(value)) return `i:${value};`
      // PHP's default serialize_precision renders floats with up to 17 significant digits;
      // JS's own shortest round-trip representation is compatible with that.
      return `d:${value};`
    }
    default:
      throw new TypeError(`cannot serialize value of type ${typeof value} for key "${key}"`)
  }
}

/** `{ "1": "5" }` -> `a:1:{i:1;s:1:"5";}` */
export function phpSerializeFlatArray(input: PhpFlatArray): string {
  const entries = Object.entries(input)
  const body = entries.map(([key, value]) => serializeKey(key) + serializeValue(value, key)).join("")
  return `a:${entries.length}:{${body}}`
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** What WHMCS wants in `configoptions` / `customfields`: base64 of the serialized array. */
export function encodePhpArrayParam(input: PhpFlatArray): string {
  return base64FromBytes(encoder.encode(phpSerializeFlatArray(input)))
}
