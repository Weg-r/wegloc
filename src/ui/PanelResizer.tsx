import { useCallback, useRef } from 'react'

interface PanelResizerProps {
  /** Called with the pointer's vertical travel since the drag began, in pixels. */
  onDrag: (deltaY: number) => void
  onDragEnd?: () => void
  /** Called with a step in pixels when the handle is nudged from the keyboard. */
  onNudge: (deltaY: number) => void
  label: string
}

const NUDGE_PX = 24
const NUDGE_PX_LARGE = 96

/**
 * The grab bar between two stacked panels.
 *
 * Pointer events rather than mouse events, so a trackpad, a touchscreen and a
 * pen all work from one path — and capture on the handle, so a fast drag that
 * outruns the cursor keeps resizing instead of stopping the moment the pointer
 * leaves the two pixels it started on.
 *
 * Draggable is not enough on its own: a divider that only a precise pointer can
 * move is unusable on a laptop trackpad and invisible to the keyboard. It is a
 * separator that takes focus and answers the arrow keys.
 */
export default function PanelResizer({ onDrag, onDragEnd, onNudge, label }: PanelResizerProps) {
  const startYRef = useRef(0)

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Ignore anything but the primary button; a right-click should open a menu,
    // not start a resize the user cannot see.
    if (event.button !== 0) return
    startYRef.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }, [])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      onDrag(event.clientY - startYRef.current)
      startYRef.current = event.clientY
    },
    [onDrag],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
      event.currentTarget.releasePointerCapture(event.pointerId)
      onDragEnd?.()
    },
    [onDragEnd],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? NUDGE_PX_LARGE : NUDGE_PX
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          onNudge(-step)
          break
        case 'ArrowDown':
          event.preventDefault()
          onNudge(step)
          break
        default:
          break
      }
    },
    [onNudge],
  )

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      // Tall enough to hit with a thumb, drawn as if it were thin. touch-none
      // stops the browser scrolling the panel instead of handing us the drag.
      className="group relative h-4 shrink-0 cursor-row-resize touch-none bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
    >
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-600 transition-colors group-hover:bg-neutral-400 group-focus-visible:bg-white"
      />
    </div>
  )
}
