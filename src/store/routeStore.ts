import { create } from 'zustand'
import { createId } from '../lib/id'
import { putRoute } from '../db'
import { DEMO_ROUTE } from '../routes/demo'
import { DEFAULT_SETTINGS, type Route, type SimulationSettings, type Waypoint } from '../types/route'

/**
 * Long enough to collapse a burst of keystrokes in a number field into one
 * write, short enough that the route on disk is never far behind the screen.
 */
const PERSIST_DEBOUNCE_MS = 400

let persistTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingWrite(): void {
  if (persistTimer !== null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
}

function writeRoute(route: Route): void {
  putRoute(route).catch(() => {
    // Local-first tool; a failed write (quota, private browsing) shouldn't crash
    // the editor. Making the failure visible to the user is ticket 08.
  })
}

interface PlaybackState {
  playing: boolean
  /** Milliseconds into the track. */
  t: number
  speedMultiplier: number
}

interface RouteState {
  route: Route
  selectedWaypointId: string | null
  /** Set for the duration of a waypoint drag. Derived state keys off this to stay put mid-gesture. */
  draggingWaypointId: string | null
  playback: PlaybackState

  addWaypoint: (lng: number, lat: number) => void
  moveWaypoint: (id: string, lng: number, lat: number) => void
  updateWaypoint: (id: string, patch: Partial<Omit<Waypoint, 'id'>>) => void
  removeWaypoint: (id: string) => void
  selectWaypoint: (id: string | null) => void
  updateSettings: (patch: Partial<SimulationSettings>) => void
  clearRoute: () => void
  loadRoute: (route: Route) => void

  beginDrag: (id: string) => void
  endDrag: () => void

  setPlaying: (playing: boolean) => void
  setPlaybackTime: (t: number) => void
  advancePlayback: (deltaMs: number, durationMs: number) => void

  /** Persists now, cancelling any pending debounced write. Call on gesture end, not mid-drag. */
  persist: () => void
  /** Debounced persist. Safe to call on every keystroke. */
  schedulePersist: () => void
}

function touch(route: Route): Route {
  return { ...route, updatedAt: Date.now() }
}

export const useRouteStore = create<RouteState>((set, get) => ({
  route: DEMO_ROUTE,
  selectedWaypointId: null,
  draggingWaypointId: null,
  playback: { playing: false, t: 0, speedMultiplier: 1 },

  addWaypoint: (lng, lat) => {
    set((state) => ({
      route: touch({
        ...state.route,
        waypoints: [
          ...state.route.waypoints,
          { id: createId(), lng, lat, altitude: null, legSpeedMps: null, dwellMs: null },
        ],
      }),
    }))
    get().schedulePersist()
  },

  // Deliberately does not persist: this fires dozens of times per second during
  // a drag. The write happens once, in endDrag.
  moveWaypoint: (id, lng, lat) =>
    set((state) => ({
      route: {
        ...state.route,
        waypoints: state.route.waypoints.map((wp) => (wp.id === id ? { ...wp, lng, lat } : wp)),
      },
    })),

  updateWaypoint: (id, patch) => {
    set((state) => ({
      route: touch({
        ...state.route,
        waypoints: state.route.waypoints.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)),
      }),
    }))
    get().schedulePersist()
  },

  removeWaypoint: (id) => {
    set((state) => ({
      route: touch({
        ...state.route,
        waypoints: state.route.waypoints.filter((wp) => wp.id !== id),
      }),
      selectedWaypointId: state.selectedWaypointId === id ? null : state.selectedWaypointId,
    }))
    get().schedulePersist()
  },

  selectWaypoint: (id) => set({ selectedWaypointId: id }),

  updateSettings: (patch) => {
    set((state) => ({ route: touch({ ...state.route, settings: { ...state.route.settings, ...patch } }) }))
    get().schedulePersist()
  },

  clearRoute: () => {
    set(() => ({
      route: touch({
        id: createId(),
        name: 'New route',
        waypoints: [],
        settings: DEFAULT_SETTINGS,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      selectedWaypointId: null,
      draggingWaypointId: null,
      playback: { playing: false, t: 0, speedMultiplier: 1 },
    }))
    // Written immediately: the empty route has a new id, and until it exists in
    // the DB a reload would resurrect the route the user just cleared.
    get().persist()
  },

  // No write: this route came out of the DB, or is about to be written by whoever
  // imported it.
  loadRoute: (route) =>
    set({
      route,
      selectedWaypointId: null,
      draggingWaypointId: null,
      playback: { playing: false, t: 0, speedMultiplier: 1 },
    }),

  beginDrag: (id) => set({ draggingWaypointId: id }),

  endDrag: () => {
    if (get().draggingWaypointId === null) return
    set((state) => ({ route: touch(state.route), draggingWaypointId: null }))
    get().persist()
  },

  setPlaying: (playing) => set((state) => ({ playback: { ...state.playback, playing } })),

  setPlaybackTime: (t) => set((state) => ({ playback: { ...state.playback, t } })),

  advancePlayback: (deltaMs, durationMs) =>
    set((state) => {
      if (!state.playback.playing || durationMs <= 0) return state
      let next = state.playback.t + deltaMs * state.playback.speedMultiplier
      if (next >= durationMs) {
        next = state.route.settings.loop ? next % durationMs : durationMs
      }
      const playing = state.route.settings.loop ? state.playback.playing : next < durationMs
      return { playback: { ...state.playback, t: next, playing } }
    }),

  persist: () => {
    cancelPendingWrite()
    writeRoute(get().route)
  },

  schedulePersist: () => {
    cancelPendingWrite()
    persistTimer = setTimeout(() => {
      persistTimer = null
      writeRoute(get().route)
    }, PERSIST_DEBOUNCE_MS)
  },
}))
