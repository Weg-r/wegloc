import { useEffect, useRef } from 'react'
import { useRouteStore } from '../store/routeStore'
import { listRoutes, putRoute } from '../db'

/**
 * Loads the most recently saved route from IndexedDB on first mount. If none
 * exists yet (fresh browser), persists the in-memory demo route so there's
 * something to find next time.
 */
export function useHydrateFromDb(): void {
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    listRoutes()
      .then((routes) => {
        if (routes.length > 0) {
          loadRoute(routes[0])
        } else {
          return putRoute(useRouteStore.getState().route)
        }
      })
      .catch(() => {
        // IndexedDB unavailable (quota, private browsing). Keep the in-memory demo route.
      })
  }, [loadRoute])
}

/**
 * Flushes the debounced write when the page goes away. Without this, an edit made
 * inside the debounce window is lost if the tab is closed straight after -- which
 * is exactly what someone does after tweaking one setting.
 */
export function useFlushPendingWrites(): void {
  useEffect(() => {
    const flush = () => useRouteStore.getState().persist()
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}
