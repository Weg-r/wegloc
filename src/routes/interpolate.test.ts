import { describe, expect, it } from 'vitest'
import { buildTrack, positionAtTime, trackDurationMs } from './interpolate'
import { haversineDistance } from './geo'
import { DEFAULT_SETTINGS, type SimulationSettings, type Waypoint } from '../types/route'

function wp(partial: Partial<Waypoint> & { lng: number; lat: number }): Waypoint {
  return { id: `wp-${partial.lng}-${partial.lat}`, altitude: null, legSpeedMps: null, ...partial }
}

function route(waypoints: Waypoint[], settings: Partial<SimulationSettings> = {}) {
  return { waypoints, settings: { ...DEFAULT_SETTINGS, ...settings } }
}

const A = wp({ lng: 2.2945, lat: 48.8584 })
const B = wp({ lng: 2.2977, lat: 48.8557 })
const C = wp({ lng: 2.3012, lat: 48.8566 })

describe('buildTrack: route shapes', () => {
  it('returns nothing for an empty route', () => {
    expect(buildTrack(route([]))).toEqual([])
  })

  it('returns a single stationary sample for one waypoint', () => {
    const track = buildTrack(route([A]))
    expect(track).toHaveLength(1)
    expect(track[0]).toMatchObject({ lng: A.lng, lat: A.lat, speedMps: 0, t: 0 })
  })

  it('contributes no time for duplicate consecutive waypoints', () => {
    const dup = wp({ lng: A.lng, lat: A.lat, id: 'dup' })
    const withDup = trackDurationMs(buildTrack(route([A, dup, B])))
    const without = trackDurationMs(buildTrack(route([A, B])))
    expect(withDup).toBeCloseTo(without, 6)
  })

  it('starts at t = 0 and increases monotonically', () => {
    const track = buildTrack(route([A, B, C]))
    expect(track[0].t).toBe(0)
    for (let i = 1; i < track.length; i++) {
      expect(track[i].t).toBeGreaterThan(track[i - 1].t)
    }
  })

  it('takes distance over speed for the duration', () => {
    const track = buildTrack(route([A, B], { baseSpeedMps: 2 }))
    expect(trackDurationMs(track)).toBeCloseTo((haversineDistance(A, B) / 2) * 1000, 6)
  })

  it('blends altitude across a leg and holds partial data', () => {
    const track = buildTrack(
      route([wp({ lng: 0, lat: 0, altitude: 0 }), wp({ lng: 0.01, lat: 0, altitude: 100 })], {
        altitudeMode: 'per-waypoint',
      }),
    )
    expect(track[0].altitude).toBe(0)
    expect(track.at(-1)?.altitude).toBeCloseTo(100, 6)
  })
})

describe('buildTrack: a zero-speed leg does not teleport', () => {
  it('still crosses the ground', () => {
    const slow = buildTrack(route([A, wp({ ...B, legSpeedMps: 0 })]))
    expect(slow.length).toBeGreaterThan(1)
    expect(trackDurationMs(slow)).toBeGreaterThan(0)
    expect(slow.at(-1)?.lng).toBeCloseTo(B.lng, 6)
    expect(slow.at(-1)?.lat).toBeCloseTo(B.lat, 6)
  })

  it('treats a negative speed the same way', () => {
    const track = buildTrack(route([A, wp({ ...B, legSpeedMps: -5 })]))
    expect(trackDurationMs(track)).toBeGreaterThan(0)
    expect(track.every((p) => p.speedMps > 0)).toBe(true)
  })
})

describe('buildTrack: dwell', () => {
  const DWELL = 30_000

  it('adds its time to the track', () => {
    const without = trackDurationMs(buildTrack(route([A, B])))
    const withStop = trackDurationMs(buildTrack(route([A, wp({ ...B, dwellMs: DWELL })])))
    expect(withStop).toBeCloseTo(without + DWELL, 6)
  })

  it('holds position at zero speed while stopped', () => {
    const track = buildTrack(route([A, wp({ ...B, dwellMs: DWELL }), C]))
    const stopped = track.filter((p) => p.speedMps === 0)
    expect(stopped.length).toBeGreaterThan(1)
    for (const p of stopped) {
      expect(haversineDistance(p, B)).toBeLessThan(1)
    }
  })

  it('holds the heading it arrived on rather than snapping to zero', () => {
    const track = buildTrack(route([A, wp({ ...B, dwellMs: DWELL }), C]))
    const arrival = track.find((p) => p.speedMps === 0)
    expect(arrival?.bearingDeg).toBeGreaterThan(0)
  })

  it('works at the first waypoint', () => {
    const track = buildTrack(route([wp({ ...A, dwellMs: DWELL }), B]))
    expect(track[0].speedMps).toBe(0)
    expect(track[0].t).toBe(0)
    expect(trackDurationMs(track)).toBeCloseTo(trackDurationMs(buildTrack(route([A, B]))) + DWELL, 6)
  })

  it('works at the last waypoint', () => {
    const track = buildTrack(route([A, wp({ ...B, dwellMs: DWELL })]))
    expect(track.at(-1)?.speedMps).toBe(0)
    expect(haversineDistance(track.at(-1) as { lng: number; lat: number }, B)).toBeLessThan(1)
  })

  it('works on a zero-length leg', () => {
    const dup = wp({ lng: A.lng, lat: A.lat, id: 'dup', dwellMs: DWELL })
    expect(trackDurationMs(buildTrack(route([A, dup, B])))).toBeCloseTo(
      trackDurationMs(buildTrack(route([A, B]))) + DWELL,
      6,
    )
  })

  it('works on a one-waypoint route', () => {
    const track = buildTrack(route([wp({ ...A, dwellMs: DWELL })]))
    expect(trackDurationMs(track)).toBeCloseTo(DWELL, 6)
    expect(track.every((p) => p.speedMps === 0)).toBe(true)
  })

  it('ignores zero, null, and absent dwells', () => {
    const base = trackDurationMs(buildTrack(route([A, B])))
    expect(trackDurationMs(buildTrack(route([A, wp({ ...B, dwellMs: 0 })])))).toBeCloseTo(base, 6)
    expect(trackDurationMs(buildTrack(route([A, wp({ ...B, dwellMs: null })])))).toBeCloseTo(base, 6)
  })
})

describe('buildTrack: jitter', () => {
  const jittered = () => buildTrack(route([A, B, C], { jitterMeters: 5, accuracyMeters: 2 }))

  it('leaves the track exact when jitter is off', () => {
    const track = buildTrack(route([A, B, C], { jitterMeters: 0, accuracyMeters: 4 }))
    expect(track[0].lng).toBe(A.lng)
    expect(track[0].lat).toBe(A.lat)
    expect(track.every((p) => p.accuracyMeters === 4)).toBe(true)
  })

  it('never reports a negative or zero accuracy', () => {
    // Accuracy 2m with jitter 5m used to report a negative radius.
    for (const p of jittered()) {
      expect(p.accuracyMeters).toBeGreaterThan(0)
    }
  })

  it('moves the position off the exact line', () => {
    const exact = buildTrack(route([A, B, C], { jitterMeters: 0 }))
    const noisy = jittered()
    const moved = noisy.filter((p, i) => haversineDistance(p, exact[i]) > 0.01)
    expect(moved.length).toBeGreaterThan(noisy.length / 2)
  })

  it('keeps every sample within jitterMeters of the true position', () => {
    const exact = buildTrack(route([A, B, C], { jitterMeters: 0 }))
    const noisy = jittered()
    for (let i = 0; i < noisy.length; i++) {
      expect(haversineDistance(noisy[i], exact[i])).toBeLessThanOrEqual(5 + 1e-6)
    }
  })

  it('is reproducible for the same route', () => {
    expect(jittered()).toEqual(jittered())
  })

  it('does not change the duration', () => {
    expect(trackDurationMs(jittered())).toBeCloseTo(
      trackDurationMs(buildTrack(route([A, B, C], { jitterMeters: 0, accuracyMeters: 2 }))),
      6,
    )
  })
})

describe('buildTrack: speed profile', () => {
  // Two ~360m legs, straight, with a car-like profile.
  const P = wp({ lng: 0, lat: 0 })
  const Q = wp({ lng: 0, lat: 0.0032 })
  const R = wp({ lng: 0, lat: 0.0064 })
  const profile = { maxAccelMps2: 2, maxDecelMps2: 3, corneringMps2: 2 }

  it('is off by default: a route with no limits is unchanged', () => {
    const off = buildTrack(route([P, Q, R]))
    expect(off.every((pt) => pt.speedMps === off[1].speedMps || pt.t === 0)).toBe(true)
  })

  it('starts and ends at rest when on', () => {
    const track = buildTrack(route([P, Q, R], profile))
    expect(track[0].speedMps).toBeCloseTo(0, 3)
    expect(track.at(-1)?.speedMps).toBeCloseTo(0, 3)
  })

  it('never implies acceleration above the configured limit', () => {
    const track = buildTrack(route([P, Q, R], { ...profile, tickRateMs: 100 }))
    const limit = Math.max(profile.maxAccelMps2, profile.maxDecelMps2)
    for (let i = 1; i < track.length; i++) {
      const dt = (track[i].t - track[i - 1].t) / 1000
      if (dt <= 0) continue
      const accel = Math.abs(track[i].speedMps - track[i - 1].speedMps) / dt
      expect(accel).toBeLessThanOrEqual(limit + 0.5)
    }
  })

  it('takes longer than the constant-speed track, because of the ramps', () => {
    const constant = trackDurationMs(buildTrack(route([P, Q, R])))
    const ramped = trackDurationMs(buildTrack(route([P, Q, R], profile)))
    expect(ramped).toBeGreaterThan(constant)
  })

  it('dips speed at a 90-degree turn, and the dip is tunable to off', () => {
    // Q is an interior 90-degree vertex; cruise is high enough that the corner
    // cap actually binds. Compare the speed as each track passes through Q.
    const corner = wp({ lng: 0.0032, lat: 0.0032 })
    const fast = { ...profile, baseSpeedMps: 20 }
    const speedAtVertex = (t: ReturnType<typeof buildTrack>) => {
      let best = t[0]
      for (const pt of t) {
        if (Math.hypot(pt.lng - Q.lng, pt.lat - Q.lat) < Math.hypot(best.lng - Q.lng, best.lat - Q.lat)) best = pt
      }
      return best.speedMps
    }
    const withCorner = buildTrack(route([P, Q, corner], fast))
    const noCorner = buildTrack(route([P, Q, corner], { ...fast, corneringMps2: 0 }))
    expect(speedAtVertex(withCorner)).toBeLessThan(speedAtVertex(noCorner))
  })

  it('brakes into a dwell and accelerates out of it', () => {
    const track = buildTrack(route([P, wp({ ...Q, dwellMs: 10_000 }), R], profile))
    const stopped = track.filter((pt) => pt.speedMps === 0 && pt.t > 0)
    expect(stopped.length).toBeGreaterThan(1)
    // Duration is longer than the same profile with no dwell, by at least the dwell.
    const noDwell = trackDurationMs(buildTrack(route([P, Q, R], profile)))
    expect(trackDurationMs(track)).toBeGreaterThan(noDwell + 10_000 - 1)
  })
})

describe('positionAtTime: antimeridian', () => {
  it('takes the short way between two samples straddling the seam', () => {
    const track = [
      { lng: 179.9, lat: 0, altitude: 0, speedMps: 10, bearingDeg: 90, accuracyMeters: 5, t: 0 },
      { lng: -179.9, lat: 0, altitude: 0, speedMps: 10, bearingDeg: 90, accuracyMeters: 5, t: 1000 },
    ]
    const mid = positionAtTime(track, 500)!
    // Halfway is the seam itself, not somewhere in the middle of the Pacific.
    expect(Math.abs(mid.lng)).toBeCloseTo(180, 6)
  })

  it('keeps its output normalised into [-180, 180)', () => {
    const track = [
      { lng: 179.5, lat: 0, altitude: 0, speedMps: 10, bearingDeg: 90, accuracyMeters: 5, t: 0 },
      { lng: -179.5, lat: 0, altitude: 0, speedMps: 10, bearingDeg: 90, accuracyMeters: 5, t: 1000 },
    ]
    for (const t of [100, 400, 600, 900]) {
      const lng = positionAtTime(track, t)!.lng
      expect(lng).toBeGreaterThanOrEqual(-180)
      expect(lng).toBeLessThan(180)
    }
  })
})

describe('positionAtTime', () => {
  const track = buildTrack(route([A, B, C]))

  it('returns null for an empty track', () => {
    expect(positionAtTime([], 0)).toBeNull()
  })

  it('clamps outside the track', () => {
    expect(positionAtTime(track, -5_000)?.t).toBe(0)
    expect(positionAtTime(track, trackDurationMs(track) + 5_000)?.t).toBe(trackDurationMs(track))
  })

  it('lands on the sample when t sits exactly on one', () => {
    const sample = track[Math.floor(track.length / 2)]
    const at = positionAtTime(track, sample.t)
    expect(at?.lng).toBeCloseTo(sample.lng, 9)
    expect(at?.lat).toBeCloseTo(sample.lat, 9)
  })

  it('wraps bearing the short way through 0/360', () => {
    const wrapping = [
      { lng: 0, lat: 0, altitude: 0, speedMps: 1, bearingDeg: 350, accuracyMeters: 5, t: 0 },
      { lng: 0, lat: 0, altitude: 0, speedMps: 1, bearingDeg: 10, accuracyMeters: 5, t: 1000 },
    ]
    expect(positionAtTime(wrapping, 500)?.bearingDeg).toBeCloseTo(0, 6)
  })

  it('reports zero speed in the middle of a dwell', () => {
    const stopped = buildTrack(route([A, wp({ ...B, dwellMs: 20_000 }), C]))
    const arrival = stopped.findIndex((p) => p.speedMps === 0)
    const mid = (stopped[arrival].t + stopped[arrival + 2].t) / 2
    expect(positionAtTime(stopped, mid)?.speedMps).toBe(0)
  })
})
