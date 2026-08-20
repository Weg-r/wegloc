import { parseOsrmRoute, routingUrl, type RoutedLeg, type TravelMode } from './provider'

export type { TravelMode, RoutedLeg } from './provider'

/**
 * The one place that calls the routing service. Off unless VITE_ROUTING_URL is
 * configured; the editor requests a route only when the user has enabled
 * road-following, never on its own. Pure request-building and parsing live in
 * `provider.ts`; this module only does the fetch.
 *
 * Nothing in `src/routes` or `src/lib` imports this: a routed path is handed to
 * the pure interpolator as data, it is never fetched from inside it.
 */

export function routingAvailable(): boolean {
  return Boolean(import.meta.env.VITE_ROUTING_URL)
}

/**
 * Routes through the ordered waypoints, returning one polyline per leg (from
 * each waypoint to the next). Returns null when routing is unavailable or the
 * service finds no road route; throws only on a network/transport failure, for
 * the caller to show as an offline state.
 */
export async function routeLegs(
  mode: TravelMode,
  waypoints: { lng: number; lat: number }[],
): Promise<RoutedLeg[] | null> {
  const template = import.meta.env.VITE_ROUTING_URL as string | undefined
  if (!template || waypoints.length < 2) return null

  const response = await fetch(routingUrl(template, mode, waypoints), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Router responded ${response.status}`)
  return parseOsrmRoute(await response.json())
}
