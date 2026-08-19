import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { TrackPoint, Waypoint } from '../types/route'
import { unwrapLongitude } from '../routes/geo'

/**
 * Longitudes made continuous so the drawn line never jumps ~358 degrees across
 * the antimeridian and takes the long way around the globe. A resulting value
 * may sit outside [-180, 180]; MapLibre renders it on the correct world copy.
 */
function unwrapLongitudes(waypoints: Waypoint[]): [number, number][] {
  let previous: number | null = null
  return waypoints.map((wp) => {
    const lng = previous === null ? wp.lng : unwrapLongitude(previous, wp.lng)
    previous = lng
    return [lng, wp.lat]
  })
}

export function waypointsToLine(waypoints: Waypoint[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: unwrapLongitudes(waypoints),
    },
  }
}

export function waypointsToPoints(
  waypoints: Waypoint[],
  selectedId: string | null,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((wp, index) => ({
      type: 'Feature',
      properties: { id: wp.id, index, selected: wp.id === selectedId },
      geometry: { type: 'Point', coordinates: [wp.lng, wp.lat] },
    })),
  }
}

export function trackPointToFeature(point: TrackPoint | null): Feature<Point> {
  return {
    type: 'Feature',
    properties: { bearing: point?.bearingDeg ?? 0 },
    geometry: { type: 'Point', coordinates: point ? [point.lng, point.lat] : [0, 0] },
  }
}

/**
 * Updates a GeoJSON source in place. No-ops if the map, style, or source
 * aren't ready yet -- safe to call from effects that race the map's `load`
 * event or fire during HMR teardown.
 */
export function setSourceData(
  map: MapLibreMap | null,
  sourceId: string,
  data: Feature | FeatureCollection,
): void {
  if (!map || !map.isStyleLoaded()) return
  const source = map.getSource(sourceId)
  if (!source || source.type !== 'geojson') return
  ;(source as GeoJSONSource).setData(data)
}

/**
 * A bounding box that frames every waypoint, with longitudes unwrapped so an
 * antimeridian route frames the short span rather than the whole globe. Returns
 * a single point to centre on for a one-waypoint route, and null for an empty
 * one. The bbox is [west, south, east, north].
 */
export function boundsForWaypoints(
  waypoints: Waypoint[],
): { bbox: [number, number, number, number]; point?: [number, number] } | null {
  if (waypoints.length === 0) return null

  const coords = unwrapLongitudes(waypoints)
  if (coords.length === 1) return { bbox: [coords[0][0], coords[0][1], coords[0][0], coords[0][1]], point: coords[0] }

  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [lng, lat] of coords) {
    west = Math.min(west, lng)
    east = Math.max(east, lng)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }

  return { bbox: [west, south, east, north] }
}
