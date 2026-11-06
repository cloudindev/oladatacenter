import { Panel } from "@/components/app/ui"

/**
 * Shown while the tab reads the provider. It is a placeholder for layout, not a progress
 * indicator: it never claims to know how far along anything is.
 */
export default function ServerTabLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando los datos del servidor">
      {[0, 1].map((block) => (
        <Panel key={block}>
          <div className="h-5 w-40 rounded bg-surface-beige mb-6" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-surface-beige" />
            <div className="h-4 w-5/6 rounded bg-surface-beige" />
            <div className="h-4 w-2/3 rounded bg-surface-beige" />
          </div>
        </Panel>
      ))}
    </div>
  )
}
