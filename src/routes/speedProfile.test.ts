import { describe, expect, it } from 'vitest'
import {
  bearingChangeDeg,
  cornerSpeedCap,
  planLegTimings,
  sampleLegProfile,
  speedProfileEnabled,
  type ProfileLeg,
  type SpeedLimits,
} from './speedProfile'

const OFF: SpeedLimits = { maxAccelMps2: 0, maxDecelMps2: 0, corneringMps2: 0 }
const CAR: SpeedLimits = { maxAccelMps2: 2, maxDecelMps2: 3, corneringMps2: 2 }

function leg(length: number, cruiseMps: number, bearingDeg = 0): ProfileLeg {
  return { length, cruiseMps, bearingDeg }
}

describe('speedProfileEnabled', () => {
  it('is off only when every limit is zero or less', () => {
    expect(speedProfileEnabled(OFF)).toBe(false)
    expect(speedProfileEnabled({ ...OFF, maxAccelMps2: -1 })).toBe(false)
    expect(speedProfileEnabled({ ...OFF, maxAccelMps2: 1 })).toBe(true)
    expect(speedProfileEnabled({ ...OFF, corneringMps2: 1 })).toBe(true)
  })
})

describe('bearingChangeDeg', () => {
  it('measures the turn, shortest way, 0 to 180', () => {
    expect(bearingChangeDeg(0, 0)).toBe(0)
    expect(bearingChangeDeg(0, 90)).toBe(90)
    expect(bearingChangeDeg(10, 350)).toBe(20)
    expect(bearingChangeDeg(0, 180)).toBe(180)
    expect(bearingChangeDeg(350, 10)).toBe(20)
  })
})

describe('cornerSpeedCap', () => {
  it('is unlimited going straight, and unlimited when cornering is off', () => {
    expect(cornerSpeedCap(0, 2)).toBe(Infinity)
    expect(cornerSpeedCap(90, 0)).toBe(Infinity)
  })

  it('forces a stop for a full reversal', () => {
    expect(cornerSpeedCap(180, 2)).toBeCloseTo(0, 6)
  })

  it('slows more for a sharper turn', () => {
    const gentle = cornerSpeedCap(30, 2)
    const sharp = cornerSpeedCap(120, 2)
    expect(sharp).toBeLessThan(gentle)
  })

  it('lifts the cap as the budget rises, which is how it is switched off', () => {
    expect(cornerSpeedCap(90, 10)).toBeGreaterThan(cornerSpeedCap(90, 2))
  })
})

describe('planLegTimings: acceleration', () => {
  const stops = new Set([0, 2])

  it('starts and ends at rest and peaks in between', () => {
    const timings = planLegTimings([leg(200, 15), leg(200, 15)], CAR, stops)
    expect(timings[0].entryMps).toBeCloseTo(0, 6)
    expect(timings[1].exitMps).toBeCloseTo(0, 6)
    expect(timings[0].peakMps).toBeGreaterThan(0)
  })

  it('never implies acceleration beyond the limit, sampled densely', () => {
    const legs = [leg(300, 20), leg(300, 20)]
    const timings = planLegTimings(legs, CAR, stops)

    for (let i = 0; i < legs.length; i++) {
      const timing = timings[i]
      const step = 50
      let prev = sampleLegProfile(timing, legs[i].length, CAR.maxAccelMps2, CAR.maxDecelMps2, 0)
      for (let t = step; t <= timing.durationMs; t += step) {
        const now = sampleLegProfile(timing, legs[i].length, CAR.maxAccelMps2, CAR.maxDecelMps2, t)
        const accel = Math.abs(now.speedMps - prev.speedMps) / (step / 1000)
        // A little slack for the phase-boundary sample straddling accel and cruise.
        expect(accel).toBeLessThanOrEqual(Math.max(CAR.maxAccelMps2, CAR.maxDecelMps2) + 0.5)
        prev = now
      }
    }
  })

  it('a short leg peaks below its cruise speed', () => {
    const timings = planLegTimings([leg(20, 30), leg(20, 30)], CAR, stops)
    expect(timings[0].peakMps).toBeLessThan(30)
  })

  it('takes longer than the constant-speed time, because of the ramps', () => {
    const constant = (200 / 15) * 1000
    const timings = planLegTimings([leg(200, 15), leg(200, 15)], CAR, stops)
    expect(timings[0].durationMs).toBeGreaterThan(constant)
  })
})

describe('planLegTimings: cornering', () => {
  it('dips the speed at a sharp vertex between two long legs', () => {
    const straight = planLegTimings(
      [leg(500, 20, 90), leg(500, 20, 90)],
      { maxAccelMps2: 3, maxDecelMps2: 3, corneringMps2: 2 },
      new Set([0, 2]),
    )
    const turned = planLegTimings(
      [leg(500, 20, 90), leg(500, 20, 180)],
      { maxAccelMps2: 3, maxDecelMps2: 3, corneringMps2: 2 },
      new Set([0, 2]),
    )
    // The corner forces a lower speed at the vertex -- the exit speed of the leg into it.
    expect(turned[0].exitMps).toBeLessThan(straight[0].exitMps)
  })

  it('a raised cornering budget removes the dip', () => {
    const withCorner = planLegTimings(
      [leg(500, 20, 90), leg(500, 20, 180)],
      { maxAccelMps2: 3, maxDecelMps2: 3, corneringMps2: 2 },
      new Set([0, 2]),
    )
    const noCorner = planLegTimings(
      [leg(500, 20, 90), leg(500, 20, 180)],
      { maxAccelMps2: 3, maxDecelMps2: 3, corneringMps2: 0 },
      new Set([0, 2]),
    )
    expect(noCorner[0].exitMps).toBeGreaterThan(withCorner[0].exitMps)
  })
})

describe('sampleLegProfile', () => {
  const stops = new Set([0, 2])
  const legs = [leg(300, 18), leg(300, 18)]
  const timing = planLegTimings(legs, CAR, stops)[0]

  it('starts at the entry speed and ends at the exit speed', () => {
    const start = sampleLegProfile(timing, 300, CAR.maxAccelMps2, CAR.maxDecelMps2, 0)
    const end = sampleLegProfile(timing, 300, CAR.maxAccelMps2, CAR.maxDecelMps2, timing.durationMs)
    expect(start.speedMps).toBeCloseTo(timing.entryMps, 6)
    expect(end.speedMps).toBeCloseTo(timing.exitMps, 6)
  })

  it('covers the whole leg length by the end', () => {
    const end = sampleLegProfile(timing, 300, CAR.maxAccelMps2, CAR.maxDecelMps2, timing.durationMs)
    expect(end.distance).toBeCloseTo(300, 3)
  })

  it('advances monotonically in distance', () => {
    let prev = -1
    for (let t = 0; t <= timing.durationMs; t += 100) {
      const s = sampleLegProfile(timing, 300, CAR.maxAccelMps2, CAR.maxDecelMps2, t).distance
      expect(s).toBeGreaterThanOrEqual(prev - 1e-6)
      prev = s
    }
  })

  it('handles a zero-length leg without dividing by zero', () => {
    const zero = planLegTimings([leg(0, 10)], CAR, new Set([0, 1]))[0]
    const s = sampleLegProfile(zero, 0, CAR.maxAccelMps2, CAR.maxDecelMps2, 0)
    expect(Number.isFinite(s.distance)).toBe(true)
    expect(zero.durationMs).toBe(0)
  })
})
