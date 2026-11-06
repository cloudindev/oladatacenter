# WHMCS inaccesible (facturación caída)

> **Regla número uno: no se pierde ningún pedido y no se pierde ningún euro.** WHMCS es el libro
> de facturación, no la fuente de la verdad operativa. Si WHMCS no está, nosotros seguimos
> guardando el registro del dinero y lo conciliamos después.

## Síntoma

- Errores en los pasos `whmcs_client`, `whmcs_order`, `whmcs_invoice` o `whmcs_payment` de
  `completedSteps`.
- Pedidos que se quedan en `paid` sin pasar a `provisioning`.
- `panel.cloudin.pro` no carga, o la API devuelve HTML en vez de JSON.
- Reintentos repetidos de funciones `whmcs.*` en Inngest.

## Comprobación

1. ¿Es la aplicación o es la red?
   `curl -s -o /dev/null -w '%{http_code}\n' https://panel.cloudin.pro/cdin/includes/api.php`
   Un `200` con cuerpo de error de API es muy distinto de un timeout.
2. **Lo más frecuente no es una caída: es la lista blanca de IPs.** WHMCS filtra por IP y Vercel
   no tiene IP de salida fija. Por eso existe `WHMCS_PROXY_URL`, un proxy de IP fija. Si el error
   es `Invalid IP` o similar:
   - comprueba que `WHMCS_PROXY_URL` está puesto en producción y que el proxy está vivo;
   - comprueba que la IP del proxy sigue en la lista blanca de WHMCS (Setup → General →
     API IP Access Restriction).
3. Credenciales: `Authentication Failed` → `docs/runbooks/rotacion-claves.md`.
4. ¿Está la escritura desactivada a propósito? Si `WHMCS_WRITE_ENABLED=false`, el adaptador
   **se niega a escribir** y eso no es un fallo de WHMCS. Mira primero esa variable antes de
   diagnosticar nada.

## Qué sigue funcionando

- La web pública, el configurador y el checkout: el cobro en **Stripe es independiente de WHMCS**.
- El aprovisionamiento en OVH, si los pasos de WHMCS ya estaban hechos.
- El área de cliente: servicios, estado, acciones, saldo. Las facturas se muestran desde nuestras
  tablas (`invoices`, `payments`), no consultando WHMCS en vivo.

## Cómo se conserva el registro del dinero

Nada se apoya en que WHMCS esté disponible en el momento del cobro:

1. El pago se registra en **nuestra** tabla `payments` con el id de Stripe, y la factura en
   `invoices`. Esas filas son la prueba del cobro y **nunca se borran**.
2. Los pasos de WHMCS se persisten uno a uno en `orders.completedSteps`. El job se reanuda en
   `nextProvisionStep(...)`, así que al volver WHMCS continúa exactamente donde se quedó: no
   vuelve a crear el cliente ni duplica la factura.
3. Los eventos entrantes quedan en `webhookEvents`; los reintentos son idempotentes por el id del
   evento.
4. Si lo que falla es solo WHMCS, **el pedido sigue adelante**: el servidor se entrega y la
   factura se sincroniza después. El cliente no espera a nuestra contabilidad.

## Actuación

1. **No desactives los pedidos** por esto. La única razón para parar ventas es que OVH no pueda
   entregar.
2. Si el motivo es el proxy, levántalo o repón su IP en la lista blanca. Es el arreglo más rápido
   y el más común.
3. Si WHMCS está caído del todo, deja que los jobs reintenten. Avisa al responsable de
   facturación de que habrá que conciliar.
4. Si hay que escribir en WHMCS a mano (urgencia de un cliente), hazlo y **apunta el id** de lo
   que creaste; luego hay que marcarlo como hecho en el pedido para que el job no lo repita.
5. Mientras WHMCS no esté, no emitas facturas por otro medio: duplicarías numeración fiscal.

## Conciliación posterior

Cuando WHMCS vuelva:

1. Relanza los pedidos pendientes desde `/admin/pedidos` → **Reanudar**. Los pasos de WHMCS que
   faltan se ejecutan en orden.
2. Lista nuestros pagos de la ventana de caída (`payments` entre las dos fechas) y cruza con las
   facturas de WHMCS. Debe haber una factura por cada pago y ninguna de más.
3. Busca duplicados: dos clientes de WHMCS con el mismo correo, o dos facturas por el mismo
   `orderId`. Si el job se ejecutó a la vez que una escritura manual, aquí aparece.
4. Comprueba que los importes cuadran **con IVA** y que el tratamiento fiscal es el correcto
   (21 %, inversión del sujeto pasivo o fuera de ámbito, según `vatTreatment`).

## Cómo verificar que se arregló

- Una llamada de lectura a WHMCS a través del proxy responde JSON correcto.
- Ningún pedido en `paid` con más de 30 minutos de antigüedad.
- Todos los pedidos afectados en `delivered`, con los pasos 1-4 en `completedSteps`.
- `payments` y las facturas de WHMCS cuadran uno a uno en la ventana de la caída, sin duplicados.
- `WHMCS_WRITE_ENABLED=true` en producción y una escritura de prueba (crear y anular una factura
  de 0 €) funciona.
