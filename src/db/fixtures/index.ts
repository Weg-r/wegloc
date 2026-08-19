import { getRoute, putRoute } from '../index'
import { FIXTURE_ROUTES } from './routes'

export * from './routes'

/**
 * Writes the fixture routes into the local database, skipping any that are
 * already there. Additive by construction: it never deletes, never overwrites a
 * fixture the user has since edited, and cannot touch a route they drew --
 * data flows one way, fixtures in.
 *
 * Returns the number of routes actually written.
 */
export async function loadFixtures(): Promise<number> {
  let written = 0

  for (const route of FIXTURE_ROUTES) {
    const existing = await getRoute(route.id)
    if (existing) continue
    await putRoute(route)
    written += 1
  }

  return written
}

/** Dev builds only. Production has no reason to ship a button that writes test data. */
export const FIXTURES_ENABLED = import.meta.env.DEV
