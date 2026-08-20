import { describe, expect, it } from 'vitest'
import { bundleFilename, routeToBundle, serializeBundle } from './serialize'
import { BundleFormatError, readBundle, readBundleText } from './read'
import { FORMAT_VERSION } from './schema'
import {
  ANTIMERIDIAN,
  CHAMP_DE_MARS,
  DUPLICATE_POINTS,
  EMPTY_ROUTE,
  FIXTURE_ROUTES,
  PARTIAL_ALTITUDE,
  SINGLE_WAYPOINT,
  STOP_IN_THE_MIDDLE,
} from '../db/fixtures/routes'
import type { Route } from '../types/route'

// Imported raw rather than parsed: the golden files are compared byte for byte,
// so the bytes are the thing under test.
import walkGolden from './__fixtures__/v1-walk.json?raw'
import stopsGolden from './__fixtures__/v1-stops.json?raw'
import legacyGolden from './__fixtures__/v1-legacy-no-speed-profile.json?raw'

const EXPORTED_AT = 1_700_000_500_000

const GOLDEN: Record<string, string> = {
  'v1-walk.json': walkGolden,
  'v1-stops.json': stopsGolden,
}

function golden(name: string): string {
  return GOLDEN[name]
}

describe('golden bundles', () => {
  // Never edit a golden file to make this pass. If it stops matching, the format
  // changed under you, which is exactly what the fixture is for.
  it('serializes the walk fixture byte for byte', () => {
    expect(serializeBundle(routeToBundle(CHAMP_DE_MARS, EXPORTED_AT))).toBe(golden('v1-walk.json'))
  })

  it('serializes the route with stops byte for byte', () => {
    expect(serializeBundle(routeToBundle(STOP_IN_THE_MIDDLE, EXPORTED_AT))).toBe(golden('v1-stops.json'))
  })

  it('reads every golden bundle back', () => {
    for (const name of ['v1-walk.json', 'v1-stops.json']) {
      const imported = readBundleText(golden(name))
      expect(imported.waypoints.length).toBeGreaterThan(0)
      expect(imported.name).toBeTruthy()
    }
  })
})

describe('backward compatibility', () => {
  // A frozen bundle written before the speed-profile fields existed. It must
  // keep importing, with the new limits defaulting to off. Never regenerate it:
  // that is the point of freezing it.
  it('reads a v1 bundle that predates the speed-profile fields', () => {
    const imported = readBundleText(legacyGolden)
    expect(imported.settings.maxAccelMps2).toBe(0)
    expect(imported.settings.maxDecelMps2).toBe(0)
    expect(imported.settings.corneringMps2).toBe(0)
    // Waypoints predate labels, so they default to null.
    expect(imported.waypoints.every((wp) => wp.label === null)).toBe(true)
    // The rest of the settings still come through.
    expect(imported.settings.baseSpeedMps).toBeGreaterThan(0)
    expect(imported.waypoints.length).toBeGreaterThan(0)
  })
})

describe('round trip', () => {
  function roundTrip(route: Route) {
    return readBundle(routeToBundle(route, EXPORTED_AT))
  }

  it.each(FIXTURE_ROUTES.map((route) => [route.name, route] as const))('survives %s', (_name, route) => {
    const imported = roundTrip(route)

    expect(imported.name).toBe(route.name)
    expect(imported.settings).toEqual(route.settings)
    expect(imported.createdAt).toBe(route.createdAt)
    expect(imported.waypoints).toEqual(
      route.waypoints.map((wp) => ({ ...wp, dwellMs: wp.dwellMs ?? null, label: wp.label ?? null })),
    )
  })

  it('keeps a manual label, and defaults it to null when absent', () => {
    const labelled = { ...CHAMP_DE_MARS, waypoints: CHAMP_DE_MARS.waypoints.map((wp, i) => (i === 0 ? { ...wp, label: 'Home' } : wp)) }
    const imported = readBundle(routeToBundle(labelled, EXPORTED_AT))
    expect(imported.waypoints[0].label).toBe('Home')
    expect(imported.waypoints[1].label).toBeNull()
  })

  it('keeps dwell, altitude and leg speed exactly', () => {
    const imported = roundTrip(STOP_IN_THE_MIDDLE)
    expect(imported.waypoints[2].dwellMs).toBe(45_000)
    expect(imported.waypoints[1].legSpeedMps).toBe(13.9)
    expect(imported.waypoints[0].altitude).toBeNull()
  })

  it('handles the empty and single-waypoint routes', () => {
    expect(roundTrip(EMPTY_ROUTE).waypoints).toEqual([])
    expect(roundTrip(SINGLE_WAYPOINT).waypoints).toHaveLength(1)
  })

  it('keeps antimeridian longitudes as authored', () => {
    const imported = roundTrip(ANTIMERIDIAN)
    expect(imported.waypoints.map((wp) => wp.lng)).toEqual(ANTIMERIDIAN.waypoints.map((wp) => wp.lng))
  })

  it('keeps duplicate consecutive waypoints rather than collapsing them', () => {
    expect(roundTrip(DUPLICATE_POINTS).waypoints).toHaveLength(DUPLICATE_POINTS.waypoints.length)
  })

  it('keeps partial altitude data null where it was null', () => {
    const imported = roundTrip(PARTIAL_ALTITUDE)
    expect(imported.waypoints.map((wp) => wp.altitude)).toEqual(
      PARTIAL_ALTITUDE.waypoints.map((wp) => wp.altitude),
    )
  })
})

describe('serialize', () => {
  it('stamps the current format version', () => {
    expect(routeToBundle(CHAMP_DE_MARS, EXPORTED_AT).formatVersion).toBe(FORMAT_VERSION)
  })

  it('is pure: the same route and timestamp give the same bytes', () => {
    expect(serializeBundle(routeToBundle(CHAMP_DE_MARS, EXPORTED_AT))).toBe(
      serializeBundle(routeToBundle(CHAMP_DE_MARS, EXPORTED_AT)),
    )
  })

  it('does not leak editor-only fields into the contract', () => {
    const withExtra = { ...CHAMP_DE_MARS, someEditorOnlyField: true } as unknown as Route
    expect(routeToBundle(withExtra, EXPORTED_AT).route).not.toHaveProperty('someEditorOnlyField')
  })
})

describe('bundleFilename', () => {
  it('slugifies the route name', () => {
    expect(bundleFilename('Champ de Mars walk')).toBe('champ-de-mars-walk.wegloc.json')
  })

  it('survives punctuation, accents and slashes', () => {
    expect(bundleFilename('A/B: "test" route!')).toBe('a-b-test-route.wegloc.json')
    expect(bundleFilename('../../etc/passwd')).toBe('etc-passwd.wegloc.json')
  })

  it('falls back for an empty or unusable name', () => {
    expect(bundleFilename('')).toBe('route.wegloc.json')
    expect(bundleFilename('!!!')).toBe('route.wegloc.json')
  })
})

describe('read: bad input', () => {
  const valid = routeToBundle(CHAMP_DE_MARS, EXPORTED_AT)

  it('rejects a newer format with a message about versions', () => {
    expect(() => readBundle({ ...valid, formatVersion: 99 })).toThrow(BundleFormatError)
    expect(() => readBundle({ ...valid, formatVersion: 99 })).toThrow(/newer version/i)
  })

  it('rejects a missing version', () => {
    expect(() => readBundle({ route: valid.route })).toThrow(/formatVersion/)
  })

  it('names the offending field', () => {
    const broken = structuredClone(valid) as unknown as Record<string, never>
    // @ts-expect-error deliberately malformed
    broken.route.waypoints[1].lat = 'north a bit'
    expect(() => readBundle(broken)).toThrow(/route\.waypoints\[1\]\.lat/)
  })

  it('rejects coordinates that are not on Earth', () => {
    const broken = structuredClone(valid)
    broken.route.waypoints[0].lng = 900
    expect(() => readBundle(broken)).toThrow(/longitude/)
  })

  it('rejects a non-finite coordinate', () => {
    const broken = structuredClone(valid) as unknown as Record<string, never>
    // @ts-expect-error deliberately malformed
    broken.route.waypoints[0].lat = null
    expect(() => readBundle(broken)).toThrow(/finite number/)
  })

  it('rejects an unknown altitude mode', () => {
    const broken = structuredClone(valid) as unknown as Record<string, never>
    // @ts-expect-error deliberately malformed
    broken.route.settings.altitudeMode = 'sideways'
    expect(() => readBundle(broken)).toThrow(/per-waypoint/)
  })

  it('rejects truncated and non-JSON files', () => {
    expect(() => readBundleText('{"formatVersion": 1, "rou')).toThrow(/not valid JSON/)
    expect(() => readBundleText('<html>nope</html>')).toThrow(/not valid JSON/)
  })

  it('rejects JSON that is not a bundle', () => {
    expect(() => readBundleText('[1,2,3]')).toThrow(/bundle/)
    expect(() => readBundleText('null')).toThrow(/bundle/)
  })

  it('ignores unknown fields, so a later version can add them', () => {
    const forward = structuredClone(valid) as unknown as Record<string, unknown>
    ;(forward.route as Record<string, unknown>).futureField = { anything: true }
    expect(() => readBundle(forward)).not.toThrow()
  })
})
