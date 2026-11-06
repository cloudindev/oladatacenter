import { describe, expect, it } from "vitest"
import {
  classifySpanishTaxId,
  firstPasswordIssueMessage,
  formatVatNumber,
  isSshPublicKey,
  isValidCif,
  isValidEuVatNumber,
  isValidNie,
  isValidNif,
  isValidPhone,
  isValidSpanishTaxId,
  isValidVatShape,
  maskPhone,
  normalizePhone,
  normalizeTaxId,
  parseSshPublicKey,
  parseVatNumber,
  parsePhone,
  passwordStrength,
  taxIdMatchesCustomerKind,
  vatCountryOf,
  PASSWORD_MIN_LENGTH,
} from "../src/identity/index.js"

// Keys generated with ssh-keygen; the private halves were discarded.
const ED25519_KEY =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIjRBhD2RY65iFGaqOpBFPDdkq3wipGlMvtO8MEM5db1 ola@test"
const RSA_KEY =
  "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDXj26UZ3+g6RLxn8McfaXdOJBH2naumcOdvoJXHDUleW8ZL1Zn2Vd+Cm172T0lr8hGh2kSiVK8n0nIgRQ5w7Uaw0Od4HVYb6UcKJPH1dR3vl5l6tRl8UzLouFa748qWrPNypWvPc1PI2hpWW+qfp8Th9aqWHyhSBnZKHf8b07qy2OkrFtFVei8oPqCG5venWG0bXO+g9syVsSrRam/0bi/t0No+Cd5i85yZFgjgrdqi9Behvk040GXpTIlT2mUV8X1O5NsNH92OVUy3fErM4MgRxzd4MxBOqTrVDl2nLySpf3r2D6tLuz1FACYsVW3wuLrMtSx/GB5HiN079QybGJv rsa@test"

describe("Spanish NIF", () => {
  it("accepts the right control letter", () => {
    expect(isValidNif("12345678Z")).toBe(true)
    expect(isValidNif("00000000T")).toBe(true)
    expect(isValidNif("54362315K")).toBe(true)
  })

  it("rejects a wrong control letter", () => {
    expect(isValidNif("12345678A")).toBe(false)
    expect(isValidNif("00000000A")).toBe(false)
  })

  it("rejects the wrong shape", () => {
    expect(isValidNif("1234567Z")).toBe(false)
    expect(isValidNif("123456789")).toBe(false)
    expect(isValidNif("X1234567L")).toBe(false)
    expect(isValidNif("")).toBe(false)
  })

  it("normalises spacing, punctuation and case", () => {
    expect(isValidNif(" 12.345.678-z ")).toBe(true)
    expect(normalizeTaxId(" es-b12345674 ")).toBe("B12345674")
    expect(normalizeTaxId("b12345674")).toBe("B12345674")
  })
})

describe("Spanish NIE", () => {
  it("accepts X, Y and Z with the right control letter", () => {
    expect(isValidNie("X1234567L")).toBe(true)
    expect(isValidNie("Y1234567X")).toBe(true)
    expect(isValidNie("Z0000000M")).toBe(true)
  })

  it("rejects a wrong control letter", () => {
    expect(isValidNie("X1234567M")).toBe(false)
    expect(isValidNie("Y1234567L")).toBe(false)
  })

  it("rejects an invalid prefix", () => {
    expect(isValidNie("A1234567L")).toBe(false)
    expect(isValidNie("W1234567L")).toBe(false)
  })
})

describe("Spanish CIF", () => {
  it("accepts a digit control for types that require one", () => {
    expect(isValidCif("A58818501")).toBe(true)
    expect(isValidCif("B12345674")).toBe(true)
  })

  it("accepts a letter control for types that require one", () => {
    expect(isValidCif("P1234567D")).toBe(true)
    expect(isValidCif("Q1234567D")).toBe(true)
    expect(isValidCif("N1234567D")).toBe(true)
  })

  it("rejects a letter control where a digit is required", () => {
    expect(isValidCif("A5881850D")).toBe(false)
    expect(isValidCif("B1234567E")).toBe(false)
  })

  it("rejects a digit control where a letter is required", () => {
    expect(isValidCif("P12345674")).toBe(false)
    expect(isValidCif("Q12345674")).toBe(false)
  })

  it("accepts either control for the mixed types", () => {
    expect(isValidCif("J1234567D")).toBe(true)
    expect(isValidCif("J12345674")).toBe(true)
  })

  it("rejects a wrong checksum", () => {
    expect(isValidCif("A58818502")).toBe(false)
    expect(isValidCif("B12345675")).toBe(false)
    expect(isValidCif("P1234567E")).toBe(false)
  })

  it("rejects an invalid organisation letter and the wrong shape", () => {
    expect(isValidCif("I1234567D")).toBe(false)
    expect(isValidCif("T1234567D")).toBe(false)
    expect(isValidCif("B123456")).toBe(false)
    expect(isValidCif("12345678Z")).toBe(false)
  })
})

describe("tax id classification", () => {
  it("names the kind", () => {
    expect(classifySpanishTaxId("12345678Z")).toBe("nif")
    expect(classifySpanishTaxId("X1234567L")).toBe("nie")
    expect(classifySpanishTaxId("A58818501")).toBe("cif")
    expect(classifySpanishTaxId("nope")).toBeNull()
  })

  it("knows which kind a customer must present", () => {
    expect(isValidSpanishTaxId("A58818501")).toBe(true)
    expect(taxIdMatchesCustomerKind("A58818501", "company")).toBe(true)
    expect(taxIdMatchesCustomerKind("A58818501", "individual")).toBe(false)
    expect(taxIdMatchesCustomerKind("12345678Z", "individual")).toBe(true)
    expect(taxIdMatchesCustomerKind("X1234567L", "individual")).toBe(true)
    expect(taxIdMatchesCustomerKind("12345678Z", "company")).toBe(false)
    expect(taxIdMatchesCustomerKind("bad", "company")).toBe(false)
  })
})

describe("EU VAT shapes", () => {
  it("validates per country", () => {
    expect(isValidVatShape("ES", "B12345674")).toBe(true)
    expect(isValidVatShape("ES", "B12345675")).toBe(false)
    expect(isValidVatShape("DE", "123456789")).toBe(true)
    expect(isValidVatShape("DE", "12345678")).toBe(false)
    expect(isValidVatShape("NL", "123456789B01")).toBe(true)
    expect(isValidVatShape("NL", "123456789B0")).toBe(false)
    expect(isValidVatShape("FR", "AB123456789")).toBe(true)
    expect(isValidVatShape("IT", "12345678901")).toBe(true)
    expect(isValidVatShape("IT", "1234567890")).toBe(false)
    expect(isValidVatShape("AT", "U12345678")).toBe(true)
    expect(isValidVatShape("AT", "12345678")).toBe(false)
  })

  it("maps Greece to EL and rejects unknown countries", () => {
    expect(vatCountryOf("gr")).toBe("EL")
    expect(isValidVatShape("GR", "123456789")).toBe(true)
    expect(isValidVatShape("US", "123456789")).toBe(false)
    expect(isValidVatShape("CH", "123456789")).toBe(false)
  })

  it("parses and formats prefixed numbers", () => {
    expect(parseVatNumber("ES B-12345674")).toEqual({ country: "ES", number: "B12345674" })
    expect(parseVatNumber("el123456789")).toEqual({ country: "EL", number: "123456789" })
    expect(parseVatNumber("US123456789")).toBeNull()
    expect(parseVatNumber("E")).toBeNull()
    expect(formatVatNumber("gr", "123 456 789")).toBe("EL123456789")
  })

  it("validates whole prefixed numbers", () => {
    expect(isValidEuVatNumber("ESB12345674")).toBe(true)
    expect(isValidEuVatNumber("ESB12345675")).toBe(false)
    expect(isValidEuVatNumber("DE123456789")).toBe(true)
    expect(isValidEuVatNumber("XX123456789")).toBe(false)
  })
})

describe("password strength", () => {
  it("accepts a long mixed password", () => {
    const verdict = passwordStrength("Tormenta#Verde72")
    expect(verdict.ok).toBe(true)
    expect(verdict.score).toBeGreaterThanOrEqual(3)
    expect(firstPasswordIssueMessage("Tormenta#Verde72")).toBeNull()
  })

  it("rejects short passwords", () => {
    const verdict = passwordStrength("Corta#7a")
    expect(verdict.ok).toBe(false)
    expect(verdict.issues).toContain("too_short")
    expect(verdict.score).toBe(0)
    expect("x".repeat(PASSWORD_MIN_LENGTH - 1).length).toBe(11)
  })

  it("rejects too long passwords", () => {
    expect(passwordStrength(`Aa1#${"b".repeat(240)}`).issues).toContain("too_long")
  })

  it("requires three character classes", () => {
    expect(passwordStrength("solominusculas").issues).toContain("too_few_classes")
    expect(passwordStrength("SOLOMAYUSCULAS").issues).toContain("too_few_classes")
  })

  it("rejects repeats and sequences", () => {
    expect(passwordStrength("Aaaa#Verde7219").issues).toContain("repeated_characters")
    expect(passwordStrength("Verde#abcd7219").issues).toContain("sequential_characters")
    expect(passwordStrength("Verde#4321xyz").issues).toContain("sequential_characters")
  })

  it("rejects common passwords", () => {
    expect(passwordStrength("password1234").issues).toContain("common_password")
  })

  it("rejects a password built from the email", () => {
    const verdict = passwordStrength("Marcos#Verde72", "marcos@empresa.com")
    expect(verdict.issues).toContain("contains_email")
    expect(passwordStrength("Tormenta#Verde72", "marcos@empresa.com").ok).toBe(true)
  })

  it("scores an empty password at zero and reports a Spanish message", () => {
    expect(passwordStrength("").score).toBe(0)
    expect(firstPasswordIssueMessage("corta")).toMatch(/caracteres/)
  })
})

describe("OpenSSH public keys", () => {
  it("parses ed25519 and rsa keys", () => {
    const ed = parseSshPublicKey(ED25519_KEY)
    expect(ed?.type).toBe("ssh-ed25519")
    expect(ed?.comment).toBe("ola@test")
    const rsa = parseSshPublicKey(RSA_KEY)
    expect(rsa?.type).toBe("ssh-rsa")
    expect(isSshPublicKey(ED25519_KEY)).toBe(true)
  })

  it("accepts a key without a comment and extra whitespace", () => {
    const [type, body] = ED25519_KEY.split(" ")
    const parsed = parseSshPublicKey(`  ${type}   ${body}\n`)
    expect(parsed?.comment).toBeNull()
  })

  it("rejects a body whose embedded algorithm does not match the type", () => {
    const body = ED25519_KEY.split(" ")[1] as string
    expect(isSshPublicKey(`ssh-rsa ${body} mismatch`)).toBe(false)
  })

  it("rejects private keys, unknown types and junk", () => {
    expect(isSshPublicKey("-----BEGIN OPENSSH PRIVATE KEY-----")).toBe(false)
    expect(isSshPublicKey("ssh-dss AAAAB3NzaC1kc3MAAACBAJ")).toBe(false)
    expect(isSshPublicKey("ssh-ed25519")).toBe(false)
    expect(isSshPublicKey("")).toBe(false)
    expect(isSshPublicKey(`ssh-ed25519 ${"!".repeat(60)}`)).toBe(false)
  })
})

describe("phone numbers", () => {
  it("normalises Spanish input to E.164", () => {
    expect(normalizePhone("600 12 34 56")).toBe("+34600123456")
    expect(normalizePhone("0034 600-123-456")).toBe("+34600123456")
    expect(parsePhone("+49 151 23456789")).toBe("+4915123456789")
    expect(parsePhone("12")).toBeNull()
  })

  it("validates and masks", () => {
    expect(isValidPhone("+34600123456")).toBe(true)
    expect(isValidPhone("600123456")).toBe(false)
    expect(isValidPhone("+0600123456")).toBe(false)
    expect(maskPhone("+34600123456")).toBe("+34 ··· 456")
    expect(maskPhone("+34")).toBe("···")
  })
})
