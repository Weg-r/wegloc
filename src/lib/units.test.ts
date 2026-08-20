import { describe, expect, it } from 'vitest'
import { formatSpeed, speedFromMps, speedToMps, speedUnitLabel, isSpeedUnit } from './units'

describe('speed conversions', () => {
  it('labels each unit', () => {
    expect(speedUnitLabel('mps')).toBe('m/s')
    expect(speedUnitLabel('kmh')).toBe('km/h')
    expect(speedUnitLabel('mph')).toBe('mph')
  })

  it('converts m/s to display units', () => {
    expect(speedFromMps(10, 'mps')).toBe(10)
    expect(speedFromMps(10, 'kmh')).toBeCloseTo(36, 6)
    expect(speedFromMps(10, 'mph')).toBeCloseTo(22.369, 3)
  })

  it('typing 50 km/h stores 13.89 m/s', () => {
    expect(speedToMps(50, 'kmh')).toBeCloseTo(13.89, 2)
  })

  it('round-trips a value through a unit', () => {
    for (const unit of ['mps', 'kmh', 'mph'] as const) {
      expect(speedToMps(speedFromMps(7.3, unit), unit)).toBeCloseTo(7.3, 9)
    }
  })

  it('formats a readout with the unit', () => {
    expect(formatSpeed(13.888, 'kmh')).toBe('50.0 km/h')
    expect(formatSpeed(1.4, 'mps')).toBe('1.4 m/s')
  })

  it('recognises valid units and rejects junk', () => {
    expect(isSpeedUnit('kmh')).toBe(true)
    expect(isSpeedUnit('knots')).toBe(false)
    expect(isSpeedUnit(null)).toBe(false)
  })
})
