/**
 * Every message the auth, onboarding and account screens can show.
 *
 * Server Actions redirect back with `?error=<code>` or `?ok=<code>` instead of returning
 * state, so each form stays a Server Component and works without JavaScript. The codes
 * are opaque to the browser and the copy lives here, in one place, in Spanish.
 *
 * `credenciales` is deliberately vague: the login form must never reveal whether it was
 * the address or the password that was wrong.
 */

export const AUTH_ERRORS: Record<string, string> = {
  credenciales: "Correo o contraseña incorrectos",
  campos: "Revisa los datos del formulario",
  correo_invalido: "Introduce un correo electrónico válido",
  correo_en_uso: "Ya existe una cuenta con este correo",
  contrasena_debil: "La contraseña no cumple los requisitos mínimos",
  contrasenas_distintas: "Las dos contraseñas no coinciden",
  limite: "Demasiados intentos. Vuelve a probar en unos minutos",
  enlace_invalido: "El enlace no es válido",
  enlace_caducado: "El enlace ha caducado. Pide uno nuevo",
  enlace_usado: "Este enlace ya se ha usado. Pide uno nuevo",
  codigo_invalido: "El código no es correcto",
  codigo_caducado: "El código ha caducado. Pide uno nuevo",
  codigo_intentos: "Has agotado los intentos. Pide un código nuevo",
  "2fa_requerido": "Introduce el código de verificación en dos pasos",
  "2fa_invalido": "El código de verificación en dos pasos no es correcto",
  sesion_expirada: "Tu sesión ha caducado. Vuelve a entrar",
  nif_invalido: "El NIF, CIF o NIE no tiene un formato válido",
  nif_tipo: "El identificador fiscal no corresponde al tipo de cliente elegido",
  telefono_invalido: "Introduce un número de teléfono válido, con prefijo del país",
  pais_invalido: "Selecciona un país",
  clave_ssh_invalida: "Esto no parece una clave pública SSH de OpenSSH",
  clave_ssh_duplicada: "Ya tienes guardada esta clave",
  clave_nombre: "Ponle un nombre a la clave",
  servicios_activos: "Tienes servidores activos. Cancélalos antes de cerrar la cuenta",
  confirmacion: "Escribe el texto de confirmación tal cual aparece",
  contrasena_actual: "La contraseña actual no es correcta",
  no_verificado: "Antes tienes que terminar de verificar tu cuenta",
  interno: "Algo ha ido mal por nuestra parte. Inténtalo de nuevo",
}

export const AUTH_NOTICES: Record<string, string> = {
  registro: "Te hemos enviado un correo para verificar tu dirección",
  enlace_enviado: "Te hemos enviado un correo con el enlace",
  correo_verificado: "Correo verificado",
  contrasena_cambiada: "Contraseña actualizada",
  contrasena_restablecida: "Contraseña restablecida. Ya puedes entrar",
  sesion_cerrada: "Has cerrado la sesión",
  sesiones_cerradas: "Hemos cerrado la sesión en todos los dispositivos",
  codigo_enviado: "Te hemos enviado un código por SMS",
  telefono_verificado: "Teléfono verificado",
  telefono_guardado: "Teléfono guardado",
  datos_guardados: "Datos guardados",
  nif_validado: "Identificador fiscal validado en VIES",
  nif_sin_validar:
    "No hemos podido validar el identificador en VIES ahora mismo. Lo reintentaremos más tarde",
  nif_no_encontrado:
    "Datos guardados. VIES no reconoce ese identificador, así que revísalo cuando puedas",
  "2fa_activado": "Verificación en dos pasos activada",
  "2fa_desactivado": "Verificación en dos pasos desactivada",
  clave_anadida: "Clave SSH añadida",
  clave_eliminada: "Clave SSH eliminada",
  cuenta_cerrada: "Hemos cerrado tu cuenta y anonimizado tus datos personales",
  cuenta_verificada: "Cuenta verificada",
  credito_concedido: "Cuenta verificada y crédito de bienvenida disponible",
  credito_denegado: "Cuenta verificada. El crédito de bienvenida queda en revisión",
}

export function authError(code: string | undefined): string | null {
  if (!code) return null
  return AUTH_ERRORS[code] ?? AUTH_ERRORS.interno ?? null
}

export function authNotice(code: string | undefined): string | null {
  if (!code) return null
  return AUTH_NOTICES[code] ?? null
}

/** First value of a search param, which Next types as `string | string[]`. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
