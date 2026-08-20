import { describe, expect, it } from 'vitest'
import { formatClock, formatMeters, formatRelativeTime, formatSeconds, stationCode } from './format'

describe('formatMeters', () => {
  it('switches to kilometres at 1000', () => {
    expect(formatMeters(999)).toBe('999 M')
    expect(formatMeters(1000)).toBe('1.00 KM')
    expect(formatMeters(12_345)).toBe('12.35 KM')
  })

  it('rounds sub-metre values', () => {
    expect(formatMeters(0)).toBe('0 M')
    expect(formatMeters(0.4)).toBe('0 M')
  })
})

describe('formatClock', () => {
  it('pads minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_000)).toBe('01:05')
  })

  it('clamps negatives rather than showing a minus', () => {
    expect(formatClock(-5000)).toBe('00:00')
  })

  it('shows hours only once the clock reaches them', () => {
    expect(formatClock(90 * 60_000)).toBe('1:30:00')
    expect(formatClock(2 * 3_600_000)).toBe('2:00:00')
    expect(formatClock(3_600_000 + 65_000)).toBe('1:01:05')
    // Under an hour stays mm:ss.
    expect(formatClock(59 * 60_000 + 59_000)).toBe('59:59')
  })
})

describe('formatSeconds', () => {
  it('reads seconds, whole minutes, and the mix', () => {
    expect(formatSeconds(30_000)).toBe('30S')
    expect(formatSeconds(120_000)).toBe('2M')
    expect(formatSeconds(150_000)).toBe('2M 30S')
  })

  it('rounds to the nearest second', () => {
    expect(formatSeconds(1_400)).toBe('1S')
    expect(formatSeconds(0)).toBe('0S')
  })
})

describe('formatRelativeTime', () => {
  const now = 1_700_000_000_000

  it('describes recent, hours and days', () => {
    expect(formatRelativeTime(now, now)).toBe('just now')
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago')
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago')
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe('2d ago')
    expect(formatRelativeTime(now - 60 * 86_400_000, now)).toBe('2mo ago')
  })

  it('does not go backwards for a clock skewed into the future', () => {
    expect(formatRelativeTime(now + 10_000, now)).toBe('just now')
  })
})

describe('stationCode', () => {
  it('is one-based and zero-padded', () => {
    expect(stationCode(0)).toBe('WP-01')
    expect(stationCode(11)).toBe('WP-12')
    expect(stationCode(100)).toBe('WP-101')
  })
})
