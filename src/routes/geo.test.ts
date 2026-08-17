import { describe, expect, it } from 'vitest'
import { bearing, haversineDistance, interpolatePosition, offsetMeters } from './geo'

const PARIS = { lng: 2.3522, lat: 48.8566 }
const LONDON = { lng: -0.1276, lat: 51.5072 }

describe('haversineDistance', () => {
  it('measures a known city pair', () => {
    // Paris to London is ~343.5km great-circle.
    expect(haversineDistance(PARIS, LONDON)).toBeCloseTo(343_500, -3)
  })

  it('is zero for identical points and symmetric otherwise', () => {
    expect(haversineDistance(PARIS, PARIS)).toBe(0)
    expect(haversineDistance(PARIS, LONDON)).toBeCloseTo(haversineDistance(LONDON, PARIS), 6)
  })

  it('takes the short way across the antimeridian', () => {
    const west = { lng: 179.9, lat: 0 }
    const east = { lng: -179.9, lat: 0 }
    // 0.2 degrees of longitude at the equator, not 359.8.
    expect(haversineDistance(west, east)).toBeCloseTo(22_240, -3)
  })
})

describe('bearing', () => {
  it('reads due north and due east', () => {
    expect(bearing({ lng: 0, lat: 0 }, { lng: 0, lat: 1 })).toBeCloseTo(0, 6)
    expect(bearing({ lng: 0, lat: 0 }, { lng: 1, lat: 0 })).toBeCloseTo(90, 6)
    expect(bearing({ lng: 0, lat: 0 }, { lng: 0, lat: -1 })).toBeCloseTo(180, 6)
  })

  it('stays in [0, 360)', () => {
    const b = bearing({ lng: 0, lat: 0 }, { lng: -1, lat: 0 })
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThan(360)
    expect(b).toBeCloseTo(270, 6)
  })

  it('crosses the antimeridian eastward', () => {
    expect(bearing({ lng: 179.9, lat: 0 }, { lng: -179.9, lat: 0 })).toBeCloseTo(90, 4)
  })
})

describe('interpolatePosition', () => {
  it('pins the endpoints', () => {
    expect(interpolatePosition(PARIS, LONDON, 0)).toEqual(PARIS)
    expect(interpolatePosition(PARIS, LONDON, 1)).toEqual(LONDON)
    expect(interpolatePosition(PARIS, LONDON, -1)).toEqual(PARIS)
    expect(interpolatePosition(PARIS, LONDON, 2)).toEqual(LONDON)
  })

  it('halves the distance at f = 0.5', () => {
    const mid = interpolatePosition(PARIS, LONDON, 0.5)
    expect(haversineDistance(PARIS, mid)).toBeCloseTo(haversineDistance(mid, LONDON), 3)
  })

  it('survives identical points', () => {
    expect(interpolatePosition(PARIS, { ...PARIS }, 0.5)).toEqual(PARIS)
  })

  it('takes the short way across the antimeridian', () => {
    const mid = interpolatePosition({ lng: 179.9, lat: 0 }, { lng: -179.9, lat: 0 }, 0.5)
    expect(Math.abs(mid.lng)).toBeCloseTo(180, 4)
  })
})

describe('offsetMeters', () => {
  it('moves north and east by the requested distance', () => {
    const from = { lng: 2, lat: 48 }
    expect(haversineDistance(from, offsetMeters(from, 0, 100))).toBeCloseTo(100, 1)
    expect(haversineDistance(from, offsetMeters(from, 100, 0))).toBeCloseTo(100, 1)
  })

  it('is a no-op for a zero offset', () => {
    const from = { lng: 2, lat: 48 }
    expect(offsetMeters(from, 0, 0)).toEqual(from)
  })

  it('leaves longitude alone at the pole, where east is undefined', () => {
    const pole = { lng: 10, lat: 90 }
    expect(offsetMeters(pole, 500, 0).lng).toBe(10)
  })
})
