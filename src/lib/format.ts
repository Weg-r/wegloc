export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} KM` : `${Math.round(m)} M`
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function stationCode(index: number): string {
  return `WP-${String(index + 1).padStart(2, '0')}`
}
