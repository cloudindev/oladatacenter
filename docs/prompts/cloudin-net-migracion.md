# Cloudin.net — de WordPress a Next.js, orientada a conversión e integrada con WHMCS

Eres el ingeniero responsable de construir **cloudin.net**: la nueva web de Cloudin
(cloudin.pro hoy), sin WordPress, sobre la misma plataforma que **oladc.com** (este
repositorio):

- Next.js 16 en Vercel.
- Supabase (Postgres) con Drizzle.
- Inngest, Resend y Stripe.
- WHMCS (`panel.cloudin.pro`) a través del reenviador de IP fija `proxy.oladc.com`.

Objetivos, por orden:

1. **Paridad total con cloudin.pro:** el mismo diseño, contenido, estructura de URL y SEO.
   Nadie debería notar el cambio salvo por la velocidad.
2. **Productos reales de WHMCS en la web:** hosting, VPS y dominios con precios en vivo, y
   compra en el menor número de pasos.
3. **Conversión máxima:** cada página empuja a una acción medible (comprar, buscar dominio,
   pedir presupuesto, chat).
4. **Área de cliente idéntica a la de oladc.com** (`/app`), con la marca Cloudin, a la que se
   llega desde el menú.

Antes de escribir código, lee:

- `AGENTS.md`
- `docs/architecture.md`
- `docs/decisions.md`, completo: casi todo lo de WHMCS ya está decidido y probado ahí.
- `docs/whmcs-setup.md`
- `docs/prompts/fase-5-whmcs-y-panel-cliente.md`
- `docs/prompts/fase-6-detalle-de-servicios.md`
- La guía de Next.js en `node_modules/next/dist/docs/`: esta versión tiene cambios
  incompatibles.

---

## 1. Reglas de trabajo (no negociables)

- **Pregunta antes de cualquier acción irreversible o visible fuera:**
  - cambios de DNS de cloudin.pro o cloudin.net;
  - redirecciones en producción;
  - escrituras en el WHMCS de producción;
  - envío de emails a clientes reales;
  - importación masiva de clientes;
  - borrados;
  - migraciones que pierdan datos.
- **Secretos:** solo en `.env.local` y en Vercel. Nunca en commits, logs ni en el chat.
  `.env.example` siempre al día.
- **Si te bloqueas,** presenta opciones con una recomendación y el coste de cada una. No decidas
  por mí en precios, textos legales, marca ni datos de clientes.
- **Nada de WHMCS, Stripe ni proveedores fuera de sus adaptadores.** Reutiliza los de oladc
  (`packages/whmcs`, `packages/core`, `packages/email`, `packages/db`), no los dupliques. Cada
  acción de API nueva se verifica en la documentación oficial y con una llamada real de **solo
  lectura**, y se anota con fecha.
- **Código:** TypeScript estricto, sin `any` ni `@ts-ignore`. ESLint limpio en tus archivos. No
  reformatees archivos enteros. Nombres de código en inglés; textos en español.
- **Commits y PR:** commits convencionales, pequeños y por tarea; una rama por bloque. Cada PR
  describe qué probar. Tras el push: abre el PR, espera los checks y **fusiona tú**.
- **Decisiones no obvias:** en `docs/decisions.md`, con fecha y motivo.
- **Contenido:** es de Cloudin y se migra tal cual. Textos, imágenes y estructura salen de
  cloudin.pro. No inventes cifras, opiniones de clientes ni sellos que no existan en la web
  actual.
- **Prueba en pantalla cada página,** en escritorio y en móvil (390 px, sin scroll horizontal),
  y compárala con su original de cloudin.pro: captura de las dos en el PR.
- **Comandos en esta máquina:** antepone
  `unset NODE_OPTIONS; export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:/usr/bin:/bin:/usr/sbin:/sbin"`.

---

## 2. Inventario de cloudin.pro (leído el 2026-11-08)

### Tecnología actual

- **WordPress:** tema **Hub** (Liquid Themes) con Elementor y Hub Elementor Addons.
- **Plugins:** Revolution Slider (con Lottie y Typewriter), Contact Form 7 con reCAPTCHA, chat
  **Support Board** y **Yoast SEO**.
- **Tipografías:** Poppins, Roboto, Oswald (300/700) y Montserrat (600), de Google Fonts.

### Páginas (`page-sitemap.xml`, unas 45)

- **Producto:**
  - `/hosting/`
  - `/hosting-web/`
  - `/cloud/`
  - `/dominios/`
  - `/data-center-espana/`
  - `/hosting-y-dominios-cloud-empresas/`
- **Landings locales,** unas 30:
  - `alojamiento-web-<ciudad o región>`: Madrid, Barcelona, Valencia, Sevilla, Málaga,
    Bilbao, Zaragoza, Murcia, Asturias, Gijón, Oviedo, Avilés, Galicia, A Coruña, Lugo,
    Andalucía, Córdoba, Granada, Huelva, Almería, Lleida, Girona, Tarragona, Huesca, Toledo,
    Albacete, La Rioja, Logroño…
  - `posicionamiento-seo-asturias`
  - `diseno-paginas-web-asturias`
- **Empresa:** `/unete/`, `/contacto/` y `/contacto-old/` (a retirar), y
  `/brief-alta-nuevo-cliente-fm/`.
- **Legales:** `/aviso-legal/`, `/cookies/`, `/politica-abuso/` y `/politica-seguridad/`.
- **Blog:** `/blog/` y 33 artículos en `/blog/<slug>/` (`post-sitemap.xml`).

### Integración actual con WHMCS

- **Botones de compra** que enlazan a la tienda de WHMCS:
  `panel.cloudin.pro/store/hosting-web/{starter|premiun|empresarial}`,
  `cart.php?a=add&domain=register`.
- **Acceso de clientes y tickets:** `panel.cloudin.pro/index.php?rp=/login` y
  `submitticket.php`.

### Lo que ya existe en oladc.com y se reutiliza

- Adaptador de WHMCS: clientes, productos, dominios, facturas, SSO y pedidos.
- Reenviador de IP fija.
- Área de cliente completa (`/app`):
  - inicio con panel, facturas, pagos, pedidos, saldo y formas de pago;
  - Bare Metal Cloud: VPS, licencias, IP;
  - Web Cloud: alojamiento, dominios;
  - fichas de detalle.
- Autenticación propia: email verificado, 2FA y sesiones.
- Importación de clientes de WHMCS: `scripts/import-whmcs-client.ts`.
- Emails transaccionales con Resend.
- Saldo con periodos sin facturar.

---

## 3. Decisiones que debes preguntarme antes de construir

Pregúntalas todas juntas al principio, cada una con tu recomendación y su coste.

1. **Arquitectura.** Opciones:
   - **(A)** Monorepo con dos apps (`apps/oladc`, `apps/cloudin`) que comparten `packages/*`, y
     el área de cliente como paquete común parametrizado por marca.
   - **(B)** Repositorio nuevo `cloudin.net` que copia los paquetes. Rápido al principio, pero
     dos copias que mantener.
   - **(C)** Web pública de cloudin.net aparte, y un único panel de clientes multi-marca (por
     ejemplo `panel.cloudin.net` y `panel.oladc.com`) servido por la misma app con el tema
     elegido por dominio.

   Recomienda una teniendo en cuenta que el área privada debe ser idéntica y evolucionar a la vez.
2. **Base de datos y cuentas.** Opciones:
   - mismo proyecto de Supabase con una columna `brand` en clientes, pedidos y servicios;
   - o un proyecto separado.

   Las dos marcas comparten el mismo WHMCS. ¿Un cliente de Cloudin y uno de OLA son cuentas
   distintas aunque tengan el mismo email?
3. **Dominios y SEO.**
   - ¿cloudin.pro se redirige (301) a cloudin.net, URL por URL, el día del lanzamiento?
     Recomendación: sí, con las mismas rutas. Así no se pierde posicionamiento.
   - ¿El WHMCS sigue en `panel.cloudin.pro` o pasa a `panel.cloudin.net`?
4. **Edición de contenido sin WordPress.** Opciones:
   - **(a)** MDX en el repositorio: cero coste, pero editar exige un commit;
   - **(b)** tablas en Supabase con un editor en el panel de admin;
   - **(c)** un CMS headless.

   ¿Quién edita el blog y las landings, y con qué frecuencia?
5. **Compra.** Opciones:
   - **(a)** Los botones llevan a la tienda de WHMCS con el producto ya elegido
     (`cart.php?a=add&pid=…`): lo más rápido de lanzar, la compra se termina en WHMCS.
   - **(b)** Checkout propio como en oladc (Stripe y alta en WHMCS), sin salir de cloudin.net:
     más conversión y más trabajo.

   Recomendación: (a) para lanzar con paridad y (b) en una segunda fase, medida contra (a).
6. **Clientes actuales** (246 en WHMCS). ¿Se importan todos a la nueva área de cliente con un
   email de «crea tu contraseña», poco a poco o bajo demanda (al primer acceso por email)?
   Nunca se envía nada sin tu aprobación.
7. **Herramientas de conversión y medición:**
   - chat: mantener Support Board o sustituirlo (Crisp, Tidio, propio);
   - analítica: GA4 con consentimiento, o Plausible o Umami sin cookies;
   - CAPTCHA: Cloudflare Turnstile en vez de reCAPTCHA;
   - consentimiento de cookies (RGPD/LSSI);
   - píxeles de anuncios, si los hay.
8. **Cambios de diseño.** La regla es paridad exacta. ¿Se permiten mejoras evidentes de
   conversión (precios visibles, buscador de dominios arriba, CTA fijo en móvil) desde el primer
   día, o primero paridad y luego mejoras medidas?

---

## 4. Alcance

### 4.1 Base del proyecto

- Estructura según la decisión 1.
- Proyecto de Vercel `cloudin.net` y variables de entorno.
- Tipografías con `next/font/local`: descárgalas una vez. `next/font/google` falló en los
  builds de Linux de oladc.
- **Recursos de cloudin.pro:**
  - Las imágenes de `wp-content/uploads` se descargan, se optimizan con `next/image` y se
    sirven desde el proyecto o desde Supabase Storage.
  - Inventario de cada imagen usada.
  - Nada se carga en caliente desde el WordPress.
- **Sistema de diseño extraído del tema Hub:** colores, tipografía, espaciados, botones,
  tarjetas, cabecera y pie, como tokens y componentes propios, sin dependencias de Elementor.
- **Sliders:** los de Revolution Slider se rehacen con CSS y animaciones ligeras (texto
  tipo máquina de escribir y Lottie solo si aportan); sin librerías pesadas.

### 4.2 Paridad de contenido y URL

- Cada página y artículo del inventario, con su ruta **idéntica** (`/hosting-web/`,
  `/blog/<slug>/`…), el barra final incluida si cloudin.pro la usa.
- **SEO:**
  - título y meta descripción de Yoast;
  - Open Graph;
  - canónicas;
  - `sitemap.xml` y `robots.txt`;
  - datos estructurados: `Organization`, `LocalBusiness` en las landings locales,
    `Product`/`Offer` en planes, `Article` en el blog, `BreadcrumbList` y `FAQPage` donde haya
    preguntas.
- **Landings locales:** una plantilla y un fichero de datos por ciudad. Se conserva el texto de
  cada una; si varias son casi idénticas, avísame del riesgo de contenido duplicado y propón
  cómo diferenciarlas.
- **Blog:**
  - listado paginado;
  - categorías y etiquetas si existen;
  - artículos relacionados;
  - tiempo de lectura;
  - autor y fecha;
  - imágenes destacadas;
  - feed RSS.
- **Formularios** (contacto, «Únete» y brief de nuevo cliente):
  - server actions con validación y Turnstile;
  - guardado en Supabase;
  - email a Cloudin y acuse al usuario con Resend;
  - sin perder ningún campo de los formularios actuales.
- **Legales:** las cuatro páginas, más el banner y el registro de consentimiento de cookies.
- **Redirecciones:** `/contacto-old/` → `/contacto/`, y cualquier URL antigua que ya no exista.
  En la decisión 3, el mapa completo cloudin.pro → cloudin.net.

### 4.3 Productos de WHMCS en la web

- **Lectura en vivo del catálogo** (`GetProducts` por grupo; añádelo al rol de API si falta,
  pidiéndomelo): nombre, descripción, características, precios por ciclo y moneda, stock y
  ocultos. Caché de unos minutos y valores de respaldo si WHMCS no responde: la web nunca se
  queda sin precios.
- **Tablas de precios** de hosting (Starter, Premium, Empresarial…) y de VPS, con:
  - conmutador mensual/anual y ahorro anual en euros;
  - plan recomendado destacado;
  - comparativa de características;
  - IVA claro (el mismo criterio de IVA que oladc).
- **Buscador de dominios** (`DomainWhois` + `GetTLDPricing`):
  - en la portada y en `/dominios/`;
  - disponibilidad al momento;
  - alternativas en otras extensiones;
  - precio de registro y renovación;
  - y «Añadir» al pedido.
- **Compra** según la decisión 5. Con (a), cada botón lleva al producto exacto en WHMCS, con el
  ciclo y el dominio ya elegidos (`cart.php?a=add&pid=…&billingcycle=…`). Con (b), el checkout de
  oladc con la marca Cloudin.
- **VPS:** los planes de OLA (gama OVH, con la protección de stock de oladc) y los VPS de
  Cloudin en WHMCS. Propón cómo presentarlos sin confundir al cliente.

### 4.4 Conversión

- **CTA principal visible siempre:** botón fijo en la cabecera y barra inferior en móvil con
  «Ver planes» o «Habla con nosotros».
- **Confianza:**
  - centro de datos en España;
  - soporte en español;
  - garantías y uptime que ya figuren en cloudin.pro;
  - logos de clientes si ya existen;
  - medios de pago.
- **Una página, un objetivo:** cada landing local termina en su plan recomendado y en un
  formulario corto.
- **Captación de contactos:** «Te ayudamos a elegir», migración gratuita, presupuesto. Cada
  contacto entra en Supabase con su origen (UTM, página, campaña) y avisa por email; se exporta
  a CSV desde el admin.
- **Chat** según la decisión 7, cargado sin penalizar la carga de la página.
- **Medición:** eventos de embudo (ver precios, buscar dominio, clic en comprar, inicio y fin de
  compra, formulario enviado), respetando el consentimiento. Panel de conversión en el admin de
  oladc.
- **Rendimiento:** Core Web Vitals en verde en móvil (LCP < 2,5 s, CLS < 0,1, INP < 200 ms).
  Medido con Lighthouse en cada PR de páginas clave, comparado con cloudin.pro.

### 4.5 Área de cliente

- Enlace «Área de cliente» en el menú, como hoy, que lleva a la misma área privada de oladc
  (`/app`) con:
  - el logo, los colores y los textos de Cloudin;
  - los mismos universos (Inicio, Bare Metal Cloud, Web Cloud);
  - las mismas fichas y el mismo saldo.
- **Sin perder nada de WHMCS:** tickets de soporte enlazados o integrados
  (`OpenTicket`/`GetTickets` si se aprueba) y acceso de un solo uso a WHMCS para lo que aún no
  esté en el panel.
- **Clientes actuales:** según la decisión 6, con el script de importación, ampliado para lotes,
  idempotente y sin enviar nada sin permiso.

### 4.6 Lanzamiento

Una checklist en `docs/operations.md`:

- DNS de cloudin.net en Vercel.
- Certificados.
- Redirecciones 301 probadas URL por URL con un script que recorre los dos sitemaps.
- Search Console de los dos dominios y cambio de dirección de Google.
- Analítica.
- Formularios probados.
- Precios comparados con WHMCS.
- Copia del WordPress antes de apagarlo.
- Plan de vuelta atrás.

---

## 5. Criterios de aceptación

- Todas las URL de los dos sitemaps de cloudin.pro existen en cloudin.net, con el mismo
  contenido, o redirigen con un 301 documentado.
- Comparación visual página a página (capturas de escritorio y móvil) sin diferencias de diseño
  salvo las mejoras aprobadas.
- Los precios y productos mostrados coinciden con WHMCS. Si WHMCS no responde, la web sigue
  mostrando precios de respaldo y se avisa al admin.
- Buscar un dominio, elegir un plan y llegar al pago funciona de punta a punta.
- Los formularios guardan, avisan y acusan recibo.
- La puntuación de Lighthouse en móvil iguala o supera a cloudin.pro en las páginas clave.
- El área de cliente con marca Cloudin funciona con un cliente real importado, en solo lectura,
  sin escribir en WHMCS.
- Typecheck, tests, build y migraciones en verde. Decisiones documentadas.

---

**Empieza así:**

1. Lee lo indicado.
2. Recorre cloudin.pro: todas las páginas y artículos de los sitemaps, solo lectura.
3. Responde con:
   - las preguntas de §3, con recomendaciones;
   - el inventario completo (páginas, artículos, formularios, imágenes, enlaces a WHMCS, metas
     SEO);
   - el sistema de diseño extraído (colores, tipografías, componentes);
   - un plan de PR por bloque, con su orden y su estimación;
   - los riesgos.

No crees repositorios, proyectos ni registros DNS hasta que responda.
