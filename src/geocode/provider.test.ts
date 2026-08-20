import { describe, expect, it } from 'vitest'
import { geocodeCacheKey, makeProvider, parseNominatim, parseNominatimSearch, searchUrl } from './provider'

describe('geocodeCacheKey', () => {
  it('rounds so nearby points share a key', () => {
    expect(geocodeCacheKey(2.29451, 48.85841)).toBe(geocodeCacheKey(2.29452, 48.85842))
  })

  it('distinguishes points a block apart', () => {
    expect(geocodeCacheKey(2.294, 48.858)).not.toBe(geocodeCacheKey(2.301, 48.861))
  })

  it('is lat,lng ordered', () => {
    expect(geocodeCacheKey(2.2945, 48.8584)).toBe('48.8584,2.2945')
  })
})

describe('makeProvider url', () => {
  it('substitutes and encodes both coordinates', () => {
    const p = makeProvider('https://geo.test/reverse?lat={lat}&lon={lng}')
    expect(p.url(2.2945, 48.8584)).toBe('https://geo.test/reverse?lat=48.8584&lon=2.2945')
  })

  it('encodes a negative longitude', () => {
    const p = makeProvider('https://geo.test/r?lat={lat}&lon={lng}')
    expect(p.url(-0.1276, 51.5072)).toContain('lon=-0.1276')
  })
})

describe('parseNominatim', () => {
  it('prefers a road from the address', () => {
    expect(parseNominatim({ address: { road: 'Rue Cler', city: 'Paris' }, name: 'x' })).toBe('Rue Cler')
  })

  it('falls back through address levels', () => {
    expect(parseNominatim({ address: { city: 'Lyon' } })).toBe('Lyon')
  })

  it('uses name when there is no usable address', () => {
    expect(parseNominatim({ name: 'Eiffel Tower' })).toBe('Eiffel Tower')
  })

  it('uses the first segment of display_name as a last resort', () => {
    expect(parseNominatim({ display_name: 'Tour Eiffel, Paris, France' })).toBe('Tour Eiffel')
  })

  it('returns null for junk', () => {
    expect(parseNominatim(null)).toBeNull()
    expect(parseNominatim({})).toBeNull()
    expect(parseNominatim('nope')).toBeNull()
  })
})

describe('searchUrl', () => {
  it('substitutes and encodes the query', () => {
    expect(searchUrl('https://geo.test/search?q={q}', 'Parking EFREI')).toBe(
      'https://geo.test/search?q=Parking%20EFREI',
    )
  })
})

describe('parseNominatimSearch', () => {
  it('maps results to lng/lat/label', () => {
    const results = parseNominatimSearch([
      { lat: '48.7871', lon: '2.3626', display_name: 'EFREI, Villejuif' },
      { lat: '48.85', lon: '2.29', name: 'Somewhere' },
    ])
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({ lng: 2.3626, lat: 48.7871, label: 'EFREI, Villejuif' })
    expect(results[1].label).toBe('Somewhere')
  })

  it('skips malformed entries', () => {
    expect(parseNominatimSearch([{ lat: 'x', lon: '1', display_name: 'a' }, { display_name: 'b' }])).toEqual([])
  })

  it('returns [] for non-arrays', () => {
    expect(parseNominatimSearch(null)).toEqual([])
    expect(parseNominatimSearch({})).toEqual([])
  })
})
