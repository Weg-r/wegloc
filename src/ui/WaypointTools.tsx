import { useState, type FormEvent } from 'react'
import { placeSearchAvailable, searchPlace } from '../geocode'

interface WaypointToolsProps {
  waypointCount: number
  onAddAtCoordinates: (lng: number, lat: number, label?: string) => void
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

type Problem = null | 'coordinates' | 'notFound' | 'offline'

const MESSAGE: Record<Exclude<Problem, null>, string> = {
  coordinates: 'Expected two numbers: latitude then longitude.',
  notFound: 'No place found for that address.',
  offline: 'The geocoder could not be reached. Coordinates still work.',
}

/**
 * The entry points for waypoint operations that aren't a click on the map:
 * arriving with a coordinate pair out of a bug report, typing an address, and
 * turning the route around.
 *
 * One field for both. Someone with a coordinate pair pastes it and someone with
 * an address types it, and neither should have to find the right box first: two
 * numbers are a coordinate, anything else is a place to look up. A build with no
 * geocoder configured keeps the coordinate behaviour and says so, rather than
 * offering a search that would quietly do nothing.
 */
export default function WaypointTools({ waypointCount, onAddAtCoordinates, onReverse }: WaypointToolsProps) {
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState<Problem>(null)
  const [searching, setSearching] = useState(false)
  const canSearch = placeSearchAvailable()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const typed = value.trim()
    if (!typed || searching) return

    const parsed = parseCoordinates(typed)
    if (parsed) {
      onAddAtCoordinates(parsed.lng, parsed.lat)
      setValue('')
      setProblem(null)
      return
    }

    if (!canSearch) {
      setProblem('coordinates')
      return
    }

    setSearching(true)
    setProblem(null)
    try {
      const found = await searchPlace(typed)
      if (!found) {
        setProblem('notFound')
        return
      }
      // The name the geocoder gave it, so the station reads as the address that
      // was asked for rather than as a pair of numbers.
      onAddAtCoordinates(found.lng, found.lat, found.label || undefined)
      setValue('')
    } catch {
      setProblem('offline')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="border-t border-neutral-200 px-5 py-3">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setProblem(null)
          }}
          placeholder={canSearch ? 'Address, or lat, lng' : 'lat, lng'}
          aria-label={canSearch ? 'Add waypoint at an address or coordinates' : 'Add waypoint at coordinates'}
          aria-invalid={problem !== null}
          aria-busy={searching}
          className={`min-w-0 flex-1 border-0 border-b-2 bg-transparent py-0.5 font-mono text-sm outline-none ${
            problem ? 'border-red-500' : 'border-neutral-300 focus:border-neutral-900'
          }`}
        />
        <button type="submit" className={buttonClass} disabled={value.trim() === '' || searching}>
          {searching ? '...' : 'Add'}
        </button>
        <button type="button" className={buttonClass} onClick={onReverse} disabled={waypointCount < 2}>
          Reverse
        </button>
      </form>
      {problem && <p className="mt-1 font-mono text-[11px] text-neutral-500">{MESSAGE[problem]}</p>}
    </div>
  )
}
