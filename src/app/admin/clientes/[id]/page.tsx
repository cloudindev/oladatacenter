import Link from "next/link"
import { notFound } from "next/navigation"
import { formatCents } from "@ola/core"
import { ConfirmAction } from "@/components/admin/action-form"
import {
  AdminHeader,
  AdminSection,
  CustomerStatus,
  Kv,
  KvRow,
  LoadFailure,
  Maybe,
  Mono,
  Muted,
  ProviderLink,
  ServiceStatus,
  TableEmpty,
  TableWrap,
  Td,
  Th,
  Timestamp,
  whmcsClientUrl,
} from "@/components/admin/ui"
import { Field, Input, Notice, Panel, StatusBadge, Textarea } from "@/components/app/ui"
import { grantManualCredit, setCustomerBlocked, startImpersonation } from "@/server/admin/actions"
import { customerScreen, requireAdminPage } from "@/server/admin/queries"

/**
 * One customer: verification, credit, trial limits, services, invoices, the fraud signals
 * recorded on their credit grants, and the three levers — block, grant credit, impersonate.
 */

const SIGNAL_LABELS: Record<string, string> = {
  cardFingerprint: "Huella de tarjeta",
  phoneNumber: "Teléfono",
  deviceFingerprint: "Dispositivo",
  ipAddress: "IP",
}

const CREDIT_REASON_LABELS: Record<string, string> = {
  welcome: "Bienvenida",
  manual: "Manual",
  refund: "Reembolso",
}

export default async function AdminClientePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const screen = await customerScreen(id)

  if (!screen.ok) {
    return (
      <>
        <AdminHeader title="Cliente" />
        <LoadFailure message={screen.message} detail={screen.detail} />
      </>
    )
  }
  if (!screen.data) notFound()

  const { detail, availableCredit, expiring, trial, whmcsBaseUrl } = screen.data
  const blocked = detail.status === "blocked"
  const withSignals = detail.credits.filter((credit) => credit.signals && Object.keys(credit.signals).length > 0)

  return (
    <>
      <AdminHeader
        title={detail.email}
        hint={
          <Link href="/admin/clientes" className="underline decoration-dotted underline-offset-4">
            Volver a clientes
          </Link>
        }
        actions={<CustomerStatus status={detail.status} />}
      />

      {detail.riskNotes ? (
        <div className="mb-6">
          <Notice tone="warn" title="Notas de riesgo">
            <pre className="font-mono text-xs whitespace-pre-wrap">{detail.riskNotes}</pre>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminSection title="Identidad y verificación">
          <Panel className="p-4">
            <Kv>
              <KvRow label="Id" mono>{detail.id}</KvRow>
              <KvRow label="Tipo">{detail.kind === "company" ? "Empresa" : "Particular"}</KvRow>
              <KvRow label="Razón social"><Maybe value={detail.legalName} /></KvRow>
              <KvRow label="NIF" mono>
                <Maybe value={detail.taxId} />{" "}
                {detail.taxId ? (
                  <StatusBadge tone={detail.taxIdValidated ? "ok" : "warn"}>
                    {detail.taxIdValidated ? "VIES" : "sin validar"}
                  </StatusBadge>
                ) : null}
              </KvRow>
              <KvRow label="País" mono><Maybe value={detail.country} /></KvRow>
              <KvRow label="Correo verificado"><Timestamp value={detail.emailVerifiedAt} /></KvRow>
              <KvRow label="Teléfono" mono><Maybe value={detail.phone} /></KvRow>
              <KvRow label="Teléfono verificado"><Timestamp value={detail.phoneVerifiedAt} /></KvRow>
              <KvRow label="Tarjeta verificada">{detail.hasVerifiedCard ? "Sí" : "No"}</KvRow>
              <KvRow label="Datos de facturación">{detail.billingComplete ? "Completos" : "Incompletos"}</KvRow>
              <KvRow label="Cliente WHMCS" mono>
                {detail.whmcsClientId !== null ? (
                  whmcsBaseUrl ? (
                    <ProviderLink href={whmcsClientUrl(whmcsBaseUrl, detail.whmcsClientId)}>
                      {detail.whmcsClientId}
                    </ProviderLink>
                  ) : (
                    detail.whmcsClientId
                  )
                ) : (
                  <Muted>—</Muted>
                )}
              </KvRow>
              <KvRow label="Cliente Stripe" mono><Maybe value={detail.stripeCustomerId} /></KvRow>
            </Kv>
          </Panel>
        </AdminSection>

        <AdminSection title="Crédito y límites de prueba">
          <Panel className="p-4">
            <Kv>
              <KvRow label="Crédito disponible" mono>{formatCents(availableCredit)}</KvRow>
              <KvRow label="Caduca en 7 días" mono>
                {expiring.length === 0
                  ? "—"
                  : formatCents(expiring.reduce((total, credit) => total + credit.amount - credit.consumed, 0))}
              </KvRow>
              <KvRow label="Primer pago real"><Timestamp value={detail.firstPaidAt} /></KvRow>
              <KvRow label="Límites de prueba">
                {trial === null ? (
                  <StatusBadge tone="ok">Levantados</StatusBadge>
                ) : trial.allowed ? (
                  <StatusBadge tone="neutral">Activos, dentro del límite</StatusBadge>
                ) : (
                  <StatusBadge tone="warn">Al límite</StatusBadge>
                )}
              </KvRow>
            </Kv>
            {trial && !trial.allowed ? (
              <p className="mt-2 text-xs text-text-muted">{trial.reason}</p>
            ) : null}
          </Panel>
        </AdminSection>

        <AdminSection title="Acciones">
          <Panel className="space-y-4 p-4">
            <ConfirmAction
              action={startImpersonation}
              fields={{ customerId: detail.id, confirmedEmail: detail.email }}
              trigger="Suplantar"
              variant="secondary"
              title={`Ver el panel como ${detail.email}`}
              consequence="Queda registrado en la auditoría con tu usuario, salta una alerta crítica y verás un aviso permanente hasta que termines. Caduca en 30 minutos."
              confirmWord="SUPLANTAR"
            />

            <ConfirmAction
              action={grantManualCredit}
              fields={{ customerId: detail.id, confirmedEmail: detail.email }}
              trigger="Conceder crédito"
              variant="secondary"
              title={`Conceder crédito a ${detail.email}`}
              consequence="El crédito se descuenta de sus próximos pedidos antes de IVA. Máximo 500,00 € por concesión."
              confirmWord="CREDITO"
            >
              <Field label="Importe (€)" htmlFor="credit-amount">
                <Input id="credit-amount" name="amount" inputMode="decimal" required />
              </Field>
              <Field label="Motivo" htmlFor="credit-note">
                <Textarea id="credit-note" name="note" rows={2} required />
              </Field>
              <Field label="Caduca" htmlFor="credit-expiry" hint="En blanco, sin caducidad.">
                <Input id="credit-expiry" name="expiresAt" type="date" />
              </Field>
            </ConfirmAction>

            <ConfirmAction
              action={setCustomerBlocked}
              fields={{ customerId: detail.id, confirmedEmail: detail.email, blocked: blocked ? "" : "on" }}
              trigger={blocked ? "Desbloquear" : "Bloquear"}
              variant={blocked ? "secondary" : "danger"}
              title={`${blocked ? "Desbloquear" : "Bloquear"} a ${detail.email}`}
              consequence={
                blocked
                  ? "Vuelve a poder iniciar sesión y contratar."
                  : `No podrá iniciar sesión ni contratar. Sus ${detail.services.length} servicios no se tocan: suspéndelos aparte si hace falta.`
              }
              confirmWord={blocked ? "DESBLOQUEAR" : "BLOQUEAR"}
            >
              <Field label="Motivo" htmlFor="block-reason">
                <Textarea id="block-reason" name="reason" rows={2} required />
              </Field>
            </ConfirmAction>
          </Panel>
        </AdminSection>
      </div>

      <AdminSection title="Servicios">
        <TableWrap>
          <thead>
            <tr>
              <Th>Servicio</Th>
              <Th>Plan</Th>
              <Th align="center">Estado</Th>
              <Th align="right">Cuota</Th>
              <Th>Renueva</Th>
            </tr>
          </thead>
          <tbody>
            {detail.services.length === 0 ? <TableEmpty colSpan={5}>Sin servicios.</TableEmpty> : null}
            {detail.services.map((service) => (
              <tr key={service.id}>
                <Td>
                  <Link href={`/admin/servicios/${service.id}`} className="text-accent-ink underline decoration-dotted underline-offset-4">
                    {service.displayName ?? service.id}
                  </Link>
                  <p><Mono className="text-text-muted">{service.ovhServiceName ?? "—"}</Mono></p>
                </Td>
                <Td>{service.planName}</Td>
                <Td align="center"><ServiceStatus status={service.status} /></Td>
                <Td align="right" mono>{formatCents(service.monthlyPrice)}</Td>
                <Td><Timestamp value={service.nextDueAt} time={false} /></Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </AdminSection>

      <AdminSection title="Facturas">
        <TableWrap>
          <thead>
            <tr>
              <Th>Número</Th>
              <Th>WHMCS</Th>
              <Th align="center">Estado</Th>
              <Th align="right">Total</Th>
              <Th>Vence</Th>
              <Th>Pagada</Th>
            </tr>
          </thead>
          <tbody>
            {detail.invoices.length === 0 ? <TableEmpty colSpan={6}>Sin facturas.</TableEmpty> : null}
            {detail.invoices.map((invoice) => (
              <tr key={invoice.id}>
                <Td mono><Maybe value={invoice.number} /></Td>
                <Td mono>{invoice.whmcsInvoiceId}</Td>
                <Td align="center">
                  <StatusBadge tone={invoice.status === "paid" ? "ok" : invoice.status === "unpaid" ? "warn" : "neutral"}>
                    {invoice.status}
                  </StatusBadge>
                </Td>
                <Td align="right" mono>{formatCents(invoice.total)}</Td>
                <Td><Timestamp value={invoice.dueAt} time={false} /></Td>
                <Td><Timestamp value={invoice.paidAt} time={false} /></Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </AdminSection>

      <AdminSection title="Créditos y señales de fraude" hint="Las señales se capturan al conceder el crédito de bienvenida.">
        <TableWrap>
          <thead>
            <tr>
              <Th>Concedido</Th>
              <Th>Motivo</Th>
              <Th align="right">Importe</Th>
              <Th align="right">Consumido</Th>
              <Th>Caduca</Th>
              <Th>Nota</Th>
              <Th>Señales</Th>
            </tr>
          </thead>
          <tbody>
            {detail.credits.length === 0 ? <TableEmpty colSpan={7}>Sin créditos.</TableEmpty> : null}
            {detail.credits.map((credit) => (
              <tr key={credit.id}>
                <Td><Timestamp value={credit.createdAt} /></Td>
                <Td>{CREDIT_REASON_LABELS[credit.reason] ?? credit.reason}</Td>
                <Td align="right" mono>{formatCents(credit.amount)}</Td>
                <Td align="right" mono>{formatCents(credit.consumed)}</Td>
                <Td><Timestamp value={credit.expiresAt} time={false} /></Td>
                <Td><Maybe value={credit.note} /></Td>
                <Td>
                  {credit.signals ? (
                    <dl className="space-y-0.5">
                      {Object.entries(credit.signals).map(([key, value]) => (
                        <div key={key} className="flex gap-2 text-xs">
                          <dt className="text-text-muted">{SIGNAL_LABELS[key] ?? key}</dt>
                          <dd className="font-mono">{value ?? "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <Muted>—</Muted>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        {withSignals.length > 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            Para buscar otras cuentas con la misma señal, usa la auditoría con la entidad «credit».
          </p>
        ) : null}
      </AdminSection>
    </>
  )
}
