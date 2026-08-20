export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} KM` : `${Math.round(m)} M`
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  // Hours only when the clock actually reaches them, so short routes stay mm:ss.
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function stationCode(index: number): string {
  return `WP-${String(index + 1).padStart(2, '0')}`
}

/** Compact duration for dwell times, which are usually seconds, occasionally minutes. */
export function formatSeconds(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}S`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}M` : `${minutes}M ${rest}S`
}

/**
 * Coarse "how long ago", for a route list where the exact minute never matters.
 * `now` is passed in rather than read from the clock so this stays pure.
 */
export function formatRelativeTime(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`
}
