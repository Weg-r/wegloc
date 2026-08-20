import { useEffect, useRef, useState } from 'react'
import { reverseGeocode } from '../geocode'
import type { GeocodeStatus } from '../geocode'
import type { Waypoint } from '../types/route'

interface GeocodedLabels {
  /** waypoint id -> resolved place name. Absent means unresolved or none. */
  labels: Record<string, string>
  status: GeocodeStatus
}

/**
 * Resolves place names for waypoints that have no manual label, when the user
 * has turned geocoding on. Skips waypoints that already have a name, is quiet
 * during a drag, and leans on the cache in `reverseGeocode` so a name is only
 * fetched once however often this re-runs. On a network failure it stops and
 * reports `offline`; callers fall back to coordinates.
 *
 * Off by default and gated on `enabled`, so with the feature off this hook makes
 * no request and returns nothing.
 */
export function useGeocodedLabels(waypoints: Waypoint[], enabled: boolean, dragging: boolean): GeocodedLabels {
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<GeocodeStatus>('idle')
  // Latest resolved labels, read inside the effect without making it a dependency
  // (which would restart the loop on every resolution).
  const labelsRef = useRef(labels)
  labelsRef.current = labels

  useEffect(() => {
    if (!enabled || dragging) return

    // A waypoint needs a lookup only if the user hasn't named it and we haven't
    // already resolved one. Resolution lives in state, so a cancelled run just
    // leaves the waypoint pending for the next one -- nothing gets stranded.
    const pending = waypoints.filter((wp) => !wp.label?.trim() && !labelsRef.current[wp.id])
    if (pending.length === 0) {
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('working')

    ;(async () => {
      for (const wp of pending) {
        if (cancelled) return
        try {
          const name = await reverseGeocode(wp.lng, wp.lat)
          if (cancelled) return
          if (name) setLabels((prev) => ({ ...prev, [wp.id]: name }))
        } catch {
          // Network down or provider erroring. Stop and let the user see it; the
          // unresolved waypoints stay pending and retry when they toggle or edit.
          if (!cancelled) setStatus('offline')
          return
        }
      }
      if (!cancelled) setStatus('idle')
    })()

    return () => {
      cancelled = true
    }
  }, [waypoints, enabled, dragging])

  return { labels, status }
}
