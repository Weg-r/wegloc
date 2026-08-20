import { useRef, useState, type FormEvent } from 'react'
import { searchAddress, type GeocodeResult } from '../geocode'

interface AddressSearchProps {
  onPick: (lng: number, lat: number, label: string) => void
}

const buttonClass =
  'px-2 py-1 border-2 border-neutral-300 font-mono text-[11px] font-bold uppercase tracking-wide text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-neutral-900'

type State = 'idle' | 'searching' | 'offline' | 'empty'

/**
 * Adds a station by address. Type a place, pick from the results, and the
 * station lands there with the address as its name. This is how stations are
 * added when a search provider is configured; there is no click-to-place then.
 */
export default function AddressSearch({ onPick }: AddressSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [state, setState] = useState<State>('idle')
  // Ignore a slow response that lands after a newer search started.
  const searchId = useRef(0)

  const runSearch = async (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) return

    const id = ++searchId.current
    setState('searching')
    setResults([])
    try {
      const found = await searchAddress(q)
      if (id !== searchId.current) return
      setResults(found)
      setState(found.length === 0 ? 'empty' : 'idle')
    } catch {
      if (id !== searchId.current) return
      setState('offline')
    }
  }

  const pick = (result: GeocodeResult) => {
    onPick(result.lng, result.lat, result.label)
    setQuery('')
    setResults([])
    setState('idle')
  }

  return (
    <div className="border-t border-neutral-200 px-5 py-3">
      <form onSubmit={runSearch} className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address, e.g. Parking EFREI"
          aria-label="Add a station by address"
          className="min-w-0 flex-1 border-0 border-b-2 border-neutral-300 bg-transparent py-0.5 text-sm outline-none focus:border-neutral-900"
        />
        <button type="submit" className={buttonClass} disabled={query.trim() === '' || state === 'searching'}>
          {state === 'searching' ? '…' : 'Search'}
        </button>
      </form>

      {state === 'offline' && (
        <p className="mt-1 font-mono text-[11px] text-neutral-500">Address search is offline. Try again.</p>
      )}
      {state === 'empty' && <p className="mt-1 font-mono text-[11px] text-neutral-500">No match for that address.</p>}

      {results.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto border-2 border-neutral-200">
          {results.map((result, i) => (
            <li key={`${result.lat},${result.lng},${i}`}>
              <button
                type="button"
                onClick={() => pick(result)}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900"
              >
                <span className="block truncate font-semibold text-neutral-900">{result.label}</span>
                <span className="block font-mono text-[10px] text-neutral-400">
                  {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
