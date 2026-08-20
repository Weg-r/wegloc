import type { ReactNode } from 'react'
import type { SimulationSettings, TrackPoint, Waypoint } from '../types/route'
import { ACCENT } from '../lib/theme'
import { formatClock } from '../lib/format'
import { SPEED_UNITS, formatSpeed, speedFromMps, speedToMps, speedUnitLabel, type SpeedUnit } from '../lib/units'
import type { GeocodeStatus } from '../geocode'

interface DepartureBoardProps {
  settings: SimulationSettings
  onUpdateSettings: (patch: Partial<SimulationSettings>) => void
  selected: Waypoint | null
  onUpdateSelected: (patch: Partial<Omit<Waypoint, 'id'>>) => void
  playing: boolean
  onTogglePlaying: () => void
  playbackT: number
  durationMs: number
  onScrub: (t: number) => void
  current: TrackPoint | null
  canPlay: boolean
  speedMultiplier: number
  onSetSpeedMultiplier: (multiplier: number) => void
  onStep: (deltaMs: number) => void
  tickRateMs: number
  follow: boolean
  onToggleFollow: () => void
  onFit: () => void
  speedUnit: SpeedUnit
  onSetSpeedUnit: (unit: SpeedUnit) => void
  geocodeAvailable: boolean
  geocodeEnabled: boolean
  onToggleGeocode: () => void
  geocodeStatus: GeocodeStatus
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

/**
 * A leg speed of 0 is not a stop -- it used to make the leg emit no track points
 * at all. Stops are the dwell field below.
 */
const MIN_LEG_SPEED_MPS = 0.1

const inputClass =
  'bg-transparent border-0 border-b-2 border-neutral-700 focus:border-[color:var(--accent)] outline-none font-mono font-bold text-lg text-neutral-50 py-0.5 w-full'

export default function DepartureBoard({
  settings,
  onUpdateSettings,
  selected,
  onUpdateSelected,
  playing,
  onTogglePlaying,
  playbackT,
  durationMs,
  onScrub,
  current,
  canPlay,
  speedMultiplier,
  onSetSpeedMultiplier,
  onStep,
  tickRateMs,
  follow,
  onToggleFollow,
  onFit,
  speedUnit,
  onSetSpeedUnit,
  geocodeAvailable,
  geocodeEnabled,
  onToggleGeocode,
  geocodeStatus,
}: DepartureBoardProps) {
  const speedStep = speedUnit === 'mps' ? 0.1 : 1
  const unit = speedUnitLabel(speedUnit)
  return (
    <div className="bg-neutral-900 text-neutral-50 px-5 py-4 space-y-4" style={{ ['--accent' as string]: ACCENT }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Speed unit</span>
        <div className="flex gap-1 font-mono text-xs font-bold" role="group" aria-label="Speed unit">
          {SPEED_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onSetSpeedUnit(u)}
              aria-pressed={speedUnit === u}
              className={`px-2 py-1 border-2 uppercase tracking-wide ${
                speedUnit === u ? 'text-neutral-950' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
              }`}
              style={speedUnit === u ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
            >
              {speedUnitLabel(u)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label={`Base speed (${unit})`}>
          <input
            type="number"
            step={speedStep}
            min={speedFromMps(0.1, speedUnit)}
            value={Number(speedFromMps(settings.baseSpeedMps, speedUnit).toFixed(2))}
            onChange={(e) =>
              onUpdateSettings({ baseSpeedMps: Math.max(0.1, speedToMps(Number(e.target.value), speedUnit)) })
            }
            className={inputClass}
          />
        </Field>

        <Field label="Accuracy (m)">
          <input
            type="number"
            step={1}
            min={0}
            value={settings.accuracyMeters}
            onChange={(e) => onUpdateSettings({ accuracyMeters: Math.max(0, Number(e.target.value)) })}
            className={inputClass}
          />
        </Field>

        <Field label="Jitter (m)">
          <input
            type="number"
            step={1}
            min={0}
            value={settings.jitterMeters}
            onChange={(e) => onUpdateSettings({ jitterMeters: Math.max(0, Number(e.target.value)) })}
            className={inputClass}
          />
        </Field>

        <Field label="Altitude mode">
          <div className="flex gap-2 font-mono font-bold text-sm">
            {(['flat', 'per-waypoint'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdateSettings({ altitudeMode: mode })}
                className={`px-2 py-1 border-2 uppercase tracking-wide ${
                  settings.altitudeMode === mode
                    ? 'text-neutral-950'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
                style={settings.altitudeMode === mode ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
              >
                {mode === 'flat' ? 'Flat' : 'Per WP'}
              </button>
            ))}
          </div>
        </Field>

        {settings.altitudeMode === 'flat' && (
          <Field label="Flat altitude (m)">
            <input
              type="number"
              step={1}
              value={settings.flatAltitude}
              onChange={(e) => onUpdateSettings({ flatAltitude: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Loop">
          <button
            type="button"
            onClick={() => onUpdateSettings({ loop: !settings.loop })}
            className={`self-start px-2 py-1 border-2 font-mono font-bold text-sm uppercase tracking-wide ${
              settings.loop ? 'text-neutral-950' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
            }`}
            style={settings.loop ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
          >
            {settings.loop ? 'On' : 'Off'}
          </button>
        </Field>
      </div>

      <details className="border-t-2 border-neutral-800 pt-3">
        <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-neutral-400 select-none">
          Fidelity
        </summary>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
          <Field label="Tick rate (ms)">
            <input
              type="number"
              step={10}
              min={16}
              value={tickRateMs}
              onChange={(e) => onUpdateSettings({ tickRateMs: Math.max(16, Number(e.target.value)) })}
              className={inputClass}
            />
          </Field>
          <Field label="Accel (m/s², 0 = off)">
            <input
              type="number"
              step={0.5}
              min={0}
              value={settings.maxAccelMps2}
              onChange={(e) => onUpdateSettings({ maxAccelMps2: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </Field>
          <Field label="Decel (m/s², 0 = off)">
            <input
              type="number"
              step={0.5}
              min={0}
              value={settings.maxDecelMps2}
              onChange={(e) => onUpdateSettings({ maxDecelMps2: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </Field>
          <Field label="Cornering (m/s², 0 = off)">
            <input
              type="number"
              step={0.5}
              min={0}
              value={settings.corneringMps2}
              onChange={(e) => onUpdateSettings({ corneringMps2: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="flex gap-2 pt-3 font-mono text-xs font-bold">
          <button
            type="button"
            onClick={() => onUpdateSettings({ maxAccelMps2: 1.2, maxDecelMps2: 1.5, corneringMps2: 1 })}
            className="px-2 py-1 border-2 border-neutral-700 uppercase tracking-wide text-neutral-300 hover:border-neutral-500"
          >
            Walk preset
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ maxAccelMps2: 2.5, maxDecelMps2: 3.5, corneringMps2: 3 })}
            className="px-2 py-1 border-2 border-neutral-700 uppercase tracking-wide text-neutral-300 hover:border-neutral-500"
          >
            Car preset
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ maxAccelMps2: 0, maxDecelMps2: 0, corneringMps2: 0 })}
            className="px-2 py-1 border-2 border-neutral-700 uppercase tracking-wide text-neutral-300 hover:border-neutral-500"
          >
            Off
          </button>
        </div>
      </details>

      {selected && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-neutral-800 pt-3">
          <Field label="Name">
            <input
              type="text"
              value={selected.label ?? ''}
              placeholder="e.g. office"
              onChange={(e) => onUpdateSelected({ label: e.target.value === '' ? null : e.target.value })}
              className={inputClass}
            />
          </Field>
          {geocodeAvailable ? (
            <Field label="Auto-name (network)">
              <button
                type="button"
                onClick={onToggleGeocode}
                aria-pressed={geocodeEnabled}
                className={`self-start px-2 py-1 border-2 font-mono font-bold text-sm uppercase tracking-wide ${
                  geocodeEnabled ? 'text-neutral-950' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
                style={geocodeEnabled ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
              >
                {geocodeEnabled ? (geocodeStatus === 'offline' ? 'Offline' : 'On') : 'Off'}
              </button>
            </Field>
          ) : (
            <div />
          )}
          <Field label={`${selected.id.slice(0, 6)} · altitude override (m)`}>
            <input
              type="number"
              step={1}
              value={selected.altitude ?? ''}
              placeholder="auto"
              onChange={(e) => onUpdateSelected({ altitude: e.target.value === '' ? null : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label={`Leg speed override (${unit})`}>
            <input
              type="number"
              step={speedStep}
              min={speedFromMps(MIN_LEG_SPEED_MPS, speedUnit)}
              value={selected.legSpeedMps == null ? '' : Number(speedFromMps(selected.legSpeedMps, speedUnit).toFixed(2))}
              placeholder="auto"
              onChange={(e) =>
                onUpdateSelected({
                  legSpeedMps:
                    e.target.value === ''
                      ? null
                      : Math.max(MIN_LEG_SPEED_MPS, speedToMps(Number(e.target.value), speedUnit)),
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Stop here (s)">
            <input
              type="number"
              step={1}
              min={0}
              value={selected.dwellMs != null ? selected.dwellMs / 1000 : ''}
              placeholder="0"
              onChange={(e) =>
                onUpdateSelected({
                  dwellMs: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) * 1000,
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <div className="border-t-2 border-neutral-800 pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canPlay}
            onClick={onTogglePlaying}
            className="w-11 h-11 flex items-center justify-center font-black text-lg shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: ACCENT }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '❚❚' : '▶'}
          </button>

          <input
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            step={50}
            value={Math.min(playbackT, durationMs)}
            disabled={!canPlay}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="flex-1 accent-[color:var(--accent)] disabled:opacity-30"
          />

          <span className="font-mono text-sm font-bold tabular-nums w-24 text-right">
            {formatClock(playbackT)} / {formatClock(durationMs)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
          <div className="flex gap-1" role="group" aria-label="Playback rate">
            {[0.5, 1, 2, 5, 10].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onSetSpeedMultiplier(rate)}
                aria-pressed={speedMultiplier === rate}
                className={`px-1.5 py-1 border-2 uppercase tracking-wide ${
                  speedMultiplier === rate ? 'text-neutral-950' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
                style={speedMultiplier === rate ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
              >
                {rate}x
              </button>
            ))}
          </div>

          <div className="flex gap-1" role="group" aria-label="Step by one tick">
            <button
              type="button"
              disabled={!canPlay}
              onClick={() => onStep(-tickRateMs)}
              aria-label="Step back one tick"
              className="px-2 py-1 border-2 border-neutral-700 text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
            >
              ‹ tick
            </button>
            <button
              type="button"
              disabled={!canPlay}
              onClick={() => onStep(tickRateMs)}
              aria-label="Step forward one tick"
              className="px-2 py-1 border-2 border-neutral-700 text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
            >
              tick ›
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleFollow}
            aria-pressed={follow}
            className={`px-2 py-1 border-2 uppercase tracking-wide ${
              follow ? 'text-neutral-950' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
            }`}
            style={follow ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
          >
            Follow
          </button>

          <button
            type="button"
            onClick={onFit}
            className="px-2 py-1 border-2 border-neutral-700 uppercase tracking-wide text-neutral-300 hover:border-neutral-500"
          >
            Fit
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3 font-mono text-xs">
          <div>
            <p className="text-neutral-500 uppercase tracking-widest text-[10px]">Speed</p>
            <p className="font-bold text-base">{current ? formatSpeed(current.speedMps, speedUnit) : '—'}</p>
          </div>
          <div>
            <p className="text-neutral-500 uppercase tracking-widest text-[10px]">Altitude</p>
            <p className="font-bold text-base">{current ? `${Math.round(current.altitude)} m` : '—'}</p>
          </div>
          <div>
            <p className="text-neutral-500 uppercase tracking-widest text-[10px]">Accuracy</p>
            <p className="font-bold text-base">{current ? `±${current.accuracyMeters.toFixed(1)} m` : '—'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
