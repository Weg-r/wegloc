import { describe, expect, it } from 'vitest'
import { osrmProfile, parseOsrmRoute, routingUrl } from './provider'

describe('routingUrl', () => {
  it('builds a coordinate list and profile', () => {
    const url = routingUrl(
      'https://r.test/route/v1/{profile}/{coords}?steps=true',
      'car',
      [{ lng: 2.29, lat: 48.85 }, { lng: 2.3, lat: 48.86 }],
    )
    expect(url).toBe('https://r.test/route/v1/driving/2.29,48.85;2.3,48.86?steps=true')
  })

  it('maps car to the OSRM driving profile', () => {
    expect(osrmProfile('car')).toBe('driving')
  })
})

describe('parseOsrmRoute', () => {
  const ok = {
    code: 'Ok',
    routes: [
      {
        legs: [
          {
            distance: 120,
            steps: [
              { geometry: { coordinates: [[0, 0], [0, 0.001]] } },
              { geometry: { coordinates: [[0, 0.001], [0.001, 0.001]] } },
            ],
          },
        ],
      },
    ],
  }

  it('returns one leg with a concatenated, de-duplicated polyline', () => {
    const legs = parseOsrmRoute(ok)
    expect(legs).not.toBeNull()
    expect(legs).toHaveLength(1)
    expect(legs![0].distanceMeters).toBe(120)
    // The repeated [0, 0.001] between the two steps appears once.
    expect(legs![0].path).toEqual([[0, 0], [0, 0.001], [0.001, 0.001]])
  })

  it('returns null when the router reports no route', () => {
    expect(parseOsrmRoute({ code: 'NoRoute', routes: [] })).toBeNull()
    expect(parseOsrmRoute({ code: 'Ok', routes: [] })).toBeNull()
  })

  it('returns null for a leg with too few points', () => {
    expect(parseOsrmRoute({ code: 'Ok', routes: [{ legs: [{ distance: 0, steps: [{ geometry: { coordinates: [[0, 0]] } }] }] }] })).toBeNull()
  })

  it('returns null for junk', () => {
    expect(parseOsrmRoute(null)).toBeNull()
    expect(parseOsrmRoute({})).toBeNull()
  })
})
