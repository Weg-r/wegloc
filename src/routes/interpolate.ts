import { bearing, haversineDistance, interpolatePosition } from './geo'
import type { Route, TrackPoint, Waypoint } from '../types/route'

/** Deterministic pseudo-random in [-1, 1], seeded by index so jitter is reproducible. */
function seededJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

function altitudeAt(waypoints: Waypoint[], index: number, flatMode: boolean, flatValue: number): number {
  if (flatMode) return flatValue
  const wp = waypoints[index]
  if (wp.altitude !== null) return wp.altitude

  for (let i = index - 1; i >= 0; i--) {
    if (waypoints[i].altitude !== null) return waypoints[i].altitude as number
  }
  for (let i = index + 1; i < waypoints.length; i++) {
    if (waypoints[i].altitude !== null) return waypoints[i].altitude as number
  }
  return 0
}

/**
 * Turns a route into a dense point stream at a fixed tick rate. Pure: no DOM,
 * no browser APIs. Speed changes take effect on the leg they're set on.
 */
export function buildTrack(route: Route): TrackPoint[] {
  const { waypoints, settings } = route
  if (waypoints.length === 0) return []

  const flatMode = settings.altitudeMode === 'flat'
  const tick = Math.max(16, settings.tickRateMs)

  if (waypoints.length === 1) {
    const wp = waypoints[0]
    return [
      {
        lng: wp.lng,
        lat: wp.lat,
        altitude: altitudeAt(waypoints, 0, flatMode, settings.flatAltitude),
        speedMps: 0,
        bearingDeg: 0,
        accuracyMeters: settings.accuracyMeters,
        t: 0,
      },
    ]
  }

  const track: TrackPoint[] = []
  let elapsed = 0
  let pointIndex = 0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]
    const to = waypoints[i + 1]
    const distance = haversineDistance(from, to)
    const speed = to.legSpeedMps ?? settings.baseSpeedMps
    const legBearing = distance > 0 ? bearing(from, to) : (track.at(-1)?.bearingDeg ?? 0)
    const durationMs = speed > 0 ? (distance / speed) * 1000 : 0
    const altFrom = altitudeAt(waypoints, i, flatMode, settings.flatAltitude)
    const altTo = altitudeAt(waypoints, i + 1, flatMode, settings.flatAltitude)

    if (i === 0) {
      track.push({
        lng: from.lng,
        lat: from.lat,
        altitude: altFrom,
        speedMps: speed,
        bearingDeg: legBearing,
        accuracyMeters: settings.accuracyMeters + settings.jitterMeters * seededJitter(pointIndex++),
        t: 0,
      })
    }

    if (durationMs === 0) continue

    const steps = Math.max(1, Math.ceil(durationMs / tick))
    for (let s = 1; s <= steps; s++) {
      const f = s / steps
      const pos = interpolatePosition(from, to, f)
      track.push({
        lng: pos.lng,
        lat: pos.lat,
        altitude: altFrom + (altTo - altFrom) * f,
        speedMps: speed,
        bearingDeg: legBearing,
        accuracyMeters: settings.accuracyMeters + settings.jitterMeters * seededJitter(pointIndex++),
        t: elapsed + f * durationMs,
      })
    }

    elapsed += durationMs
  }

  return track
}

export function trackDurationMs(track: TrackPoint[]): number {
  return track.at(-1)?.t ?? 0
}

function lerpAngleDeg(a: number, b: number, f: number): number {
  const diff = ((((b - a) % 360) + 540) % 360) - 180
  return (a + diff * f + 360) % 360
}

/** Interpolated position/heading at time `t` (ms), for smooth playback scrubbing. */
export function positionAtTime(track: TrackPoint[], t: number): TrackPoint | null {
  if (track.length === 0) return null
  if (track.length === 1) return track[0]

  const clamped = Math.min(Math.max(t, 0), trackDurationMs(track))

  let lo = 0
  let hi = track.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (track[mid].t <= clamped) lo = mid
    else hi = mid
  }

  const a = track[lo]
  const b = track[hi]
  const span = b.t - a.t
  const f = span > 0 ? (clamped - a.t) / span : 0

  return {
    lng: a.lng + (b.lng - a.lng) * f,
    lat: a.lat + (b.lat - a.lat) * f,
    altitude: a.altitude + (b.altitude - a.altitude) * f,
    speedMps: a.speedMps + (b.speedMps - a.speedMps) * f,
    bearingDeg: lerpAngleDeg(a.bearingDeg, b.bearingDeg, f),
    accuracyMeters: a.accuracyMeters + (b.accuracyMeters - a.accuracyMeters) * f,
    t: clamped,
  }
}
