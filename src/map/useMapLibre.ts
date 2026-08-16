import { useEffect, useRef, useState, type RefObject } from 'react'
import { Map as MapLibreMap, type ErrorEvent as MapLibreErrorEvent } from 'maplibre-gl'

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
  error: string | null
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
  const { styleUrl, center, zoom, pitch = 0, bearing = 0 } = options

  // center/zoom/pitch/bearing are only the *initial* camera; changing them
  // does not recreate the map. Camera moves after mount are imperative.
  const initial = useRef({ center, zoom, pitch, bearing })

  useEffect(() => {
    if (!containerRef.current) return

    if (!styleUrl) {
      setError('No map style configured. Set VITE_MAP_STYLE_URL in .env.')
      return
    }

    setReady(false)
    setError(null)

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

    const handleLoad = () => setReady(true)
    const handleError = (event: MapLibreErrorEvent) => {
      setError(event.error?.message ?? 'Failed to load map style.')
    }

    map.on('load', handleLoad)
    map.on('error', handleError)

    return () => {
      map.off('load', handleLoad)
      map.off('error', handleError)
      mapRef.current = null
      map.remove()
    }
  }, [styleUrl])

  return { containerRef, mapRef, ready, error }
}
