import { useState } from 'react'
import type { RouteSummary } from '../app/library'
import type { StorageFailure } from '../db'
import { ACCENT } from '../lib/theme'
import { formatRelativeTime } from '../lib/format'

interface StorageStatus {
  available: boolean
  pending: boolean
  failure: StorageFailure | null
}

interface RouteBarProps {
  routeId: string
  routeName: string
  onRename: (name: string) => void
  storage: StorageStatus
  routes: RouteSummary[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onDuplicate: () => void
  onExport: () => void
  onImport: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onLoadFixtures?: () => void
}

const actionClass =
  'px-2 py-1 border-2 border-neutral-300 font-mono text-[11px] font-bold uppercase tracking-wide text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 disabled:opacity-30 disabled:hover:border-neutral-300 disabled:hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-neutral-900'

/**
 * Honest about the debounce: "saving" covers both the queued write and the one
 * in flight, and a failure stays up until a write succeeds rather than blinking
 * away on its own.
 */
function storageProblem(storage: StorageStatus): string | null {
  if (!storage.available) {
    return 'This browser is blocking local storage, which private browsing usually does. Routes are not being saved -- use Export to keep anything you need.'
  }
  return storage.failure?.message ?? null
}

function SaveState({ storage }: { storage: StorageStatus }) {
  if (storageProblem(storage)) {
    return (
      <span
        className="px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white"
        style={{ backgroundColor: ACCENT }}
        role="status"
      >
        Not saved
      </span>
    )
  }

  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400" role="status">
      {storage.pending ? 'Saving' : 'Saved'}
    </span>
  )
}

export default function RouteBar({
  routeId,
  routeName,
  onRename,
  storage,
  routes,
  onOpen,
  onDelete,
  onNew,
  onDuplicate,
  onExport,
  onImport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onLoadFixtures,
}: RouteBarProps) {
  const [listOpen, setListOpen] = useState(false)
  const now = Date.now()
  const problem = storageProblem(storage)

  return (
    <div className="border-b border-neutral-200 px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Wegloc / Line Diagram</p>
        <SaveState storage={storage} />
      </div>

      <input
        value={routeName}
        onChange={(e) => onRename(e.target.value)}
        aria-label="Route name"
        placeholder="Untitled route"
        className="mt-1 w-full border-0 border-b-2 border-transparent bg-transparent text-lg font-black uppercase tracking-tight text-neutral-900 outline-none hover:border-neutral-200 focus:border-neutral-900"
      />

      {problem && (
        <p
          className="mt-2 border-l-4 py-1 pl-2 text-[11px] leading-snug text-neutral-700"
          style={{ borderColor: ACCENT }}
        >
          {problem}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          className={actionClass}
          onClick={() => setListOpen((open) => !open)}
          aria-expanded={listOpen}
        >
          Routes {routes.length > 0 && `(${routes.length})`}
        </button>
        <button type="button" className={actionClass} onClick={onNew}>
          New
        </button>
        <button type="button" className={actionClass} onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className={actionClass} onClick={onExport}>
          Export
        </button>
        <button type="button" className={actionClass} onClick={onImport}>
          Import
        </button>
        <button type="button" className={actionClass} onClick={onUndo} disabled={!canUndo} title="Undo (cmd/ctrl+Z)">
          Undo
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (shift+cmd/ctrl+Z)"
        >
          Redo
        </button>
        {onLoadFixtures && (
          <button type="button" className={actionClass} onClick={onLoadFixtures} title="Dev only">
            Fixtures
          </button>
        )}
      </div>

      {listOpen && (
        <ul className="mt-3 max-h-56 overflow-y-auto border-2 border-neutral-200">
          {routes.length === 0 && (
            <li className="px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-neutral-400">
              No saved routes
            </li>
          )}
          {routes.map((route) => {
            const open = route.id === routeId
            return (
              <li key={route.id} className={`flex items-stretch ${open ? 'bg-neutral-100' : 'hover:bg-neutral-50'}`}>
                <button
                  type="button"
                  onClick={() => onOpen(route.id)}
                  aria-current={open ? 'true' : undefined}
                  className="min-w-0 flex-1 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900"
                >
                  <span className="block truncate text-sm font-semibold text-neutral-900">
                    {route.name || 'Untitled route'}
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-wide text-neutral-500">
                    {route.waypointCount} WP · {formatRelativeTime(route.updatedAt, now)}
                    {open && ' · open'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(route.id)}
                  aria-label={`Delete ${route.name || 'untitled route'}`}
                  className="w-11 shrink-0 text-xs font-bold text-neutral-300 hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-900"
                  style={{ ['--accent' as string]: ACCENT }}
                >
                  &#10005;
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
