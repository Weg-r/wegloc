import { useEffect } from 'react'
import { useRouteStore } from '../store/routeStore'

/** True when the user is typing, where the browser's own undo should win. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/**
 * Undo and redo from the keyboard, on both the cmd and ctrl conventions. Stays
 * out of the way inside form fields so editing a number still undoes character
 * by character.
 */
export function useUndoRedoShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      if (isTextEntry(event.target)) return

      event.preventDefault()
      const { undo, redo } = useRouteStore.getState()
      if (event.shiftKey) redo()
      else undo()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
