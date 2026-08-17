/**
 * Deterministic, correlated noise for simulating receiver drift. Pure: no DOM,
 * no browser APIs, no randomness that varies between runs -- the same route has
 * to produce the same trace on every reload, in tests, and on the device.
 */

/** Pseudo-random value in [-1, 1] for an integer lattice point. */
function hash(n: number, seed: number): number {
  const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** Hermite ease, so the noise has no corners where lattice cells meet. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Value noise in [-1, 1] that changes smoothly over `period` samples. Sampling
 * white noise per tick reads as a visible buzz; a real receiver wanders. The
 * result is bounded rather than accumulated, so it can never drift away from
 * the route however long the track runs.
 */
export function correlatedNoise(index: number, seed: number, period: number): number {
  const u = index / Math.max(1, period)
  const cell = Math.floor(u)
  const f = smoothstep(u - cell)
  return hash(cell, seed) * (1 - f) + hash(cell + 1, seed) * f
}
