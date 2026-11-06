# WHMCS — configuración para OLA VPS Cloud

Guía operativa para dejar WHMCS listo como **libro de contabilidad** de la plataforma.
Todo lo que hay aquí se hace una vez y se puede verificar. El código de la plataforma está en
inglés; este documento está en español porque lo ejecuta el operador.

- Panel: `https://panel.cloudin.pro/cdin/`
- API: `https://panel.cloudin.pro/includes/api.php`
- Versión soportada: WHMCS **8.13**

## 0. Cómo encaja

1. El cliente configura y paga en la plataforma. **El cobro lo hace Stripe**, nunca WHMCS.
2. La plataforma crea en WHMCS el cliente, el pedido y la factura, y después **registra** el
   pago ya cobrado (`AddInvoicePayment`).
3. El aprovisionamiento real lo hace la plataforma contra OVH. WHMCS **no** ejecuta ningún
   módulo de aprovisionamiento.
4. Si algo cambia dentro de WHMCS (factura pagada a mano, factura cancelada, datos de
   facturación editados), el hook `ola_vps.php` lo notifica a la plataforma.

Consecuencias que condicionan toda la configuración de abajo:

- WHMCS **nunca** envía correo a nuestros clientes: los correos son nuestros.
- WHMCS **nunca** borra nada. El adaptador no tiene ningún método de borrado, por diseño.
- Toda escritura está detrás de `WHMCS_WRITE_ENABLED=true` en la plataforma.

---

## 1. Credencial de API con rol limitado

No usar nunca la credencial de un administrador completo.

1. **Configuración → Administradores → Roles de administrador → Añadir rol**
   Nombre: `OLA VPS API`.
2. En el rol, marcar **solo** los permisos necesarios para gestionar clientes, pedidos,
   facturas y servicios. No marcar nada de "Configuración", "Módulos", "Plantillas" ni
   "Herramientas de utilidad".
3. Crear un administrador dedicado (p. ej. `ola-api`) con ese rol, sin acceso al panel
   (desmarcar la recepción de correos de administración).
4. **Configuración → Credenciales de API → Generar nueva credencial**, asignada a `ola-api`.
   Guardar `identifier` y `secret`: el `secret` solo se muestra una vez.
5. En la credencial, restringir las acciones permitidas a **esta lista exacta**:

| Acción WHMCS | Para qué la usamos | Método del puerto |
|---|---|---|
| `GetClients` | buscar cliente por email | `findClientByEmail` |
| `AddClient` | crear el cliente | `createClient` |
| `UpdateClient` | actualizar datos fiscales / estado | `updateClient` |
| `AddOrder` | crear pedido + factura | `createOrder` |
| `AcceptOrder` | aceptar el pedido sin aprovisionar | `acceptOrder` |
| `AddInvoicePayment` | registrar el pago cobrado en Stripe | `recordPayment` |
| `CreateInvoice` | facturas sueltas (prorrateos, ampliaciones) | `createInvoice` |
| `GetInvoice` | releer una factura | `getInvoice` |
| `GetInvoices` | listar facturas de un cliente | `listInvoices` |
| `UpdateClientProduct` | suspender / reactivar / fecha de renovación | `updateService` |
| `GetClientsProducts` | listar servicios de un cliente | `listServices` |
| `CreateSsoToken` | entrada sin contraseña al área de cliente | `createSsoToken` |

Opcional: `GetClientsDetails` (no se usa hoy, el esquema está preparado).

**No** habilitar ninguna acción `Delete*`, `Terminate*` masiva, `ModuleCreate`,
`ModuleTerminate`, ni nada de dominios.

> Verificación: una llamada con `action=DeleteClient` debe responder
> `{"result":"error","message":"API Command Restricted..."}`.

---

## 2. Lista blanca de IP y proxy de IP fija

WHMCS exige lista blanca de IP para la API. **Vercel no tiene IP de salida fija**, así que hay
dos escenarios y el adaptador funciona igual en los dos.

### 2.a Sin proxy (solo para servidores con IP fija)

**Configuración → Credenciales de API → Lista blanca de IP**: añadir la IP de salida.
En la plataforma: dejar `WHMCS_PROXY_URL` vacío.

### 2.b Con proxy de IP fija (producción en Vercel)

Poner en la lista blanca de WHMCS **solo la IP del proxy**, y en la plataforma
`WHMCS_PROXY_URL=https://…/forward`.

Contrato del proxy (lo cumple el adaptador, lo tiene que cumplir el proxy):

| Elemento | Valor |
|---|---|
| Método | `POST` |
| Cuerpo | `application/x-www-form-urlencoded`, **se reenvía byte a byte** |
| Cabecera `X-Target-Url` | URL real de `includes/api.php`. El proxy reenvía ahí |
| Cabecera `X-Ola-Correlation-Id` | id de correlación, solo para trazas |
| Respuesta | se devuelve el **código HTTP y el cuerpo sin modificar** |

Reglas obligatorias del proxy:

1. **Lista blanca de destino**: rechazar con `400` cualquier `X-Target-Url` que no sea
   exactamente `https://panel.cloudin.pro/includes/api.php`. Sin esto el proxy es un
   SSRF abierto.
2. **No registrar el cuerpo**: contiene `identifier` y `secret`. Registrar como máximo
   método, destino, código HTTP y duración.
3. **No reintentar**: los reintentos los decide el adaptador, que distingue las escrituras que
   no se pueden repetir (`AddOrder`, `AddInvoicePayment`, `CreateInvoice`).
4. **Tiempo de espera ≤ 20 s** y sin seguir redirecciones hacia otro host.
5. Acceso restringido: o bien red privada, o bien un token propio del proxy. El proxy no añade
   ni quita parámetros del formulario.

> Verificación: `curl` desde la IP del proxy debe responder `{"result":"success",...}`; el
> mismo `curl` desde otra IP debe responder `Invalid IP ...`.

---

## 3. Ajustes generales de WHMCS

1. **Configuración → Ajustes generales → Localización**
   - Zona horaria del servidor: **UTC**. El adaptador envía fechas en UTC
     (`YYYY-MM-DD HH:mm:ss`) y WHMCS las guarda tal cual.
   - Idioma por defecto: `spanish`.
2. **Moneda**: EUR como moneda por defecto y única. Si hay otras, dejarlas inactivas.
3. **Correos**: en el producto y en el grupo no activar ninguna plantilla de correo de
   cliente. El adaptador manda `noemail=1` y `noinvoiceemail=1` en todas las escrituras, pero
   la configuración debe ser coherente igualmente.
4. **Facturación → Generación de facturas**: dejar la generación automática de renovaciones
   **desactivada** para el grupo OLA VPS. Las renovaciones las decide la plataforma (dunning
   propio) y crea la factura por API.

---

## 4. Grupo de productos oculto «OLA VPS»

**Configuración → Productos/Servicios → Crear nuevo grupo**

| Campo | Valor |
|---|---|
| Nombre del grupo | `OLA VPS` |
| Cabecera / texto | vacío |
| Pasarelas disponibles | solo `Stripe` |
| **Oculto** | **sí** (marcado) |

El grupo está oculto porque el carrito de WHMCS no se usa nunca: el cliente solo ve
oladc.com. Si el grupo es visible, aparece una tienda paralela con precios que no controlamos.

---

## 5. Un producto por plan

Crear **un producto por plan comercial** (`MVP_PLAN_CODES` en `@ola/core`), todos en el grupo
`OLA VPS`:

| Pestaña | Ajuste |
|---|---|
| Detalles | Tipo: **Otro** (*Other*). Nombre: nombre comercial del plan |
| Detalles | **Oculto**: sí. **Requiere dominio**: no |
| Precios | Tipo de pago: **Recurrente**. Rellenar **Mensual** y **Anual** en EUR |
| Precios | Dejar el resto de ciclos vacíos: solo vendemos `monthly` y `annually` |
| Módulo | Ninguno (`None`). **Aprovisionamiento automático: no** |
| Otros | No marcar ninguna plantilla de correo de bienvenida |

Precios: el **precio real es el de la plataforma**. El adaptador manda
`priceoverride[0]` en cada pedido, así que el precio del producto solo es un valor de
referencia; aun así hay que mantenerlo alineado con el catálogo para que los informes de
WHMCS cuadren.

Apuntar el **id de producto (`pid`)** de cada plan y de cada ciclo: es lo que la plataforma
envía en `createOrder({ pid, billingcycle })`.

> Verificación: el `pid` aparece en la URL al editar el producto
> (`configproducts.php?action=edit&id=NN`).

---

## 6. Opciones configurables

**Configuración → Productos/Servicios → Opciones configurables → Crear nuevo grupo**
Nombre del grupo: `OLA VPS — configuración`. Asignarlo a **todos** los productos del grupo.

Crear estas opciones (nombres de cara al operador; el cliente nunca las ve):

| Opción | Tipo | Valores |
|---|---|---|
| `Datacenter` | Lista desplegable | un valor por cada datacenter vendible (`SELLABLE_DATACENTERS`) |
| `Sistema operativo` | Lista desplegable | un valor por cada imagen ofrecida |
| `Compromiso` | Lista desplegable | `Mensual`, `Anual` |
| `Backup automático` | Sí/No | obligatorio y con precio (nunca se vende un VPS sin él) |
| `Snapshot`, `IP adicional`, … | Sí/No o Cantidad | un addon por opción |

Todos los precios de estas opciones a **0,00 €**: el importe lo fija la plataforma con
`priceoverride`. Las opciones existen para que la factura y el servicio en WHMCS describan
exactamente lo que se vendió.

**Apuntar los ids numéricos** de cada opción y de cada valor. La plataforma los necesita para
`buildConfigOptions({ datacenter, os, term, addons }, …)`; se configuran en la plataforma, no
se escriben a mano en el código.

> Dónde se ven los ids: al editar una opción configurable, la URL lleva
> `configproducts.php?action=managecfoptions&cid=ID_OPCION`, y cada valor tiene su propio id
> en el formulario.

**Codificación en la API**: el adaptador envía `configoptions[0]` y `customfields[0]` como
`base64(serialize(array(id_opcion => id_valor)))`, que es el formato documentado por WHMCS
para `AddOrder`. No hace falta configurar nada para eso.

---

## 7. Campos personalizados

**Configuración → Productos/Servicios → Campos personalizados**, sobre los productos del grupo:

| Campo | Tipo | Uso |
|---|---|---|
| `Referencia OLA` | Texto | id del servicio en nuestra base de datos |
| `Servidor OVH` | Texto | `serviceName` de OVH, solo visible para administración |

Marcar los dos como **solo administración** (`Admin Only`). El `serviceName` de OVH nunca se
muestra al cliente.

Apuntar también el id numérico de cada campo: es la clave de `customfields`.

---

## 8. Impuestos

**Configuración → Facturación → Reglas de impuestos**. Activar los impuestos en
**Configuración → Ajustes generales → Impuestos** (`Enable Tax Support`).

1. **IVA España 21 %**
   - Nivel 1, País `Spain`, Estado: vacío (todos), Nombre `IVA`, Tasa `21.00`.
2. **Inversión del sujeto pasivo (UE con VAT válido)**
   - WHMCS aplica la exención por país, no por cliente, así que la decisión la toma la
     plataforma (`vatTreatment` en `@ola/core`) y se refleja al crear la factura:
     el adaptador manda `taxrate` solo cuando corresponde cobrar IVA.
   - Requisito: el `tax_id` del cliente en WHMCS solo se rellena **después** de validarlo en
     VIES (`customers.tax_id_validated`). Si no está validado, se cobra IVA.
   - En las facturas con inversión del sujeto pasivo, la plataforma añade la mención legal en
     las notas de la factura.
3. **Fuera del ámbito (fuera de la UE)**: sin impuesto, mismo mecanismo.
4. **Configuración → Ajustes generales → Impuestos**: activar la validación del número de IVA
   europeo solo como red de seguridad; la validación de verdad es la nuestra.

> Verificación: una factura creada con `taxRate: 21` para un cliente de España debe mostrar
> `IVA 21%`; la misma con `taxRate` ausente para un cliente alemán con VAT validado debe
> salir sin impuesto.

---

## 9. Pasarela Stripe registrada (aunque el cobro sea externo)

**Configuración → Pasarelas de pago → Gestionar pasarelas existentes → Stripe**: activarla.

Es obligatorio aunque **no se cobre nunca desde WHMCS**:

- `AddOrder` y `CreateInvoice` necesitan un `paymentmethod` válido; usamos `stripe`.
- `AddInvoicePayment` necesita un `gateway` existente para que el pago quede imputado a la
  pasarela correcta en los informes.

Configuración recomendada: claves de Stripe **en modo lectura o en blanco** si WHMCS lo
permite, y desactivar la captura automática y los recordatorios de pago de WHMCS. No hay que
configurar el webhook de Stripe en WHMCS: el webhook de Stripe apunta a la plataforma.

> Verificación: `AddInvoicePayment` con `gateway=stripe` responde `success` y el pago aparece
> en **Facturación → Transacciones** con esa pasarela.

---

## 10. Instalar el hook `ola_vps.php`

1. Copiar `whmcs-hook/ola_vps.php` del repositorio a **`<whmcs>/includes/hooks/ola_vps.php`**.
2. Editar las dos constantes de la cabecera del fichero:
   - `OLA_PLATFORM_URL` → `https://oladc.com` (sin barra final).
   - `OLA_WEBHOOK_SECRET` → el mismo valor que `WHMCS_WEBHOOK_SECRET` en la plataforma.
     Generarlo con `openssl rand -hex 32`.
3. Permisos `644`, propietario el del resto de `includes/hooks/`.
4. Requiere la extensión `php-curl` activa.

Qué hace:

| Hook de WHMCS | Evento enviado |
|---|---|
| `InvoicePaid` | `invoice.paid` |
| `InvoiceCancelled` | `invoice.cancelled` |
| `ClientEdit` | `client.updated` |

Petición: `POST {OLA_PLATFORM_URL}/api/webhooks/whmcs`, cuerpo JSON y tres cabeceras:

| Cabecera | Contenido |
|---|---|
| `X-Ola-Event-Id` | id estable (`evento:id:hash`). Si el mismo evento se repite, el id es igual y la plataforma lo descarta |
| `X-Ola-Timestamp` | segundos Unix |
| `X-Ola-Signature` | `sha256=` + HMAC-SHA256 hex de `timestamp + "." + cuerpo` |

La plataforma rechaza cualquier petición con firma incorrecta o con más de **5 minutos** de
antigüedad (`verifyWebhookSignature` en `packages/whmcs/src/webhook.ts`).

Si el envío falla, el hook **no rompe nunca el panel**: captura el error y lo escribe en
**Utilidades → Registros → Registro de actividad** con el prefijo `OLA VPS`.

> Verificación: marcar a mano una factura de prueba como pagada y comprobar que no aparece
> ninguna línea `OLA VPS webhook` en el registro de actividad (si aparece, dice el motivo).
> Para silenciar el hook temporalmente: `define('OLA_WEBHOOK_ENABLED', false);`.

---

## 11. Variables de entorno de la plataforma

```
WHMCS_API_URL=https://panel.cloudin.pro/includes/api.php
WHMCS_API_IDENTIFIER=...
WHMCS_API_SECRET=...
WHMCS_PROXY_URL=            # vacío si no hay proxy de IP fija
WHMCS_WRITE_ENABLED=false   # true solo cuando todo lo anterior esté verificado
WHMCS_WEBHOOK_SECRET=...    # idéntico a OLA_WEBHOOK_SECRET del hook
```

Con `WHMCS_WRITE_ENABLED=false` las lecturas funcionan y **toda** escritura falla con un error
claro sin llegar a llamar a WHMCS. Eso incluye `createSsoToken`, porque emite una credencial
dentro de WHMCS: en un entorno de pruebas sin escrituras hay que usar
`USE_MOCK_PROVIDERS=true`.

---

## 12. Prueba manual de la API

```bash
curl -sS https://panel.cloudin.pro/includes/api.php \
  -d identifier="$WHMCS_API_IDENTIFIER" \
  -d secret="$WHMCS_API_SECRET" \
  -d action=GetClients \
  -d limitnum=1 \
  -d responsetype=json
```

Respuestas y qué significan:

| Respuesta | Causa |
|---|---|
| `{"result":"success",...}` | todo bien |
| `Invalid IP ...` | la IP de origen no está en la lista blanca (paso 2) |
| `Authentication Failed` | `identifier`/`secret` incorrectos o credencial desactivada |
| `API Command Restricted` | la acción no está permitida en la credencial (paso 1) |
| HTML en lugar de JSON | falta `responsetype=json`, o el proxy no reenvía bien |

Para las listas vacías, WHMCS devuelve `"clients":{}` o `"clients":""` en lugar de un array
vacío; el adaptador ya lo normaliza a `[]`.

---

## 13. Lista de verificación final

- [ ] Rol `OLA VPS API` creado, con solo las 12 acciones de la tabla del paso 1.
- [ ] Credencial de API generada para `ola-api`; `secret` guardado en el gestor de secretos.
- [ ] `DeleteClient` responde `API Command Restricted`.
- [ ] Lista blanca de IP: solo la IP del proxy (o del servidor fijo).
- [ ] El proxy rechaza un `X-Target-Url` distinto del endpoint de WHMCS.
- [ ] Zona horaria del servidor en UTC; moneda EUR por defecto.
- [ ] Grupo `OLA VPS` creado y **oculto**.
- [ ] Un producto por plan, tipo *Otro*, oculto, sin módulo, con precio mensual y anual.
- [ ] `pid` de cada plan apuntado y configurado en la plataforma.
- [ ] Grupo de opciones configurables asignado a todos los productos, con precios a 0,00 €.
- [ ] Ids de las opciones configurables y de sus valores apuntados (datacenter, SO,
      compromiso, addons).
- [ ] Campos personalizados `Referencia OLA` y `Servidor OVH`, solo administración.
- [ ] Regla de impuestos IVA 21 % España activa.
- [ ] Pasarela Stripe activada y sin captura automática ni recordatorios.
- [ ] `ola_vps.php` en `includes/hooks/`, con `OLA_PLATFORM_URL` y `OLA_WEBHOOK_SECRET`.
- [ ] `WHMCS_WEBHOOK_SECRET` de la plataforma igual al del hook.
- [ ] `curl` de prueba responde `{"result":"success"}`.
- [ ] Factura de prueba pagada a mano: la plataforma recibe `invoice.paid` y no hay errores
      `OLA VPS` en el registro de actividad.
- [ ] `WHMCS_WRITE_ENABLED=true` **solo al final**, cuando todo lo anterior está marcado.
