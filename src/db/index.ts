import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Route } from '../types/route'

interface WeglocDB extends DBSchema {
  routes: {
    key: string
    value: Route
    indexes: { updatedAt: number }
  }
}

let dbPromise: Promise<IDBPDatabase<WeglocDB>> | null = null

function getDb(): Promise<IDBPDatabase<WeglocDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WeglocDB>('wegloc', 1, {
      upgrade(db) {
        const store = db.createObjectStore('routes', { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      },
    })
  }
  return dbPromise
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
