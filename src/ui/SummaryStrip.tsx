import type { SpeedUnit } from '../lib/units'
import { formatSpeed, speedUnitLabel } from '../lib/units'
import { formatClock, formatMeters } from '../lib/format'

interface SummaryStripProps {
  waypointCount: number
  distanceMeters: number
  durationMs: number
  speedUnit: SpeedUnit
  onCycleUnit: () => void
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="truncate font-mono text-sm font-bold text-neutral-900">{value}</p>
    </div>
  )
}

/**
 * The route at a glance: how far, how long, how many stations, how fast on
 * average. The average is over the whole duration including stops, so it reads
 * lower than the cruise speed -- which is the honest number for "how long will
 * this take".
 */
export default function SummaryStrip({
  waypointCount,
  distanceMeters,
  durationMs,
  speedUnit,
  onCycleUnit,
}: SummaryStripProps) {
  const avgMps = durationMs > 0 ? distanceMeters / (durationMs / 1000) : 0

  return (
    <div className="grid grid-cols-4 items-start gap-3 border-b border-neutral-200 px-5 py-3">
      <Cell label="Stations" value={String(waypointCount)} />
      <Cell label="Distance" value={formatMeters(distanceMeters)} />
      <Cell label="Duration" value={formatClock(durationMs)} />
      <button type="button" onClick={onCycleUnit} className="min-w-0 text-left" title="Change speed unit">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          Avg · {speedUnitLabel(speedUnit)}
        </p>
        <p className="truncate font-mono text-sm font-bold text-neutral-900 underline decoration-dotted">
          {formatSpeed(avgMps, speedUnit)}
        </p>
      </button>
    </div>
  )
}
