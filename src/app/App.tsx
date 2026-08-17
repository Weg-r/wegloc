import { useCallback, useMemo, useRef } from 'react'
import { useRouteStore } from '../store/routeStore'
import { useTrack, useCurrentPosition, usePlaybackClock } from '../store/hooks'
import { trackDurationMs } from '../routes/interpolate'
import { useFlushPendingWrites, useHydrateFromDb } from './hydrate'
import RouteMap, { type RouteMapHandle } from '../map/RouteMap'
import LineCard from '../ui/LineCard'
import DepartureBoard from '../ui/DepartureBoard'
import { ACCENT } from '../lib/theme'

export default function App() {
  useHydrateFromDb()
  useFlushPendingWrites()

  const route = useRouteStore((s) => s.route)
  const selectedWaypointId = useRouteStore((s) => s.selectedWaypointId)
  const playback = useRouteStore((s) => s.playback)
  const updateWaypoint = useRouteStore((s) => s.updateWaypoint)
  const removeWaypoint = useRouteStore((s) => s.removeWaypoint)
  const selectWaypoint = useRouteStore((s) => s.selectWaypoint)
  const updateSettings = useRouteStore((s) => s.updateSettings)
  const setPlaying = useRouteStore((s) => s.setPlaying)
  const setPlaybackTime = useRouteStore((s) => s.setPlaybackTime)

  const track = useTrack()
  const current = useCurrentPosition(track)
  usePlaybackClock(track)
  const durationMs = trackDurationMs(track)

  const selected = useMemo(
    () => route.waypoints.find((wp) => wp.id === selectedWaypointId) ?? null,
    [route.waypoints, selectedWaypointId],
  )

  const mapHandleRef = useRef<RouteMapHandle>(null)
  const canPlay = route.waypoints.length >= 2 && durationMs > 0

  // Stable identities: the memoized rows in LineCard are only worth anything if
  // their callback props don't change on every render of the shell. Reading the
  // waypoints off the store keeps the callback out of the render's closure.
  const handleSelect = useCallback(
    (id: string) => {
      selectWaypoint(id)
      const wp = useRouteStore.getState().route.waypoints.find((w) => w.id === id)
      if (wp) mapHandleRef.current?.flyTo(wp.lng, wp.lat)
    },
    [selectWaypoint],
  )

  const handleDeselect = useCallback(() => selectWaypoint(null), [selectWaypoint])

  return (
    <div className="h-screen w-screen flex bg-white text-neutral-900 overflow-hidden">
      <div className="flex-1 relative min-w-0">
        <RouteMap ref={mapHandleRef} current={current} />

        <div
          className="absolute top-4 right-4 z-10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-sm"
          style={{ backgroundColor: ACCENT }}
        >
          {route.name}
        </div>
      </div>

      <aside className="w-[380px] shrink-0 flex flex-col border-l-4 border-neutral-900">
        <div className="px-5 py-4 border-b border-neutral-200">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Wegloc / Line Diagram</p>
          <h1 className="text-lg font-black uppercase tracking-tight">Route Stations</h1>
        </div>

        <LineCard
          waypoints={route.waypoints}
          settings={route.settings}
          selectedId={selectedWaypointId}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          onDelete={removeWaypoint}
        />

        <DepartureBoard
          settings={route.settings}
          onUpdateSettings={updateSettings}
          selected={selected}
          onUpdateSelected={(patch) => selected && updateWaypoint(selected.id, patch)}
          playing={playback.playing}
          onTogglePlaying={() => setPlaying(!playback.playing)}
          playbackT={playback.t}
          durationMs={durationMs}
          onScrub={setPlaybackTime}
          current={current}
          canPlay={canPlay}
        />
      </aside>
    </div>
  )
}
