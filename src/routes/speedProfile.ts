/**
 * A physically achievable speed profile over a route's legs. Pure: no DOM, no
 * browser APIs, no randomness. Given per-leg lengths and cruise speeds it works
 * out how fast you can actually be going at each waypoint, accounting for how
 * hard the vehicle can accelerate, how hard it can brake, and how much it has to
 * slow for a corner. `buildTrack` uses the result to time and sample each leg.
 *
 * The feature is off unless at least one limit is set: with everything at zero
 * the caller keeps its constant-speed path, so a route with no limits behaves
 * exactly as before.
 */

export interface SpeedLimits {
  /** Max acceleration, m/s^2. <= 0 means unlimited (ramps are instant). */
  maxAccelMps2: number
  /** Max deceleration, m/s^2, as a positive number. <= 0 means unlimited. */
  maxDecelMps2: number
  /** Lateral-acceleration budget for corners, m/s^2. <= 0 means no corner limit. */
  corneringMps2: number
}

export interface ProfileLeg {
  /** Ground length of the leg, meters. Zero for a duplicate-waypoint leg. */
  length: number
  /** The leg's own cruise speed, m/s. Already clamped to a positive floor by the caller. */
  cruiseMps: number
  /** Initial bearing of the leg, degrees. Used to measure the turn at each vertex. */
  bearingDeg: number
}

export interface LegTiming {
  durationMs: number
  entryMps: number
  exitMps: number
  /** Peak speed actually reached on the leg (the cruise plateau, or the triangle apex). */
  peakMps: number
}

/**
 * Distance from which a corner's radius is estimated. A vertex in a polyline has
 * no radius of its own, so the turn is modelled as an arc of this scale: the
 * sharper the turn, the tighter the arc, the lower the safe speed.
 */
const TURN_BASE_M = 8

export function speedProfileEnabled(limits: SpeedLimits): boolean {
  return limits.maxAccelMps2 > 0 || limits.maxDecelMps2 > 0 || limits.corneringMps2 > 0
}

/** Direction change at a vertex, 0 (straight on) to 180 (full reversal), in degrees. */
export function bearingChangeDeg(fromBearing: number, toBearing: number): number {
  return Math.abs(((((toBearing - fromBearing) % 360) + 540) % 360) - 180)
}

/**
 * Fastest a vehicle should take a vertex of the given direction change, from a
 * lateral-acceleration budget. A straight-through vertex is unlimited; a full
 * reversal forces a stop; a raised budget lifts the cap toward unlimited, which
 * is how cornering is switched off.
 */
export function cornerSpeedCap(changeDeg: number, corneringMps2: number): number {
  if (corneringMps2 <= 0) return Infinity
  const half = (changeDeg * Math.PI) / 360
  const tanHalf = Math.tan(half)
  if (tanHalf <= 1e-9) return Infinity
  return Math.sqrt((corneringMps2 * TURN_BASE_M) / tanHalf)
}

function accelOr(limit: number): number {
  return limit > 0 ? limit : Infinity
}

/**
 * The trapezoidal (or triangular) time to cross one leg: accelerate from the
 * entry speed toward the cruise cap, hold, then brake to the exit speed. When
 * the leg is too short to reach the cruise cap it becomes a triangle peaking
 * below it.
 */
function timeLeg(length: number, entry: number, exit: number, cruise: number, accel: number, decel: number): LegTiming {
  if (length <= 0) {
    return { durationMs: 0, entryMps: entry, exitMps: exit, peakMps: Math.max(entry, exit) }
  }

  // Distance each phase would need to reach the full cruise speed.
  const accelDist = accel === Infinity ? 0 : Math.max(0, (cruise * cruise - entry * entry) / (2 * accel))
  const decelDist = decel === Infinity ? 0 : Math.max(0, (cruise * cruise - exit * exit) / (2 * decel))

  let peak = cruise
  let sAccel = accelDist
  let sDecel = decelDist

  if (accelDist + decelDist > length) {
    // Too short to cruise: solve for the apex where the ramps meet.
    if (accel === Infinity) {
      peak = Math.sqrt(exit * exit + 2 * decel * length)
    } else if (decel === Infinity) {
      peak = Math.sqrt(entry * entry + 2 * accel * length)
    } else {
      peak = Math.sqrt((2 * accel * decel * length + decel * entry * entry + accel * exit * exit) / (accel + decel))
    }
    sAccel = accel === Infinity ? 0 : Math.max(0, (peak * peak - entry * entry) / (2 * accel))
    sDecel = Math.max(0, length - sAccel)
  }

  const sCruise = Math.max(0, length - sAccel - sDecel)
  const tAccel = accel === Infinity ? 0 : (peak - entry) / accel
  const tCruise = peak > 0 ? sCruise / peak : 0
  const tDecel = decel === Infinity ? 0 : (peak - exit) / decel

  return {
    durationMs: (tAccel + tCruise + tDecel) * 1000,
    entryMps: entry,
    exitMps: exit,
    peakMps: peak,
  }
}

/**
 * Speed and distance reached `elapsedMs` into a leg with the given timing. Lets
 * the caller sample the leg on a fixed time grid without re-deriving the phases.
 */
export function sampleLegProfile(
  timing: LegTiming,
  length: number,
  accel: number,
  decel: number,
  elapsedMs: number,
): { distance: number; speedMps: number } {
  if (length <= 0 || timing.durationMs <= 0) {
    return { distance: length, speedMps: timing.exitMps }
  }

  const a = accelOr(accel)
  const d = accelOr(decel)
  const { entryMps: entry, exitMps: exit, peakMps: peak } = timing

  const tAccel = a === Infinity ? 0 : (peak - entry) / a
  const sAccel = a === Infinity ? 0 : entry * tAccel + 0.5 * a * tAccel * tAccel
  const tDecel = d === Infinity ? 0 : (peak - exit) / d
  const sDecel = d === Infinity ? 0 : peak * tDecel - 0.5 * d * tDecel * tDecel
  const sCruise = Math.max(0, length - sAccel - sDecel)
  const tCruise = peak > 0 ? sCruise / peak : 0

  const t = Math.min(Math.max(elapsedMs, 0), timing.durationMs) / 1000

  if (t <= tAccel && tAccel > 0) {
    return { distance: entry * t + 0.5 * a * t * t, speedMps: entry + a * t }
  }
  if (t <= tAccel + tCruise) {
    return { distance: sAccel + peak * (t - tAccel), speedMps: peak }
  }

  const td = t - tAccel - tCruise
  return { distance: sAccel + sCruise + peak * td - 0.5 * d * td * td, speedMps: Math.max(exit, peak - d * td) }
}

/**
 * Solves the achievable speed at every waypoint, then the timing of every leg.
 *
 * `forcedStopNodes` are waypoints the vehicle must be stationary at -- the ends
 * of the route and any dwell. A forward pass caps each node by what acceleration
 * allows from the one before it; a backward pass caps it by what braking needs
 * for the one after. The result respects both limits and every corner.
 */
export function planLegTimings(
  legs: ProfileLeg[],
  limits: SpeedLimits,
  forcedStopNodes: ReadonlySet<number>,
): LegTiming[] {
  const nodeCount = legs.length + 1
  const accel = accelOr(limits.maxAccelMps2)
  const decel = accelOr(limits.maxDecelMps2)

  // Per-node speed ceiling: the slower of the two adjacent cruise speeds, the
  // corner cap at the vertex, and zero where a stop is forced.
  const cap = new Array<number>(nodeCount)
  for (let j = 0; j < nodeCount; j++) {
    if (forcedStopNodes.has(j)) {
      cap[j] = 0
      continue
    }
    const before = legs[j - 1]
    const after = legs[j]
    let limit = Math.min(before?.cruiseMps ?? Infinity, after?.cruiseMps ?? Infinity)
    if (before && after) {
      limit = Math.min(limit, cornerSpeedCap(bearingChangeDeg(before.bearingDeg, after.bearingDeg), limits.corneringMps2))
    }
    cap[j] = limit
  }

  const speed = cap.slice()

  // Forward: no faster than acceleration can bring you from the previous node.
  for (let j = 1; j < nodeCount; j++) {
    const reachable = Math.sqrt(speed[j - 1] * speed[j - 1] + 2 * accel * legs[j - 1].length)
    speed[j] = Math.min(speed[j], reachable)
  }
  // Backward: no faster than braking can bring you down to the next node.
  for (let j = nodeCount - 2; j >= 0; j--) {
    const reachable = Math.sqrt(speed[j + 1] * speed[j + 1] + 2 * decel * legs[j].length)
    speed[j] = Math.min(speed[j], reachable)
  }

  return legs.map((leg, i) => timeLeg(leg.length, speed[i], speed[i + 1], leg.cruiseMps, accel, decel))
}
