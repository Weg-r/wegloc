import { useMemo, useRef } from 'react'
import { useRouteStore } from './routeStore'
import { buildTrack, positionAtTime } from '../routes/interpolate'
import type { SimulationSettings, TrackPoint, Waypoint } from '../types/route'

interface TrackCache {
  waypoints: Waypoint[] | null
  settings: SimulationSettings | null
  track: TrackPoint[]
}

/**
 * Derives the dense track from the current route.
 *
 * Held still for the duration of a waypoint drag: `moveWaypoint` produces a new
 * route on every pointer event, and rebuilding every leg of a dense route dozens
 * of times a second is what makes the drag feel broken. The map line and the
 * waypoint circles are fed from the raw waypoints during the gesture, so the only
 * stale thing is the playback track, which is rebuilt once on release.
 *
 * The cache is keyed on the inputs as well, so ending a gesture that changed
 * nothing -- a click on a waypoint to select it -- costs nothing either.
 */
export function useTrack(): TrackPoint[] {
  const waypoints = useRouteStore((s) => s.route.waypoints)
  const settings = useRouteStore((s) => s.route.settings)
  const dragging = useRouteStore((s) => s.draggingWaypointId !== null)
  const cache = useRef<TrackCache>({ waypoints: null, settings: null, track: [] })

  return useMemo(() => {
    const cached = cache.current
    if (dragging) return cached.track
    if (cached.waypoints === waypoints && cached.settings === settings) return cached.track

    cache.current = { waypoints, settings, track: buildTrack({ waypoints, settings }) }
    return cache.current.track
  }, [waypoints, settings, dragging])
}

/** Interpolated marker position for the current playback time. */
export function useCurrentPosition(track: TrackPoint[]): TrackPoint | null {
  const t = useRouteStore((s) => s.playback.t)
  return useMemo(() => positionAtTime(track, t), [track, t])
}
