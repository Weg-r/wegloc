const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

/** Great-circle distance in meters. */
export function haversineDistance(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing in degrees [0, 360), from a to b. */
export function bearing(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLng = toRad(b.lng - a.lng)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Point at fraction `f` [0, 1] along the great-circle segment a -> b. */
export function interpolatePosition(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
  f: number,
): { lng: number; lat: number } {
  if (f <= 0) return { lng: a.lng, lat: a.lat }
  if (f >= 1) return { lng: b.lng, lat: b.lat }

  const lat1 = toRad(a.lat)
  const lng1 = toRad(a.lng)
  const lat2 = toRad(b.lat)
  const lng2 = toRad(b.lng)

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
      ),
    )

  if (d === 0) return { lng: a.lng, lat: a.lat }

  const A = Math.sin((1 - f) * d) / Math.sin(d)
  const B = Math.sin(f * d) / Math.sin(d)

  const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
  const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
  const z = A * Math.sin(lat1) + B * Math.sin(lat2)

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
  const lng = Math.atan2(y, x)

  return { lng: toDeg(lng), lat: toDeg(lat) }
}

/**
 * Moves a point by a local east/north offset in meters. Used to apply receiver
 * noise to a position; accurate for the small offsets that implies, and a no-op
 * on longitude at the poles where the east direction is undefined.
 */
export function offsetMeters(
  p: { lng: number; lat: number },
  eastMeters: number,
  northMeters: number,
): { lng: number; lat: number } {
  const dLat = toDeg(northMeters / EARTH_RADIUS_M)
  const cosLat = Math.cos(toRad(p.lat))
  const dLng = Math.abs(cosLat) < 1e-9 ? 0 : toDeg(eastMeters / (EARTH_RADIUS_M * cosLat))
  return { lng: p.lng + dLng, lat: p.lat + dLat }
}
