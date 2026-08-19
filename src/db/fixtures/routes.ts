import { DEFAULT_SETTINGS, type Route, type SimulationSettings, type Waypoint } from '../../types/route'

/**
 * Test routes covering the shapes that break things. An empty database is a bad
 * test and a straight line of three waypoints is barely better -- these are
 * deliberately the ugly cases: duplicate points, partial altitude, an
 * antimeridian crossing, a stop, a zero-length leg, and a route dense enough to
 * make a sloppy drag visible.
 *
 * Pure and importable from tests: nothing here opens a transaction. Ids are
 * stable and prefixed `fixture-` so the loader can tell them apart from a route
 * the user drew.
 */

export const FIXTURE_ID_PREFIX = 'fixture-'

/** Fixed so a fixture route serializes to the same bytes on every machine. */
const FIXTURE_TIME = 1_700_000_000_000

function wp(
  id: string,
  lng: number,
  lat: number,
  extra: Partial<Omit<Waypoint, 'id' | 'lng' | 'lat'>> = {},
): Waypoint {
  return { id, lng, lat, altitude: null, legSpeedMps: null, dwellMs: null, ...extra }
}

function route(
  slug: string,
  name: string,
  waypoints: Waypoint[],
  settings: Partial<SimulationSettings> = {},
): Route {
  return {
    id: `${FIXTURE_ID_PREFIX}${slug}`,
    name,
    waypoints,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    createdAt: FIXTURE_TIME,
    updatedAt: FIXTURE_TIME,
  }
}

/** A walk with altitude on every waypoint. The well-behaved baseline. */
export const CHAMP_DE_MARS = route(
  'champ-de-mars',
  'Champ de Mars walk',
  [
    wp('cdm-1', 2.2945, 48.8584, { altitude: 33 }),
    wp('cdm-2', 2.2977, 48.8557, { altitude: 35, legSpeedMps: 1.4 }),
    wp('cdm-3', 2.3012, 48.8566, { altitude: 34, legSpeedMps: 2.8 }),
    wp('cdm-4', 2.301, 48.86, { altitude: 36, legSpeedMps: 1.4 }),
    wp('cdm-5', 2.2965, 48.8607, { altitude: 34, legSpeedMps: 1.1 }),
  ],
  { altitudeMode: 'per-waypoint' },
)

/** Two identical waypoints in the middle: a zero-length leg that must cost no time. */
export const DUPLICATE_POINTS = route('duplicates', 'Duplicate waypoints', [
  wp('dup-1', 2.35, 48.86),
  wp('dup-2', 2.352, 48.861),
  wp('dup-3', 2.352, 48.861),
  wp('dup-4', 2.354, 48.862),
])

/** Altitude on some waypoints and not others, so the blend has to fill gaps. */
export const PARTIAL_ALTITUDE = route(
  'partial-altitude',
  'Partial altitude data',
  [
    wp('alt-1', 6.865, 45.832, { altitude: 1035 }),
    wp('alt-2', 6.872, 45.838),
    wp('alt-3', 6.879, 45.845, { altitude: 1420 }),
    wp('alt-4', 6.886, 45.851),
    wp('alt-5', 6.893, 45.858, { altitude: 1890 }),
  ],
  { altitudeMode: 'per-waypoint', baseSpeedMps: 1.1 },
)

/** Crosses 180 degrees. The short way is 200km; the wrong answer is most of the planet. */
export const ANTIMERIDIAN = route('antimeridian', 'Antimeridian crossing', [
  wp('am-1', 179.2, -16.7),
  wp('am-2', 179.8, -16.72),
  wp('am-3', -179.7, -16.74),
  wp('am-4', -179.1, -16.75),
], { baseSpeedMps: 12 })

/** A drive with a 45s stop at a light in the middle, and a slow leg after it. */
export const STOP_IN_THE_MIDDLE = route('stop-in-the-middle', 'Drive with a stop', [
  wp('stop-1', 2.3312, 48.8709),
  wp('stop-2', 2.3345, 48.8712, { legSpeedMps: 13.9 }),
  wp('stop-3', 2.3378, 48.8716, { legSpeedMps: 13.9, dwellMs: 45_000 }),
  wp('stop-4', 2.3402, 48.8721, { legSpeedMps: 4.2 }),
  wp('stop-5', 2.3448, 48.8729, { legSpeedMps: 13.9, dwellMs: 15_000 }),
], { baseSpeedMps: 13.9, jitterMeters: 4, accuracyMeters: 6 })

/** One waypoint, holding still for a minute. Every readout has to survive it. */
export const SINGLE_WAYPOINT = route('single-waypoint', 'Single waypoint', [
  wp('single-1', 2.2945, 48.8584, { altitude: 33, dwellMs: 60_000 }),
])

/** No waypoints at all: the first-run shape. */
export const EMPTY_ROUTE = route('empty', 'Empty route', [])

/**
 * A few thousand waypoints along a winding drive. Deterministic by construction
 * -- no Math.random, so the same fixture is the same bytes in every run and a
 * performance comparison across two commits is comparing the same work.
 */
function buildDenseRoute(): Route {
  const waypoints: Waypoint[] = []
  const count = 2500

  for (let i = 0; i < count; i++) {
    const f = i / (count - 1)
    waypoints.push(
      wp(
        `dense-${i}`,
        2.25 + f * 0.12 + Math.sin(i / 7) * 0.0004,
        48.83 + Math.sin(f * Math.PI * 6) * 0.012 + Math.cos(i / 11) * 0.0003,
      ),
    )
  }

  return route('dense', 'Dense route (2500 waypoints)', waypoints, { baseSpeedMps: 15, tickRateMs: 200 })
}

export const DENSE_ROUTE = buildDenseRoute()

export const FIXTURE_ROUTES: Route[] = [
  CHAMP_DE_MARS,
  STOP_IN_THE_MIDDLE,
  PARTIAL_ALTITUDE,
  DUPLICATE_POINTS,
  ANTIMERIDIAN,
  SINGLE_WAYPOINT,
  EMPTY_ROUTE,
  DENSE_ROUTE,
]
