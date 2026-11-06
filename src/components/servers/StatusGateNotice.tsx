import { Notice } from "@/components/app/ui"
import type { ServiceStatus } from "@ola/core"

/**
 * Why this screen has no buttons.
 *
 * `allowedActions` in `@ola/core` decides it, and it is deliberate: a suspended server
 * must not be restartable from the panel, and a server being created or cancelled is
 * not ours to touch yet. The customer gets told which of those it is.
 */
export function StatusGateNotice({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "suspended":
      return (
        <Notice tone="danger" title="El servidor está suspendido">
          Mientras esté suspendido no se pueden hacer operaciones sobre él. Tus datos se
          conservan. En cuanto quede resuelta la factura pendiente lo reactivamos y
          volverás a tener el control completo.
        </Notice>
      )
    case "provisioning":
      return (
        <Notice tone="busy" title="Estamos creando el servidor">
          Tardará unos minutos. Cuando esté listo te avisamos por correo y aquí aparecerán
          todas las acciones.
        </Notice>
      )
    case "review":
      return (
        <Notice tone="warn" title="El servidor está en revisión">
          Hemos detectado algo que tenemos que comprobar a mano y lo hemos dejado parado.
          Escríbenos y lo resolvemos contigo.
        </Notice>
      )
    case "terminating":
      return (
        <Notice tone="warn" title="El servidor se está dando de baja">
          Ya no se pueden hacer operaciones sobre él.
        </Notice>
      )
    case "terminated":
      return (
        <Notice tone="neutral" title="El servidor está dado de baja">
          Lo mantenemos en el historial para tus facturas, pero la máquina ya no existe.
        </Notice>
      )
    default:
      return null
  }
}

/** True when the status allows nothing at all. */
export function isReadOnlyStatus(status: ServiceStatus): boolean {
  return status !== "active" && status !== "stopped"
}
