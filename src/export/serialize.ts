import { FORMAT_VERSION, type BundleSettingsV1, type BundleWaypointV1, type ExportBundleV1 } from './schema'
import type { Route } from '../types/route'

/**
 * Turns a route into the versioned bundle. Pure: `exportedAt` is passed in
 * rather than read from the clock, so the same route always serializes to the
 * same bytes and the golden fixtures mean something.
 *
 * Every field is mapped explicitly. Spreading the route in here would let a new
 * field in the editor's model leak into the contract without anyone deciding to
 * put it there.
 */
export function routeToBundle(route: Route, exportedAt: number): ExportBundleV1 {
  return {
    formatVersion: FORMAT_VERSION,
    exportedAt,
    route: {
      id: route.id,
      name: route.name,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      waypoints: route.waypoints.map(
        (wp): BundleWaypointV1 => ({
          id: wp.id,
          lng: wp.lng,
          lat: wp.lat,
          altitude: wp.altitude,
          legSpeedMps: wp.legSpeedMps,
          dwellMs: wp.dwellMs ?? null,
        }),
      ),
      settings: {
        baseSpeedMps: route.settings.baseSpeedMps,
        altitudeMode: route.settings.altitudeMode,
        flatAltitude: route.settings.flatAltitude,
        accuracyMeters: route.settings.accuracyMeters,
        jitterMeters: route.settings.jitterMeters,
        loop: route.settings.loop,
        tickRateMs: route.settings.tickRateMs,
        maxAccelMps2: route.settings.maxAccelMps2,
        maxDecelMps2: route.settings.maxDecelMps2,
        corneringMps2: route.settings.corneringMps2,
      } satisfies BundleSettingsV1,
    },
  }
}

/** Pretty-printed so an exported file is readable and diffable. */
export function serializeBundle(bundle: ExportBundleV1): string {
  return `${JSON.stringify(bundle, null, 2)}\n`
}

/**
 * Filename for a downloaded bundle. Keeps it recognisable as the user's route
 * while staying safe on every filesystem.
 */
export function bundleFilename(routeName: string): string {
  const slug = routeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'route'}.wegloc.json`
}
