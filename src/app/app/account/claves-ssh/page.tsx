import { desc, eq } from "drizzle-orm"
import { db, sshKeys } from "@ola/db"
import {
  EmptyState,
  Field,
  Input,
  Notice,
  Panel,
  SectionTitle,
  Textarea,
} from "@/components/app/ui"
import { SubmitButton } from "@/components/auth/SubmitButton"
import { authError, authNotice, firstParam } from "@/components/auth/messages"
import { requireUser } from "@/server/auth/session"
import { loadCustomer } from "@/server/auth/verification"
import { addSshKeyAction, deleteSshKeyAction } from "../actions"

/**
 * SSH keys, used when a new server is created. The key is validated as a real OpenSSH
 * public key and stored with its SHA-256 fingerprint, the same string `ssh-keygen -lf`
 * prints, so a customer can compare it with their own machine.
 */
export default async function ClavesSshPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await requireUser()
  const params = await searchParams
  const error = authError(firstParam(params.error))
  const notice = authNotice(firstParam(params.ok))

  const customer = await loadCustomer(session.user.id)
  const keys = customer
    ? await db()
        .select({
          id: sshKeys.id,
          name: sshKeys.name,
          fingerprint: sshKeys.fingerprint,
          publicKey: sshKeys.publicKey,
          createdAt: sshKeys.createdAt,
        })
        .from(sshKeys)
        .where(eq(sshKeys.customerId, customer.id))
        .orderBy(desc(sshKeys.createdAt))
    : []

  return (
    <div className="space-y-8">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice && !error ? <Notice tone="ok">{notice}</Notice> : null}

      <Panel>
        <SectionTitle>Tus claves</SectionTitle>
        {keys.length === 0 ? (
          <EmptyState>
            Todavía no has guardado ninguna clave. Añade una y la instalaremos en los servidores
            que crees a partir de ahora.
          </EmptyState>
        ) : (
          <ul>
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-start justify-between gap-4 py-4 border-b border-border-base last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-text-base">{key.name}</p>
                  <p className="label-mono text-text-muted mt-1 break-all">{key.fingerprint}</p>
                  <p className="label-mono text-text-muted mt-1">
                    {key.publicKey.split(" ")[0]} · añadida el {formatDate(key.createdAt)}
                  </p>
                </div>
                <form action={deleteSshKeyAction}>
                  <input type="hidden" name="id" value={key.id} />
                  <SubmitButton variant="danger" withArrow={false} pendingLabel="Eliminando">
                    Eliminar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionTitle>Añadir una clave</SectionTitle>
        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          Pega la clave pública, no la privada. Suele estar en{" "}
          <code className="font-mono">~/.ssh/id_ed25519.pub</code> y empieza por{" "}
          <code className="font-mono">ssh-ed25519</code> o <code className="font-mono">ssh-rsa</code>.
        </p>
        <form action={addSshKeyAction}>
          <Field label="Nombre" htmlFor="nombre" hint="Por ejemplo: portátil de trabajo">
            <Input id="nombre" name="nombre" maxLength={120} required />
          </Field>
          <Field label="Clave pública" htmlFor="clave">
            <Textarea
              id="clave"
              name="clave"
              rows={5}
              required
              spellCheck={false}
              className="font-mono text-xs"
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."
            />
          </Field>
          <div className="pt-2">
            <SubmitButton pendingLabel="Guardando">Añadir clave</SubmitButton>
          </div>
        </form>
      </Panel>
    </div>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(date)
}
