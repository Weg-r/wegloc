import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { useRouteStore } from '../store/routeStore'
import { useTrack, useCurrentPosition, usePlaybackClock } from '../store/hooks'
import { trackDurationMs } from '../routes/interpolate'
import { useFlushPendingWrites, useHydrateFromDb, useRememberLastOpened } from './hydrate'
import { useRouteLibrary } from './library'
import { useUndoRedoShortcuts } from './shortcuts'
import { downloadRoute, pickRouteFile, readRouteFile } from './routeFile'
import { FIXTURES_ENABLED, loadFixtures } from '../db/fixtures'
import RouteMap, { type RouteMapHandle } from '../map/RouteMap'
import LineCard from '../ui/LineCard'
import DepartureBoard from '../ui/DepartureBoard'
import RouteBar from '../ui/RouteBar'
import WaypointTools from '../ui/WaypointTools'
import { ACCENT } from '../lib/theme'

export default function App() {
  useHydrateFromDb()
  useRememberLastOpened()
  useFlushPendingWrites()
  useUndoRedoShortcuts()

  const route = useRouteStore((s) => s.route)
  const selectedWaypointId = useRouteStore((s) => s.selectedWaypointId)
  const playback = useRouteStore((s) => s.playback)
  const storage = useRouteStore((s) => s.storage)
  const canUndo = useRouteStore((s) => s.past.length > 0)
  const canRedo = useRouteStore((s) => s.future.length > 0)

  const updateWaypoint = useRouteStore((s) => s.updateWaypoint)
  const removeWaypoint = useRouteStore((s) => s.removeWaypoint)
  const selectWaypoint = useRouteStore((s) => s.selectWaypoint)
  const updateSettings = useRouteStore((s) => s.updateSettings)
  const setPlaying = useRouteStore((s) => s.setPlaying)
  const setPlaybackTime = useRouteStore((s) => s.setPlaybackTime)
  const addWaypoint = useRouteStore((s) => s.addWaypoint)
  const reorderWaypoint = useRouteStore((s) => s.reorderWaypoint)
  const reverseRoute = useRouteStore((s) => s.reverseRoute)
  const undo = useRouteStore((s) => s.undo)
  const redo = useRouteStore((s) => s.redo)
  const renameRoute = useRouteStore((s) => s.renameRoute)
  const newRoute = useRouteStore((s) => s.newRoute)
  const duplicateRoute = useRouteStore((s) => s.duplicateRoute)
  const openRoute = useRouteStore((s) => s.openRoute)
  const deleteRouteById = useRouteStore((s) => s.deleteRouteById)
  const importRoute = useRouteStore((s) => s.importRoute)

  const { routes, refresh: refreshLibrary } = useRouteLibrary()
  const [importError, setImportError] = useState<string | null>(null)
  const [dropActive, setDropActive] = useState(false)

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

  const importFile = useCallback(
    async (file: File) => {
      try {
        const imported = await readRouteFile(file)
        await importRoute(imported)
        setImportError(null)
      } catch (error) {
        // The current route is untouched: nothing was applied before this threw.
        setImportError(error instanceof Error ? error.message : 'That file could not be imported.')
      }
    },
    [importRoute],
  )

  const handleImport = useCallback(async () => {
    const file = await pickRouteFile()
    if (file) await importFile(file)
  }, [importFile])

  const handleDelete = useCallback(
    async (id: string) => {
      const target = routes.find((r) => r.id === id)
      const label = target?.name || 'this route'
      if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
      await deleteRouteById(id)
    },
    [routes, deleteRouteById],
  )

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDropActive(false)
    const file = event.dataTransfer.files[0]
    if (file) void importFile(file)
  }

  const handleDragOver = (event: DragEvent) => {
    // Only claim the drop if a file is coming; dragging text should do nothing.
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    setDropActive(true)
  }

  return (
    <div
      className="h-screen w-screen flex bg-white text-neutral-900 overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={handleDrop}
    >
      <div className="flex-1 relative min-w-0">
        <RouteMap ref={mapHandleRef} current={current} />

        <div
          className="absolute top-4 right-4 z-10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-sm"
          style={{ backgroundColor: ACCENT }}
        >
          {route.name || 'Untitled route'}
        </div>

        {dropActive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
            <p className="border-4 border-dashed border-neutral-900 px-6 py-4 font-mono text-sm font-bold uppercase tracking-widest">
              Drop a .wegloc.json route
            </p>
          </div>
        )}

        {importError && (
          <div className="absolute bottom-4 right-4 z-20 flex max-w-sm items-start gap-3 bg-neutral-900 px-3 py-2 text-neutral-50 shadow-lg">
            <p className="font-mono text-xs leading-snug">{importError}</p>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="shrink-0 text-xs font-bold text-neutral-400 hover:text-white"
              aria-label="Dismiss import error"
            >
              &#10005;
            </button>
          </div>
        )}
      </div>

      <aside className="w-[380px] shrink-0 flex flex-col border-l-4 border-neutral-900">
        <RouteBar
          routeId={route.id}
          routeName={route.name}
          onRename={renameRoute}
          storage={storage}
          routes={routes}
          onOpen={(id) => void openRoute(id)}
          onDelete={(id) => void handleDelete(id)}
          onNew={newRoute}
          onDuplicate={() => void duplicateRoute()}
          onExport={() => downloadRoute(route)}
          onImport={() => void handleImport()}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onLoadFixtures={
            FIXTURES_ENABLED
              ? () => {
                  void loadFixtures().then(refreshLibrary)
                }
              : undefined
          }
        />

        <LineCard
          waypoints={route.waypoints}
          settings={route.settings}
          selectedId={selectedWaypointId}
          onSelect={handleSelect}
          onDeselect={handleDeselect}
          onDelete={removeWaypoint}
          onReorder={reorderWaypoint}
        />

        <WaypointTools
          waypointCount={route.waypoints.length}
          onAddAtCoordinates={(lng, lat) => {
            addWaypoint(lng, lat)
            mapHandleRef.current?.flyTo(lng, lat)
          }}
          onReverse={reverseRoute}
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
