import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Route } from '../types/route'

interface WeglocDB extends DBSchema {
  routes: {
    key: string
    value: Route
    indexes: { updatedAt: number }
  }
}

/** Why storage is not working, in words a user can act on. */
export type StorageFailure =
  | { kind: 'unavailable'; message: string }
  | { kind: 'quota'; message: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'unknown'; message: string }

export function describeStorageError(error: unknown): StorageFailure {
  const name = (error as { name?: unknown } | null)?.name
  const message = (error as { message?: unknown } | null)?.message

  if (name === 'QuotaExceededError') {
    return {
      kind: 'quota',
      message: 'Out of browser storage. Export the routes you need, then delete some to free space.',
    }
  }
  if (name === 'SecurityError' || name === 'InvalidStateError') {
    return {
      kind: 'unavailable',
      message: 'This browser is blocking local storage, which private browsing usually does. Routes will not be saved.',
    }
  }
  return {
    kind: 'unknown',
    message: typeof message === 'string' && message ? message : 'Routes could not be saved to this browser.',
  }
}

const UPGRADE_BLOCKED_MESSAGE =
  'Another Wegloc tab is open on an older version and is holding the database. Close it and reload.'

/** Set when a version upgrade is stuck behind another tab, so the UI can say which problem this is. */
let blockedByOtherTab = false

let dbPromise: Promise<IDBPDatabase<WeglocDB>> | null = null

/** False in private browsing and in any context without IndexedDB. */
export function isStorageAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function getDb(): Promise<IDBPDatabase<WeglocDB>> {
  if (!isStorageAvailable()) {
    return Promise.reject(
      Object.assign(new Error('IndexedDB is unavailable in this browser context.'), { name: 'SecurityError' }),
    )
  }

  if (!dbPromise) {
    dbPromise = openDB<WeglocDB>('wegloc', 1, {
      upgrade(db) {
        // Additive only. Never drop a store here: it is full of routes someone
        // spent an afternoon drawing.
        if (!db.objectStoreNames.contains('routes')) {
          const store = db.createObjectStore('routes', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
      },
      blocked() {
        // Another tab is on an older version and won't let the upgrade through.
        // Without this the open just hangs and the editor looks frozen.
        blockedByOtherTab = true
      },
      blocking() {
        // We are the old tab holding someone else's upgrade. Let go.
        void dbPromise?.then((db) => db.close())
        dbPromise = null
      },
      terminated() {
        dbPromise = null
      },
    }).then(
      (db) => {
        blockedByOtherTab = false
        return db
      },
      (error) => {
        dbPromise = null
        throw error
      },
    )
  }

  return dbPromise
}

/** Turns any DB rejection into something worth showing, including the blocked case. */
export function toStorageFailure(error: unknown): StorageFailure {
  if (blockedByOtherTab) return { kind: 'blocked', message: UPGRADE_BLOCKED_MESSAGE }
  return describeStorageError(error)
}

export async function putRoute(route: Route): Promise<void> {
  const db = await getDb()
  await db.put('routes', route)
}

export async function getRoute(id: string): Promise<Route | undefined> {
  const db = await getDb()
  return db.get('routes', id)
}

export async function listRoutes(): Promise<Route[]> {
  const db = await getDb()
  const routes = await db.getAllFromIndex('routes', 'updatedAt')
  return routes.reverse()
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('routes', id)
}
