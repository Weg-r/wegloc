import { create } from 'zustand'
import { createId } from '../lib/id'
import { putRoute } from '../db'
import { DEMO_ROUTE } from '../routes/demo'
import { DEFAULT_SETTINGS, type Route, type SimulationSettings, type Waypoint } from '../types/route'

interface PlaybackState {
  playing: boolean
  /** Milliseconds into the track. */
  t: number
  speedMultiplier: number
}

interface RouteState {
  route: Route
  selectedWaypointId: string | null
  playback: PlaybackState

  addWaypoint: (lng: number, lat: number) => void
  moveWaypoint: (id: string, lng: number, lat: number) => void
  updateWaypoint: (id: string, patch: Partial<Omit<Waypoint, 'id'>>) => void
  removeWaypoint: (id: string) => void
  selectWaypoint: (id: string | null) => void
  updateSettings: (patch: Partial<SimulationSettings>) => void
  clearRoute: () => void
  loadRoute: (route: Route) => void

  setPlaying: (playing: boolean) => void
  setPlaybackTime: (t: number) => void
  advancePlayback: (deltaMs: number, durationMs: number) => void

  /** Persists the current route to IndexedDB. Call on gesture end, not mid-drag. */
  persist: () => void
}

function touch(route: Route): Route {
  return { ...route, updatedAt: Date.now() }
}

export const useRouteStore = create<RouteState>((set, get) => ({
  route: DEMO_ROUTE,
  selectedWaypointId: null,
  playback: { playing: false, t: 0, speedMultiplier: 1 },

  addWaypoint: (lng, lat) =>
    set((state) => ({
      route: touch({
        ...state.route,
        waypoints: [
          ...state.route.waypoints,
          { id: createId(), lng, lat, altitude: null, legSpeedMps: null },
        ],
      }),
    })),

  moveWaypoint: (id, lng, lat) =>
    set((state) => ({
      route: {
        ...state.route,
        waypoints: state.route.waypoints.map((wp) => (wp.id === id ? { ...wp, lng, lat } : wp)),
      },
    })),

  updateWaypoint: (id, patch) =>
    set((state) => ({
      route: touch({
        ...state.route,
        waypoints: state.route.waypoints.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)),
      }),
    })),

  removeWaypoint: (id) =>
    set((state) => ({
      route: touch({
        ...state.route,
        waypoints: state.route.waypoints.filter((wp) => wp.id !== id),
      }),
      selectedWaypointId: state.selectedWaypointId === id ? null : state.selectedWaypointId,
    })),

  selectWaypoint: (id) => set({ selectedWaypointId: id }),

  updateSettings: (patch) =>
    set((state) => ({ route: touch({ ...state.route, settings: { ...state.route.settings, ...patch } }) })),

  clearRoute: () =>
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
      playback: { playing: false, t: 0, speedMultiplier: 1 },
    })),

  loadRoute: (route) => set({ route, selectedWaypointId: null, playback: { playing: false, t: 0, speedMultiplier: 1 } }),

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
    putRoute(get().route).catch(() => {
      // Local-first tool; a failed write (quota, private browsing) shouldn't crash the editor.
    })
  },
}))
