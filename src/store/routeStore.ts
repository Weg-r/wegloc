import { create } from 'zustand'
import { createId } from '../lib/id'
import {
  deleteRoute as deleteRouteFromDb,
  getRoute,
  isStorageAvailable,
  listRoutes,
  putRoute,
  toStorageFailure,
  type StorageFailure,
} from '../db'
import { DEMO_ROUTE } from '../routes/demo'
import {
  isValidCoordinate,
  moveWaypointToIndex,
  nearestLegIndex,
  reverseWaypoints,
  splitLeg,
} from '../routes/ops'
import type { ImportedRoute } from '../export/read'
import { isSpeedUnit, type SpeedUnit } from '../lib/units'
import { DEFAULT_SETTINGS, type Route, type SimulationSettings, type Waypoint } from '../types/route'

/**
 * Long enough to collapse a burst of keystrokes in a number field into one
 * write, short enough that the route on disk is never far behind the screen.
 */
const PERSIST_DEBOUNCE_MS = 400

/** Undo depth. Fifty entries of a 3000-waypoint route is about a megabyte. */
const HISTORY_LIMIT = 50

/** Edits sharing a key inside this window are one undo step, so typing is not fifty. */
const COALESCE_WINDOW_MS = 800

const SPEED_UNIT_KEY = 'wegloc:speed-unit'
const GEOCODE_KEY = 'wegloc:geocode-enabled'

function readGeocodeEnabled(): boolean {
  try {
    return window.localStorage.getItem(GEOCODE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeGeocodeEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(GEOCODE_KEY, String(enabled))
  } catch {
    // Storage disabled; the preference resets next session.
  }
}

function readSpeedUnit(): SpeedUnit {
  try {
    const stored = window.localStorage.getItem(SPEED_UNIT_KEY)
    return isSpeedUnit(stored) ? stored : 'mps'
  } catch {
    return 'mps'
  }
}

function writeSpeedUnit(unit: SpeedUnit): void {
  try {
    window.localStorage.setItem(SPEED_UNIT_KEY, unit)
  } catch {
    // Storage disabled; the preference just resets next session.
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
let lastCommitKey: string | null = null
let lastCommitAt = 0

/** The route as it was when the current drag started, for the single undo entry the gesture earns. */
let dragSnapshot: Route | null = null

function cancelPendingWrite(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}

interface PlaybackState {
  playing: boolean
  /** Milliseconds into the track. */
  t: number
  speedMultiplier: number
}

interface StorageState {
  /** False in private browsing and anywhere else IndexedDB is missing. */
  available: boolean
  /** A write is queued or in flight. */
  pending: boolean
  /** Set while writes are failing. Cleared by the next write that succeeds. */
  failure: StorageFailure | null
}

interface RouteState {
  route: Route
  selectedWaypointId: string | null
  /** Set for the duration of a waypoint drag. Derived state keys off this to stay put mid-gesture. */
  draggingWaypointId: string | null
  playback: PlaybackState
  storage: StorageState
  /** Bumped when the set of saved routes changes, so the library list knows to refetch. */
  libraryVersion: number
  /** Display unit for speeds. A UI preference; the route model stays SI. */
  speedUnit: SpeedUnit
  /** Whether to reverse-geocode waypoint names. Off by default; a UI preference, never sent in a bundle. */
  geocodeEnabled: boolean

  past: Route[]
  future: Route[]

  addWaypoint: (lng: number, lat: number) => void
  moveWaypoint: (id: string, lng: number, lat: number) => void
  updateWaypoint: (id: string, patch: Partial<Omit<Waypoint, 'id'>>) => void
  removeWaypoint: (id: string) => void
  selectWaypoint: (id: string | null) => void
  updateSettings: (patch: Partial<SimulationSettings>) => void
  loadRoute: (route: Route) => void

  /** Splits the leg closest to the given point, so a click on the line inserts there. */
  insertWaypointOnRoute: (lng: number, lat: number) => void
  reorderWaypoint: (from: number, to: number) => void
  reverseRoute: () => void

  beginDrag: (id: string) => void
  endDrag: () => void

  undo: () => void
  redo: () => void

  newRoute: () => void
  renameRoute: (name: string) => void
  duplicateRoute: () => Promise<void>
  openRoute: (id: string) => Promise<void>
  deleteRouteById: (id: string) => Promise<void>
  importRoute: (imported: ImportedRoute) => Promise<void>

  setPlaying: (playing: boolean) => void
  setPlaybackTime: (t: number) => void
  setSpeedMultiplier: (multiplier: number) => void
  setSpeedUnit: (unit: SpeedUnit) => void
  setGeocodeEnabled: (enabled: boolean) => void

  /** Persists now, cancelling any pending debounced write. Call on gesture end, not mid-drag. */
  persist: () => void
  /** Debounced persist. Safe to call on every keystroke. */
  schedulePersist: () => void
}

function touch(route: Route): Route {
  return { ...route, updatedAt: Date.now() }
}

function emptyRoute(): Route {
  const now = Date.now()
  return {
    id: createId(),
    name: 'New route',
    waypoints: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Snapshots the route about to be replaced. Successive edits with the same
 * `coalesceKey` inside the coalesce window fold into the entry already on the
 * stack: one drag, or one burst of typing in a field, is one undo step.
 */
function pushHistory(state: RouteState, coalesceKey?: string): Pick<RouteState, 'past' | 'future'> {
  const now = Date.now()
  const folds = coalesceKey !== undefined && coalesceKey === lastCommitKey && now - lastCommitAt < COALESCE_WINDOW_MS

  lastCommitKey = coalesceKey ?? null
  lastCommitAt = now

  if (folds) return { past: state.past, future: [] }
  return { past: [...state.past, state.route].slice(-HISTORY_LIMIT), future: [] }
}

/** Undo and redo must not fold into whatever the user does next. */
function breakCoalescing(): void {
  lastCommitKey = null
  lastCommitAt = 0
}

export const useRouteStore = create<RouteState>((set, get) => {
  /**
   * `announce` bumps the library version once the write lands, rather than when
   * it is requested: a list refetched before the route reached the database
   * comes back without it.
   */
  function write(route: Route, announce = false): void {
    putRoute(route).then(
      () =>
        set((s) => ({
          storage: { ...s.storage, pending: false, failure: null },
          libraryVersion: announce ? s.libraryVersion + 1 : s.libraryVersion,
        })),
      (error: unknown) =>
        set((s) => ({ storage: { ...s.storage, pending: false, failure: toStorageFailure(error) } })),
    )
  }

  function persistNow(announce: boolean): void {
    cancelPendingWrite()
    set((state) => ({ storage: { ...state.storage, pending: true } }))
    write(get().route, announce)
  }

  /** Replaces the route as one undoable edit, and saves it. */
  function commit(next: (route: Route) => Route, options: { coalesceKey?: string; immediate?: boolean } = {}): void {
    set((state) => ({
      ...pushHistory(state, options.coalesceKey),
      route: touch(next(state.route)),
    }))
    if (options.immediate) get().persist()
    else get().schedulePersist()
  }

  /**
   * Switches to another route.
   *
   * `flushOutgoing` is false only when the route being left has just been deleted
   * -- flushing it there would write it straight back into the database.
   */
  function replaceRoute(next: Route, { flushOutgoing }: { flushOutgoing: boolean }): void {
    if (flushOutgoing) persistNow(false)
    open(next)
    persistNow(true)
  }

  /** Opens a route as a fresh document: no history from the one before it. */
  function open(route: Route): void {
    breakCoalescing()
    set({
      route,
      selectedWaypointId: null,
      draggingWaypointId: null,
      past: [],
      future: [],
      playback: { playing: false, t: 0, speedMultiplier: 1 },
    })
  }

  return {
    route: DEMO_ROUTE,
    selectedWaypointId: null,
    draggingWaypointId: null,
    playback: { playing: false, t: 0, speedMultiplier: 1 },
    storage: { available: isStorageAvailable(), pending: false, failure: null },
    libraryVersion: 0,
    speedUnit: readSpeedUnit(),
    geocodeEnabled: readGeocodeEnabled(),
    past: [],
    future: [],

    addWaypoint: (lng, lat) => {
      if (!isValidCoordinate(lng, lat)) return
      commit((route) => ({
        ...route,
        waypoints: [
          ...route.waypoints,
          { id: createId(), lng, lat, altitude: null, legSpeedMps: null, dwellMs: null },
        ],
      }))
    },

    // Deliberately does not persist or snapshot: this fires dozens of times per
    // second during a drag. The write and the undo entry belong to the gesture,
    // and are handled in beginDrag / endDrag.
    moveWaypoint: (id, lng, lat) =>
      set((state) => ({
        route: {
          ...state.route,
          waypoints: state.route.waypoints.map((wp) => (wp.id === id ? { ...wp, lng, lat } : wp)),
        },
      })),

    updateWaypoint: (id, patch) => {
      const field = Object.keys(patch).join(',')
      commit(
        (route) => ({
          ...route,
          waypoints: route.waypoints.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)),
        }),
        { coalesceKey: `waypoint:${id}:${field}` },
      )
    },

    removeWaypoint: (id) => {
      commit((route) => ({ ...route, waypoints: route.waypoints.filter((wp) => wp.id !== id) }))
      set((state) => ({
        selectedWaypointId: state.selectedWaypointId === id ? null : state.selectedWaypointId,
      }))
    },

    selectWaypoint: (id) => set({ selectedWaypointId: id }),

    updateSettings: (patch) => {
      const field = Object.keys(patch).join(',')
      commit((route) => ({ ...route, settings: { ...route.settings, ...patch } }), {
        coalesceKey: `settings:${field}`,
      })
    },

    loadRoute: (route) => open(route),

    insertWaypointOnRoute: (lng, lat) => {
      if (!isValidCoordinate(lng, lat)) return
      const { waypoints } = get().route
      const legIndex = nearestLegIndex(waypoints, { lng, lat })
      if (legIndex < 0) return

      const id = createId()
      commit((route) => ({ ...route, waypoints: splitLeg(route.waypoints, legIndex, { lng, lat }, id) }))
      set({ selectedWaypointId: id })
    },

    reorderWaypoint: (from, to) => {
      if (from === to) return
      commit((route) => ({ ...route, waypoints: moveWaypointToIndex(route.waypoints, from, to) }))
    },

    reverseRoute: () => commit((route) => ({ ...route, waypoints: reverseWaypoints(route.waypoints) })),

    beginDrag: (id) => {
      // Taken before the gesture: every moveWaypoint that follows folds into this
      // one undo entry, which is only kept if the waypoint actually moved.
      dragSnapshot = get().route
      set({ draggingWaypointId: id })
    },

    endDrag: () => {
      if (get().draggingWaypointId === null) return

      const snapshot = dragSnapshot
      dragSnapshot = null

      // moveWaypoint replaces the waypoints array, so identity says whether this
      // was a drag or just a click that selected the waypoint. A click must not
      // cost an undo step or a write.
      const moved = snapshot !== null && snapshot.waypoints !== get().route.waypoints
      if (!moved) {
        set({ draggingWaypointId: null })
        return
      }

      breakCoalescing()
      set((state) => ({
        route: touch(state.route),
        draggingWaypointId: null,
        past: [...state.past, snapshot].slice(-HISTORY_LIMIT),
        future: [],
      }))
      get().persist()
    },

    undo: () => {
      const previous = get().past.at(-1)
      if (!previous) return
      breakCoalescing()
      set((state) => ({
        past: state.past.slice(0, -1),
        future: [state.route, ...state.future].slice(0, HISTORY_LIMIT),
        route: previous,
        selectedWaypointId: previous.waypoints.some((wp) => wp.id === state.selectedWaypointId)
          ? state.selectedWaypointId
          : null,
      }))
      get().persist()
    },

    redo: () => {
      const next = get().future[0]
      if (!next) return
      breakCoalescing()
      set((state) => ({
        past: [...state.past, state.route].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        route: next,
        selectedWaypointId: next.waypoints.some((wp) => wp.id === state.selectedWaypointId)
          ? state.selectedWaypointId
          : null,
      }))
      get().persist()
    },

    // Written immediately: until the new route exists in the DB, a reload reopens
    // the previous one and this one is simply gone.
    newRoute: () => replaceRoute(emptyRoute(), { flushOutgoing: true }),

    // No library bump: renaming does not change the set of routes, and the list
    // reads the open route's name from the store rather than refetching per key.
    renameRoute: (name) => commit((route) => ({ ...route, name }), { coalesceKey: 'route:name' }),

    duplicateRoute: async () => {
      const source = get().route
      const now = Date.now()
      const copy: Route = {
        ...source,
        id: createId(),
        name: `${source.name} copy`,
        waypoints: source.waypoints.map((wp) => ({ ...wp })),
        settings: { ...source.settings },
        createdAt: now,
        updatedAt: now,
      }

      replaceRoute(copy, { flushOutgoing: true })
      await Promise.resolve()
    },

    openRoute: async (id) => {
      if (get().route.id === id) return
      // Flush the outgoing route before switching away from it.
      persistNow(false)
      const route = await getRoute(id)
      if (route) open(route)
    },

    deleteRouteById: async (id) => {
      await deleteRouteFromDb(id)
      set((state) => ({ libraryVersion: state.libraryVersion + 1 }))

      if (get().route.id !== id) return

      // The open route just went away; land somewhere real rather than on a route
      // that no longer exists. Nothing is flushed on the way out: the route being
      // left is the one that was deleted.
      const remaining = (await listRoutes()).filter((r) => r.id !== id)
      if (remaining[0]) {
        cancelPendingWrite()
        open(remaining[0])
      } else {
        replaceRoute(emptyRoute(), { flushOutgoing: false })
      }
    },

    importRoute: async (imported) => {
      const now = Date.now()
      const route: Route = {
        id: createId(),
        name: imported.name,
        waypoints: imported.waypoints,
        settings: imported.settings,
        createdAt: imported.createdAt,
        updatedAt: now,
      }

      replaceRoute(route, { flushOutgoing: true })
      await Promise.resolve()
    },

    setPlaying: (playing) => set((state) => ({ playback: { ...state.playback, playing } })),

    setPlaybackTime: (t) => set((state) => ({ playback: { ...state.playback, t } })),

    setSpeedMultiplier: (multiplier) =>
      set((state) => ({ playback: { ...state.playback, speedMultiplier: multiplier } })),

    setSpeedUnit: (unit) => {
      writeSpeedUnit(unit)
      set({ speedUnit: unit })
    },

    setGeocodeEnabled: (enabled) => {
      writeGeocodeEnabled(enabled)
      set({ geocodeEnabled: enabled })
    },

    persist: () => persistNow(false),

    schedulePersist: () => {
      cancelPendingWrite()
      set((state) => ({ storage: { ...state.storage, pending: true } }))
      persistTimer = setTimeout(() => {
        persistTimer = null
        write(get().route)
      }, PERSIST_DEBOUNCE_MS)
    },
  }
})
