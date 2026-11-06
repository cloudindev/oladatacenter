import type { DiskUsageView } from "@/server/services/types"

/**
 * Real disk usage, read from `GET /vps/{serviceName}/disks/{id}/use`.
 *
 * This is the only capacity metric the OVH API exposes for a VPS, so it is the only one
 * shown. No state is needed, so this renders on the server.
 */
export function DiskUsageBar({ disk, index }: { disk: DiskUsageView; index: number }) {
  const label = index === 0 ? "Disco del sistema" : `Disco adicional ${index}`
  const tone =
    disk.percent >= 90 ? "bg-[#8a2d26]" : disk.percent >= 75 ? "bg-[#7a5a16]" : "bg-accent-ink"

  return (
    <div className="py-3 border-b border-border-base last:border-b-0">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <p className="label-mono text-text-muted">{label}</p>
        <p className="text-sm text-text-base">
          <span className="font-mono">{disk.usedGb}</span> de{" "}
          <span className="font-mono">{disk.maxGb}</span> GB
        </p>
      </div>
      <div
        role="meter"
        aria-valuenow={disk.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${disk.percent} por ciento ocupado`}
        className="h-2 w-full rounded-full bg-surface-beige overflow-hidden"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${disk.percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-text-muted">{disk.percent} % ocupado</p>
    </div>
  )
}
