import { useEffect, useRef, useState } from 'react'
import { routeLegs, type TravelMode } from '../routing'
import { useRouteStore } from '../store/routeStore'
import type { Waypoint } from '../types/route'

export type RoutingStatus = 'idle' | 'working' | 'offline' | 'noroute'

/** Identity of the waypoint *positions* only -- not their routed paths, so applying paths can't retrigger. */
function positionSignature(waypoints: Waypoint[]): string {
  return waypoints.map((wp) => `${wp.id}:${wp.lng.toFixed(6)},${wp.lat.toFixed(6)}`).join('|')
}

function hasAnyPath(waypoints: Waypoint[]): boolean {
  return waypoints.some((wp) => wp.path && wp.path.length >= 2)
}

/**
 * Keeps each leg's road-following polyline in sync with the waypoints, when a
 * router is configured and the user has road-following on. Routes through the
 * whole waypoint list, attaches one polyline per leg, and reports status.
 *
 * The routed geometry is derived data applied through `applyRoutedPaths`, which
 * takes no undo step; the effect keys on waypoint *positions* only, so writing
 * the paths back does not loop. Skips while dragging and when there are fewer
 * than two waypoints. On failure it reports `offline` and leaves the legs
 * straight; the route stays usable.
 */
export function useRouting(
  waypoints: Waypoint[],
  mode: TravelMode,
  enabled: boolean,
  dragging: boolean,
): RoutingStatus {
  const [status, setStatus] = useState<RoutingStatus>('idle')
  const applyRoutedPaths = useRouteStore((s) => s.applyRoutedPaths)
  const signature = positionSignature(waypoints)
  const wpRef = useRef(waypoints)
  wpRef.current = waypoints

  useEffect(() => {
    if (dragging) return

    if (!enabled) {
      // Turned off, or no router: drop any routed geometry back to straight legs.
      if (hasAnyPath(wpRef.current)) applyRoutedPaths([])
      setStatus('idle')
      return
    }

    const points = wpRef.current
    if (points.length < 2) {
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('working')

    // The waypoints changed, so any existing routed paths belong to the old
    // shape; drop them to straight lines until the new route arrives, rather than
    // leaving geometry that no longer connects.
    if (hasAnyPath(points)) applyRoutedPaths([])

    ;(async () => {
      try {
        const legs = await routeLegs(mode, points.map((wp) => ({ lng: wp.lng, lat: wp.lat })))
        if (cancelled) return
        if (!legs) {
          // No road route found (or routing unavailable): straight legs.
          if (hasAnyPath(wpRef.current)) applyRoutedPaths([])
          setStatus('noroute')
          return
        }
        applyRoutedPaths(legs.map((leg) => leg.path))
        setStatus('idle')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    })()

    return () => {
      cancelled = true
    }
    // Positions and mode drive routing; applying paths does not change the signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mode, enabled, dragging, applyRoutedPaths])

  return status
}
