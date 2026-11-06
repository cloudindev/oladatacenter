/**
 * Shared chrome for every transactional email.
 *
 * Constraints baked in here, because Gmail and Outlook are the only two renderers that
 * matter: table-based layout (every @react-email primitive below renders a table), inline
 * styles only, no <style> block, no external CSS, no web fonts, 560 px maximum width,
 * light background with dark text, and the wordmark as text so the message stays legible
 * with images blocked. There are no <img> tags anywhere in this package.
 */
import * as React from "react"
import {
  Body,
  Button as REButton,
  Column,
  Container,
  Head,
  Heading as REHeading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components"

import {
  COMPANY_CITY,
  COMPANY_NAME,
  CUSTOMER_AREA_URL,
  colors,
  FONT_STACK,
  MAX_WIDTH,
  MONO_STACK,
  SIGNATURE,
} from "./theme"

// ─── primitives ──────────────────────────────────────────────────────────────

const baseText: React.CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: "15px",
  lineHeight: "24px",
  color: colors.ink,
  margin: "0 0 16px",
}

/** Body copy. */
export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={baseText}>{children}</Text>
}

/** Secondary copy: smaller, grey, still AA against white. */
export function Muted({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ ...baseText, fontSize: "13px", lineHeight: "20px", color: colors.muted }}>
      {children}
    </Text>
  )
}

/** Monospace uppercase label, the house eyebrow. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        ...baseText,
        fontFamily: MONO_STACK,
        fontSize: "11px",
        lineHeight: "16px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: colors.muted,
        margin: "0 0 10px",
      }}
    >
      {children}
    </Text>
  )
}

export function Heading({ children, level = 1 }: { children: React.ReactNode; level?: 1 | 2 }) {
  const isTitle = level === 1
  return (
    <REHeading
      as={isTitle ? "h1" : "h2"}
      style={{
        fontFamily: FONT_STACK,
        fontSize: isTitle ? "24px" : "17px",
        lineHeight: isTitle ? "32px" : "24px",
        fontWeight: isTitle ? 400 : 600,
        letterSpacing: isTitle ? "-0.01em" : "0",
        color: colors.ink,
        margin: isTitle ? "0 0 16px" : "24px 0 12px",
      }}
    >
      {children}
    </REHeading>
  )
}

/**
 * Dark pill, label in uppercase with monospace letterspacing. One per email.
 * The destination is always repeated as plain text next to it, because some clients
 * strip the anchor styling and some recipients cannot click.
 */
export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <REButton
      href={href}
      style={{
        backgroundColor: colors.ink,
        color: colors.onInk,
        fontFamily: MONO_STACK,
        fontSize: "12px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        textDecoration: "none",
        borderRadius: "8px",
        padding: "14px 24px",
        display: "inline-block",
      }}
    >
      {children}
    </REButton>
  )
}

/** The same URL spelled out, for images-off and copy-paste. */
export function UrlFallback({ href, label }: { href: string; label?: string }) {
  return (
    <Text
      style={{
        ...baseText,
        fontSize: "13px",
        lineHeight: "20px",
        color: colors.muted,
        margin: "14px 0 0",
        wordBreak: "break-all",
      }}
    >
      {label ?? "Si el botón no funciona, copia esta dirección en tu navegador"}:{" "}
      <Link href={href} style={{ color: colors.accentInk, textDecoration: "underline" }}>
        {href}
      </Link>
    </Text>
  )
}

export interface DataTableRow {
  label: string
  value: React.ReactNode
  /** Render the value in monospace: IPs, hostnames, references. */
  mono?: boolean
}

/**
 * Label/value rows. Rows whose value is null or undefined are dropped, so an optional
 * field can never render as "undefined".
 */
export function DataTable({ rows }: { rows: readonly (DataTableRow | null | undefined | false)[] }) {
  const visible = rows.filter(
    (row): row is DataTableRow =>
      typeof row === "object" && row !== null && row.value !== null && row.value !== undefined,
  )
  if (visible.length === 0) return null
  return (
    <Section
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: "10px",
        padding: "4px 16px",
        margin: "0 0 20px",
      }}
    >
      {visible.map((row, index) => (
        <Row
          key={row.label}
          style={{
            borderBottom: index === visible.length - 1 ? "none" : `1px solid ${colors.border}`,
          }}
        >
          <Column style={{ padding: "10px 0", verticalAlign: "top", width: "40%" }}>
            <Text
              style={{
                fontFamily: MONO_STACK,
                fontSize: "11px",
                lineHeight: "18px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: colors.muted,
                margin: 0,
              }}
            >
              {row.label}
            </Text>
          </Column>
          <Column style={{ padding: "10px 0", verticalAlign: "top", textAlign: "right" }}>
            <Text
              style={{
                fontFamily: row.mono ? MONO_STACK : FONT_STACK,
                fontSize: row.mono ? "13px" : "14px",
                lineHeight: "20px",
                color: colors.ink,
                margin: 0,
                wordBreak: "break-all",
              }}
            >
              {row.value}
            </Text>
          </Column>
        </Row>
      ))}
    </Section>
  )
}

/** Inset block for a value the recipient has to read carefully: a code, a password. */
export function Callout({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: "neutral" | "accent"
}) {
  return (
    <Section
      style={{
        backgroundColor: tone === "accent" ? colors.mint : colors.beige,
        border: `1px solid ${tone === "accent" ? colors.lime : colors.border}`,
        borderRadius: "10px",
        padding: "16px 20px",
        margin: "0 0 20px",
      }}
    >
      {children}
    </Section>
  )
}

/** Large monospace value, used for the one-time code and the one-time password. */
export function CodeValue({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: MONO_STACK,
        fontSize: "26px",
        lineHeight: "34px",
        letterSpacing: "0.18em",
        color: colors.ink,
        margin: 0,
        wordBreak: "break-all",
      }}
    >
      {children}
    </Text>
  )
}

export function Rule() {
  return <Hr style={{ border: "none", borderTop: `1px solid ${colors.border}`, margin: "24px 0" }} />
}

// ─── layout ──────────────────────────────────────────────────────────────────

export interface EmailLayoutProps {
  /** Inbox preview line. Spanish, sentence case, no exclamation marks. */
  preview: string
  children: React.ReactNode
  /** Where the footer link points. Injected so no template reads the environment. */
  customerAreaUrl?: string
  /** Internal mails say so in the footer instead of linking the customer area. */
  internal?: boolean
}

export function EmailLayout({
  preview,
  children,
  customerAreaUrl = CUSTOMER_AREA_URL,
  internal = false,
}: EmailLayoutProps) {
  return (
    <Html lang="es" dir="ltr">
      <Head>
        {/* <Head> already emits the charset, viewport and Apple reformatting metas. */}
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.canvas,
          color: colors.ink,
          fontFamily: FONT_STACK,
          margin: 0,
          padding: "32px 12px",
        }}
      >
        <Container style={{ width: "100%", maxWidth: `${MAX_WIDTH}px`, margin: "0 auto" }}>
          {/* Wordmark as text, so it survives images being blocked. */}
          <Section style={{ padding: "0 0 16px" }}>
            <Text
              style={{
                fontFamily: FONT_STACK,
                fontSize: "20px",
                lineHeight: "28px",
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: colors.ink,
                margin: 0,
              }}
            >
              OLA
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: "14px",
              padding: "28px 28px 20px",
            }}
          >
            {children}
            <Rule />
            <Text
              style={{
                ...baseText,
                fontSize: "14px",
                color: colors.muted,
                margin: 0,
              }}
            >
              {SIGNATURE}
            </Text>
          </Section>

          <Section style={{ padding: "20px 4px 0" }}>
            <Text
              style={{
                fontFamily: FONT_STACK,
                fontSize: "12px",
                lineHeight: "19px",
                color: colors.muted,
                margin: 0,
              }}
            >
              {COMPANY_NAME} · {COMPANY_CITY}
              <br />
              {internal ? (
                "Aviso interno generado por la plataforma. No reenviar fuera del equipo."
              ) : (
                <>
                  <Link
                    href={customerAreaUrl}
                    style={{ color: colors.accentInk, textDecoration: "underline" }}
                  >
                    Área de cliente
                  </Link>
                  <br />
                  Este es un mensaje transaccional sobre tu cuenta y tus servicios, no es
                  publicidad, por lo que no incluye opción de baja. Mientras tengas servicios o
                  facturas con nosotros seguirás recibiéndolo.
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
