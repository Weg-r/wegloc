import { describe, expect, it } from 'vitest'
import { coordinateLabel, hasName, waypointLabel } from './waypointLabel'
import type { Waypoint } from '../types/route'

function wp(extra: Partial<Waypoint> = {}): Waypoint {
  return { id: 'a', lng: 2.2945, lat: 48.8584, altitude: null, legSpeedMps: null, dwellMs: null, ...extra }
}

describe('waypointLabel precedence', () => {
  it('prefers the manual label', () => {
    expect(waypointLabel(wp({ label: 'Office' }), 'Rue Cler')).toBe('Office')
  })

  it('uses the geocoded name when there is no manual label', () => {
    expect(waypointLabel(wp(), 'Rue Cler')).toBe('Rue Cler')
  })

  it('falls back to coordinates', () => {
    expect(waypointLabel(wp(), null)).toBe('48.8584, 2.2945')
    expect(waypointLabel(wp(), undefined)).toBe('48.8584, 2.2945')
  })

  it('treats a blank or whitespace label as absent', () => {
    expect(waypointLabel(wp({ label: '   ' }), 'Rue Cler')).toBe('Rue Cler')
    expect(waypointLabel(wp({ label: '' }), null)).toBe('48.8584, 2.2945')
  })
})

describe('hasName', () => {
  it('is true only when a name is available', () => {
    expect(hasName(wp({ label: 'Home' }), null)).toBe(true)
    expect(hasName(wp(), 'Somewhere')).toBe(true)
    expect(hasName(wp(), null)).toBe(false)
  })
})

describe('coordinateLabel', () => {
  it('is lat, lng to four places', () => {
    expect(coordinateLabel({ lng: 2.29451, lat: 48.85842 })).toBe('48.8584, 2.2945')
  })
})
