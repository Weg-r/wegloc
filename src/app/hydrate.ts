import { useEffect, useRef } from 'react'
import { useRouteStore } from '../store/routeStore'
import { listRoutes, putRoute } from '../db'

/** Which route the user had open, so a reload reopens their work and not just the newest one. */
const LAST_OPENED_KEY = 'wegloc:last-opened-route'

/**
 * A UI preference rather than user data, so it lives in localStorage: losing it
 * costs nothing, and keeping it out of IndexedDB avoids a schema version bump on
 * a database full of routes.
 */
function readLastOpenedId(): string | null {
  try {
    return window.localStorage.getItem(LAST_OPENED_KEY)
  } catch {
    return null
  }
}

function writeLastOpenedId(id: string): void {
  try {
    window.localStorage.setItem(LAST_OPENED_KEY, id)
  } catch {
    // Storage disabled. The editor still works; the next reload just opens the
    // most recent route instead.
  }
}

/**
 * Opens the route the user last had open on first mount, falling back to the
 * most recently edited one. If the database is empty (fresh browser), persists
 * the in-memory demo route so there's something to find next time.
 */
export function useHydrateFromDb(): void {
  const loadRoute = useRouteStore((s) => s.loadRoute)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    listRoutes()
      .then((routes) => {
        if (routes.length === 0) {
          return putRoute(useRouteStore.getState().route)
        }

        const lastOpened = readLastOpenedId()
        const previous = lastOpened ? routes.find((route) => route.id === lastOpened) : undefined
        loadRoute(previous ?? routes[0])
      })
      .catch(() => {
        // IndexedDB unavailable (quota, private browsing). Keep the in-memory
        // demo route; the save badge in the header says routes aren't persisting.
      })
  }, [loadRoute])
}

/** Records the open route as it changes, for the next session. */
export function useRememberLastOpened(): void {
  useEffect(
    () =>
      useRouteStore.subscribe((state, previous) => {
        if (state.route.id !== previous.route.id) writeLastOpenedId(state.route.id)
      }),
    [],
  )
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
