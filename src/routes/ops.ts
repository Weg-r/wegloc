import { haversineDistance, interpolatePosition, pathLengthMeters } from './geo'
import type { Waypoint } from '../types/route'

/**
 * Editing operations on a waypoint list. Pure: no React, no store, no DOM --
 * every one of these is reachable from the map, the list, and the keyboard, and
 * none of those callers should be reimplementing the maths.
 *
 * Leg speed lives on the waypoint a leg arrives at, so an operation that
 * reorders waypoints has to move leg speeds separately from the waypoints
 * carrying them. That is the whole subtlety in this file.
 */

/** Inserts `waypoint` so it ends up at `index`, clamped to the ends of the list. */
export function insertWaypoint(waypoints: Waypoint[], index: number, waypoint: Waypoint): Waypoint[] {
  const at = Math.min(Math.max(index, 0), waypoints.length)
  return [...waypoints.slice(0, at), waypoint, ...waypoints.slice(at)]
}

/**
 * Splits the leg that arrives at `waypoints[legIndex + 1]`, putting a new
 * waypoint at the given position. Both halves keep the speed the original leg
 * ran at, so splitting a leg never changes how the route is driven.
 */
export function splitLeg(
  waypoints: Waypoint[],
  legIndex: number,
  position: { lng: number; lat: number },
  id: string,
): Waypoint[] {
  const to = waypoints[legIndex + 1]
  if (!to) return waypoints

  return insertWaypoint(waypoints, legIndex + 1, {
    id,
    lng: position.lng,
    lat: position.lat,
    altitude: null,
    legSpeedMps: to.legSpeedMps,
    dwellMs: null,
  })
}

/** Moves the waypoint at `from` to `to`, carrying its own leg speed with it. */
export function moveWaypointToIndex(waypoints: Waypoint[], from: number, to: number): Waypoint[] {
  if (from === to || from < 0 || from >= waypoints.length) return waypoints
  const target = Math.min(Math.max(to, 0), waypoints.length - 1)
  if (from === target) return waypoints

  const next = [...waypoints]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved)
  return next
}

/**
 * Reverses the direction of travel. The waypoints keep their own altitude and
 * dwell -- a stop at a corner is a stop at that corner whichever way you drive
 * through it -- but leg speeds belong to legs, so they shift one place along the
 * reversed list. Reversing twice returns the original route exactly.
 */
export function reverseWaypoints(waypoints: Waypoint[]): Waypoint[] {
  const reversed = [...waypoints].reverse()
  return reversed.map((wp, i) => ({
    ...wp,
    legSpeedMps: i === 0 ? null : (reversed[i - 1].legSpeedMps ?? null),
  }))
}

/**
 * Index of the leg whose ground track passes closest to `position`, or -1 for a
 * route with no legs. Used to turn a click on the route line into the leg to
 * split, without the map having to publish a feature per leg.
 */
export function nearestLegIndex(waypoints: Waypoint[], position: { lng: number; lat: number }): number {
  let best = -1
  let bestDistance = Infinity

  for (let i = 0; i < waypoints.length - 1; i++) {
    const distance = distanceToLeg(waypoints[i], waypoints[i + 1], position)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }

  return best
}

/**
 * Distance in meters from `position` to the segment a -> b. Samples the leg
 * rather than solving it: legs here are short relative to the globe, and this
 * keeps the great-circle path the interpolator actually uses.
 */
function distanceToLeg(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
  position: { lng: number; lat: number },
): number {
  const SAMPLES = 8
  let best = Math.min(haversineDistance(a, position), haversineDistance(b, position))

  for (let s = 1; s < SAMPLES; s++) {
    const point = interpolatePosition(a, b, s / SAMPLES)
    const distance = haversineDistance(point, position)
    if (distance < best) best = distance
  }

  return best
}

/** True if a coordinate pair is somewhere on Earth. */
export function isValidCoordinate(lng: number, lat: number): boolean {
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
}

/**
 * Sum of the leg lengths, meters: the routed polyline where a leg has one, else
 * the straight great-circle line. Zero for a route with under two waypoints.
 */
export function totalDistanceMeters(waypoints: Waypoint[]): number {
  let total = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    const path = waypoints[i + 1].path
    total += path && path.length >= 2 ? pathLengthMeters(path) : haversineDistance(waypoints[i], waypoints[i + 1])
  }
  return total
}
