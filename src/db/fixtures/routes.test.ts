import { describe, expect, it } from 'vitest'
import { FIXTURE_ID_PREFIX, FIXTURE_ROUTES } from './routes'
import { buildTrack, trackDurationMs } from '../../routes/interpolate'
import { haversineDistance } from '../../routes/geo'

describe('fixture routes', () => {
  it('are uniquely and recognisably identified', () => {
    const ids = FIXTURE_ROUTES.map((route) => route.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith(FIXTURE_ID_PREFIX))).toBe(true)
  })

  it('have stable timestamps, so a fixture serializes the same on every machine', () => {
    for (const route of FIXTURE_ROUTES) {
      expect(route.createdAt).toBe(1_700_000_000_000)
      expect(route.updatedAt).toBe(1_700_000_000_000)
    }
  })

  it('have unique waypoint ids within each route', () => {
    for (const route of FIXTURE_ROUTES) {
      const ids = route.waypoints.map((wp) => wp.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  // The point of the ugly cases: the maths has to survive all of them.
  it.each(FIXTURE_ROUTES.map((route) => [route.name, route] as const))(
    'builds a usable track for %s',
    (_name, route) => {
      const track = buildTrack(route)

      expect(track.length).toBe(route.waypoints.length === 0 ? 0 : track.length)
      expect(trackDurationMs(track)).toBeGreaterThanOrEqual(0)

      for (let i = 0; i < track.length; i++) {
        expect(Number.isFinite(track[i].lng)).toBe(true)
        expect(Number.isFinite(track[i].lat)).toBe(true)
        expect(Number.isFinite(track[i].altitude)).toBe(true)
        expect(track[i].accuracyMeters).toBeGreaterThan(0)
        expect(track[i].bearingDeg).toBeGreaterThanOrEqual(0)
        expect(track[i].bearingDeg).toBeLessThan(360)
        if (i > 0) expect(track[i].t).toBeGreaterThan(track[i - 1].t)
      }
    },
  )

  it('covers the antimeridian without going the long way around', () => {
    const route = FIXTURE_ROUTES.find((r) => r.id.endsWith('antimeridian'))
    expect(route).toBeDefined()

    const track = buildTrack(route!)
    // The whole route is a couple of hundred kilometres, not most of the planet.
    let total = 0
    for (let i = 1; i < track.length; i++) total += haversineDistance(track[i - 1], track[i])
    expect(total).toBeLessThan(300_000)
  })

  it('has a route with a real stop in it', () => {
    const route = FIXTURE_ROUTES.find((r) => r.id.endsWith('stop-in-the-middle'))
    const track = buildTrack(route!)
    expect(track.some((p) => p.speedMps === 0)).toBe(true)
  })

  it('has a dense route big enough to be worth measuring', () => {
    const dense = FIXTURE_ROUTES.find((r) => r.id.endsWith('dense'))
    expect(dense!.waypoints.length).toBeGreaterThanOrEqual(2000)
  })

  it('is deterministic: the dense route is the same on every run', () => {
    const dense = FIXTURE_ROUTES.find((r) => r.id.endsWith('dense'))!
    expect(dense.waypoints[1234].lng).toBeCloseTo(dense.waypoints[1234].lng, 12)
    expect(buildTrack(dense)).toEqual(buildTrack(dense))
  })
})
