import { notFound } from "next/navigation"
import { DataRow, Notice, Panel, SectionTitle, StatusBadge } from "@/components/app/ui"
import { CopyField } from "@/components/servers/CopyField"
import { FirewallActivation } from "@/components/servers/FirewallActivation"
import { FirewallRuleForm } from "@/components/servers/FirewallRuleForm"
import { FirewallRules } from "@/components/servers/FirewallRules"
import { RdnsForm } from "@/components/servers/RdnsForm"
import { StatusGateNotice } from "@/components/servers/StatusGateNotice"
import { load } from "@/server/services/load"
import { actionGate, serviceForPage } from "@/server/services/page-data"
import { fetchNetwork } from "@/server/services/provider"

/**
 * Red: IPs, rDNS, the OVH network firewall and the anti-DDoS state.
 *
 * The firewall here is OVH's, in front of the server — it filters before the traffic
 * ever reaches the machine, and it is a different thing from the firewall inside the
 * operating system. The page says so, because mixing them up is the usual mistake.
 */
export default async function NetworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const page = await serviceForPage(id)
  if (page.state === "missing") notFound()
  if (page.state === "unavailable") return null

  const { service } = page
  const can = actionGate(service)
  const network = await load("fetchNetwork", () => fetchNetwork(service.ovhServiceName))

  if (!network.ok) {
    return (
      <div className="space-y-8">
        <StatusGateNotice status={service.status} />
        <Notice tone="warn" title="No hemos podido cargar la configuración de red">
          {network.message}
        </Notice>
      </div>
    )
  }

  const { ips, reverses, firewall, firewallRules, firewallRuleSequences, mitigation } =
    network.data
  const v4 = ips.filter((ip) => ip.version === 4)
  const v6 = ips.filter((ip) => ip.version === 6)
  const mainIpv4 = v4.find((ip) => !ip.isBlock) ?? null
  const reverseOf = (address: string) =>
    reverses.find((entry) => entry.ip === address)?.hostname ?? null

  return (
    <div className="space-y-8">
      <StatusGateNotice status={service.status} />

      <Panel>
        <SectionTitle>Direcciones</SectionTitle>
        <dl>
          {v4.map((ip) => (
            <DataRow key={ip.address} label={ip.isBlock ? "Bloque IPv4" : "IPv4"}>
              <CopyField value={ip.address} label="la dirección" />
            </DataRow>
          ))}
          {v6.map((ip) => (
            <DataRow key={ip.address} label={ip.isBlock ? "Bloque IPv6" : "IPv6"}>
              <CopyField value={ip.address} label="la dirección" />
            </DataRow>
          ))}
          {ips.length === 0 ? (
            <DataRow label="Direcciones">Todavía no hay direcciones asignadas</DataRow>
          ) : null}
        </dl>
      </Panel>

      <Panel>
        <SectionTitle>DNS inverso</SectionTitle>
        <p className="mb-2 text-sm text-text-muted leading-relaxed max-w-2xl">
          Antes de poner un rDNS, crea un registro A o AAAA que apunte ese nombre a esta
          IP. Si no coincide, el proveedor rechaza el cambio.
        </p>
        {v4.filter((ip) => !ip.isBlock).length === 0 ? (
          <p className="text-sm text-text-muted">
            El rDNS se configura sobre direcciones individuales.
          </p>
        ) : (
          v4
            .filter((ip) => !ip.isBlock)
            .map((ip) => (
              <RdnsForm
                key={ip.address}
                serviceId={service.id}
                ip={ip.address}
                currentHostname={reverseOf(ip.address)}
                allowed={can("rdns_set")}
              />
            ))
        )}
      </Panel>

      <Panel>
        <SectionTitle>Firewall de red</SectionTitle>
        <p className="mb-6 text-sm text-text-muted leading-relaxed max-w-2xl">
          Este cortafuegos está en la red del proveedor, delante del servidor: filtra el
          tráfico antes de que llegue a la máquina. No sustituye al cortafuegos del
          sistema operativo. Las reglas se evalúan por posición, de la 0 a la 19, y se
          aplica la primera que coincide.
        </p>

        {!mainIpv4 ? (
          <p className="text-sm text-text-muted">
            El firewall de red se configura sobre la IPv4 del servidor.
          </p>
        ) : firewall !== "on" ? (
          <FirewallActivation
            key={firewall}
            serviceId={service.id}
            ip={mainIpv4.address}
            initial={firewall}
            allowed={can("firewall_rule_add")}
          />
        ) : (
          <>
            <div className="mb-8">
              <FirewallRules
                serviceId={service.id}
                ip={mainIpv4.address}
                sequences={firewallRuleSequences}
                rules={firewallRules}
                allowed={can("firewall_rule_delete")}
              />
            </div>
            <h3 className="label-mono text-text-muted mb-4">Nueva regla</h3>
            <FirewallRuleForm
              serviceId={service.id}
              ip={mainIpv4.address}
              usedSequences={firewallRuleSequences}
              allowed={can("firewall_rule_add")}
            />
          </>
        )}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <SectionTitle>Protección anti-DDoS</SectionTitle>
          <StatusBadge tone={mitigation.active ? "warn" : "ok"}>
            {mitigation.active ? "Mitigación en curso" : "Vigilancia permanente"}
          </StatusBadge>
        </div>
        <p className="text-sm text-text-muted leading-relaxed max-w-2xl">
          {mitigation.active ? (
            <>
              Ahora mismo el tráfico de tu IP está pasando por los filtros de limpieza
              {mitigation.permanent ? " de forma permanente" : " porque se ha detectado un ataque"}.
              Es normal notar algo más de latencia mientras dura. No tienes que hacer nada.
            </>
          ) : (
            <>
              La protección está siempre activa y vigilando. Cuando se detecta un ataque,
              el tráfico de tu IP se desvía automáticamente a los filtros de limpieza y
              vuelve a la normalidad al terminar. No hay nada que configurar.
            </>
          )}
        </p>
      </Panel>
    </div>
  )
}
