import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Route } from '../types/route'

const { putRoute } = vi.hoisted(() => ({
  putRoute: vi.fn((_route: Route): Promise<void> => Promise.resolve()),
}))
vi.mock('../db', () => ({ putRoute }))

const { useRouteStore } = await import('./routeStore')

function baseRoute(): Route {
  return {
    id: 'test-route',
    name: 'Test route',
    waypoints: [
      { id: 'a', lng: 0, lat: 0, altitude: null, legSpeedMps: null },
      { id: 'b', lng: 0.01, lat: 0.01, altitude: null, legSpeedMps: null },
    ],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: 0,
    updatedAt: 0,
  }
}

/** The route as it was actually written, for the nth call. */
function written(call = 0): Route {
  const args = putRoute.mock.calls[call]
  if (!args) throw new Error(`putRoute was not called ${call + 1} time(s)`)
  return args[0]
}

beforeEach(() => {
  vi.useFakeTimers()
  // Flush any debounce left pending by the previous test before counting.
  useRouteStore.getState().persist()
  useRouteStore.setState({
    route: baseRoute(),
    selectedWaypointId: null,
    draggingWaypointId: null,
    playback: { playing: false, t: 0, speedMultiplier: 1 },
  })
  putRoute.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('persistence', () => {
  it('writes an added waypoint', () => {
    useRouteStore.getState().addWaypoint(1, 2)
    vi.runAllTimers()

    expect(putRoute).toHaveBeenCalledTimes(1)
    expect(written().waypoints).toHaveLength(3)
    expect(written().waypoints[2]).toMatchObject({ lng: 1, lat: 2 })
  })

  it('writes a changed setting', () => {
    useRouteStore.getState().updateSettings({ baseSpeedMps: 9.5 })
    vi.runAllTimers()

    expect(putRoute).toHaveBeenCalledTimes(1)
    expect(written().settings.baseSpeedMps).toBe(9.5)
  })

  it('writes a removed waypoint and a waypoint edit', () => {
    useRouteStore.getState().updateWaypoint('a', { altitude: 120 })
    vi.runAllTimers()
    expect(written().waypoints[0].altitude).toBe(120)

    putRoute.mockClear()
    useRouteStore.getState().removeWaypoint('a')
    vi.runAllTimers()
    expect(written().waypoints.map((wp) => wp.id)).toEqual(['b'])
  })

  it('collapses a burst of edits into one write', () => {
    const { updateSettings } = useRouteStore.getState()
    for (const speed of [1, 2, 3, 4, 5]) updateSettings({ baseSpeedMps: speed })
    vi.runAllTimers()

    expect(putRoute).toHaveBeenCalledTimes(1)
    expect(written().settings.baseSpeedMps).toBe(5)
  })

  it('writes the empty route immediately when cleared', () => {
    const before = useRouteStore.getState().route.id
    useRouteStore.getState().clearRoute()

    // No timer advance: until the empty route exists in the DB, a reload would
    // resurrect the one the user just cleared.
    expect(putRoute).toHaveBeenCalledTimes(1)
    expect(written().waypoints).toEqual([])
    expect(written().id).not.toBe(before)
  })

  it('does not write a route it just loaded', () => {
    useRouteStore.getState().loadRoute(baseRoute())
    vi.runAllTimers()

    expect(putRoute).not.toHaveBeenCalled()
  })
})

describe('drag', () => {
  it('writes once for a whole drag, not once per pointer event', () => {
    const store = useRouteStore.getState()
    store.beginDrag('a')
    for (let i = 0; i < 60; i++) store.moveWaypoint('a', i * 0.001, i * 0.001)
    expect(putRoute).not.toHaveBeenCalled()

    store.endDrag()
    vi.runAllTimers()

    expect(putRoute).toHaveBeenCalledTimes(1)
    expect(written().waypoints[0].lng).toBeCloseTo(0.059, 9)
    expect(written().waypoints[0].lat).toBeCloseTo(0.059, 9)
  })

  it('marks the drag so derived state can hold still, and clears it on release', () => {
    const store = useRouteStore.getState()
    store.beginDrag('a')
    expect(useRouteStore.getState().draggingWaypointId).toBe('a')

    store.endDrag()
    expect(useRouteStore.getState().draggingWaypointId).toBeNull()
  })

  it('bumps updatedAt on release, so the route sorts as recently edited', () => {
    const store = useRouteStore.getState()
    store.beginDrag('a')
    store.moveWaypoint('a', 5, 5)
    store.endDrag()

    expect(written().updatedAt).toBeGreaterThan(0)
  })
})
