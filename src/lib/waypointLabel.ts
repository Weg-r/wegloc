import type { Waypoint } from '../types/route'

/** Coordinates as a display string, the label of last resort. */
export function coordinateLabel(waypoint: Pick<Waypoint, 'lng' | 'lat'>): string {
  return `${waypoint.lat.toFixed(4)}, ${waypoint.lng.toFixed(4)}`
}

/**
 * What to show for a waypoint, in order of preference: the name the user typed,
 * then a reverse-geocoded name if one has been resolved, then the coordinates.
 * Coordinates are never lost -- they remain reachable on the row and in the
 * selected-waypoint panel -- but they are the least useful thing to lead with.
 */
export function waypointLabel(waypoint: Waypoint, geocoded: string | null | undefined): string {
  const manual = waypoint.label?.trim()
  if (manual) return manual
  const derived = geocoded?.trim()
  if (derived) return derived
  return coordinateLabel(waypoint)
}

/** Whether the shown label came from a name rather than falling back to coordinates. */
export function hasName(waypoint: Waypoint, geocoded: string | null | undefined): boolean {
  return Boolean(waypoint.label?.trim() || geocoded?.trim())
}
