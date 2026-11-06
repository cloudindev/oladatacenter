import { describe, expect, it } from "vitest"

import { encodePhpArrayParam, phpSerializeFlatArray } from "../src/php-serialize.js"

/**
 * The expected values below were produced by a real PHP 8 interpreter:
 *
 *   php -r 'echo base64_encode(serialize(array(5 => 31, 6 => 44)));'
 *
 * They are the contract with `includes/api/addorder.php`, which runs
 * `unserialize(base64_decode($value))`. If one of these fails, WHMCS will silently drop the
 * configurable options of every order.
 */
describe("phpSerializeFlatArray", () => {
  it("matches PHP for integer keys and integer values", () => {
    expect(phpSerializeFlatArray({ 5: 31, 6: 44 })).toBe("a:2:{i:5;i:31;i:6;i:44;}")
    expect(encodePhpArrayParam({ 5: 31, 6: 44 })).toBe("YToyOntpOjU7aTozMTtpOjY7aTo0NDt9")
  })

  it("matches PHP for string values", () => {
    expect(phpSerializeFlatArray({ 9: "ola-vps-01" })).toBe('a:1:{i:9;s:10:"ola-vps-01";}')
    expect(encodePhpArrayParam({ 9: "ola-vps-01" })).toBe(
      "YToxOntpOjk7czoxMDoib2xhLXZwcy0wMSI7fQ==",
    )
  })

  it("counts UTF-8 bytes, not characters, exactly like PHP", () => {
    // "Ampliación" is 10 characters but 11 bytes.
    expect(phpSerializeFlatArray({ 5: "31", 7: "Ampliación", 8: 2 })).toBe(
      'a:3:{i:5;s:2:"31";i:7;s:11:"Ampliación";i:8;i:2;}',
    )
    expect(encodePhpArrayParam({ 5: "31", 7: "Ampliación", 8: 2 })).toBe(
      "YTozOntpOjU7czoyOiIzMSI7aTo3O3M6MTE6IkFtcGxpYWNpw7NuIjtpOjg7aToyO30=",
    )
  })

  it("serializes booleans, nulls and floats the PHP way", () => {
    expect(phpSerializeFlatArray({ 1: true, 2: false, 3: null, 4: 1.5 })).toBe(
      "a:4:{i:1;b:1;i:2;b:0;i:3;N;i:4;d:1.5;}",
    )
  })

  it("keeps non-numeric keys as string keys", () => {
    expect(phpSerializeFlatArray({ datacenter: "sbg" })).toBe(
      'a:1:{s:10:"datacenter";s:3:"sbg";}',
    )
  })

  it("serializes an empty array", () => {
    expect(phpSerializeFlatArray({})).toBe("a:0:{}")
  })

  it("refuses a value it cannot represent exactly", () => {
    expect(() => phpSerializeFlatArray({ 1: Number.NaN })).toThrow(TypeError)
    expect(() => phpSerializeFlatArray({ 1: Number.POSITIVE_INFINITY })).toThrow(TypeError)
  })
})
