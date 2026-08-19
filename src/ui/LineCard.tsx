import { memo, useCallback, useMemo, useRef, type KeyboardEvent } from 'react'
import { haversineDistance } from '../routes/geo'
import type { SimulationSettings, Waypoint } from '../types/route'
import { ACCENT } from '../lib/theme'
import { formatMeters, formatSeconds, stationCode } from '../lib/format'

interface LineCardProps {
  waypoints: Waypoint[]
  settings: SimulationSettings
  selectedId: string | null
  onSelect: (id: string) => void
  onDeselect: () => void
  onDelete: (id: string) => void
  onReorder: (from: number, to: number) => void
}

interface LineRowProps {
  waypoint: Waypoint
  index: number
  total: number
  legDistance: number | null
  legSpeed: number | null
  selected: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onReorder: (from: number, to: number) => void
  registerRef: (id: string, node: HTMLButtonElement | null) => void
}

const rowActionClass =
  'w-7 flex items-center justify-center text-[9px] text-neutral-300 hover:text-neutral-900 disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900'

/**
 * One station in the line diagram. Memoized because dragging a waypoint hands
 * the list a new waypoints array on every pointer event: only the rows whose
 * own data changed should re-render.
 */
const LineRow = memo(function LineRow({
  waypoint,
  index,
  total,
  legDistance,
  legSpeed,
  selected,
  onSelect,
  onDelete,
  onReorder,
  registerRef,
}: LineRowProps) {
  const code = stationCode(index)
  const dwellMs = waypoint.dwellMs ?? 0

  return (
    <li className={`flex items-stretch transition-colors ${selected ? 'bg-neutral-100' : 'hover:bg-neutral-50'}`}>
      <button
        type="button"
        ref={(node) => registerRef(waypoint.id, node)}
        onClick={() => onSelect(waypoint.id)}
        aria-current={selected ? 'true' : undefined}
        aria-label={`${code}, waypoint ${index + 1} of ${total}`}
        className="flex-1 min-w-0 flex items-stretch gap-3 pl-5 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900"
      >
        <span className="flex flex-col items-center pt-0.5" aria-hidden="true">
          <span className="w-4 h-4 rounded-full border-[3px] bg-white shrink-0" style={{ borderColor: ACCENT }} />
          {legDistance !== null && <span className="w-1 flex-1 mt-1" style={{ backgroundColor: ACCENT }} />}
        </span>

        <span className="flex-1 min-w-0 pb-1 block">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-neutral-500">{code}</span>
            {waypoint.altitude !== null && (
              <span className="font-mono text-xs text-neutral-400">{Math.round(waypoint.altitude)}M ALT</span>
            )}
          </span>
          <span className="block text-sm font-semibold text-neutral-900 truncate">
            {waypoint.lat.toFixed(4)}, {waypoint.lng.toFixed(4)}
          </span>
          {dwellMs > 0 && (
            <span className="block font-mono text-xs font-bold mt-1 text-neutral-600">
              STOP {formatSeconds(dwellMs)}
            </span>
          )}
          {legDistance !== null ? (
            <span className="block font-mono text-xs text-neutral-500 mt-1">
              NEXT &rarr; {formatMeters(legDistance)} @ {legSpeed?.toFixed(1)} M/S
            </span>
          ) : (
            <span className="block font-mono text-xs font-bold mt-1" style={{ color: ACCENT }}>
              TERMINUS
            </span>
          )}
        </span>
      </button>

      <span className="shrink-0 flex flex-col justify-start pt-2">
        <button
          type="button"
          onClick={() => onReorder(index, index - 1)}
          disabled={index === 0}
          aria-label={`Move ${code} earlier`}
          className={`${rowActionClass} h-5`}
        >
          &#9650;
        </button>
        <button
          type="button"
          onClick={() => onReorder(index, index + 1)}
          disabled={index === total - 1}
          aria-label={`Move ${code} later`}
          className={`${rowActionClass} h-5`}
        >
          &#9660;
        </button>
      </span>

      <button
        type="button"
        onClick={() => onDelete(waypoint.id)}
        aria-label={`Remove ${code}`}
        className={`shrink-0 w-11 flex items-start justify-center pt-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900 hover:text-[color:var(--accent)] ${
          selected ? 'text-neutral-600' : 'text-neutral-300'
        }`}
        style={{ ['--accent' as string]: ACCENT }}
      >
        &#10005;
      </button>
    </li>
  )
})

export default function LineCard({
  waypoints,
  settings,
  selectedId,
  onSelect,
  onDeselect,
  onDelete,
  onReorder,
}: LineCardProps) {
  // Recomputed once per waypoint change rather than once per row per render.
  const legDistances = useMemo(
    () => waypoints.map((wp, i) => (waypoints[i + 1] ? haversineDistance(wp, waypoints[i + 1]) : null)),
    [waypoints],
  )

  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const registerRef = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) rowRefs.current.set(id, node)
    else rowRefs.current.delete(id)
  }, [])

  const selectAt = useCallback(
    (index: number) => {
      const wp = waypoints[index]
      if (!wp) return
      onSelect(wp.id)
      rowRefs.current.get(wp.id)?.focus()
    },
    [waypoints, onSelect],
  )

  /** The whole list is operable from the keyboard: arrows move, Delete removes, Escape deselects. */
  const handleKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const index = waypoints.findIndex((wp) => wp.id === selectedId)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        // Alt reorders instead of navigating; the selection follows the waypoint.
        if (event.altKey && index >= 0) onReorder(index, index + 1)
        else selectAt(index < 0 ? 0 : Math.min(index + 1, waypoints.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        if (event.altKey && index >= 0) onReorder(index, index - 1)
        else selectAt(index < 0 ? waypoints.length - 1 : Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        selectAt(0)
        break
      case 'End':
        event.preventDefault()
        selectAt(waypoints.length - 1)
        break
      case 'Delete':
      case 'Backspace': {
        if (index < 0) return
        event.preventDefault()
        // Resolve the survivor against the current list before the removal: after
        // it, this row's position belongs to a different waypoint.
        const survivor = waypoints[index + 1] ?? waypoints[index - 1] ?? null
        onDelete(waypoints[index].id)
        if (survivor) {
          onSelect(survivor.id)
          rowRefs.current.get(survivor.id)?.focus()
        }
        break
      }
      case 'Escape':
        if (selectedId === null) return
        event.preventDefault()
        onDeselect()
        break
      default:
        break
    }
  }

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
    <ol
      className="flex-1 overflow-y-auto py-2"
      onKeyDown={handleKeyDown}
      aria-label={`Route stations, ${waypoints.length} waypoints`}
    >
      {waypoints.map((wp, index) => (
        <LineRow
          key={wp.id}
          waypoint={wp}
          index={index}
          total={waypoints.length}
          legDistance={legDistances[index]}
          legSpeed={waypoints[index + 1] ? (waypoints[index + 1].legSpeedMps ?? settings.baseSpeedMps) : null}
          selected={wp.id === selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onReorder={onReorder}
          registerRef={registerRef}
        />
      ))}
    </ol>
  )
}
