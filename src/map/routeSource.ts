import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import type { TrackPoint, Waypoint } from '../types/route'

export function waypointsToLine(waypoints: Waypoint[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: waypoints.map((wp) => [wp.lng, wp.lat]),
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
