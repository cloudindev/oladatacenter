# Abuso y fraude

Dos casos: **un servidor que hace daño** (spam, escaneo, DDoS saliente, minería, phishing) y
**un registro sospechoso** (tarjeta robada, alta en cadena para gastar el saldo de bienvenida).

El estado `review` existe exactamente para esto: `active | stopped | suspended → review`, y desde
`review` solo se sale a `active` (se aclaró) o a `terminating` (se corta). Un servicio en `review`
**no ofrece acciones al cliente**.

---

## A. Servidor señalado por abuso

### Síntoma
- Correo de abuse de OVH (`abuse@ovh.net`) con una queja y un plazo.
- Aviso de mitigación o de bloqueo de IP en el panel de OVH.
- Picos de tráfico saliente anómalos, o quejas de terceros a nuestro buzón de abuso.

### Comprobación
1. **Identifica el servicio por la IP**, no por el nombre: la queja trae una IP y una hora
   (con zona horaria: compáralas en UTC). Busca la IP en `services` → `/admin` → servicio.
2. Mira el plazo que da OVH. Suelen ser **24 h** para responder; si no se responde, **OVH bloquea
   la IP o suspende el VPS por su cuenta**, y entonces el cliente se queda sin servicio sin que
   nosotros controlemos nada.
3. Revisa `auditLog` de ese servicio y de ese cliente: reinstalaciones recientes, cambios de
   contraseña root, snapshots. Un servidor comprometido suele mostrar actividad rara antes.
4. Mira la antigüedad de la cuenta, si pagó con tarjeta propia y si usó crédito de bienvenida.
   Abuso + cuenta de dos días + crédito gratis = casi siempre fraude, no un cliente hackeado.

### Actuación
1. **Pasa el servicio a `review`** desde `/admin` → servicio → **Marcar para revisión**. Esto
   bloquea las acciones del cliente y deja constancia en `auditLog`.
2. **Para el servidor** si el abuso está en curso (spam saliente, DDoS, minería):
   `/admin` → servicio → **Apagar**. Es `POST /vps/{serviceName}/stop` vía el adaptador; queda
   como tarea de OVH con su estado. Apagar es preferible a reinstalar: **la reinstalación destruye
   las pruebas**.
3. **Responde a OVH dentro del plazo**, aunque la investigación no esté terminada. Lo que OVH
   espera es: acuse de recibo, qué medida se ha tomado (servidor parado / cliente avisado), y el
   plazo en el que se resuelve. Un "recibido, servidor apagado, investigando" dentro de las 24 h
   evita que OVH actúe sola.
4. **Avisa al cliente** con los hechos y sin acusar: qué se ha recibido, qué hemos hecho, qué
   necesitamos de él. Si es un servidor comprometido (lo más frecuente), el camino es: conservar
   el disco, reinstalar limpio, y cambiar las claves.
5. **Reincidencia o abuso deliberado** (phishing, botnet, contenido ilegal): `terminating`,
   reembolso no, y conserva todo el expediente. Si hay indicio de delito grave, escala antes de
   borrar nada.

### Pruebas que hay que recoger (antes de tocar el servidor)
- La queja original completa, con cabeceras y marcas de tiempo.
- IP, puerto y hora del incidente, en UTC.
- Estado del servicio y su historial de `auditLog`.
- Fecha de entrega, plan, datacenter y `serviceName` de OVH (para hablar con OVH; **nunca** se
  le muestra al cliente).
- Si hay que preservar el contenido: **snapshot antes de apagar o reinstalar**
  (`POST /vps/{serviceName}/createSnapshot`). Anota en `auditLog` que se hizo y por qué.
- Datos de alta del cliente: correo, IP de registro, método de pago, uso de crédito.

### Lo que no se hace
- No reinstalar "para limpiarlo" antes de recoger pruebas.
- No borrar el servicio mientras haya un expediente de abuso abierto con OVH.
- No reenviar al cliente los datos personales del denunciante.
- No contestar a OVH con los datos del cliente salvo requerimiento formal.

---

## B. Alta sospechosa de fraude

### Síntoma
- Varias cuentas con la misma tarjeta, la misma IP o correos del mismo patrón.
- Alta y contratación inmediata consumiendo el crédito de bienvenida.
- Pago rechazado por el banco como fraudulento, o `charge.dispute.created` en Stripe.
- País de la tarjeta distinto del país declarado, o NIF que no valida en VIES.

### Comprobación
1. `checkTrialLimits` en `@ola/core` es el que decide si se concede el crédito de bienvenida
   (`decideWelcomeCredit`). Si lo saltó, mira por qué: la señal nueva habrá que añadirla ahí.
2. Cruza por tarjeta (`paymentMethods`), por correo y por IP de registro.
3. Estado del cliente: `customers.status` (`unverified`, activo, bloqueado).
4. Disputas en Stripe sobre ese cliente.

### Actuación
1. Pasa los servicios del cliente a **`review`** y páralos si ya están entregados.
2. Bloquea la cuenta: el cliente pasa a bloqueado y **se cierran sus sesiones en todos los
   dispositivos** (las sesiones están en base de datos justamente para poder revocarlas).
3. No concedas ni amplíes crédito. Retira el crédito no consumido.
4. Si hay disputa en Stripe, responde con las pruebas de entrega (pedido, fecha, IP del servidor,
   `auditLog`). Una disputa sin respuesta se pierde siempre.
5. Si el cliente es legítimo (pasa), pide verificación: documento de la empresa o del titular, y
   confirmación del teléfono por OTP. Documenta quién lo aprobó.

---

## Cómo verificar que se arregló

- El servicio está en el estado que corresponde: **`active`** si se aclaró, **`terminating`** si
  se corta. Ninguno se queda olvidado en `review` — revisa esa lista cada día.
- El tráfico abusivo ha cesado (sin nuevas quejas ni mitigación activa en OVH).
- OVH dio el caso de abuso por cerrado, dentro del plazo.
- `auditLog` contiene la cadena completa: marcado para revisión, parada, snapshot de pruebas,
  decisión final y quién la tomó.
- Si era fraude: cuenta bloqueada, sesiones cerradas, crédito retirado, y la señal que lo detectó
  añadida a `checkTrialLimits` para que la próxima vez lo pare el sistema y no una persona.
