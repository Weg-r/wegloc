import { getGeocodeCache, putGeocodeCache } from '../db'
import { configuredProvider, geocodeCacheKey, type GeocodeProvider } from './provider'

export { geocodeCacheKey } from './provider'

/**
 * The one place that reverse-geocodes: the only module that fetches a place
 * name, and the only one that touches the geocode cache. Off unless a provider
 * URL is configured *and* the caller opts in -- the editor makes no network
 * request for a name on its own.
 *
 * Nothing in `src/routes` or `src/lib` imports this: names are an editor
 * convenience, not part of the route model or the simulation.
 */

/** Minimum gap between outgoing requests. Nominatim's public policy is one per second. */
const MIN_REQUEST_GAP_MS = 1100

export type GeocodeStatus = 'idle' | 'working' | 'offline'

/** Whether a provider is configured at all, so the UI can hide the toggle when it isn't. */
export function geocodingAvailable(): boolean {
  return configuredProvider() !== null
}

let lastRequestAt = 0
let chain: Promise<unknown> = Promise.resolve()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Serialises requests and spaces them out, so a burst of waypoints trickles rather than floods. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt)
    if (wait > 0) await delay(wait)
    lastRequestAt = Date.now()
    return task()
  })
  // Keep the chain alive even if this task rejects.
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function fetchName(provider: GeocodeProvider, lng: number, lat: number): Promise<string | null> {
  const response = await fetch(provider.url(lng, lat), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`)
  return provider.parse(await response.json())
}

/**
 * A place name for a coordinate, or null if there is none. Returns from the
 * cache immediately when it can; otherwise queues one rate-limited request and
 * caches whatever comes back, including "nothing", so the same point is never
 * asked twice. A network failure throws, for the caller to show as an offline
 * state and fall back to coordinates.
 */
export async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  const provider = configuredProvider()
  if (!provider) return null

  const key = geocodeCacheKey(lng, lat)

  const cached = await getGeocodeCache(key).catch(() => undefined)
  if (cached) return cached.label || null

  const label = await enqueue(() => fetchName(provider, lng, lat))
  await putGeocodeCache({ key, label: label ?? '', at: Date.now() }).catch(() => {
    // Cache unavailable (private browsing); the lookup still worked this session.
  })
  return label
}
