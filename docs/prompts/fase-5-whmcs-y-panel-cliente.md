# Fase 5 — WHMCS como sistema financiero, OLA como experiencia del cliente

Eres el ingeniero responsable de OLA VPS Cloud (este repositorio, Next.js 16 + Supabase +
Drizzle + Inngest + Stripe + Resend + OVH + WHMCS). En esta fase dejas el sistema listo
para vender VPS reales con este reparto:

- **WHMCS** (`https://panel.cloudin.pro/cdin/`, versión 8.13) es el **sistema financiero y
  contable**: clientes, pedidos, facturas, pagos registrados, estado de cada servicio y
  cancelaciones. Las facturas oficiales son las suyas.
- **OLA** (oladc.com) es **todo lo que ve el cliente**: contratación, cobro con Stripe,
  panel para gestionar su VPS, lectura de sus facturas, cancelación y todas las
  comunicaciones por email, mejores que las de WHMCS. WHMCS no envía ningún email al cliente.
- **OVH** presta la infraestructura. Solo OLA habla con OVH.

Lee antes de escribir código: `AGENTS.md`, `docs/architecture.md`, `docs/decisions.md`,
`docs/operations.md`, `docs/whmcs-setup.md`, `docs/ovh-api-verified.md` y la guía de
Next.js en `node_modules/next/dist/docs/` para cualquier API de Next que toques. Esta
versión tiene cambios incompatibles con lo que conoces: `proxy.ts` en vez de middleware,
entre otros.

---

## 1. Reglas de trabajo (no negociables)

- **Pregunta antes de cualquier acción irreversible**: pedidos reales a OVH, cualquier
  escritura en el WHMCS de producción (está compartido con otros negocios de Cloudin),
  cobros o reembolsos reales en Stripe, borrados, migraciones que pierdan datos.
- **Secretos** solo en `.env.local` y en Vercel; `.env.example` siempre al día; nunca un
  secreto en un commit, un log, un email o el chat.
- **Cuando te bloquees**, presenta opciones con una recomendación y el coste de cada una. No
  decidas por mí en pagos, precios, fiscalidad, textos legales ni datos de clientes.
- **Nada de OVH, WHMCS ni Stripe fuera de sus adaptadores** (`packages/ovh`,
  `packages/whmcs`, `src/lib/stripe`). Cada acción o ruta nueva, verificada en la
  documentación oficial (WHMCS: developers.whmcs.com/api-reference) y anotada con fecha en
  el `docs/*-verified.md` que corresponda. Si una acción no existe o dudas, dilo y propón
  alternativa; no la inventes.
- **TypeScript strict**, sin `any`, sin `@ts-ignore`. ESLint del repo sin errores nuevos. El
  repo no tiene config de Prettier: respeta el estilo existente (sin punto y coma, ~100
  columnas) y **no reformatees archivos enteros**.
- Nombres de código en inglés; textos de interfaz y emails en español.
- Commits convencionales, pequeños y por tarea; una rama por subfase; PR con descripción
  de qué probar. Tras cada push: abre PR, espera los checks (build, test, typecheck,
  migrations, Vercel) y **fusiona tú** a `main`. El check `lint` está rojo por errores
  previos del marketing y no bloquea, pero tus archivos deben pasar ESLint.
- Cada decisión no obvia, en `docs/decisions.md` con fecha y motivo.
- Dinero siempre en céntimos enteros; fechas en UTC en base de datos y en WHMCS (zona del
  servidor WHMCS en UTC según `docs/whmcs-setup.md`), Europe/Madrid en emails y pantallas.
- Cada job (Inngest) idempotente y reanudable, con marca en la auditoría antes de cualquier
  llamada que mueva dinero o cree algo en WHMCS u OVH (patrón `ovh.checkout.attempt` de
  `src/inngest/jobs/provision.ts`).
- Comandos en esta máquina: antepone
  `unset NODE_OPTIONS; export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"`.

---

## 2. Punto de partida (lo que ya existe)

El diseño actual ya es "WHMCS como libro de contabilidad" (`docs/whmcs-setup.md`, sección 0):

- **Alta** (`src/inngest/jobs/provision.ts`): cobro con Stripe → `whmcs_client`
  (`GetClients`/`AddClient`) → `whmcs_order` (`AddOrder` con `noemail`/`noinvoiceemail`) →
  `whmcs_invoice` (`AcceptOrder`) → `whmcs_payment` (`AddInvoicePayment` del importe ya
  cobrado) → carrito, comprobación de precio y checkout en OVH → entrega → primer arranque
  con contraseña propia → servicio activo.
- **Adaptador** `packages/whmcs`, con todas las escrituras detrás de
  `WHMCS_WRITE_ENABLED=true` y sin ningún método de borrado. Acciones usadas: `GetClients`,
  `AddClient`, `UpdateClient`, `AddOrder`, `AcceptOrder`, `AddInvoicePayment`,
  `CreateInvoice`, `GetInvoice`, `GetInvoices`, `UpdateClientProduct`,
  `GetClientsProducts`, `CreateSsoToken`.
- **Hook** `ola_vps.php` en WHMCS que avisa a OLA de cambios hechos dentro de WHMCS
  (factura pagada a mano, cancelada, datos editados), recibido en
  `src/app/api/webhooks/whmcs/`.
- **Proxy de IP fija** (`WHMCS_PROXY_URL`), porque WHMCS exige lista blanca de IP y Vercel
  no tiene IP de salida fija. Comprueba si está desplegado; si no, es lo primero.
- **Renovación e impago** (`packages/core/src/dunning/schedule.ts`,
  `src/inngest/jobs/renewals.ts`): T-7 factura en WHMCS y email, T-0 cobro Stripe
  `off_session`, reintentos en T+1 y T+3, suspensión en T+3, baja en OVH en T+10.
- **Emails** con plantillas React en `packages/email/src/`, enviados por Resend desde
  `cloud@oladc.com` (dominio verificado) y registrados en `outbound_emails`.
- **Producción hoy**: `USE_MOCK_PROVIDERS=true` porque faltan las credenciales de WHMCS (ese
  interruptor simula OVH y WHMCS a la vez). Las claves de OVH ya son reales y válidas
  (comprobado el 2026-11-06); `OVH_ORDERS_ENABLED=false`.
- **La cuenta de OVH** también tiene los VPS propios de Cloudin (6 el 2026-11-06, quizá 7). El
  aprovisionamiento ya los excluye (ver la decisión del 2026-11-06 sobre la identificación
  del VPS entregado). OVH envía sus emails de entrega al contacto de la cuenta
  (`hola@cloudin.pro`), nunca al cliente; no los reenvíes jamás.

---

## 3. Decisiones ya tomadas (2026-11-06) y lo que queda abierto

Regístralas en `docs/decisions.md` al empezar. No las reabras salvo que encuentres un
impedimento técnico; en ese caso explícamelo con alternativas.

**Tomadas:**

1. **Facturas: las de WHMCS, con su numeración.** No hay serie propia de OLA ni se toca la
   configuración de numeración de WHMCS.
2. **Cliente identificado por email.** Si el email ya existe en WHMCS, el pedido se asigna a
   ese cliente; si no, se crea. Es seguro porque el checkout de OLA exige email verificado
   (`not_verified` en `src/server/billing/checkout.ts`): mantén y prueba ese bloqueo.
3. **Datos fiscales de un cliente existente: mandan los de WHMCS.** Al vincularlo, OLA copia
   sus datos de WHMCS (`GetClientsDetails`) y se los muestra para que los confirme antes de
   pagar. Si los cambia en OLA, se actualizan en WHMCS (`UpdateClient`). Nada se
   sobrescribe sin que el cliente lo vea.
4. **Cobro de renovaciones: OLA con Stripe** (opción ya construida). OLA cobra la tarjeta
   guardada `off_session` y registra el pago en la factura de WHMCS (`AddInvoicePayment`).
   WHMCS no cobra ni genera renovaciones automáticas para el grupo OLA VPS.
5. **Facturas en el panel de OLA, solo las de servicios OLA.** OLA lista las facturas del
   cliente filtradas por los productos del grupo OLA VPS (sus otras facturas de Cloudin no
   aparecen) y abre cada una en WHMCS con `CreateSsoToken` hacia `viewinvoice.php?id=…`.
   Por cada factura emitida o pagada, OLA envía su propio email con el enlace. WHMCS no
   envía nada al cliente. Verifica que `CreateSsoToken` admite esa ruta de destino; si no,
   propón alternativa.
6. **Cancelación desde el panel: al final del periodo pagado, sin reembolso.** El servidor
   sigue hasta el último día pagado, no se renueva ni en WHMCS ni en OVH, y el cliente puede
   deshacer la cancelación hasta esa fecha. Verifica cómo reflejarlo en WHMCS
   (`AddCancelRequest` con tipo "End of Billing Period" o `UpdateClientProduct`, y su efecto
   en facturas pendientes) y en OVH (`deleteAtExpiration` en `serviceInfos`). Con compromiso
   de 12 meses, el servicio sigue hasta el final del compromiso.
7. **Calendario de renovación e impago** (T = día de vencimiento):
   - T-7: factura de renovación en WHMCS y aviso de renovación con importe y fecha.
   - T-3: **recordatorio de pago**.
   - T-0: cobro.
   - T+1 y T+3: reintentos con email de cobro fallido y enlace de pago.
   - T+3: servidor parado (suspendido).
   - T+7: **aviso de que en T+10 se da de baja y se borran los datos**.
   - T+10: baja en OVH y en WHMCS.

   Pagando antes de T+10, se reactiva al momento. Actualiza
   `packages/core/src/dunning/schedule.ts`, sus tests y el job de renovaciones.
8. **Solo empresas por ahora.** No se vende a particulares hasta tener los textos legales y
   el desistimiento resueltos. El registro y el checkout deben exigir razón social y
   NIF/VAT (con validación VIES para la UE fuera de España) y bloquear la compra sin ellos,
   con un mensaje claro. Deja preparado, pero desactivado tras un feature flag, el flujo
   para particulares (casilla de inicio inmediato del servicio y textos de desistimiento
   como borrador).
9. **Panel del VPS v1 completo**, con todo esto:
   - **Básico**: encender, apagar, reiniciar, reinstalar sistema, consola web, contraseña
     root y claves SSH.
   - **Copias**: copias automáticas y restauración, snapshot manual y volver a él.
   - **Red y seguridad**: DNS inverso, firewall de red, estado anti-DDoS, IPs.
   - **Gráficas y ampliación**: uso de CPU, RAM, disco y tráfico, y ampliar a un plan
     superior.

   Haz primero un inventario de lo que ya existe y funciona, y construye solo lo que falte.

**Abiertas (investiga y tráeme opciones; no bloquean el resto):**

- **Verifactu.** WHMCS es el sistema de facturación, así que su cumplimiento (obligatorio
  para sociedades a partir de 2027 según el último aplazamiento conocido; confirma la fecha
  en el BOE) depende de la instalación de WHMCS: módulo, proveedor y modalidad. Resume las
  opciones; no es código de OLA.
- **Licencia de Plesk.** Comprueba en el esquema público de OVH si la licencia contratada
  como opción del VPS expone una clave (`/license/plesk/*` u opciones del VPS) o solo se
  activa en la imagen. Si hace falta un permiso de API nuevo, dime cuál.
- **Documentos contractuales para empresas**: condiciones generales, condiciones del
  servicio VPS (SLA, copias, límites), uso aceptable, privacidad y encargo del tratamiento
  (art. 28 RGPD). Yo aporto o valido los textos; tú dejas borradores marcados como tales y
  el mecanismo de versiones y aceptación.

---

## 4. Subfases

### F5.1 WHMCS de producción conectado, sin vender todavía

- Proxy de IP fija desplegado y en la lista blanca de WHMCS (`docs/whmcs-setup.md` §2.b).
- Rol de API con la lista exacta de acciones de §2 de este prompt, más `AddCancelRequest` y
  `GetClientsDetails`. Ninguna acción `Delete*` ni
  `Module*`. Verificación: `DeleteClient` debe responder "API Command Restricted".
- Grupo oculto «OLA VPS», un producto por plan, opciones configurables, campos
  personalizados, impuestos y pasarela según `docs/whmcs-setup.md`; generación automática
  de facturas de renovación y emails al cliente desactivados en ese grupo.
- Hook `ola_vps.php` instalado y firmado. Prueba que cada evento llega y se procesa una vez.
- Separa los interruptores para que OVH y WHMCS se activen por separado
  (`USE_MOCK_PROVIDERS` hoy los activa a la vez) y documenta la tabla de variables.
- Una prueba manual de lectura (`GetClients` por email) antes de cualquier escritura. La
  primera escritura real, con mi permiso, sobre un cliente de prueba marcado como tal.

### F5.2 Alta de punta a punta contra WHMCS real

- Revisa cada paso `whmcs_*` contra la API real: campos obligatorios, formato de fechas,
  `noemail`, impuestos (España 21 %, UE B2B con VIES inversión del sujeto pasivo, UE B2C y
  fuera de la UE según `packages/core/src/pricing/vat.ts`), y que el importe de la factura
  de WHMCS coincide al céntimo con lo cobrado en Stripe. Si no coincide, el pedido se para y
  se avisa; nunca se ajusta en silencio.
- Anota en `docs/whmcs-api-verified.md` cada acción con la respuesta real observada y la
  fecha.
- Pedido real completo solo con mi permiso y con `OVH_ORDERS_ENABLED=true` puntualmente.
  Aprovecha para verificar el campo `domain` de `GET /me/order/{orderId}/details/{detailId}`
  en OVH (pendiente en `docs/decisions.md`).

### F5.3 Renovaciones, impagos y conciliación (OLA ↔ WHMCS ↔ OVH)

Con el calendario de la decisión 7:

- **T-7**: factura de renovación en WHMCS (`CreateInvoice`) y email de OLA con importe,
  fecha y enlace a la factura. **T-3**: recordatorio de pago.
- **T-0**: cobro `off_session` con clave de idempotencia por servicio y periodo,
  `AddInvoicePayment` y email de cobro realizado.
- **Si falla**: reintentos; acción requerida por 3DS con enlace a una página de pago del
  panel (Payment Element que completa el mismo PaymentIntent); suspensión (OVH `stop`,
  WHMCS `UpdateClientProduct` suspendido, email); reactivación inmediata al pagar; baja en
  la fecha límite (OVH `deleteAtExpiration`, cancelación en WHMCS, email), con aviso previo
  en T+7.
- **Conciliación diaria**: un job compara servicios de OLA, productos de WHMCS y VPS de OVH
  (estado, próxima renovación, importe, renovación automática) y abre alertas en el admin
  ante cualquier diferencia: una factura pagada en WHMCS sin servicio activo, un VPS que OVH
  va a renovar y el cliente ya no paga, etc. Solo informa; no corrige nada sola.
- Aviso de tarjeta a punto de caducar (30 días antes).
- Usa los relojes de prueba de Stripe (test clocks) y dobles de WHMCS y OVH para un test de
  integración del calendario completo.

### F5.4 Cancelación desde el panel

- Botón "Cancelar servidor" con confirmación clara: qué pasa, cuándo se para y cuándo se
  borran los datos.
- Refleja la cancelación en WHMCS (para que deje de facturar) y en OVH (no renovar), con
  auditoría y email.
- Opción de deshacer la cancelación hasta la fecha efectiva.
- Si el servicio tiene compromiso de 12 meses, la cancelación surte efecto al final del
  compromiso (decisión 6).

### F5.5 Comunicaciones (todas desde OLA)

Plantillas en `packages/email`, con versión de texto plano, registradas en
`outbound_emails` y probadas con snapshot. Remitente `OLA <cloud@oladc.com>`, `Reply-To` a
soporte.

- **Confirmación de contratación**: resumen del pedido, enlace a la factura (decisión 5) y documentos contractuales con su versión. Guarda en el pedido qué versión de
  cada documento aceptó el cliente y cuándo (hash del texto, fecha, IP).
- **Servidor listo**: nombre, IPv4, IPv6, sistema, ubicación, usuario y acceso a la
  contraseña. **La contraseña nunca va en el email**: va un enlace de un solo uso al panel,
  como hace el flujo actual. Comprueba que siga así.
- **Plesk**, si se contrató: acceso al panel y qué incluye (10 dominios Web Admin, 30 Web
  Pro, ilimitados Web Host) y la licencia si se confirma que OVH expone una clave.
- Aviso de renovación (T-7), recordatorio de pago (T-3), cobro realizado, cobro fallido con enlace de pago, acción requerida
  (3DS), servidor suspendido, aviso de borrado (T+7), baja realizada, cancelación confirmada,
  tarjeta a punto de caducar, reembolso.
- Comprueba con una herramienta de pruebas de envío que no caen en spam (SPF y DKIM de
  `send.oladc.com`, DMARC estricto en `oladc.com`).

### F5.6 Panel del cliente

- **Facturas**: solo las de servicios OLA, leídas de WHMCS (`GetInvoices`/`GetInvoice`) con
  una copia local en la tabla `invoices` para que el panel no dependa de que WHMCS
  responda; estado, importe y acceso al documento por SSO (decisión 5).
- **Datos de facturación** editables en OLA y enviados a WHMCS (`UpdateClient`); los cambios
  hechos en WHMCS llegan por el hook. Valida el VAT con VIES. Aclara en pantalla que solo
  afectan a facturas futuras.
- **Métodos de pago**: añadir, elegir el predeterminado y eliminar; no se puede eliminar el
  único método de un servicio activo.
- **Gestión del VPS**: completa la lista de la decisión 9. Cada acción pasa por el
  adaptador de OVH, queda auditada y muestra su progreso (tareas de OVH).
- Por servicio: próxima renovación, importe, compromiso, renovación automática on/off,
  cancelación y aviso visible si está en impago, con botón de pago.

### F5.7 Panel de administración

- Vista de conciliación con las alertas de F5.3 y un "volver a sincronizar" por servicio.
- Por pedido y servicio: enlaces directos a su cliente, pedido, factura y producto en WHMCS
  y a su VPS en OVH.
- Reenviar cualquier email al cliente.
- Toda acción con fila de auditoría (un test lo exige en
  `src/server/admin/__tests__/actions.test.ts`).

### F5.8 Pruebas y puesta en marcha

- Tests de cada paso con dobles de WHMCS, OVH y Stripe, y un test de extremo a extremo de
  alta, renovación, impago y cancelación.
- Lista de salida a producción en `docs/operations.md`: credencial y rol de WHMCS, proxy,
  hook, grupo y productos, Verifactu resuelto en WHMCS, venta solo a empresas activa, textos legales
  aprobados, webhooks de Stripe, `OVH_ORDERS_ENABLED`, alertas, copias de la base de datos
  y procedimiento de incidencias.

---

## 5. Criterios de aceptación

- Un alta real deja en WHMCS un cliente, un pedido, una factura pagada con el importe
  exacto cobrado en Stripe y un producto activo; en OVH el VPS correcto; en OLA el servicio
  activo; y el cliente recibe solo emails de OLA.
- Un ciclo de renovación y uno de impago, con reloj simulado, mantienen OLA, WHMCS y OVH en
  el mismo estado en cada paso.
- Una cancelación desde el panel detiene la facturación en WHMCS y la renovación en OVH en
  la fecha acordada.
- El cliente ve y abre sus facturas desde OLA.
- La conciliación diaria no da diferencias en el escenario feliz y las detecta en los
  escenarios de prueba.
- Typecheck, tests, build y migraciones en verde. Decisiones documentadas. `.env.example`
  al día.

Empieza por leer el código y los documentos señalados y responde con: (1) el inventario del
panel del VPS (qué existe y qué falta); (2) un plan de PRs por subfase; (3) los riesgos que
veas y lo que hayas averiguado de los temas abiertos. Después empieza por F5.1. No escribas
en el WHMCS de producción sin mi permiso.
