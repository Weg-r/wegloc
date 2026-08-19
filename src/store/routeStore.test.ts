import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Route } from '../types/route'

const { putRoute, getRoute, listRoutes, deleteRoute } = vi.hoisted(() => ({
  putRoute: vi.fn((_route: Route): Promise<void> => Promise.resolve()),
  getRoute: vi.fn((_id: string): Promise<Route | undefined> => Promise.resolve(undefined)),
  listRoutes: vi.fn((): Promise<Route[]> => Promise.resolve([])),
  deleteRoute: vi.fn((_id: string): Promise<void> => Promise.resolve()),
}))

vi.mock('../db', () => ({
  putRoute,
  getRoute,
  listRoutes,
  deleteRoute,
  isStorageAvailable: () => true,
  toStorageFailure: (error: unknown) => ({
    kind: 'unknown',
    message: error instanceof Error ? error.message : String(error),
  }),
}))

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
  putRoute.mockImplementation(() => Promise.resolve())
  getRoute.mockImplementation(() => Promise.resolve(undefined))
  listRoutes.mockImplementation(() => Promise.resolve([]))
  deleteRoute.mockImplementation(() => Promise.resolve())
  // Flush any debounce left pending by the previous test before counting.
  useRouteStore.getState().persist()
  useRouteStore.setState({
    route: baseRoute(),
    selectedWaypointId: null,
    draggingWaypointId: null,
    past: [],
    future: [],
    storage: { available: true, pending: false, failure: null },
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

  it('writes the empty route immediately when a new one is started', () => {
    const before = useRouteStore.getState().route.id
    useRouteStore.getState().newRoute()

    // No timer advance: until the empty route exists in the DB, a reload would
    // reopen the previous one and this one would simply be gone.
    const ids = putRoute.mock.calls.map(([r]) => r.id)
    expect(ids).toContain(before)
    expect(written(putRoute.mock.calls.length - 1).waypoints).toEqual([])
    expect(written(putRoute.mock.calls.length - 1).id).not.toBe(before)
  })

  it('flushes a pending edit before switching to another route', () => {
    useRouteStore.getState().updateSettings({ baseSpeedMps: 7 })
    // The debounce has not fired yet.
    expect(putRoute).not.toHaveBeenCalled()

    useRouteStore.getState().newRoute()
    expect(putRoute.mock.calls.some(([r]) => r.settings.baseSpeedMps === 7)).toBe(true)
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

  it('costs nothing when the pointer went down and up without moving', () => {
    const store = useRouteStore.getState()
    store.beginDrag('a')
    store.endDrag()

    // Clicking a waypoint to select it is not an edit.
    expect(putRoute).not.toHaveBeenCalled()
    expect(useRouteStore.getState().past).toEqual([])
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

describe('undo and redo', () => {
  it('walks back through each kind of edit and forward again', () => {
    const store = useRouteStore.getState()
    store.addWaypoint(1, 1)
    store.updateSettings({ baseSpeedMps: 9 })
    store.removeWaypoint('a')

    expect(useRouteStore.getState().route.waypoints.map((wp) => wp.id)).toEqual(['b', expect.any(String)])

    useRouteStore.getState().undo()
    expect(useRouteStore.getState().route.waypoints.map((wp) => wp.id)[0]).toBe('a')

    useRouteStore.getState().undo()
    expect(useRouteStore.getState().route.settings.baseSpeedMps).toBe(DEFAULT_SETTINGS.baseSpeedMps)

    useRouteStore.getState().undo()
    expect(useRouteStore.getState().route.waypoints).toHaveLength(2)

    useRouteStore.getState().redo()
    expect(useRouteStore.getState().route.waypoints).toHaveLength(3)
    useRouteStore.getState().redo()
    expect(useRouteStore.getState().route.settings.baseSpeedMps).toBe(9)
  })

  it('does nothing at the ends of the stack', () => {
    expect(() => useRouteStore.getState().undo()).not.toThrow()
    expect(() => useRouteStore.getState().redo()).not.toThrow()
    expect(useRouteStore.getState().route.waypoints).toHaveLength(2)
  })

  it('treats a whole drag as one step', () => {
    const store = useRouteStore.getState()
    store.beginDrag('a')
    for (let i = 0; i < 40; i++) store.moveWaypoint('a', i * 0.01, i * 0.01)
    store.endDrag()

    expect(useRouteStore.getState().past).toHaveLength(1)
    useRouteStore.getState().undo()
    expect(useRouteStore.getState().route.waypoints[0]).toMatchObject({ lng: 0, lat: 0 })
  })

  it('folds a burst of typing in one field into one step', () => {
    const { updateSettings } = useRouteStore.getState()
    for (const speed of [1, 2, 3, 4, 5]) updateSettings({ baseSpeedMps: speed })

    expect(useRouteStore.getState().past).toHaveLength(1)
    useRouteStore.getState().undo()
    expect(useRouteStore.getState().route.settings.baseSpeedMps).toBe(DEFAULT_SETTINGS.baseSpeedMps)
  })

  it('keeps separate fields as separate steps', () => {
    const { updateSettings } = useRouteStore.getState()
    updateSettings({ baseSpeedMps: 3 })
    updateSettings({ jitterMeters: 7 })

    expect(useRouteStore.getState().past).toHaveLength(2)
  })

  it('does not fold across the coalesce window', () => {
    useRouteStore.getState().updateSettings({ baseSpeedMps: 3 })
    vi.advanceTimersByTime(2_000)
    useRouteStore.getState().updateSettings({ baseSpeedMps: 4 })

    expect(useRouteStore.getState().past).toHaveLength(2)
  })

  it('drops the redo stack once a new edit lands', () => {
    useRouteStore.getState().addWaypoint(1, 1)
    useRouteStore.getState().undo()
    expect(useRouteStore.getState().future).toHaveLength(1)

    useRouteStore.getState().addWaypoint(2, 2)
    expect(useRouteStore.getState().future).toHaveLength(0)
  })

  it('bounds the history', () => {
    for (let i = 0; i < 120; i++) useRouteStore.getState().addWaypoint(i * 0.001, 0)
    expect(useRouteStore.getState().past.length).toBeLessThanOrEqual(50)
  })

  it('writes the restored route', () => {
    useRouteStore.getState().addWaypoint(1, 1)
    vi.runAllTimers()
    putRoute.mockClear()

    useRouteStore.getState().undo()
    expect(putRoute).toHaveBeenCalledTimes(1)
    expect(written().waypoints).toHaveLength(2)
  })

  it('clears the selection when the restored route has no such waypoint', () => {
    useRouteStore.getState().addWaypoint(1, 1)
    const added = useRouteStore.getState().route.waypoints[2].id
    useRouteStore.getState().selectWaypoint(added)

    useRouteStore.getState().undo()
    expect(useRouteStore.getState().selectedWaypointId).toBeNull()
  })

  it('starts a fresh history when another route is opened', () => {
    useRouteStore.getState().addWaypoint(1, 1)
    useRouteStore.getState().loadRoute(baseRoute())

    expect(useRouteStore.getState().past).toEqual([])
    expect(useRouteStore.getState().future).toEqual([])
  })
})

describe('route library', () => {
  it('duplicates into a new id, saved before it is opened', () => {
    const original = useRouteStore.getState().route.id
    void useRouteStore.getState().duplicateRoute()

    const copy = useRouteStore.getState().route
    expect(copy.id).not.toBe(original)
    expect(copy.name).toBe('Test route copy')
    expect(copy.waypoints).toHaveLength(2)
    expect(putRoute.mock.calls.some(([r]) => r.id === copy.id)).toBe(true)
  })

  it('does not share waypoint objects with the route it copied', () => {
    const source = useRouteStore.getState().route
    void useRouteStore.getState().duplicateRoute()
    expect(useRouteStore.getState().route.waypoints[0]).not.toBe(source.waypoints[0])
  })

  it('opens a saved route and flushes the outgoing one', async () => {
    const other = { ...baseRoute(), id: 'other', name: 'Other' }
    getRoute.mockImplementation(() => Promise.resolve(other))

    useRouteStore.getState().updateSettings({ baseSpeedMps: 4 })
    await useRouteStore.getState().openRoute('other')

    expect(useRouteStore.getState().route.id).toBe('other')
    expect(putRoute.mock.calls.some(([r]) => r.settings.baseSpeedMps === 4)).toBe(true)
  })

  it('lands on the next route when the open one is deleted', async () => {
    const survivor = { ...baseRoute(), id: 'survivor', name: 'Survivor' }
    listRoutes.mockImplementation(() => Promise.resolve([survivor]))

    await useRouteStore.getState().deleteRouteById('test-route')

    expect(deleteRoute).toHaveBeenCalledWith('test-route')
    expect(useRouteStore.getState().route.id).toBe('survivor')
  })

  it('lands on a new empty route when the last one is deleted', async () => {
    listRoutes.mockImplementation(() => Promise.resolve([]))

    await useRouteStore.getState().deleteRouteById('test-route')

    expect(useRouteStore.getState().route.waypoints).toEqual([])
    expect(useRouteStore.getState().route.id).not.toBe('test-route')
  })

  it('does not write the deleted route back on the way out', async () => {
    listRoutes.mockImplementation(() => Promise.resolve([]))
    // A pending edit to the route about to be deleted.
    useRouteStore.getState().updateSettings({ baseSpeedMps: 3 })
    putRoute.mockClear()

    await useRouteStore.getState().deleteRouteById('test-route')

    expect(putRoute.mock.calls.some(([r]) => r.id === 'test-route')).toBe(false)
  })

  it('does not resurrect a deleted route when another one survives', async () => {
    const survivor = { ...baseRoute(), id: 'survivor' }
    listRoutes.mockImplementation(() => Promise.resolve([survivor]))
    useRouteStore.getState().updateSettings({ baseSpeedMps: 3 })
    putRoute.mockClear()

    await useRouteStore.getState().deleteRouteById('test-route')
    vi.runAllTimers()

    expect(putRoute.mock.calls.some(([r]) => r.id === 'test-route')).toBe(false)
  })

  it('leaves the open route alone when a different one is deleted', async () => {
    await useRouteStore.getState().deleteRouteById('some-other-route')
    expect(useRouteStore.getState().route.id).toBe('test-route')
  })

  it('imports under a fresh id so importing twice gives two routes', async () => {
    const imported = {
      name: 'Imported',
      waypoints: [{ id: 'x', lng: 1, lat: 1, altitude: null, legSpeedMps: null, dwellMs: null }],
      settings: { ...DEFAULT_SETTINGS },
      createdAt: 123,
    }

    await useRouteStore.getState().importRoute(imported)
    const first = useRouteStore.getState().route.id

    await useRouteStore.getState().importRoute(imported)
    expect(useRouteStore.getState().route.id).not.toBe(first)
    expect(useRouteStore.getState().route.name).toBe('Imported')
    expect(useRouteStore.getState().route.createdAt).toBe(123)
  })

  it('signals the library to refetch when the set of routes changes', async () => {
    const before = useRouteStore.getState().libraryVersion
    useRouteStore.getState().newRoute()
    await useRouteStore.getState().importRoute({
      name: 'x',
      waypoints: [],
      settings: { ...DEFAULT_SETTINGS },
      createdAt: 0,
    })

    expect(useRouteStore.getState().libraryVersion).toBeGreaterThan(before)
  })
})

describe('storage state', () => {
  it('reports a write in flight and then success', async () => {
    useRouteStore.getState().addWaypoint(1, 1)
    expect(useRouteStore.getState().storage.pending).toBe(true)

    vi.runAllTimers()
    await vi.waitFor(() => expect(useRouteStore.getState().storage.pending).toBe(false))
    expect(useRouteStore.getState().storage.failure).toBeNull()
  })

  it('surfaces a failed write instead of swallowing it', async () => {
    putRoute.mockImplementation(() => Promise.reject(new Error('QuotaExceeded')))

    useRouteStore.getState().persist()
    await vi.waitFor(() => expect(useRouteStore.getState().storage.failure).not.toBeNull())
    expect(useRouteStore.getState().storage.failure?.message).toContain('QuotaExceeded')
  })

  it('clears the failure once a write succeeds again', async () => {
    putRoute.mockImplementation(() => Promise.reject(new Error('nope')))
    useRouteStore.getState().persist()
    await vi.waitFor(() => expect(useRouteStore.getState().storage.failure).not.toBeNull())

    putRoute.mockImplementation(() => Promise.resolve())
    useRouteStore.getState().persist()
    await vi.waitFor(() => expect(useRouteStore.getState().storage.failure).toBeNull())
  })
})

describe('waypoint operations', () => {
  it('inserts into the leg nearest a click rather than appending', () => {
    useRouteStore.getState().insertWaypointOnRoute(0.005, 0.005)

    const ids = useRouteStore.getState().route.waypoints.map((wp) => wp.id)
    expect(ids).toHaveLength(3)
    expect(ids[0]).toBe('a')
    expect(ids[2]).toBe('b')
    expect(useRouteStore.getState().selectedWaypointId).toBe(ids[1])
  })

  it('ignores an insert on a route with no legs', () => {
    useRouteStore.setState({ route: { ...baseRoute(), waypoints: [] } })
    useRouteStore.getState().insertWaypointOnRoute(1, 1)
    expect(useRouteStore.getState().route.waypoints).toEqual([])
  })

  it('rejects coordinates that are not on Earth', () => {
    useRouteStore.getState().addWaypoint(500, 0)
    useRouteStore.getState().addWaypoint(0, NaN)
    expect(useRouteStore.getState().route.waypoints).toHaveLength(2)
  })

  it('reorders and reverses as undoable steps', () => {
    useRouteStore.getState().reorderWaypoint(0, 1)
    expect(useRouteStore.getState().route.waypoints.map((wp) => wp.id)).toEqual(['b', 'a'])

    useRouteStore.getState().reverseRoute()
    expect(useRouteStore.getState().route.waypoints.map((wp) => wp.id)).toEqual(['a', 'b'])

    useRouteStore.getState().undo()
    expect(useRouteStore.getState().route.waypoints.map((wp) => wp.id)).toEqual(['b', 'a'])
  })
})

describe('playback rate', () => {
  it('sets the multiplier', () => {
    useRouteStore.getState().setSpeedMultiplier(5)
    expect(useRouteStore.getState().playback.speedMultiplier).toBe(5)
  })
})
