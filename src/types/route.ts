export interface Waypoint {
  id: string
  lng: number
  lat: number
  altitude: number | null
  /** Overrides the base speed for the leg leading into this waypoint. null = use base speed. */
  legSpeedMps: number | null
  /**
   * Time held stationary at this waypoint, in milliseconds. Optional so routes
   * saved before stops existed read back unchanged. null or absent = no stop.
   */
  dwellMs?: number | null
  /**
   * A human name for this waypoint, typed by the user. Optional and additive.
   * A reverse-geocoded name is never stored here -- that is derived, cached
   * separately, and only fills in where this is absent.
   */
  label?: string | null
  /**
   * The road-following polyline for the leg arriving at this waypoint, as
   * [lng, lat] pairs from the previous waypoint to this one. Absent means the
   * leg is a straight great-circle line. It is derived from a routing service
   * but stored on purpose: the device app must replay the exact path, and a
   * routed route has to stay usable offline. The first waypoint never has one.
   */
  path?: [number, number][] | null
}

export type AltitudeMode = 'flat' | 'per-waypoint'

export interface SimulationSettings {
  baseSpeedMps: number
  altitudeMode: AltitudeMode
  flatAltitude: number
  accuracyMeters: number
  jitterMeters: number
  loop: boolean
  tickRateMs: number
  /**
   * Speed-profile limits. All default to 0, meaning "off": speed changes are
   * instant, as they always were. Set any of them and the interpolator ramps
   * speed and slows for corners instead of stepping between leg speeds.
   */
  maxAccelMps2: number
  maxDecelMps2: number
  corneringMps2: number
}

export interface Route {
  id: string
  name: string
  waypoints: Waypoint[]
  settings: SimulationSettings
  createdAt: number
  updatedAt: number
}

export interface TrackPoint {
  lng: number
  lat: number
  altitude: number
  speedMps: number
  bearingDeg: number
  accuracyMeters: number
  /** Milliseconds elapsed since track start. */
  t: number
}

export const DEFAULT_SETTINGS: SimulationSettings = {
  baseSpeedMps: 1.4,
  altitudeMode: 'flat',
  flatAltitude: 0,
  accuracyMeters: 5,
  jitterMeters: 0,
  loop: false,
  tickRateMs: 200,
  maxAccelMps2: 0,
  maxDecelMps2: 0,
  corneringMps2: 0,
}
