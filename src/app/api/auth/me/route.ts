import { currentSession } from "@/server/auth/session"

/**
 * Whether the visitor is signed in, for the public header ("Mi panel" instead of
 * "Entrar"). Deliberately tiny: no id, no role, no customer data — only what the button
 * needs. Never cached, and a database hiccup answers "signed out" rather than an error.
 */
export async function GET(): Promise<Response> {
  let signedIn = false
  try {
    signedIn = (await currentSession()) !== null
  } catch {
    signedIn = false
  }
  return Response.json({ signedIn }, { headers: { "Cache-Control": "private, no-store" } })
}
