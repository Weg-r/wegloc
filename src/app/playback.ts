import { useEffect, useRef, type RefObject } from 'react'
import { useRouteStore } from '../store/routeStore'
import { positionAtTime } from '../routes/interpolate'
import type { RouteMapHandle } from '../map/RouteMap'
import type { TrackPoint } from '../types/route'

/** How often the store's playback time is committed for the readouts and scrub thumb. */
const COMMIT_INTERVAL_MS = 100

/** A frame gap longer than this means the tab was hidden; skip it rather than lurching forward. */
const RESUME_GAP_MS = 250

/**
 * Drives playback.
 *
 * The marker moves every animation frame, imperatively, through the map handle
 * -- no React render per frame. The store's `playback.t` is committed only about
 * ten times a second, which is all the readouts and the scrub thumb need. That
 * keeps a 120Hz display from running 120 React renders a second to move one dot.
 *
 * Browsers already stop rAF callbacks while the tab is hidden; the resume-gap
 * guard stops the marker from jumping when they start again.
 */
export function usePlaybackEngine(
  track: TrackPoint[],
  durationMs: number,
  mapHandleRef: RefObject<RouteMapHandle | null>,
  follow: boolean,
): void {
  const playing = useRouteStore((s) => s.playback.playing)
  const trackRef = useRef(track)
  trackRef.current = track
  const followRef = useRef(follow)
  followRef.current = follow

  useEffect(() => {
    if (!playing || durationMs <= 0) return

    const store = useRouteStore.getState
    let frame = 0
    let last: number | null = null
    let tLocal = store().playback.t
    let lastCommit = 0

    const paint = () => {
      const point = positionAtTime(trackRef.current, tLocal)
      mapHandleRef.current?.setMarker(point)
      if (point && followRef.current) mapHandleRef.current?.follow(point)
    }

    const step = (time: number) => {
      if (last !== null) {
        const dt = time - last
        // A huge gap is a hidden-tab resume, not real elapsed time.
        if (dt < RESUME_GAP_MS) {
          tLocal += dt * store().playback.speedMultiplier

          if (tLocal >= durationMs) {
            if (store().route.settings.loop) {
              tLocal %= durationMs
            } else {
              tLocal = durationMs
              paint()
              store().setPlaybackTime(durationMs)
              useRouteStore.setState((prev) => ({ playback: { ...prev.playback, playing: false } }))
              return
            }
          }

          paint()
          if (time - lastCommit >= COMMIT_INTERVAL_MS) {
            store().setPlaybackTime(tLocal)
            lastCommit = time
          }
        }
      }
      last = time
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      // Commit wherever the marker actually is, so a pause leaves the readouts and
      // scrub in sync with the dot.
      store().setPlaybackTime(tLocal)
    }
  }, [playing, durationMs, mapHandleRef])
}
