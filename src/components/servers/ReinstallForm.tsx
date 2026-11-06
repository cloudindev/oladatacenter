"use client"

import * as React from "react"
import { Button, Field, Notice, Select } from "@/components/app/ui"
import { reinstallServer } from "@/server/services/actions"
import { ConfirmDialog } from "./ConfirmDialog"
import { CopyField } from "./CopyField"
import { ImagePicker } from "./ImagePicker"
import { TaskProgress } from "./TaskProgress"
import type { ReinstallResult } from "./types"
import { useRunner } from "./useRunner"

/**
 * Reinstall.
 *
 * Three decisions, in order: which image, which SSH key (or none), and the typed
 * confirmation. Everything on this screen says the disk is wiped, because it is.
 *
 * The root password is only generated when no key is chosen, and it is shown exactly
 * once: it is never stored on our side.
 */
export function ReinstallForm({
  serviceId,
  serverName,
  images,
  currentImage,
  sshKeys,
  allowed,
}: {
  serviceId: string
  serverName: string
  images: readonly string[]
  currentImage: string | null
  sshKeys: readonly { id: string; name: string; fingerprint: string }[]
  allowed: boolean
}) {
  const runner = useRunner<ReinstallResult>()
  const [imageId, setImageId] = React.useState(images[0] ?? "")
  const [sshKeyId, setSshKeyId] = React.useState("")
  const [confirming, setConfirming] = React.useState(false)

  const done = runner.result
  if (done) {
    return (
      <div className="space-y-4">
        <Notice tone="ok" title="Reinstalación en marcha">
          El servidor se está reinstalando. Tardará varios minutos y durante ese tiempo no
          responderá.
        </Notice>

        {done.rootPassword ? (
          <Notice tone="warn" title="Contraseña de root: cópiala ahora">
            <p className="mb-3">
              Esta es la única vez que la vas a ver. No la guardamos en ninguna parte.
              Cámbiala en cuanto entres por SSH.
            </p>
            <CopyField value={done.rootPassword} label="la contraseña de root" />
          </Notice>
        ) : null}

        {done.passwordByEmail ? (
          <Notice tone="warn" title="La contraseña llega por correo">
            En esta imagen el proveedor genera la contraseña de administrador y la envía al
            correo de la cuenta. Nosotros no la vemos.
          </Notice>
        ) : null}

        {!done.rootPassword && !done.passwordByEmail ? (
          <Notice tone="neutral" title="Acceso con tu clave SSH">
            Entra con la clave que has elegido. No hay contraseña de root.
          </Notice>
        ) : null}

        <TaskProgress serviceId={serviceId} actionId={done.actionId} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Notice tone="danger" title="La reinstalación borra el disco">
        Todo lo que haya en {serverName} —archivos, bases de datos, configuración— se
        pierde. Si quieres conservar algo, haz antes una copia o un snapshot.
      </Notice>

      {images.length === 0 ? (
        <Notice tone="warn">
          No hemos podido leer las imágenes disponibles para este servidor. Inténtalo en
          unos minutos.
        </Notice>
      ) : (
        <ImagePicker
          images={images}
          currentImage={currentImage}
          value={imageId}
          onChange={setImageId}
        />
      )}

      <Field
        label="Acceso al servidor"
        htmlFor="ssh-key"
        hint={
          sshKeys.length === 0
            ? "No tienes claves SSH guardadas. Generaremos una contraseña de root y te la mostraremos una sola vez."
            : "Con una clave SSH no hay contraseña de root, que es la opción más segura."
        }
      >
        <Select
          id="ssh-key"
          value={sshKeyId}
          onChange={(event) => setSshKeyId(event.target.value)}
          disabled={sshKeys.length === 0}
        >
          <option value="">Sin clave: generar una contraseña de root</option>
          {sshKeys.map((key) => (
            <option key={key.id} value={key.id}>
              {key.name} · {key.fingerprint.slice(0, 24)}
            </option>
          ))}
        </Select>
      </Field>

      {runner.error ? <Notice tone="danger">{runner.error}</Notice> : null}

      <div>
        <Button
          type="button"
          variant="danger"
          disabled={!allowed || !imageId}
          onClick={() => setConfirming(true)}
        >
          Reinstalar el servidor
        </Button>
        {!allowed ? (
          <p className="mt-2 text-xs text-text-muted">
            La reinstalación está disponible cuando el servidor está activo o apagado.
          </p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Reinstalar el servidor"
        consequence={
          <>
            Vas a borrar el disco de {serverName} y a instalar el sistema desde cero. No
            hay vuelta atrás: ni los archivos ni las bases de datos se pueden recuperar
            después.
          </>
        }
        confirmLabel="Borrar e instalar"
        requireText={serverName}
        requireTextLabel={`Escribe ${serverName} para confirmar`}
        danger
        busy={runner.busy}
        error={runner.error}
        onConfirm={(typed) =>
          void runner.run(() =>
            reinstallServer({ serviceId, imageId, sshKeyId, confirmation: typed }),
          )
        }
        onCancel={() => {
          if (runner.busy) return
          setConfirming(false)
          runner.reset()
        }}
      />
    </div>
  )
}
