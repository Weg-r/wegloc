import { describe, expect, it } from 'vitest'
import {
  insertWaypoint,
  totalDistanceMeters,
  isValidCoordinate,
  moveWaypointToIndex,
  nearestLegIndex,
  reverseWaypoints,
  splitLeg,
} from './ops'
import type { Waypoint } from '../types/route'

function wp(id: string, lng: number, lat: number, legSpeedMps: number | null = null): Waypoint {
  return { id, lng, lat, altitude: null, legSpeedMps, dwellMs: null }
}

const A = wp('a', 0, 0)
const B = wp('b', 0.01, 0, 2)
const C = wp('c', 0.02, 0, 3)

describe('insertWaypoint', () => {
  it('inserts at the index and clamps out-of-range ones', () => {
    const x = wp('x', 5, 5)
    expect(insertWaypoint([A, B], 1, x).map((w) => w.id)).toEqual(['a', 'x', 'b'])
    expect(insertWaypoint([A, B], 0, x).map((w) => w.id)).toEqual(['x', 'a', 'b'])
    expect(insertWaypoint([A, B], 99, x).map((w) => w.id)).toEqual(['a', 'b', 'x'])
    expect(insertWaypoint([A, B], -5, x).map((w) => w.id)).toEqual(['x', 'a', 'b'])
  })

  it('inserts into an empty list', () => {
    expect(insertWaypoint([], 0, A)).toEqual([A])
  })

  it('does not mutate its input', () => {
    const input = [A, B]
    insertWaypoint(input, 1, wp('x', 5, 5))
    expect(input).toHaveLength(2)
  })
})

describe('splitLeg', () => {
  it('puts the new waypoint in the middle of the leg', () => {
    const split = splitLeg([A, B, C], 0, { lng: 0.005, lat: 0 }, 'new')
    expect(split.map((w) => w.id)).toEqual(['a', 'new', 'b', 'c'])
    expect(split[1]).toMatchObject({ lng: 0.005, lat: 0 })
  })

  it('keeps both halves at the speed the original leg ran at', () => {
    const split = splitLeg([A, B, C], 0, { lng: 0.005, lat: 0 }, 'new')
    // The leg into B ran at 2; after the split, both halves still do.
    expect(split[1].legSpeedMps).toBe(2)
    expect(split[2].legSpeedMps).toBe(2)
  })

  it('splits the last leg', () => {
    expect(splitLeg([A, B, C], 1, { lng: 0.015, lat: 0 }, 'new').map((w) => w.id)).toEqual([
      'a',
      'b',
      'new',
      'c',
    ])
  })

  it('is a no-op for a leg that does not exist', () => {
    expect(splitLeg([A], 0, { lng: 1, lat: 1 }, 'new')).toHaveLength(1)
    expect(splitLeg([A, B], 5, { lng: 1, lat: 1 }, 'new')).toHaveLength(2)
  })
})

describe('moveWaypointToIndex', () => {
  it('moves later and earlier', () => {
    expect(moveWaypointToIndex([A, B, C], 0, 2).map((w) => w.id)).toEqual(['b', 'c', 'a'])
    expect(moveWaypointToIndex([A, B, C], 2, 0).map((w) => w.id)).toEqual(['c', 'a', 'b'])
  })

  it('clamps past the ends and no-ops in place', () => {
    expect(moveWaypointToIndex([A, B, C], 0, -1)).toEqual([A, B, C])
    expect(moveWaypointToIndex([A, B, C], 2, 99).map((w) => w.id)).toEqual(['a', 'b', 'c'])
    expect(moveWaypointToIndex([A, B, C], 1, 1)).toEqual([A, B, C])
  })

  it('carries the waypoint own fields with it', () => {
    expect(moveWaypointToIndex([A, B, C], 1, 0)[0]).toEqual(B)
  })

  it('ignores an out-of-range source', () => {
    expect(moveWaypointToIndex([A, B], 7, 0)).toEqual([A, B])
  })
})

describe('reverseWaypoints', () => {
  it('reverses the order', () => {
    expect(reverseWaypoints([A, B, C]).map((w) => w.id)).toEqual(['c', 'b', 'a'])
  })

  it('shifts leg speeds so each leg keeps its own speed', () => {
    // A -> B at 2, B -> C at 3. Reversed: C -> B must still be 3, B -> A still 2.
    const reversed = reverseWaypoints([A, B, C])
    expect(reversed[0].legSpeedMps).toBeNull()
    expect(reversed[1].legSpeedMps).toBe(3)
    expect(reversed[2].legSpeedMps).toBe(2)
  })

  it('returns the original when applied twice', () => {
    expect(reverseWaypoints(reverseWaypoints([A, B, C]))).toEqual([A, B, C])
  })

  it('keeps altitude and dwell with the waypoint they belong to', () => {
    const stop: Waypoint = { id: 's', lng: 1, lat: 1, altitude: 40, legSpeedMps: 5, dwellMs: 9_000 }
    const reversed = reverseWaypoints([A, stop, C])
    const moved = reversed.find((w) => w.id === 's')
    expect(moved?.altitude).toBe(40)
    expect(moved?.dwellMs).toBe(9_000)
  })

  it('handles empty and single-waypoint routes', () => {
    expect(reverseWaypoints([])).toEqual([])
    expect(reverseWaypoints([B])).toEqual([{ ...B, legSpeedMps: null }])
  })
})

describe('nearestLegIndex', () => {
  it('finds the leg a click landed on', () => {
    expect(nearestLegIndex([A, B, C], { lng: 0.005, lat: 0.00001 })).toBe(0)
    expect(nearestLegIndex([A, B, C], { lng: 0.015, lat: 0.00001 })).toBe(1)
  })

  it('picks the nearer of two legs that pass close together', () => {
    const square = [wp('1', 0, 0), wp('2', 0, 0.01), wp('3', 0.0001, 0.01), wp('4', 0.0001, 0)]
    expect(nearestLegIndex(square, { lng: 0, lat: 0.005 })).toBe(0)
    expect(nearestLegIndex(square, { lng: 0.0001, lat: 0.005 })).toBe(2)
  })

  it('returns -1 when there are no legs', () => {
    expect(nearestLegIndex([], { lng: 0, lat: 0 })).toBe(-1)
    expect(nearestLegIndex([A], { lng: 0, lat: 0 })).toBe(-1)
  })
})

describe('isValidCoordinate', () => {
  it('accepts the whole globe including the edges', () => {
    expect(isValidCoordinate(0, 0)).toBe(true)
    expect(isValidCoordinate(180, 90)).toBe(true)
    expect(isValidCoordinate(-180, -90)).toBe(true)
  })

  it('rejects out-of-range and non-finite values', () => {
    expect(isValidCoordinate(181, 0)).toBe(false)
    expect(isValidCoordinate(0, 91)).toBe(false)
    expect(isValidCoordinate(NaN, 0)).toBe(false)
    expect(isValidCoordinate(0, Infinity)).toBe(false)
  })
})

describe('totalDistanceMeters', () => {
  it('is zero for under two waypoints', () => {
    expect(totalDistanceMeters([])).toBe(0)
    expect(totalDistanceMeters([A])).toBe(0)
  })

  it('sums the legs', () => {
    const two = totalDistanceMeters([A, B])
    const three = totalDistanceMeters([A, B, C])
    expect(three).toBeGreaterThan(two)
    expect(two).toBeGreaterThan(0)
  })
})
