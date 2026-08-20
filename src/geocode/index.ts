import { getGeocodeCache, putGeocodeCache } from '../db'
import {
  configuredProvider,
  geocodeCacheKey,
  parseNominatimSearch,
  searchUrl,
  type GeocodeProvider,
  type GeocodeResult,
} from './provider'

export { geocodeCacheKey } from './provider'
export type { GeocodeResult } from './provider'

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

/** Whether a reverse-geocoding provider is configured, so the UI can hide the toggle when it isn't. */
export function geocodingAvailable(): boolean {
  return configuredProvider() !== null
}

/** Whether address search is configured, so the UI can show or hide the search box. */
export function addressSearchAvailable(): boolean {
  return Boolean(import.meta.env.VITE_GEOCODE_SEARCH_URL)
}

/**
 * Finds places matching an address string. Returns [] when search is not
 * configured or nothing matched; throws only on a network failure. Rate-limited
 * through the same queue as reverse geocoding.
 */
export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const template = import.meta.env.VITE_GEOCODE_SEARCH_URL as string | undefined
  const q = query.trim()
  if (!template || !q) return []

  return enqueue(async () => {
    const response = await fetch(searchUrl(template, q), { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Address search responded ${response.status}`)
    return parseNominatimSearch(await response.json())
  })
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

async function fetchPlace(provider: SearchProvider, query: string): Promise<FoundPlace | null> {
  const response = await fetch(provider.url(query), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`)
  return provider.parse(await response.json())
}

/**
 * The place behind an address, or null when the geocoder knows of none.
 *
 * Deliberately not cached. A reverse lookup is asked the same question over and
 * over — every waypoint of every route, forever — which is what the cache is
 * for. An address is typed once by a person who is about to see the answer on
 * the map; storing it would grow the database for no second read.
 *
 * Shares the outgoing queue with the reverse lookups, so a search typed while
 * names are resolving still respects the one-request-a-second policy rather than
 * jumping the line.
 */
export async function searchPlace(query: string): Promise<FoundPlace | null> {
  const provider = configuredSearchProvider()
  const trimmed = query.trim()
  if (!provider || !trimmed) return null
  return enqueue(() => fetchPlace(provider, trimmed))
}
