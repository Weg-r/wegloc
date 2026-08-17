import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Map as MapLibreMap, type ErrorEvent as MapLibreErrorEvent } from 'maplibre-gl'

/** How long a transient map warning stays on screen before clearing itself. */
const WARNING_TTL_MS = 6000

interface UseMapLibreOptions {
  styleUrl: string
  center: [number, number]
  zoom: number
  pitch?: number
  bearing?: number
}

interface UseMapLibreResult {
  containerRef: RefObject<HTMLDivElement | null>
  mapRef: RefObject<MapLibreMap | null>
  ready: boolean
  /** The map cannot render at all: the style never came up. */
  error: string | null
  /** Something failed but the map still works -- a tile, a sprite, a glyph range. */
  warning: string | null
  dismissWarning: () => void
}

/** The URL a failed request was for, if the error carries one (maplibre's AJAXError). */
function failedUrl(error: unknown): string | null {
  const url = (error as { url?: unknown } | null)?.url
  return typeof url === 'string' ? url : null
}

function absolute(url: string): string {
  try {
    return new URL(url, window.location.href).href
  } catch {
    return url
  }
}

/**
 * Decides whether a map error is worth blanking the map for.
 *
 * MapLibre fires `error` for anything from a missing style to a single 404'd
 * tile on a fast pan. Only the first kind is fatal: a tile blip must not put an
 * overlay over the user's route. The style URL is the discriminator, since the
 * event itself carries no source id -- and an error with no URL at all is fatal
 * only if it arrived before the map ever finished loading, which is what an
 * unparseable or invalid style looks like.
 */
function isFatal(error: unknown, styleUrl: string, hasLoaded: boolean): boolean {
  const url = failedUrl(error)
  if (url !== null) return absolute(url) === absolute(styleUrl)
  return !hasLoaded
}

/**
 * Owns a MapLibre instance imperatively. The instance never touches React
 * state; callers read `mapRef.current` inside effects gated on `ready` to add
 * sources/layers, and update them with setData outside of React's render cycle.
 */
export function useMapLibre(options: UseMapLibreOptions): UseMapLibreResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const { styleUrl, center, zoom, pitch = 0, bearing = 0 } = options

  // center/zoom/pitch/bearing are only the *initial* camera; changing them
  // does not recreate the map. Camera moves after mount are imperative.
  const initial = useRef({ center, zoom, pitch, bearing })
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissWarning = useCallback(() => {
    if (warningTimer.current !== null) clearTimeout(warningTimer.current)
    warningTimer.current = null
    setWarning(null)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    if (!styleUrl) {
      setError('No map style configured. Set VITE_MAP_STYLE_URL in .env.')
      return
    }

    setReady(false)
    setError(null)
    setWarning(null)

    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleUrl,
      center: initial.current.center,
      zoom: initial.current.zoom,
      pitch: initial.current.pitch,
      bearing: initial.current.bearing,
      attributionControl: false,
    })
    mapRef.current = map

    let hasLoaded = false

    const handleLoad = () => {
      hasLoaded = true
      setReady(true)
      setError(null)
    }

    const handleError = (event: MapLibreErrorEvent) => {
      const message = event.error?.message ?? 'Unknown map error.'
      if (isFatal(event.error, styleUrl, hasLoaded)) {
        setError(`Map style failed to load from VITE_MAP_STYLE_URL. ${message}`)
        return
      }
      // Transient: say so, then get out of the way on its own.
      setWarning(message)
      if (warningTimer.current !== null) clearTimeout(warningTimer.current)
      warningTimer.current = setTimeout(() => {
        warningTimer.current = null
        setWarning(null)
      }, WARNING_TTL_MS)
    }

    map.on('load', handleLoad)
    map.on('error', handleError)

    return () => {
      if (warningTimer.current !== null) clearTimeout(warningTimer.current)
      warningTimer.current = null
      map.off('load', handleLoad)
      map.off('error', handleError)
      mapRef.current = null
      map.remove()
    }
  }, [styleUrl])

  return { containerRef, mapRef, ready, error, warning, dismissWarning }
}
