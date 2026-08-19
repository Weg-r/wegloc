import { useState, type FormEvent } from 'react'

interface WaypointToolsProps {
  waypointCount: number
  onAddAtCoordinates: (lng: number, lat: number) => void
  onReverse: () => void
}

const buttonClass =
  'px-2 py-1 border-2 border-neutral-300 font-mono text-[11px] font-bold uppercase tracking-wide text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-30 disabled:hover:border-neutral-300 focus-visible:outline-2 focus-visible:outline-neutral-900'

/** Accepts "48.8584, 2.2945" or "48.8584 2.2945", lat first, the way coordinates get pasted. */
function parseCoordinates(input: string): { lng: number; lat: number } | null {
  const parts = input
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length !== 2) return null

  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lng, lat }
}

/**
 * The entry points for waypoint operations that aren't a click on the map:
 * arriving with a coordinate pair out of a bug report, and turning the route
 * around.
 */
export default function WaypointTools({ waypointCount, onAddAtCoordinates, onReverse }: WaypointToolsProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseCoordinates(value)
    if (!parsed) {
      setError(true)
      return
    }

    onAddAtCoordinates(parsed.lng, parsed.lat)
    setValue('')
    setError(false)
  }

  return (
    <div className="border-t border-neutral-200 px-5 py-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(false)
          }}
          placeholder="lat, lng"
          aria-label="Add waypoint at coordinates"
          aria-invalid={error}
          className={`min-w-0 flex-1 border-0 border-b-2 bg-transparent py-0.5 font-mono text-sm outline-none ${
            error ? 'border-red-500' : 'border-neutral-300 focus:border-neutral-900'
          }`}
        />
        <button type="submit" className={buttonClass} disabled={value.trim() === ''}>
          Add
        </button>
        <button type="button" className={buttonClass} onClick={onReverse} disabled={waypointCount < 2}>
          Reverse
        </button>
      </form>
      {error && (
        <p className="mt-1 font-mono text-[11px] text-neutral-500">
          Expected two numbers: latitude then longitude.
        </p>
      )}
    </div>
  )
}
