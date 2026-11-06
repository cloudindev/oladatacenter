# Cobro de renovación fallido (dunning)

El calendario está en `dunningSchedule` (`packages/core/src/dunning/schedule.ts`) y es relativo a
`next_due_at` (T). No lo improvises: el job lo ejecuta tal cual.

| Momento | Qué hace el sistema | Qué ve el cliente | Estado del servidor |
|---|---|---|---|
| T-7 | emite factura en WHMCS | correo `renewal_upcoming`, factura pendiente en `/app/facturas` | activo |
| T-0 | cobro off-session en Stripe | nada si va bien | activo |
| T+1 | reintento 1 | correo `payment_failed`, aviso en el panel | **activo** |
| T+3 | reintento 2; si falla, **suspende** | correo `service_suspended` | **suspended** (apagado) |
| T+10 | marca no renovación en OVH | correo `service_terminating` | `terminating` |

Pagar en cualquier momento **antes de T+10** reactiva el servidor (`canReactivate`).
A partir de `terminating` ya no hay vuelta atrás por autoservicio.

## Síntoma

- El cliente dice que su servidor está apagado y que su tarjeta funciona.
- `/admin/pedidos` → vista de servicios: servicio en **`suspended`**.
- Factura en `unpaid` con `next_due_at` pasado.
- Varias filas en `payments` con error para el mismo servicio.

## Comprobación

1. **Etapa real del dunning**: `services.dunningCompleted` (lista de etapas ya ejecutadas:
   `invoiced`, `charging`, `retry_1`, `retry_2`, `suspended`, `terminating`, `paid`).
   `pendingStep(dueAt, now, dunningCompleted)` dice qué toca ahora.
2. **Motivo del rechazo**: en `payments`, el código de error de Stripe.
   - `insufficient_funds`, `card_declined` → es del banco del cliente.
   - `authentication_required` → el banco pide SCA: un cobro off-session no puede resolverlo,
     hay que mandar al cliente a pagar la factura a mano.
   - `expired_card`, `card_not_supported` → el cliente tiene que cambiar el método de pago.
3. **¿Hay saldo?** `customerCredit(customerId)`: si hay crédito sin usar, el cobro debería
   haberlo aplicado antes de ir a la tarjeta. Si no lo aplicó, es un bug nuestro; no lo tapes
   con un cobro manual, abre incidencia.
4. **Correos enviados**: `outbound_emails` filtrado por el cliente. Si falta el
   `payment_failed`, el cliente no sabe nada y hay que avisarle antes de cualquier otra cosa.

## Actuación

### Reintentar el cobro a mano
1. `/admin/pedidos` → servicio → **Reintentar cobro**. Lanza el mismo paso del job, no un cobro
   paralelo: queda registrado en `payments` y en `auditLog`.
2. Si Stripe pide SCA, manda al cliente el enlace de la factura (`/app/facturas`) para que pague
   on-session. Nunca pidas datos de tarjeta por teléfono ni por correo.

### Cambiar el método de pago
Lo hace el cliente desde `/app/cuenta` → métodos de pago. Nosotros no introducimos tarjetas.
Tras añadir una nueva, reintenta el cobro.

### Reactivar un servidor suspendido
1. Confirma que la factura está **`paid`**.
2. `/admin/pedidos` → servicio → **Reactivar**. Hace la transición `suspended → active` y manda
   el arranque a OVH; el estado se sigue con la tarea de OVH, no al instante.
3. Si el servicio ya está en `terminating`, **no** se reactiva desde aquí: hay que retirar la
   marca de no renovación en OVH (`PUT /vps/{serviceName}/serviceInfos`) y eso se hace a mano,
   con criterio comercial, porque puede que OVH ya lo haya borrado.

### Dar margen comercial
Si decides esperar (cliente bueno, problema bancario pasajero), mueve `next_due_at` en vez de
desactivar el dunning. El job recalcula todo el calendario desde la nueva fecha.

## Cómo verificar que se arregló

- La factura en **`paid`** y una fila en `payments` con éxito.
- El servicio en **`active`** en `/app/servidores` del cliente y respondiendo a ping/SSH.
- `services.dunningCompleted` incluye `paid` y `next_due_at` apunta al periodo siguiente
  (`nextDueDate`).
- No queda ninguna etapa pendiente: `pendingStep(...)` devuelve `null`.
- `auditLog` registra quién reintentó o reactivó.
