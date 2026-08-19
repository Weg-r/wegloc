/**
 * The export bundle: the contract between the editor and the device app.
 *
 * These types are deliberately separate from `src/types/route.ts`. The editor's
 * route model is free to change; the bundle is not, because shipped Android
 * builds we cannot update in lockstep will parse it and users have exported
 * files sitting on disk. Reshaping the model must therefore be a visible,
 * deliberate edit to the serializer, not something that follows silently.
 *
 * The bundle carries the route and its simulation settings, not the dense
 * track: the device app runs the same interpolator, so shipping the track would
 * be shipping a derived value that can disagree with the thing it came from.
 *
 * Rules for changing this file:
 * - Add optional fields. Never rename or repurpose an existing one.
 * - A breaking change is a new version with a new reader, and the old reader stays.
 * - Never edit a golden fixture to make a test pass.
 */

export const FORMAT_VERSION = 1

export type BundleAltitudeMode = 'flat' | 'per-waypoint'

export interface BundleWaypointV1 {
  id: string
  lng: number
  lat: number
  /** Meters above sea level, or null to inherit from a neighbouring waypoint. */
  altitude: number | null
  /** Speed for the leg leading into this waypoint, or null for the route's base speed. */
  legSpeedMps: number | null
  /** Time held stationary here, in milliseconds. null for no stop. */
  dwellMs: number | null
}

export interface BundleSettingsV1 {
  baseSpeedMps: number
  altitudeMode: BundleAltitudeMode
  flatAltitude: number
  accuracyMeters: number
  jitterMeters: number
  loop: boolean
  tickRateMs: number
}

export interface BundleRouteV1 {
  /** The id the route had in the editor. Informational: importers mint their own. */
  id: string
  name: string
  createdAt: number
  updatedAt: number
  waypoints: BundleWaypointV1[]
  settings: BundleSettingsV1
}

export interface ExportBundleV1 {
  formatVersion: typeof FORMAT_VERSION
  /** Unix ms at which the file was written. */
  exportedAt: number
  route: BundleRouteV1
}
