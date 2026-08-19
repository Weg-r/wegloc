import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type {
  MapLayerMouseEvent,
  MapLayerTouchEvent,
  MapMouseEvent,
  MapTouchEvent,
  PointLike,
} from 'maplibre-gl'
import { useRouteStore } from '../store/routeStore'
import { useMapLibre } from './useMapLibre'
import { setSourceData, trackPointToFeature, waypointsToLine, waypointsToPoints } from './routeSource'
import { ACCENT } from '../lib/theme'
import type { TrackPoint } from '../types/route'

const LINE_SOURCE = 'route-line'
const LINE_LAYER = 'route-line-layer'
const POINTS_SOURCE = 'route-points'
const POINTS_LAYER = 'route-points-layer'
const MARKER_SOURCE = 'route-marker'
const MARKER_LAYER = 'route-marker-layer'

export interface RouteMapHandle {
  flyTo: (lng: number, lat: number) => void
}

interface RouteMapProps {
  current: TrackPoint | null
}

/**
 * Owns the MapLibre instance end to end: sources, layers, and every pointer
 * interaction (add / select / drag a waypoint). The only place in the app
 * that touches maplibre-gl.
 */
const RouteMap = forwardRef<RouteMapHandle, RouteMapProps>(function RouteMap({ current }, ref) {
  const route = useRouteStore((s) => s.route)
  const selectedWaypointId = useRouteStore((s) => s.selectedWaypointId)
  const addWaypoint = useRouteStore((s) => s.addWaypoint)
  const insertWaypointOnRoute = useRouteStore((s) => s.insertWaypointOnRoute)
  const moveWaypoint = useRouteStore((s) => s.moveWaypoint)
  const selectWaypoint = useRouteStore((s) => s.selectWaypoint)
  const beginDrag = useRouteStore((s) => s.beginDrag)
  const endDrag = useRouteStore((s) => s.endDrag)

  const styleUrl = import.meta.env.VITE_MAP_STYLE_URL as string
  const { containerRef, mapRef, ready, error, warning, dismissWarning } = useMapLibre({
    styleUrl,
    center: route.waypoints[0] ? [route.waypoints[0].lng, route.waypoints[0].lat] : [2.298, 48.858],
    zoom: 15,
  })

  const draggingId = useRef<string | null>(null)

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat) => {
      mapRef.current?.flyTo({ center: [lng, lat], duration: 500 })
    },
  }))

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    if (!map.getSource(LINE_SOURCE)) {
      map.addSource(LINE_SOURCE, { type: 'geojson', data: waypointsToLine(route.waypoints) })
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: LINE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ACCENT, 'line-width': 5 },
      })
    }

    if (!map.getSource(POINTS_SOURCE)) {
      map.addSource(POINTS_SOURCE, { type: 'geojson', data: waypointsToPoints(route.waypoints, selectedWaypointId) })
      map.addLayer({
        id: POINTS_LAYER,
        type: 'circle',
        source: POINTS_SOURCE,
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 9, 7],
          'circle-color': '#ffffff',
          'circle-stroke-color': ACCENT,
          'circle-stroke-width': ['case', ['get', 'selected'], 4, 3],
        },
      })
    }

    if (!map.getSource(MARKER_SOURCE)) {
      map.addSource(MARKER_SOURCE, { type: 'geojson', data: trackPointToFeature(current) })
      map.addLayer({
        id: MARKER_LAYER,
        type: 'circle',
        source: MARKER_SOURCE,
        paint: { 'circle-radius': 6, 'circle-color': ACCENT, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
      })
    }

    const handleMapClick = (e: MapMouseEvent) => {
      // A click on an existing waypoint is a selection, handled below. A click on
      // the line splits that leg, which is how a waypoint gets inserted into the
      // middle of a route. Anywhere else appends.
      if (map.queryRenderedFeatures(e.point, { layers: [POINTS_LAYER] }).length > 0) return

      // A few pixels of slop: the line is 5px wide and a trackpad is not precise.
      const slop = 6
      const box: [PointLike, PointLike] = [
        [e.point.x - slop, e.point.y - slop],
        [e.point.x + slop, e.point.y + slop],
      ]
      if (map.queryRenderedFeatures(box, { layers: [LINE_LAYER] }).length > 0) {
        insertWaypointOnRoute(e.lngLat.lng, e.lngLat.lat)
        return
      }

      addWaypoint(e.lngLat.lng, e.lngLat.lat)
    }
    const handlePointClick = (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) selectWaypoint(id)
    }
    const handleDragStart = (e: MapLayerMouseEvent | MapLayerTouchEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (!id) return
      draggingId.current = id
      beginDrag(id)
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'grabbing'
    }
    const handleDragMove = (e: MapMouseEvent | MapTouchEvent) => {
      if (!draggingId.current) return
      moveWaypoint(draggingId.current, e.lngLat.lng, e.lngLat.lat)
    }
    const handleDragEnd = () => {
      if (!draggingId.current) return
      draggingId.current = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      // Rebuilds the track and writes the route once, on release.
      endDrag()
    }
    const handleEnter = () => {
      if (!draggingId.current) map.getCanvas().style.cursor = 'grab'
    }
    const handleLeave = () => {
      if (!draggingId.current) map.getCanvas().style.cursor = ''
    }
    const handleLineEnter = () => {
      if (!draggingId.current) map.getCanvas().style.cursor = 'copy'
    }

    map.on('click', handleMapClick)
    map.on('click', POINTS_LAYER, handlePointClick)
    map.on('mousedown', POINTS_LAYER, handleDragStart)
    map.on('touchstart', POINTS_LAYER, handleDragStart)
    map.on('mousemove', handleDragMove)
    map.on('touchmove', handleDragMove)
    map.on('mouseup', handleDragEnd)
    map.on('touchend', handleDragEnd)
    map.on('mouseenter', POINTS_LAYER, handleEnter)
    map.on('mouseleave', POINTS_LAYER, handleLeave)
    map.on('mouseenter', LINE_LAYER, handleLineEnter)
    map.on('mouseleave', LINE_LAYER, handleLeave)

    return () => {
      map.off('click', handleMapClick)
      map.off('click', POINTS_LAYER, handlePointClick)
      map.off('mousedown', POINTS_LAYER, handleDragStart)
      map.off('touchstart', POINTS_LAYER, handleDragStart)
      map.off('mousemove', handleDragMove)
      map.off('touchmove', handleDragMove)
      map.off('mouseup', handleDragEnd)
      map.off('touchend', handleDragEnd)
      map.off('mouseenter', POINTS_LAYER, handleEnter)
      map.off('mouseleave', POINTS_LAYER, handleLeave)
      map.off('mouseenter', LINE_LAYER, handleLineEnter)
      map.off('mouseleave', LINE_LAYER, handleLeave)
    }
    // Sources/layers are created once per map instance (guarded above); handlers
    // close over the latest store actions, which are referentially stable. Waypoint
    // and marker data are pushed in via setData by the effects below, not here --
    // this effect must not re-run on every waypoint change (e.g. mid-drag).
  }, [ready, mapRef, addWaypoint, insertWaypointOnRoute, moveWaypoint, selectWaypoint, beginDrag, endDrag])

  useEffect(() => {
    setSourceData(mapRef.current, LINE_SOURCE, waypointsToLine(route.waypoints))
    setSourceData(mapRef.current, POINTS_SOURCE, waypointsToPoints(route.waypoints, selectedWaypointId))
  }, [mapRef, ready, route.waypoints, selectedWaypointId])

  useEffect(() => {
    setSourceData(mapRef.current, MARKER_SOURCE, trackPointToFeature(current))
  }, [mapRef, ready, current])

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ filter: 'grayscale(1) contrast(1.05) brightness(1.1)' }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none">
          <div className="pointer-events-auto max-w-sm bg-white border-4 border-neutral-900 px-5 py-4 shadow-lg text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Map unavailable</p>
            <p className="mt-2 text-sm font-mono text-neutral-700">{error}</p>
          </div>
        </div>
      )}

      {!error && warning && (
        <div className="absolute bottom-4 left-4 z-10 flex max-w-sm items-start gap-3 bg-neutral-900 px-3 py-2 text-neutral-50 shadow-lg">
          <p className="font-mono text-xs leading-snug">{warning}</p>
          <button
            type="button"
            onClick={dismissWarning}
            className="shrink-0 text-xs font-bold text-neutral-400 hover:text-white"
            aria-label="Dismiss map warning"
          >
            &#10005;
          </button>
        </div>
      )}
    </div>
  )
})

export default RouteMap
