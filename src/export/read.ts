import { FORMAT_VERSION, type BundleAltitudeMode } from './schema'
import type { SimulationSettings, Waypoint } from '../types/route'

/** A malformed bundle. The message is meant to be shown to the user as-is. */
export class BundleFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BundleFormatError'
  }
}

/**
 * What a bundle yields: everything needed to build a route except its identity.
 * The importer mints a fresh id, so importing the same file twice gives two
 * routes rather than one overwriting the other.
 */
export interface ImportedRoute {
  name: string
  waypoints: Waypoint[]
  settings: SimulationSettings
  createdAt: number
}

function fail(path: string, expected: string): never {
  throw new BundleFormatError(`${path}: expected ${expected}`)
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'an object')
  return value as Record<string, unknown>
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'an array')
  return value
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'a finite number')
  return value
}

function asNullableNumber(value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null
  return asNumber(value, path)
}

/** For optional numeric settings added after the first bundles shipped. */
function asNumberOr(value: unknown, fallback: number, path: string): number {
  if (value === undefined || value === null) return fallback
  return asNumber(value, path)
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'a string')
  return value
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'a boolean')
  return value
}

function asLongitude(value: unknown, path: string): number {
  const n = asNumber(value, path)
  if (n < -180 || n > 180) fail(path, 'a longitude between -180 and 180')
  return n
}

function asLatitude(value: unknown, path: string): number {
  const n = asNumber(value, path)
  if (n < -90 || n > 90) fail(path, 'a latitude between -90 and 90')
  return n
}

function readSettingsV1(value: unknown, path: string): SimulationSettings {
  const s = asRecord(value, path)
  const mode = asString(s.altitudeMode, `${path}.altitudeMode`)
  if (mode !== 'flat' && mode !== 'per-waypoint') {
    fail(`${path}.altitudeMode`, `"flat" or "per-waypoint", got "${mode}"`)
  }

  return {
    baseSpeedMps: asNumber(s.baseSpeedMps, `${path}.baseSpeedMps`),
    altitudeMode: mode satisfies BundleAltitudeMode,
    flatAltitude: asNumber(s.flatAltitude, `${path}.flatAltitude`),
    accuracyMeters: asNumber(s.accuracyMeters, `${path}.accuracyMeters`),
    jitterMeters: asNumber(s.jitterMeters, `${path}.jitterMeters`),
    loop: asBoolean(s.loop, `${path}.loop`),
    tickRateMs: asNumber(s.tickRateMs, `${path}.tickRateMs`),
    // Optional: a bundle written before speed profiles existed simply has them off.
    maxAccelMps2: asNumberOr(s.maxAccelMps2, 0, `${path}.maxAccelMps2`),
    maxDecelMps2: asNumberOr(s.maxDecelMps2, 0, `${path}.maxDecelMps2`),
    corneringMps2: asNumberOr(s.corneringMps2, 0, `${path}.corneringMps2`),
  }
}

function readWaypointV1(value: unknown, path: string): Waypoint {
  const wp = asRecord(value, path)
  return {
    id: asString(wp.id, `${path}.id`),
    lng: asLongitude(wp.lng, `${path}.lng`),
    lat: asLatitude(wp.lat, `${path}.lat`),
    altitude: asNullableNumber(wp.altitude, `${path}.altitude`),
    legSpeedMps: asNullableNumber(wp.legSpeedMps, `${path}.legSpeedMps`),
    dwellMs: asNullableNumber(wp.dwellMs, `${path}.dwellMs`),
    // Optional: a bundle written before labels existed simply has none.
    label: typeof wp.label === 'string' ? wp.label : null,
  }
}

/**
 * Reader for format version 1. Unknown fields are ignored on purpose: later
 * versions add optional fields, and a v1 reader meeting one must not choke.
 */
function readV1(bundle: Record<string, unknown>): ImportedRoute {
  const route = asRecord(bundle.route, 'route')
  const waypoints = asArray(route.waypoints, 'route.waypoints').map((wp, i) =>
    readWaypointV1(wp, `route.waypoints[${i}]`),
  )

  return {
    name: asString(route.name, 'route.name'),
    waypoints,
    settings: readSettingsV1(route.settings, 'route.settings'),
    createdAt: asNumber(route.createdAt, 'route.createdAt'),
  }
}

const READERS: Record<number, (bundle: Record<string, unknown>) => ImportedRoute> = {
  1: readV1,
}

/**
 * Parses a bundle of any version we still read. Throws BundleFormatError with a
 * message naming the offending field, which is what the user sees.
 */
export function readBundle(data: unknown): ImportedRoute {
  const bundle = asRecord(data, 'bundle')
  const version = asNumber(bundle.formatVersion, 'bundle.formatVersion')
  const reader = READERS[version]

  if (!reader) {
    const known = Object.keys(READERS).join(', ')
    throw new BundleFormatError(
      version > FORMAT_VERSION
        ? `This route was exported by a newer version of Wegloc (format ${version}). This editor reads format ${known}.`
        : `Unknown export format ${version}. This editor reads format ${known}.`,
    )
  }

  return reader(bundle)
}

/** Same, from the raw text of a file. */
export function readBundleText(text: string): ImportedRoute {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BundleFormatError('That file is not valid JSON, so it is not a Wegloc route.')
  }
  return readBundle(parsed)
}
