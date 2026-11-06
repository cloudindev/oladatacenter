# Pedido atascado o con retraso

> **Regla número uno: nunca pedir dos veces.** Antes de reintentar cualquier cosa, averigua si
> OVH ya aceptó el pedido. Un pedido duplicado es un VPS que pagamos y nadie usa.

## Síntoma

- El cliente escribe diciendo que pagó y no tiene servidor.
- El pedido aparece en `/admin/pedidos` como **`provisioning`** desde hace más de 2 horas
  (`DELIVERY_SLA_HOURS`) o como **`delayed`**.
- Llegó el correo `order_delayed` al cliente (lo manda el propio job al pasar el SLA).
- Un pedido en **`failed`**.

Estados posibles: `draft → pending_payment → paid → provisioning → delivered`, con desvío a
`delayed` y salida a `failed`. Un pedido nunca se borra.

## Comprobación

1. **`/admin/pedidos/<id>`** — mira `status` y, sobre todo, **`completedSteps`**. Los pasos van en
   este orden y cada uno se guarda al terminar:

   | # | Paso | Qué significa si está hecho |
   |---|---|---|
   | 1 | `whmcs_client` | el cliente existe en WHMCS |
   | 2 | `whmcs_order` | hay pedido en WHMCS |
   | 3 | `whmcs_invoice` | hay factura |
   | 4 | `whmcs_payment` | **el dinero está registrado** |
   | 5 | `ovh_cart` | carrito creado en OVH |
   | 6 | `ovh_configure` | datacenter y OS puestos en el carrito |
   | 7 | `ovh_price_check` | el precio de OVH coincide con lo cotizado |
   | 8 | `ovh_checkout` | **OVH YA TIENE EL PEDIDO. No se vuelve a pedir.** |
   | 9 | `ovh_delivery` | OVH entregó el `serviceName` |
   | 10 | `ovh_first_boot` | arrancó y tiene IP |
   | 11 | `service_active` | el cliente ya lo ve activo |

2. **¿Está el paso 8 (`ovh_checkout`) en `completedSteps`?**
   - **Sí** → el pedido está puesto. Esto es una espera de entrega, no un fallo nuestro.
     Busca el `orderId` de OVH guardado en el pedido y consúltalo en el panel de OVH
     (`/me/order/{orderId}/status`). Si OVH dice `delivering`, hay que esperar.
   - **No** → el pedido no salió. Se puede reintentar sin riesgo de duplicar.

3. **Run de Inngest** — en el dashboard de Inngest busca la ejecución de `orders.provision` con
   el `correlationId` del pedido. Ahí está el error exacto del paso que falló.

4. **`auditLog`** filtrado por `entity = "order"` y ese `entityId`: la secuencia completa de lo
   que hizo el sistema, con quién la lanzó.

## Actuación

### Caso A — falló antes del paso 8
Relanza el job desde `/admin/pedidos/<id>` → **Reanudar aprovisionamiento**. El job es
idempotente: arranca en `nextProvisionStep(completedSteps)`, no repite lo ya hecho.

Si el error era un dato mal puesto (datacenter agotado, OS retirado del catálogo), corrige la
configuración del pedido antes de reanudar.

### Caso B — el paso 8 está hecho y OVH no entrega
No toques nada en OVH. Espera hasta `DELIVERY_TIMEOUT_HOURS` (24 h). El job sigue consultando
la entrega por su cuenta. Avisa al cliente con el tiempo estimado real.

Pasadas las 24 h, abre ticket a OVH con el `orderId` y deja el pedido en `delayed`
(no en `failed`: el dinero está cobrado y el pedido existe).

### Caso C — OVH rechazó el pedido o el `price_check` no cuadra
Si `ovh_price_check` falló, **OVH cambió el precio**. No fuerces el pedido: mira
`docs/runbooks/ovh-caido.md` → sección de deriva de catálogo, sincroniza el catálogo y vuelve a
cotizar. El cliente tiene que aceptar el precio nuevo o se le devuelve el dinero.

### Cuándo devolver el dinero
Devuelve (reembolso completo en Stripe + nota de crédito en WHMCS) cuando:

- el paso 8 **no** se completó y el pedido no se puede reponer en menos de 24 h; o
- OVH no tiene stock del plan/datacenter contratado; o
- pasaron 24 h desde el pago sin servidor y el cliente lo pide.

Nunca reembolses sin dejar el pedido en `failed` y una entrada en `auditLog` con el motivo.
Si el paso 8 sí se completó, **primero cancela el servicio en OVH**, o pagaremos un VPS
reembolsado.

## Cómo verificar que se arregló

- `/admin/pedidos/<id>` en **`delivered`** y `completedSteps` con los 11 pasos.
- El servicio existe en `/app/servidores` del cliente, en **`active`**, con IPv4.
- Salió el correo `server_ready` (compruébalo en `outbound_emails`).
- **Un solo** pedido en OVH para ese cliente y ese plan. Cuéntalos antes de cerrar la incidencia.
- `auditLog` tiene la entrada de la reanudación manual con tu usuario.
