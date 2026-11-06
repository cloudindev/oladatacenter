import { ButtonLink, EmptyState, PageTitle } from "@/components/app/ui"

/**
 * Reached when the id does not match a server of the signed-in customer — whether it
 * never existed or belongs to somebody else. Both say the same thing on purpose: the
 * panel must not reveal which ids exist.
 */
export default function ServerNotFound() {
  return (
    <>
      <PageTitle>No encontramos este servidor</PageTitle>
      <EmptyState
        action={
          <ButtonLink href="/app" withArrow>
            Ver tus servidores
          </ButtonLink>
        }
      >
        Puede que el enlace esté mal o que el servidor ya no esté en tu cuenta.
      </EmptyState>
    </>
  )
}
