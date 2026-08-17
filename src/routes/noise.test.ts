import { describe, expect, it } from 'vitest'
import { correlatedNoise } from './noise'

const PERIOD = 12

describe('correlatedNoise', () => {
  it('stays inside [-1, 1] over a long run', () => {
    for (let i = 0; i < 20_000; i++) {
      const n = correlatedNoise(i, 1, PERIOD)
      expect(n).toBeGreaterThanOrEqual(-1)
      expect(n).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic', () => {
    expect(correlatedNoise(437, 2, PERIOD)).toBe(correlatedNoise(437, 2, PERIOD))
  })

  it('separates seeds', () => {
    expect(correlatedNoise(5, 1, PERIOD)).not.toBe(correlatedNoise(5, 2, PERIOD))
  })

  it('changes gradually rather than resampling per index', () => {
    // Neighbouring samples stay close: this is drift, not buzz. The smoothstep
    // ease peaks at slope 1.5 over a range of 2, so no step exceeds 3 / period --
    // against the ~2 that resampling white noise per index would give.
    for (let i = 0; i < 5_000; i++) {
      const step = Math.abs(correlatedNoise(i + 1, 1, PERIOD) - correlatedNoise(i, 1, PERIOD))
      expect(step).toBeLessThan(3 / PERIOD)
    }
  })

  it('does not trend away from zero', () => {
    let sum = 0
    for (let i = 0; i < 20_000; i++) sum += correlatedNoise(i, 3, PERIOD)
    expect(Math.abs(sum / 20_000)).toBeLessThan(0.1)
  })
})
