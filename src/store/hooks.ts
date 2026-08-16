import { useEffect, useMemo, useRef } from 'react'
import { useRouteStore } from './routeStore'
import { buildTrack, positionAtTime, trackDurationMs } from '../routes/interpolate'
import type { TrackPoint } from '../types/route'

/** Derives the dense track from the current route. Recomputed only when the route changes. */
export function useTrack(): TrackPoint[] {
  const route = useRouteStore((s) => s.route)
  return useMemo(() => buildTrack(route), [route])
}

/** Interpolated marker position for the current playback time. */
export function useCurrentPosition(track: TrackPoint[]): TrackPoint | null {
  const t = useRouteStore((s) => s.playback.t)
  return useMemo(() => positionAtTime(track, t), [track, t])
}

/** Drives playback.t forward with requestAnimationFrame while playing; idle (no rAF) otherwise. */
export function usePlaybackClock(track: TrackPoint[]): void {
  const playing = useRouteStore((s) => s.playback.playing)
  const advancePlayback = useRouteStore((s) => s.advancePlayback)
  const durationMs = trackDurationMs(track)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!playing || durationMs <= 0) {
      lastTimeRef.current = null
      return
    }

    let frame: number
    const tick = (time: number) => {
      if (lastTimeRef.current !== null) {
        advancePlayback(time - lastTimeRef.current, durationMs)
      }
      lastTimeRef.current = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      lastTimeRef.current = null
    }
  }, [playing, durationMs, advancePlayback])
}
