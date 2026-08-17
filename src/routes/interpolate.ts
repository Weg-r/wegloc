import { bearing, haversineDistance, interpolatePosition, offsetMeters } from './geo'
import { correlatedNoise } from './noise'
import type { Route, SimulationSettings, TrackPoint, Waypoint } from '../types/route'

/**
 * Slowest a leg is allowed to run. A leg speed of zero used to produce no track
 * points at all, so the position teleported to the next waypoint -- the one
 * input that looks like "stop here" was the one that skipped the ground. Stops
 * are expressed with `dwellMs`; a zero speed is just very slow.
 */
const MIN_SPEED_MPS = 0.01

/** Reported accuracy stays positive however large the jitter. */
const MIN_ACCURACY_M = 0.5

/** Samples over which the position noise completes one wander. */
const JITTER_PERIOD_SAMPLES = 12

const NOISE_SEED_EAST = 1
const NOISE_SEED_NORTH = 2
const NOISE_SEED_ACCURACY = 3

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
 * Applies receiver noise to one sample. The position wanders inside a circle of
 * `jitterMeters` while the reported accuracy stays near `accuracyMeters`, which
 * is the way a real receiver behaves -- code that filters fixes by
 * distance-from-last has something to work with, and the radius never inverts.
 * With `jitterMeters` at 0 the sample is exact.
 */
function applyNoise(
  index: number,
  lng: number,
  lat: number,
  settings: SimulationSettings,
): { lng: number; lat: number; accuracyMeters: number } {
  const jitter = Math.max(0, settings.jitterMeters)
  if (jitter === 0) {
    return { lng, lat, accuracyMeters: settings.accuracyMeters }
  }

  const east = correlatedNoise(index, NOISE_SEED_EAST, JITTER_PERIOD_SAMPLES)
  const north = correlatedNoise(index, NOISE_SEED_NORTH, JITTER_PERIOD_SAMPLES)
  // Clamp to the unit disc so the offset never exceeds jitterMeters in any direction.
  const norm = Math.hypot(east, north)
  const scale = norm > 1 ? 1 / norm : 1
  const position = offsetMeters({ lng, lat }, jitter * east * scale, jitter * north * scale)

  const spread = Math.min(jitter, settings.accuracyMeters * 0.5)
  const accuracy =
    settings.accuracyMeters + spread * correlatedNoise(index, NOISE_SEED_ACCURACY, JITTER_PERIOD_SAMPLES)

  return { lng: position.lng, lat: position.lat, accuracyMeters: Math.max(MIN_ACCURACY_M, accuracy) }
}

/**
 * Turns a route into a dense point stream at a fixed tick rate. Pure: no DOM,
 * no browser APIs. Speed changes take effect on the leg they're set on, and a
 * waypoint's `dwellMs` holds the position there before the next leg starts.
 */
export function buildTrack(route: Pick<Route, 'waypoints' | 'settings'>): TrackPoint[] {
  const { waypoints, settings } = route
  if (waypoints.length === 0) return []

  const flatMode = settings.altitudeMode === 'flat'
  const tick = Math.max(16, settings.tickRateMs)
  const track: TrackPoint[] = []
  let pointIndex = 0

  const push = (
    lng: number,
    lat: number,
    altitude: number,
    speedMps: number,
    bearingDeg: number,
    t: number,
  ) => {
    const noised = applyNoise(pointIndex++, lng, lat, settings)
    track.push({
      lng: noised.lng,
      lat: noised.lat,
      altitude,
      speedMps,
      bearingDeg,
      accuracyMeters: noised.accuracyMeters,
      t,
    })
  }

  /**
   * Holds a waypoint's position for its dwell. A stationary receiver still
   * reports, so the samples keep coming with speed 0 and the heading held from
   * the leg that arrived here. Returns the time consumed.
   */
  const pushDwell = (wp: Waypoint, altitude: number, heldBearing: number, startT: number): number => {
    const dwell = wp.dwellMs ?? 0
    if (!(dwell > 0)) return 0

    const steps = Math.max(1, Math.ceil(dwell / tick))
    for (let s = 1; s <= steps; s++) {
      push(wp.lng, wp.lat, altitude, 0, heldBearing, startT + (s / steps) * dwell)
    }
    return dwell
  }

  if (waypoints.length === 1) {
    const wp = waypoints[0]
    const altitude = altitudeAt(waypoints, 0, flatMode, settings.flatAltitude)
    push(wp.lng, wp.lat, altitude, 0, 0, 0)
    pushDwell(wp, altitude, 0, 0)
    return track
  }

  let elapsed = 0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i]
    const to = waypoints[i + 1]
    const distance = haversineDistance(from, to)
    const speed = Math.max(MIN_SPEED_MPS, to.legSpeedMps ?? settings.baseSpeedMps)
    const legBearing = distance > 0 ? bearing(from, to) : (track.at(-1)?.bearingDeg ?? 0)
    const durationMs = (distance / speed) * 1000
    const altFrom = altitudeAt(waypoints, i, flatMode, settings.flatAltitude)
    const altTo = altitudeAt(waypoints, i + 1, flatMode, settings.flatAltitude)

    if (i === 0) {
      const stopped = (from.dwellMs ?? 0) > 0
      push(from.lng, from.lat, altFrom, stopped ? 0 : speed, legBearing, 0)
    }

    // The sample at `from` was emitted by the previous leg, or just above for the
    // first waypoint; the dwell holds that position on the heading it arrived on.
    elapsed += pushDwell(from, altFrom, track.at(-1)?.bearingDeg ?? legBearing, elapsed)

    // Only a zero-length leg contributes no time now that speed is clamped.
    if (durationMs === 0) continue

    const steps = Math.max(1, Math.ceil(durationMs / tick))
    for (let s = 1; s <= steps; s++) {
      const f = s / steps
      const pos = interpolatePosition(from, to, f)
      push(pos.lng, pos.lat, altFrom + (altTo - altFrom) * f, speed, legBearing, elapsed + f * durationMs)
    }

    elapsed += durationMs
  }

  const lastIndex = waypoints.length - 1
  pushDwell(
    waypoints[lastIndex],
    altitudeAt(waypoints, lastIndex, flatMode, settings.flatAltitude),
    track.at(-1)?.bearingDeg ?? 0,
    elapsed,
  )

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
