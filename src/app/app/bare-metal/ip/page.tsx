import type { Metadata } from "next"
import Link from "next/link"
import { EmptyState, Eyebrow, Notice, PageTitle, Panel } from "@/components/app/ui"
import { WhmcsProductTable, WhmcsReadNotice } from "@/components/app/WhmcsProducts"
import { CopyField } from "@/components/servers/CopyField"
import { customerContext } from "@/server/services/customer"
import { load } from "@/server/services/load"
import { listServicesForCustomer } from "@/server/services/repository"
import { whmcsProductsOfKind } from "@/server/whmcs-products"

/**
 * Bare Metal Cloud → IP: the addresses of the customer's OLA servers, plus the extra IPs
 * contracted as their own product in WHMCS.
 */

export const metadata: Metadata = {
  title: "IP · Bare Metal Cloud · OLA",
}

export default async function IpPage() {
  const context = await customerContext()
  if (!context.ok) {
    return (
      <>
        <PageTitle>IP</PageTitle>
        <Notice tone="warn" title="No hemos podido cargar tus IP">
          {context.message}
        </Notice>
      </>
    )
  }

  const [servers, extra] = await Promise.all([
    load("listServicesForCustomer", () => listServicesForCustomer(context.customerId)),
    whmcsProductsOfKind(context.customerId, "ip"),
  ])
  const withIps = servers.ok
    ? servers.data.filter((service) => service.status !== "terminated" && (service.ipv4 || service.ipv6))
    : []

  return (
    <>
      <PageTitle description="Las direcciones de tus servidores y las IP adicionales que tienes contratadas.">
        IP
      </PageTitle>

      <section className="mb-8">
        <Eyebrow>Direcciones de tus servidores</Eyebrow>
        {!servers.ok ? (
          <Notice tone="warn" title="No hemos podido cargar tus servidores">
            {servers.message}
          </Notice>
        ) : withIps.length === 0 ? (
          <EmptyState>Tus servidores todavía no tienen IP asignada.</EmptyState>
        ) : (
          <Panel className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left">
                    {["Servidor", "IPv4", "IPv6", "Ubicación"].map((label) => (
                      <th key={label} scope="col" className="label-mono text-text-muted font-normal px-5 py-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withIps.map((service) => (
                    <tr key={service.id} className="border-b border-border-base last:border-b-0">
                      <td className="px-5 py-4">
                        <Link
                          href={`/app/servers/${service.id}`}
                          className="text-text-base hover:text-accent-ink underline-offset-4 hover:underline"
                        >
                          {service.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {service.ipv4 ? <CopyField value={service.ipv4} label="la IPv4" /> : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {service.ipv6 ? <CopyField value={service.ipv6} label="la IPv6" /> : "—"}
                      </td>
                      <td className="px-5 py-4 text-text-muted">{service.datacenterLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </section>

      {extra.state !== "not_linked" ? (
        <section>
          <Eyebrow>IP adicionales</Eyebrow>
          <WhmcsReadNotice read={extra} what="tus IP adicionales" />
          {extra.state === "ok" ? (
            <WhmcsProductTable
              items={extra.items}
              showIps
              empty={<EmptyState>No tienes IP adicionales contratadas.</EmptyState>}
            />
          ) : null}
        </section>
      ) : null}
    </>
  )
}
