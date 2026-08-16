import { haversineDistance } from '../routes/geo'
import type { SimulationSettings, Waypoint } from '../types/route'
import { ACCENT } from '../lib/theme'
import { formatMeters, stationCode } from '../lib/format'

interface LineCardProps {
  waypoints: Waypoint[]
  settings: SimulationSettings
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export default function LineCard({ waypoints, settings, selectedId, onSelect, onDelete }: LineCardProps) {
  if (waypoints.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-neutral-400 uppercase tracking-wide font-semibold">
          Click the map to lay the first station
        </p>
      </div>
    )
  }

  return (
    <ol className="flex-1 overflow-y-auto py-2">
      {waypoints.map((wp, index) => {
        const next = waypoints[index + 1]
        const legSpeed = next ? (next.legSpeedMps ?? settings.baseSpeedMps) : null
        const legDistance = next ? haversineDistance(wp, next) : null
        const selected = wp.id === selectedId

        return (
          <li key={wp.id}>
            <button
              type="button"
              onClick={() => onSelect(wp.id)}
              className={`w-full flex items-stretch gap-3 px-5 py-3 text-left transition-colors ${
                selected ? 'bg-neutral-100' : 'hover:bg-neutral-50'
              }`}
            >
              <div className="flex flex-col items-center pt-0.5">
                <span className="w-4 h-4 rounded-full border-[3px] bg-white shrink-0" style={{ borderColor: ACCENT }} />
                {next && <span className="w-1 flex-1 mt-1" style={{ backgroundColor: ACCENT }} />}
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs font-bold tracking-wider text-neutral-500">
                    {stationCode(index)}
                  </span>
                  {wp.altitude !== null && (
                    <span className="font-mono text-xs text-neutral-400">{Math.round(wp.altitude)}M ALT</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-neutral-900 truncate">
                  {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                </p>
                {next ? (
                  <p className="font-mono text-xs text-neutral-500 mt-1">
                    NEXT &rarr; {formatMeters(legDistance ?? 0)} @ {legSpeed?.toFixed(1)} M/S
                  </p>
                ) : (
                  <p className="font-mono text-xs font-bold mt-1" style={{ color: ACCENT }}>
                    TERMINUS
                  </p>
                )}
              </div>

              {selected && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(wp.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      onDelete(wp.id)
                    }
                  }}
                  className="self-start text-xs font-bold text-neutral-400 hover:text-[color:var(--accent)] px-1"
                  style={{ ['--accent' as string]: ACCENT }}
                  aria-label={`Remove ${stationCode(index)}`}
                >
                  &#10005;
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
