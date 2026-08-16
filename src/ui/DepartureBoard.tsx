import type { ReactNode } from 'react'
import type { SimulationSettings, TrackPoint, Waypoint } from '../types/route'
import { ACCENT } from '../lib/theme'
import { formatClock } from '../lib/format'

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
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

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
}: DepartureBoardProps) {
  return (
    <div className="bg-neutral-900 text-neutral-50 px-5 py-4 space-y-4" style={{ ['--accent' as string]: ACCENT }}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Base speed (m/s)">
          <input
            type="number"
            step={0.1}
            min={0.1}
            value={settings.baseSpeedMps}
            onChange={(e) => onUpdateSettings({ baseSpeedMps: Math.max(0.1, Number(e.target.value)) })}
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

      {selected && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t-2 border-neutral-800 pt-3">
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
          <Field label="Leg speed override (m/s)">
            <input
              type="number"
              step={0.1}
              value={selected.legSpeedMps ?? ''}
              placeholder="auto"
              onChange={(e) =>
                onUpdateSelected({ legSpeedMps: e.target.value === '' ? null : Number(e.target.value) })
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

        <div className="grid grid-cols-3 gap-3 mt-3 font-mono text-xs">
          <div>
            <p className="text-neutral-500 uppercase tracking-widest text-[10px]">Speed</p>
            <p className="font-bold text-base">{current ? `${current.speedMps.toFixed(1)} m/s` : '—'}</p>
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
