# OVH no responde (o cambió el catálogo)

Dos incidencias distintas en el mismo sitio: **la API no responde** y **la API responde pero con
otros precios**. La segunda es más peligrosa porque no se nota.

---

## A. La API de OVH no responde

### Síntoma
- Errores al entrar en un servidor o al lanzar una acción (reiniciar, snapshot, consola).
- Pedidos que se quedan en `provisioning`.
- Muchos reintentos en Inngest sobre funciones `ovh.*`.
- `https://status.ovhcloud.com` con incidencia abierta.

### Comprobación
1. `curl -s -o /dev/null -w '%{http_code}\n' https://eu.api.ovh.com/1.0/auth/time`
   — ruta sin autenticar. Si no devuelve `200`, es OVH, no somos nosotros.
2. Si `auth/time` va pero las llamadas firmadas fallan con **403 / `INVALID_SIGNATURE`**, no es
   una caída: es un problema de claves o de reloj → `docs/runbooks/rotacion-claves.md`.
3. Mira el panel de Inngest: si los jobs están reintentando con backoff, el sistema está
   aguantando solo y no hay que hacer nada aún.

### Qué sigue funcionando
- Toda la web pública y el configurador: los precios salen del **snapshot del catálogo en base de
  datos** (`ovh_catalog_snapshots`), no de OVH en vivo.
- Registro, login, el área de cliente, facturas, saldo.
- Lectura del estado de los servidores: se muestra el último estado conocido, con su fecha.

### Qué se encola
- Aprovisionamiento de pedidos nuevos (se reanuda por `completedSteps`, sin duplicar).
- Acciones de servidor (reinicio, snapshot, rescate, reinstalación): quedan en `actions` como
  `queued`.
- Renovaciones en la parte de OVH (el cobro en Stripe es independiente y sí ocurre).

### Actuación
1. **Corta los pedidos nuevos** si la caída es larga o el aprovisionamiento está fallando:

   ```
   OVH_ORDERS_ENABLED=false
   ```

   En Vercel → Settings → Environment Variables → production, y **redespliega** (las variables
   no se recargan en caliente). Con esto `assertOvhOrdersEnabled()` rechaza cualquier pedido
   antes de gastar dinero. El checkout debe dejar de ofrecer la compra.
2. Publica aviso en la web y responde a los clientes (texto abajo).
3. No reintentes acciones a mano en bucle: duplica tareas en OVH. Los jobs ya reintentan.
4. Cuando OVH vuelva: `OVH_ORDERS_ENABLED=true`, redespliega, y repasa
   `docs/runbooks/pedido-atascado.md` para cada pedido que quedó a medias.

### Qué decir a los clientes
> Estamos teniendo un problema con nuestro proveedor de infraestructura. Tu servidor sigue
> funcionando; lo que está afectado son las acciones del panel (reinicio, snapshots) y la
> contratación de servidores nuevos. Lo estamos siguiendo y te avisamos en cuanto se restablezca.

No prometas hora de resolución si OVH no la ha dado. No digas "OVH" si no quieres explicar la
cadena de proveedores: "nuestro proveedor de infraestructura" es suficiente y es cierto.

---

## B. El catálogo cambió (precio o `planCode`)

### Síntoma
- Falla el workflow **OVH catalog contract** (`.github/workflows/contract.yml`), a diario o a
  mano. El mensaje nombra el plan y el precio viejo y el nuevo.
- O falla el paso `ovh_price_check` de un pedido real: OVH cobra distinto de lo cotizado.

### Comprobación
1. Abre el run fallido en Actions: dice exactamente qué plan y qué modo (`default` / `upfront12`)
   se movió y cuánto.
2. Compáralo con `docs/ovh-api-verified.md` (tabla verificada el 2026-11-05).
3. Comprueba si el cambio afecta a los **addons obligatorios** (`os`, `storage`,
   `automatedBackup`). `automatedBackup` entra en el coste real de cada VPS: si sube, baja el
   margen de todos los servidores, no solo de los nuevos.

### Actuación
1. **Para los pedidos nuevos** mientras decides: `OVH_ORDERS_ENABLED=false`. Vender por debajo de
   coste es peor que no vender.
2. Sincroniza el catálogo (`/admin` → catálogo → sincronizar, o el job `catalog.sync`). Eso
   actualiza `ovh_catalog_snapshots` y con ello los precios públicos calculados.
3. Refresca el fixture comprometido y vuelve a pasar el contrato:
   `packages/core/test/fixtures/ovh-catalog-vps-es.json` — guarda solo los cuatro planes MVP y
   sus familias de addons, sin secretos, y anota la fecha en `_fetchedAt`.
4. Revisa el margen con la vista de admin (usa el coste real, no el coste de plan) y decide si se
   sube el PVP. Si se sube, hay que anunciarlo a los clientes existentes antes de su renovación.
5. Si un `planCode` **desapareció**: retíralo del catálogo vendible y busca el código sustituto en
   el catálogo en vivo. Los servicios ya entregados no se ven afectados; los nuevos sí.
6. Apunta la decisión en `docs/decisions.md` con la fecha.

### Cómo verificar que se arregló
- `npx playwright test --project=contract` en verde (con
  `PLAYWRIGHT_SKIP_WEBSERVER=1`; no necesita navegador ni app).
- Los precios de `/vps` coinciden con la tabla aprobada.
- Un pedido de prueba con mocks (`USE_MOCK_PROVIDERS=true`) llega a `delivered`.
- Con `OVH_ORDERS_ENABLED=true` de nuevo, un pedido real de control pasa `ovh_price_check`.
