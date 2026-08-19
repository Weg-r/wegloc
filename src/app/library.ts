import { useCallback, useEffect, useMemo, useState } from 'react'
import { listRoutes } from '../db'
import { useRouteStore } from '../store/routeStore'

export interface RouteSummary {
  id: string
  name: string
  updatedAt: number
  waypointCount: number
}

/**
 * The list of saved routes, refetched whenever the set of them changes. Kept
 * out of the store on purpose: it is a projection of the database, not editing
 * state, and the store already owns enough.
 */
export function useRouteLibrary(): { routes: RouteSummary[]; refresh: () => void } {
  const libraryVersion = useRouteStore((s) => s.libraryVersion)
  const current = useRouteStore((s) => s.route)
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [manualVersion, setManualVersion] = useState(0)

  const refresh = useCallback(() => setManualVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false

    listRoutes()
      .then((saved) => {
        if (cancelled) return
        setRoutes(
          saved.map((route) => ({
            id: route.id,
            name: route.name,
            updatedAt: route.updatedAt,
            waypointCount: route.waypoints.length,
          })),
        )
      })
      .catch(() => {
        // Storage is unavailable; the badge in the header says so already.
        if (!cancelled) setRoutes([])
      })

    return () => {
      cancelled = true
    }
  }, [libraryVersion, manualVersion])

  // The open route's name and count come from the store rather than the last
  // fetch, so renaming shows up immediately without refetching every route in
  // the database on each keystroke.
  const merged = useMemo(
    () =>
      routes.map((route) =>
        route.id === current.id
          ? {
              ...route,
              name: current.name,
              updatedAt: current.updatedAt,
              waypointCount: current.waypoints.length,
            }
          : route,
      ),
    [routes, current],
  )

  return { routes: merged, refresh }
}
