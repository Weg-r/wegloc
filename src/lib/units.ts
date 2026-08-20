/**
 * Speed unit conversions. Pure. The route model is always SI (metres per second)
 * -- these exist only to show and accept speeds in whatever unit the user reads
 * in, so the stored route and the export bundle never depend on the preference.
 */

export type SpeedUnit = 'mps' | 'kmh' | 'mph'

export const SPEED_UNITS: SpeedUnit[] = ['mps', 'kmh', 'mph']

const PER_MPS: Record<SpeedUnit, number> = {
  mps: 1,
  kmh: 3.6,
  mph: 2.2369362920544,
}

export function speedUnitLabel(unit: SpeedUnit): string {
  return unit === 'mps' ? 'm/s' : unit === 'kmh' ? 'km/h' : 'mph'
}

/** SI speed to the display unit. */
export function speedFromMps(mps: number, unit: SpeedUnit): number {
  return mps * PER_MPS[unit]
}

/** A value the user typed in the display unit back to SI. */
export function speedToMps(value: number, unit: SpeedUnit): number {
  return value / PER_MPS[unit]
}

/** A speed formatted for a readout, e.g. "50.0 km/h". */
export function formatSpeed(mps: number, unit: SpeedUnit, digits = 1): string {
  return `${speedFromMps(mps, unit).toFixed(digits)} ${speedUnitLabel(unit)}`
}

export function isSpeedUnit(value: unknown): value is SpeedUnit {
  return value === 'mps' || value === 'kmh' || value === 'mph'
}
