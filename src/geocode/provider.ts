/**
 * Turning a coordinate into a place name is provider-specific but small. These
 * are the pure parts -- the request URL and the response-to-name reduction --
 * with no fetch and no cache, so they can be tested without a network.
 *
 * The provider is configured with a URL template holding `{lat}` and `{lng}`.
 * A Nominatim reverse endpoint looks like:
 *   https://nominatim.example.org/reverse?format=jsonv2&lat={lat}&lon={lng}
 */

export interface GeocodeProvider {
  url: (lng: number, lat: number) => string
  parse: (payload: unknown) => string | null
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
