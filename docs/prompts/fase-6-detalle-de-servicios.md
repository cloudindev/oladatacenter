# Fase 6 — Vistas de detalle: dominios, alojamiento web y VPS

Eres el ingeniero responsable de OLA VPS Cloud (este repositorio: Next.js 16, Supabase, Drizzle,
Inngest, Stripe, Resend, OVH y WHMCS). Esta fase convierte las listas de productos del área de
cliente en **fichas de gestión completas**, con el nivel de opciones de los paneles de referencia
del sector:

- **Dominios:** como Dinahosting o DonDominio.
- **Alojamiento web:** con acceso a Plesk ya identificado, como el botón «Acceder a Plesk» del
  área de cliente de WHMCS.
- **VPS:** como el gestor de OVHcloud.

Tomas prestadas las **opciones y la organización**, no el aspecto: el lenguaje visual sigue siendo
el de oladc.com.

Antes de escribir código, lee estos documentos:

- `AGENTS.md`
- `docs/architecture.md`
- `docs/decisions.md`, completo: hay decisiones de esta misma semana que condicionan esta fase.
- `docs/ovh-api-verified.md`
- `docs/whmcs-setup.md`
- La guía de Next.js en `node_modules/next/dist/docs/`: esta versión tiene cambios incompatibles.

---

## 1. Reglas de trabajo (no negociables)

- **Pregunta antes de cualquier acción irreversible o con coste:**
  - pedidos o renovaciones reales (OVH, registradores, WHMCS);
  - cambios en DNS reales;
  - reinstalaciones, borrados y bajas;
  - cualquier escritura en el WHMCS o el Plesk de producción;
  - migraciones que pierdan datos.
- **Secretos:** solo en `.env.local` y en Vercel. Nunca en commits, logs, emails ni en el chat.
  `.env.example` siempre al día.
- **Si te bloqueas,** presenta opciones con una recomendación y el coste de cada una. No decidas
  por mí en precios, pagos, datos de clientes ni proveedores.
- **Nada de OVH, WHMCS, Plesk ni registradores fuera de sus adaptadores** (`packages/*`).
  - Cada ruta o acción nueva se verifica en la documentación o el esquema oficial, y se anota con
    fecha en el `docs/*-verified.md` correspondiente.
  - Si algo no existe o tienes dudas, dilo y propón una alternativa. No lo inventes.
  - Comprueba también qué responde el sistema real con una llamada de **solo lectura**: en esta
    instalación varias funciones de WHMCS no están disponibles (ver §3).
- **Código:**
  - TypeScript estricto, sin `any` ni `@ts-ignore`.
  - Tus archivos deben pasar ESLint. El check `lint` del CI está rojo por errores antiguos del
    marketing; no lo empeores.
  - El repo no tiene configuración de Prettier: respeta el estilo existente y no reformatees
    archivos enteros.
  - Nombres de código en inglés; textos de interfaz y emails en español.
- **Commits y PR:**
  - Commits convencionales, pequeños y por tarea; una rama por bloque.
  - Cada PR describe qué probar.
  - Tras el push: abre el PR, espera los checks (build, test, typecheck, migrations, Vercel) y
    **fusiona tú**.
- **Decisiones no obvias:** en `docs/decisions.md`, con fecha y motivo.
- **Seguridad:**
  - Toda acción comprueba que el servicio pertenece al cliente de la sesión.
  - Toda escritura queda en la auditoría.
  - Las acciones destructivas piden una confirmación escrita (patrón `ConfirmAction` del admin).
  - Nunca se renderiza una contraseña, un código EPP o un token salvo en un flujo de un solo uso
    pensado para ello.
- **Rendimiento:**
  - Las lecturas a WHMCS, OVH y Plesk van con `cache()` por petición, límites de tiempo y estados
    de error por bloque: un proveedor caído no deja la página en blanco.
  - Las operaciones largas (reinstalar, restaurar, transferir) van a Inngest y muestran su
    progreso.
- **Prueba en pantalla cada vista,** en escritorio y en móvil (390 px, sin scroll horizontal):
  - Usa la base de datos local de demostración: Postgres 16 de Homebrew en la carpeta de pruebas,
    con `drizzle-kit migrate` y el script de semilla. El cliente de prueba está enlazado a un
    cliente real de WHMCS en **solo lectura** a través del reenviador.
  - **Nunca** crees datos de prueba en producción.
- **Comandos en esta máquina:** antepone
  `unset NODE_OPTIONS; export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"`.

---

## 2. Punto de partida

### Área de cliente

- **Estructura:** universos arriba (Inicio · Bare Metal Cloud · Web Cloud) y un menú lateral por
  universo (`src/components/app/shell/`).
- **Lectura de WHMCS** en `src/server/whmcs-products/`:
  - Usa `whmcsReader()`: solo lectura y real siempre que haya credenciales, aunque `MOCK_WHMCS`
    esté activo. Pasa por el reenviador de IP fija `proxy.oladc.com`.
  - Clasifica los productos por id: alojamiento 1, 2, 3, 284, 4, 125, 8, 9, 10 · VPS 85, 14, 15,
    5, 41, 42, 63 · Plesk 88 · IP 64.
  - Lee dominios (`GetClientsDomains`), facturas (`GetInvoices`), periodo de gracia y saldo para
    estar al día.
  - Los inactivos se ocultan pasado un mes.
- **Listas existentes, hoy de solo lectura:** `/app/web-cloud/alojamiento`,
  `/app/web-cloud/dominios`, `/app/bare-metal/vps` («Otros VPS de tu cuenta»),
  `/app/bare-metal/licencias` y `/app/bare-metal/ip`.
- **Ficha de los VPS creados desde OLA** (`/app/servers/[id]`), con pestañas Resumen, Consola,
  Reinstalar, Rescate, Snapshots, Backups, Red, Plan y Actividad, a través de `packages/ovh`.
- **SSO de WHMCS:** `CreateSsoToken` funciona en solo lectura (`ssoEnabled`). Hay un patrón
  probado de enlace de un solo uso creado al pulsar y tras comprobar la propiedad:
  `/app/billing/factura/[id]`.

### Lo verificado en la instalación real (2026-11-08)

- **Registrador de los dominios:** en WHMCS tienen el campo `registrar` **vacío**. Por eso
  `DomainGetNameservers` responde «Registrar Function Not Supported», y lo mismo pasará con
  `DomainRenew`, `DomainTransfer`, `DomainRequestEPP` o la gestión del WHOIS.
- **Caducidad de los dominios:** casi todos tienen `expirydate` vacío; se usa `nextduedate`.
- **DNS de los dominios:** apuntan a servidores de Cloudin (`ns*.cloudinhosting.com`,
  `srv00x.cloudinhosting.com`), a Dinahosting o a servidores propios del cliente. Hoy se leen del
  DNS público.
- **Permisos del rol de API de WHMCS «OlaDC»:** incluyen las acciones `Domain*` de gestión,
  `GetClientsDomains`, `GetTLDPricing`, `CreateSsoToken`, `AddOrder`, `AcceptOrder`,
  `AddCancelRequest` y `UpdateClientProduct`, entre otras.
- **Permisos de la clave de OVH:** `/vps/*`, `/ip/*`, `/order/*`, `/me/order/*` y `GET /me`. **No
  incluye** `/domain/*` ni `/hosting/*`.
- **VPS:** la cuenta de OVH contiene los VPS de Cloudin (6 o 7). Los VPS de WHMCS (ids 85, etc.)
  **no tienen hoy ningún vínculo** con su `serviceName` de OVH: no hay campo personalizado y
  `dedicatedip` está vacío en los que se han visto.
- **Stock de OVH:** a 2026-11-08 no hay stock de ningún VPS en ningún centro. No afecta a esta
  fase, pero ninguna prueba debe contar con poder pedir uno.

---

## 3. Decisiones que debes preguntarme antes de implementar

Pregúntalas todas juntas al principio, cada una con tu recomendación y su coste. Hasta tener
respuesta, solo construyes lo que no dependa de ellas.

1. **Con qué registrador gestionamos los dominios.** Sin un módulo de registrador asignado en
   WHMCS, ninguna operación de dominio funciona por su API. Opciones:
   - **(A)** Asignar en WHMCS el módulo del registrador real de cada dominio (por ejemplo OVH,
     Dinahosting u Openprovider) y operar siempre a través de la API de WHMCS. Una sola vía, y la
     facturación de renovaciones sigue en WHMCS.
   - **(B)** Integrar directamente la API del registrador (por ejemplo `/domain/*` de OVH, con
     permisos nuevos en la clave) y usar WHMCS solo para facturar.

   Averigua dónde están registrados realmente los dominios: consulta el WHOIS de una muestra,
   solo lectura. Recomienda una opción, con lo que cuesta cada una.
2. **Edición de la zona DNS (registros A, AAAA, CNAME, MX, TXT, SRV, CAA).** La API de WHMCS no
   la ofrece. Para los dominios que usan los DNS de Cloudin, la zona está en los servidores Plesk
   (`srv00x.cloudinhosting.com`) o en el servidor de nombres de Cloudin.
   - Propón de dónde leerla y escribirla: API de Plesk o API del registrador o del DNS.
   - Si la escritura es arriesgada, propón una versión de solo lectura para empezar.
3. **Acceso a Plesk ya identificado.** Verifica qué ofrece esta instalación y recomienda una vía:
   - **(a)** `CreateSsoToken` con destino `clientarea:product_details` y el `service_id`: deja al
     cliente en la ficha del producto en WHMCS, donde está el botón de Plesk. Son dos clics.
   - **(b)** Acceso directo con la API de Plesk de cada servidor: crear una sesión para el
     usuario del cliente en Plesk (XML-RPC `server.create_session` o REST). Necesita credenciales
     de administrador de cada servidor Plesk en la plataforma, guardadas como secretos.
   - **(c)** Que WHMCS ejecute la función del módulo de Plesk que genera el acceso, si la expone
     por API. Compruébalo antes de proponerla.
4. **Gestión de los VPS que hoy solo están en WHMCS.** Para darles una ficha como la de OVH hay
   que saber qué VPS de OVH corresponde a cada servicio de WHMCS.
   - Propón cómo guardar ese vínculo, por ejemplo un campo personalizado `ovh_service_name` en el
     producto de WHMCS o una tabla de enlaces en OLA rellenada desde el panel de admin.
   - Propón quién lo rellena la primera vez.
   - Mientras no estén enlazados, su ficha es de solo lectura.
5. **Qué acciones son de pago y cómo se cobran:** renovar o transferir un dominio, ampliar un
   alojamiento, añadir un disco o una IP, cambiar de gama de VPS. La regla es la de siempre: OLA
   cobra con Stripe y registra en WHMCS, pero confírmalo para cada una.
6. **Acciones destructivas permitidas al cliente:** reinstalar, borrar registros DNS, desbloquear
   un dominio y pedir el EPP, cambiar la contraseña de Plesk o de root. Propón cuáles exigen
   confirmación escrita y cuáles quedan para soporte.

---

## 4. Alcance

### 4.1 Ficha de dominio — `/app/web-cloud/dominios/[id]`

Referencia: Dinahosting y DonDominio. Pestañas:

- **Resumen:**
  - estado (incluido el periodo de gracia);
  - fecha de alta, caducidad y próxima renovación, e importe por año;
  - renovación automática activable y desactivable (WHMCS `UpdateClientDomain`);
  - estado del bloqueo de transferencia y de la privacidad WHOIS;
  - servidores DNS actuales, leídos del DNS público, y si son los de Cloudin;
  - accesos rápidos: renovar, cambiar DNS, pedir el código de transferencia.
- **Servidores DNS:** ver y cambiar los servidores de nombres
  (`DomainGetNameservers` / `DomainUpdateNameservers`, o la vía de la decisión 1). Incluye
  preajustes «DNS de OLA/Cloudin» y «personalizados», y validación de hostnames.
- **Zona DNS:** según la decisión 2. Tabla de registros con alta, edición y baja; plantillas para
  correo (MX, SPF, DKIM, DMARC) y para apuntar al VPS o al alojamiento del cliente con un clic.
  Cada cambio se valida y se audita.
- **Titular y contactos:** ver y editar los datos WHOIS (`DomainGetWhoisInfo` /
  `DomainUpdateWhoisInfo`). Respeta las reglas de las extensiones con requisitos, como `.es`.
- **Transferencia:**
  - bloqueo on/off (`DomainUpdateLockingStatus`);
  - código EPP (`DomainRequestEPP`), entregado por email al titular o mostrado una sola vez;
  - instrucciones claras.
- **Renovación:** renovar por 1 a N años con el precio de `GetTLDPricing`, cobro con Stripe y
  registro en WHMCS, según la decisión 5.
- **Historial:** acciones y facturas del dominio.

**Fuera de la ficha, en la lista de dominios:**

- **Buscador de disponibilidad** (`DomainWhois`) con precios por extensión.
- **Alta de registro y de transferencia entrante** (`AddOrder` con el dominio y `AcceptOrder`).
  Es de pago: según la decisión 5 y nunca sin mi permiso para probarlo en real.

### 4.2 Ficha de alojamiento web — `/app/web-cloud/alojamiento/[id]`

- **Resumen:**
  - plan, dominio principal, estado, alta, próxima renovación e importe;
  - servidor en el que está alojado, mostrado solo por nombre comercial: no se expone el hostname
    interno salvo que lo decidas;
  - uso de disco y de transferencia si WHMCS lo da (`diskusage`, `disklimit`, `bwusage`,
    `bwlimit`).
- **Botón principal «Acceder a Plesk»:** sesión ya iniciada, según la decisión 3. Enlace de un
  solo uso, creado al pulsar y tras comprobar la propiedad, igual que los PDF de factura.
- **Accesos y datos de conexión:**
  - usuario FTP o SFTP y servidor;
  - cambio de contraseña del panel o del FTP, con confirmación, si la vía elegida lo permite;
  - nunca mostrar la contraseña actual.
- **Dominios del alojamiento,** si Plesk o WHMCS los exponen.
- **Correo:** acceso al webmail y datos de configuración IMAP/SMTP del dominio. Gestión de
  buzones solo si la vía de Plesk lo permite sin riesgo.
- **Facturación del servicio:** facturas relacionadas y cancelación al final del periodo
  (`AddCancelRequest`, tipo «End of Billing Period»).

### 4.3 Ficha de VPS estilo OVH — `/app/servers/[id]` y la nueva ficha de los VPS de WHMCS

Referencia: el gestor de OVHcloud. Reorganiza el **Resumen** en tarjetas:

- **Información general:**
  - modo de arranque (`netbootMode`: local o rescate);
  - distribución actual y acceso a «Reinstalar»;
  - región con la bandera del país;
  - menú «Acciones adicionales»: reiniciar, apagar, encender, modo rescate, cambiar el nombre.
- **Detalles de conexión:**
  - IPv4, IPv6 y pasarela IPv6, con botón de copiar;
  - usuario por defecto;
  - acceso a gestionar las IP (DNS inverso, firewall, IP adicionales);
  - DNS secundario, si es viable (`/vps/{serviceName}/secondaryDnsDomains`: verifícalo antes).
- **Mi configuración:** modelo (nombre comercial OLA), vCores, RAM, disco principal y
  almacenamiento adicional, con «Cambiar de gama» y «Añadir un disco» (de pago, decisión 5).
- **Copia de seguridad:** estado del snapshot y del backup automático, último punto de
  restauración y accesos a sus pestañas.
- **Suscripción:** fecha de alta, compromiso (mensual o 12 meses) y fecha de fin, próxima
  renovación, renovación automática y cancelar al final del periodo.

**Pestañas** (mantener las que ya existen y completar):

- Consola KVM
- Backup automático, con restaurar
- Snapshots
- Disco adicional
- Red: IP, DNS inverso, firewall, anti-DDoS
- Reinstalar, con claves SSH
- Rescate
- Monitorización: gráficas de CPU, RAM, disco y tráfico, si OVH las expone por API para esta
  gama (verifica `/vps/{serviceName}/monitoring` o `/use`); si no, dilo.
- Plan
- Actividad: tareas de OVH y auditoría

**VPS que hoy solo están en WHMCS:** ficha de solo lectura con los datos de WHMCS hasta que estén
enlazados con su VPS de OVH (decisión 4). A partir de ahí, misma ficha y mismas acciones, siempre
comprobando que el VPS está enlazado con este cliente.

### 4.4 Licencias e IP

- **Licencia Plesk:** edición, servidor, dominios incluidos y estado, con enlace al acceso a
  Plesk de ese servidor si aplica.
- **IP:** a qué servidor está asignada, DNS inverso editable (`/ip/{ip}/reverse`) y firewall.

---

## 5. Criterios de aceptación

- Cada fila de las listas de dominios, alojamientos, VPS, licencias e IP abre su ficha, y la URL
  de un servicio de otro cliente responde «no encontrado».
- La ficha de dominio muestra datos reales y permite, como mínimo:
  - cambiar los servidores DNS;
  - activar o desactivar la renovación automática;
  - consultar el estado de bloqueo;
  - todo a través de la vía decidida, verificado contra el sistema real.

  Ninguna acción de pago se ejecuta en real sin mi permiso.
- «Acceder a Plesk» deja al cliente dentro de su Plesk, o de la ficha en WHMCS con un clic más si
  se elige (a), sin pedirle contraseña. El enlace es de un solo uso y comprueba la propiedad.
- La ficha de VPS tiene las tarjetas y pestañas de §4.3 con datos reales de OVH en los VPS de OLA;
  lo que OVH no expone está documentado, no inventado.
- Cada acción de escritura tiene test, auditoría, mensajes en español y un estado de error que no
  rompe la página.
- Typecheck, tests, build y migraciones en verde. Capturas de escritorio y de móvil de cada ficha
  en el PR. Decisiones documentadas.

---

**Empieza así:**

1. Lee el código y los documentos indicados.
2. Haz las verificaciones de solo lectura que necesites.
3. Responde con:
   - las preguntas de §3, con recomendaciones y lo que hayas averiguado (dónde están registrados
     los dominios, qué permite Plesk, qué expone OVH para monitorización);
   - un plan de PR por bloque (dominios, alojamiento, VPS, licencias e IP), con su orden y su
     estimación;
   - los riesgos que veas.

No escribas en ningún sistema real hasta que responda.
