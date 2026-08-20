/**
 * Turning a coordinate into a place name is provider-specific but small. These
 * are the pure parts -- the request URL and the response-to-name reduction --
 * with no fetch and no cache, so they can be tested without a network.
 *
 * The provider is configured with a URL template holding `{lat}` and `{lng}`.
 * A Nominatim reverse endpoint looks like:
 *   https://nominatim.example.org/reverse?format=jsonv2&lat={lat}&lon={lng}
 *
 * Looking an address up is the same shape in the other direction, configured
 * separately because it is a different endpoint and a build may want one without
 * the other. A Nominatim search endpoint looks like:
 *   https://nominatim.example.org/search?format=jsonv2&limit=1&q={q}
 */

export interface GeocodeProvider {
  url: (lng: number, lat: number) => string
  parse: (payload: unknown) => string | null
}

/** A place found by searching an address string. */
export interface GeocodeResult {
  lng: number
  lat: number
  label: string
}
export type FoundPlace = GeocodeResult
export interface SearchProvider {
  url: (query: string) => string
  parse: (payload: unknown) => FoundPlace | null
}
/** Rounded so two waypoints a few metres apart share a cache entry (~11m at 4 dp). */
export function geocodeCacheKey(lng: number, lat: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/** Shortens a Nominatim-style response to a single readable name. */
export function parseNominatim(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>

  const address = p.address as Record<string, unknown> | undefined
  const fromAddress =
    (address?.road as string | undefined) ??
    (address?.pedestrian as string | undefined) ??
    (address?.neighbourhood as string | undefined) ??
    (address?.suburb as string | undefined) ??
    (address?.village as string | undefined) ??
    (address?.town as string | undefined) ??
    (address?.city as string | undefined)
  if (typeof fromAddress === 'string' && fromAddress.trim()) return fromAddress.trim()

  if (typeof p.name === 'string' && p.name.trim()) return p.name.trim()

  // Last resort: the leading segment of the full display string.
  if (typeof p.display_name === 'string' && p.display_name.trim()) {
    return p.display_name.split(',')[0].trim() || null
  }
  return null
}

/**
 * Reads the first result of a Nominatim-style search.
 *
 * Coordinates come back as strings, and a result without usable ones is no
 * result at all: a waypoint at NaN would poison every distance on the route.
 */
export function parseNominatimSearchOne(payload: unknown): FoundPlace | null {
  const first = Array.isArray(payload) ? payload[0] : payload
  if (typeof first !== 'object' || first === null) return null
  const p = first as Record<string, unknown>

  const lat = Number(p.lat)
  const lng = Number(p.lon ?? p.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  const display = typeof p.display_name === 'string' ? p.display_name.trim() : ''
  const name = typeof p.name === 'string' ? p.name.trim() : ''
  return { lng, lat, label: name || display.split(',')[0]?.trim() || '' }
}

export function makeSearchProvider(template: string): SearchProvider {
  return {
    url: (query) => template.replaceAll('{q}', encodeURIComponent(query)),
    parse: parseNominatimSearchOne,
  }
}

/** The search endpoint configured for this build, or null when none is set. */
export function configuredSearchProvider(): SearchProvider | null {
  const template = import.meta.env.VITE_GEOCODE_SEARCH_URL as string | undefined
  return template ? makeSearchProvider(template) : null
}

export function makeProvider(template: string): GeocodeProvider {
  return {
    url: (lng, lat) =>
      template.replaceAll('{lat}', encodeURIComponent(String(lat))).replaceAll('{lng}', encodeURIComponent(String(lng))),
    parse: parseNominatim,
  }
}

/** The provider configured for this build, or null when no endpoint is set. */
export function configuredProvider(): GeocodeProvider | null {
  const template = import.meta.env.VITE_GEOCODE_URL as string | undefined
  return template ? makeProvider(template) : null
}

/**
 * Turns a Nominatim search response (an array of places) into results. Each
 * carries a coordinate and a display label. Malformed entries are skipped.
 */
export function parseNominatimSearch(payload: unknown): GeocodeResult[] {
  if (!Array.isArray(payload)) return []
  const results: GeocodeResult[] = []
  for (const item of payload) {
    if (typeof item !== 'object' || item === null) continue
    const p = item as Record<string, unknown>
    const lat = Number(p.lat)
    const lng = Number(p.lon)
    const label = typeof p.display_name === 'string' ? p.display_name : typeof p.name === 'string' ? p.name : ''
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !label) continue
    results.push({ lng, lat, label })
  }
  return results
}

/** Builds a search URL from a template holding `{q}`. */
export function searchUrl(template: string, query: string): string {
  return template.replaceAll('{q}', encodeURIComponent(query))
}
