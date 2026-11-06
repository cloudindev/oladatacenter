# Rotación de claves sin cortar el servicio

Aplica a: clave de consumidor de OVH, credencial de API de WHMCS, `AUTH_SECRET` y claves de
Stripe. Todas viven como variables de entorno en Vercel; **ninguna se guarda en el repositorio**.

> Las variables de entorno de Vercel **no se recargan en caliente**: todo cambio necesita un
> redespliegue para surtir efecto. Planifica la ventana contando con eso.

Regla general para rotar sin downtime: **crear la credencial nueva → añadirla → verificar →
retirar la vieja.** Nunca borrar primero.

---

## 1. Clave de consumidor de OVH (`OVH_CONSUMER_KEY`)

La firma usa `OVH_APP_KEY` + `OVH_APP_SECRET` + `OVH_CONSUMER_KEY`. La *consumer key* es la que
caduca o se revoca; las de aplicación se cambian solo si se filtraron.

### Derechos mínimos que hay que pedir
Al crear el token en `https://eu.api.ovh.com/createToken/` pide **exactamente** esto y nada más:

| Métodos | Ruta |
|---|---|
| GET, POST, PUT, DELETE | `/vps/*` |
| GET, POST, PUT, DELETE | `/order/*` |
| GET, POST | `/me/order/*` |
| GET, POST, PUT, DELETE | `/ip/*` |
| GET | `/me` |

Validez: sin caducidad (`unlimited`), o la rotación se convierte en una incidencia nocturna.
No pidas `/*`. No pidas `/me/*` completo: incluye métodos de pago y datos de facturación.

### Pasos
1. Crea el token nuevo y valídalo **fuera de producción**:
   `GET /me` firmado con la clave nueva debe devolver el `nichandle` correcto.
2. Pon `OVH_CONSUMER_KEY` nueva en Vercel (preview primero, luego production) y redespliega.
3. Antes de revocar la vieja: **pon `OVH_ORDERS_ENABLED=false` si hay un pedido en vuelo**, o
   espera a que `/admin/pedidos` no tenga nada en `provisioning`. Una clave revocada a mitad de
   un carrito deja el pedido a medias (recuperable por `completedSteps`, pero evítalo).
4. Verifica en producción: abre un servidor en el panel (lectura) y lanza un reinicio en uno de
   prueba (escritura). La tarea tiene que llegar a `done`.
5. Revoca la clave antigua en el panel de OVH (`/me/api/credential`).

### Si la firma falla con 403 `INVALID_SIGNATURE`
Antes de culpar a la clave, mira el reloj: la firma incluye el timestamp y se corrige contra
`GET /auth/time` (ver `packages/ovh/src/signer.ts`). Un desfase grande da el mismo error que una
clave mala.

---

## 2. Credencial de API de WHMCS (`WHMCS_API_IDENTIFIER` / `WHMCS_API_SECRET`)

1. En WHMCS: Configuration → API Credentials → **Generate New**. Asigna un rol con permisos solo
   para clientes, pedidos, facturas y pagos. No uses un rol de administrador completo.
2. Comprueba que la IP del proxy (`WHMCS_PROXY_URL`) está en la lista blanca de la API. Si
   cambias de proxy, **esto es lo que rompe la rotación**, no la credencial.
3. Mete la pareja nueva en Vercel y redespliega.
4. Verifica con una lectura (`GetClients` sobre un cliente conocido) a través del proxy.
5. Prueba una escritura con `WHMCS_WRITE_ENABLED=true`: crea y anula una factura de 0 €.
6. Borra la credencial antigua en WHMCS.

Si tienes que rotar con pedidos en vuelo: pon `WHMCS_WRITE_ENABLED=false`, rota, verifica,
vuelve a `true`. Los pedidos se encolan y se reanudan (ver `whmcs-inaccesible.md`); no se pierden.

---

## 3. `AUTH_SECRET`

**Cambiarlo invalida sesiones si se hace mal.** Nuestras sesiones son opacas y viven en la tabla
`sessions` (se guarda el sha256 del token), precisamente para poder revocarlas; el secreto se usa
para firmar cookies y tokens de verificación.

1. Genera uno nuevo: `openssl rand -base64 32` (mínimo 32 caracteres, lo valida el esquema de
   `src/lib/env.ts`).
2. Haz el cambio en la **ventana de menor tráfico**. Consecuencias que hay que asumir:
   - los enlaces de verificación de correo y de restablecimiento de contraseña **ya emitidos**
     dejan de valer: el cliente tiene que pedir otro;
   - según cómo esté firmada la cookie, puede obligar a volver a iniciar sesión.
3. Cambia la variable y redespliega.
4. Avisa a soporte: durante la hora siguiente habrá clientes diciendo que su enlace no funciona.
   La respuesta es "pide otro correo de verificación".

Nunca reutilices un `AUTH_SECRET` entre entornos: staging y producción llevan secretos distintos.

---

## 4. Claves de Stripe

Hay tres y no se rotan igual:

| Variable | Dónde se usa | Cómo se rota |
|---|---|---|
| `STRIPE_SECRET_KEY` | servidor | Stripe → Developers → API keys → **Roll key**. Deja la vieja activa 24 h ("expire in 24 hours"), pon la nueva, redespliega, verifica, y deja que la vieja caduque sola. Esto da rotación sin downtime real. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | navegador | se puede cambiar en cualquier momento; es pública. Debe pertenecer a la **misma cuenta y el mismo modo** que la secreta, o los pagos fallan con errores confusos. |
| `STRIPE_WEBHOOK_SECRET` | verificación de webhooks | **crea un endpoint nuevo** en Stripe apuntando a la misma URL, coge su secreto, y mantén los dos endpoints un rato. Primero despliega con el secreto nuevo, comprueba que llegan eventos firmados, y luego borra el endpoint viejo. |

Verificación obligatoria tras rotar Stripe:
1. Un pago de prueba en staging con `4242 4242 4242 4242`.
2. Un evento de webhook recibido y aceptado (`webhookEvents` con la fila nueva, sin error de
   firma).
3. Un cobro off-session de renovación simulado, que es el camino que más se rompe al rotar.

---

## Comprobación final (cualquier rotación)

- Ninguna clave nueva aparece en un commit, en un log ni en el código del cliente:
  `git log -p -1 | grep -iE 'sk_live|whsec|consumer'` no devuelve nada.
- El despliegue de producción está hecho **después** del cambio de variables.
- Lectura y escritura verificadas contra el proveedor rotado.
- Las credenciales antiguas revocadas o caducadas, y apuntado el día en que se hizo.
- Si la rotación fue por una filtración: además, `auditLog` revisado en busca de uso indebido, y
  sesiones cerradas en todos los dispositivos de las cuentas de admin.
