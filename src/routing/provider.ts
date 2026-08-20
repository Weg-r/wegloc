/**
 * The pure parts of talking to a routing service: the request URL and turning
 * the response into per-leg polylines. No fetch, no cache, so it is tested
 * without a network.
 *
 * Modelled on OSRM's HTTP API, which most self-hosted routers (OSRM, and via
 * translation OpenRouteService / GraphHopper) can speak. The endpoint is a URL
 * template with `{coords}` (a `lng,lat;lng,lat;...` list) and `{profile}`:
 *   https://router.example.org/route/v1/{profile}/{coords}?geometries=geojson&overview=full&steps=true
 */

export type TravelMode = 'car'

/** OSRM profile name for a travel mode. */
export function osrmProfile(mode: TravelMode): string {
  return mode === 'car' ? 'driving' : 'driving'
}

export interface RoutedLeg {
  /** Ground length of the leg as routed, meters. */
  distanceMeters: number
  /** The leg's polyline, [lng, lat] pairs, from one waypoint to the next. */
  path: [number, number][]
}

/** Builds the request URL for the ordered waypoints. */
export function routingUrl(template: string, mode: TravelMode, waypoints: { lng: number; lat: number }[]): string {
  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(';')
  return template.replaceAll('{profile}', osrmProfile(mode)).replaceAll('{coords}', coords)
}

function concatStepGeometry(steps: unknown[]): [number, number][] {
  const path: [number, number][] = []
  for (const step of steps) {
    const geometry = (step as { geometry?: { coordinates?: unknown } }).geometry
    const coords = geometry?.coordinates
    if (!Array.isArray(coords)) continue
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2) continue
      const point: [number, number] = [Number(c[0]), Number(c[1])]
      // Drop a repeated vertex where one step ends and the next begins.
      const last = path[path.length - 1]
      if (last && last[0] === point[0] && last[1] === point[1]) continue
      path.push(point)
    }
  }
  return path
}

/**
 * Per-leg geometry from an OSRM route response. Returns one RoutedLeg for each
 * consecutive waypoint pair, or null if the response has no usable route (no
 * road found, malformed). The caller attaches each leg's path to the waypoint
 * it arrives at.
 */
export function parseOsrmRoute(payload: unknown): RoutedLeg[] | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  if (p.code !== 'Ok') return null

  const routes = p.routes
  if (!Array.isArray(routes) || routes.length === 0) return null
  const legs = (routes[0] as { legs?: unknown }).legs
  if (!Array.isArray(legs) || legs.length === 0) return null

  const result: RoutedLeg[] = []
  for (const leg of legs) {
    const l = leg as { distance?: unknown; steps?: unknown }
    const steps = Array.isArray(l.steps) ? l.steps : []
    const path = concatStepGeometry(steps)
    if (path.length < 2) return null
    result.push({ distanceMeters: typeof l.distance === 'number' ? l.distance : 0, path })
  }
  return result
}
