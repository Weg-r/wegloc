import { describe, expect, it } from 'vitest'
import { boundsForWaypoints, waypointsToLine } from './routeSource'
import type { Waypoint } from '../types/route'

function wp(lng: number, lat: number): Waypoint {
  return { id: `${lng},${lat}`, lng, lat, altitude: null, legSpeedMps: null, dwellMs: null }
}

describe('waypointsToLine: antimeridian', () => {
  it('unwraps longitudes so the line never spans the globe', () => {
    const line = waypointsToLine([wp(179, 0), wp(-179, 0)])
    const lngs = line.geometry.coordinates.map((c) => c[0])
    // Consecutive drawn longitudes stay within 180 of each other.
    expect(Math.abs(lngs[1] - lngs[0])).toBeLessThanOrEqual(180)
    // The second point is drawn at ~181, not -179.
    expect(lngs[1]).toBeCloseTo(181, 6)
  })

  it('leaves an ordinary route untouched', () => {
    const line = waypointsToLine([wp(2.29, 48.85), wp(2.3, 48.86)])
    expect(line.geometry.coordinates).toEqual([
      [2.29, 48.85],
      [2.3, 48.86],
    ])
  })
})

describe('boundsForWaypoints', () => {
  it('returns null for an empty route', () => {
    expect(boundsForWaypoints([])).toBeNull()
  })

  it('centres on the single waypoint of a one-point route', () => {
    const b = boundsForWaypoints([wp(2.29, 48.85)])
    expect(b?.point).toEqual([2.29, 48.85])
  })

  it('frames every waypoint of a normal route', () => {
    const b = boundsForWaypoints([wp(2.2, 48.8), wp(2.4, 48.9), wp(2.3, 48.85)])
    expect(b?.bbox).toEqual([2.2, 48.8, 2.4, 48.9])
    expect(b?.point).toBeUndefined()
  })

  it('frames the short span across the antimeridian, not the whole globe', () => {
    const b = boundsForWaypoints([wp(179, -16), wp(-179, -17)])!
    const [west, , east] = b.bbox
    // ~2 degrees wide in the unwrapped frame, not ~358.
    expect(east - west).toBeLessThan(10)
  })
})
