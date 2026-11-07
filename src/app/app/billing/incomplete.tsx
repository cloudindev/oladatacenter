import { ButtonLink, Notice, PageTitle, Panel } from "@/components/app/ui"

/** Shown by every billing page while the customer has no billing identity yet. */
export function BillingIncomplete({ title }: { title: string }) {
  return (
    <div className="max-w-2xl">
      <PageTitle>{title}</PageTitle>
      <Panel>
        <Notice
          tone="warn"
          title="Tu cuenta está a medias"
          action={
            <ButtonLink href="/onboarding" withArrow>
              Completar
            </ButtonLink>
          }
        >
          Necesitamos tus datos de facturación antes de poder emitir facturas.
        </Notice>
      </Panel>
    </div>
  )
}
