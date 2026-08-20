# Architecture

Contributor-facing. For the product-side view, see [`docs/user/`](../user/). Vocabulary
is defined once in the glossary in [`AGENT.md`](../../AGENT.md#a-small-glossary); this
document uses those terms without redefining them.

## Data flow

```
waypoints + settings  ──(pure interpolator)──▶  track  ──▶  playback
       │                                                        marker
       └──(pure serializer)──▶  export bundle  ──▶  device app (phase 2)
```

- A **route** (waypoints + simulation settings) is the only thing that is ever saved.
- `buildTrack` in `src/routes/interpolate.ts` turns a route into a dense **track**: a
  point stream at a fixed tick rate with position, speed, bearing, altitude, and
  accuracy per point. It is a pure function.
- The editor renders the route as GeoJSON and animates a single marker feature along
  the track during playback.
- `routeToBundle` in `src/export/serialize.ts` turns a route into a versioned **export
  bundle**, the artifact that crosses to the device app.

The track is always derived, never stored: a value and its derivative in state will
drift.

## Where code lives

- `src/routes` -- route model, editing operations (`ops.ts`), interpolator, and speed
  profile. Pure.
- `src/lib` -- pure helpers (formatting, units, coordinate maths, label precedence).
- `src/map` -- the MapLibre instance, sources, layers, and pointer interaction. The
  only place that imports `maplibre-gl`. See [map-adapter.md](./map-adapter.md).
- `src/store` -- Zustand state and actions, plus derived-state hooks.
- `src/db` -- IndexedDB schema, versioned upgrades, queries, fixtures. Nothing outside
  it opens a transaction. See [storage.md](./storage.md).
- `src/export` -- bundle schema, serializer, version readers, golden fixtures.
- `src/geocode` -- optional, opt-in reverse geocoding. See [geocoding.md](./geocoding.md).
- `src/ui` -- presentational components.
- `src/app` -- entry, layout, and the hooks that wire the store to the map (playback
  engine, hydration, geocoding).

## Playback

`usePlaybackEngine` (`src/app/playback.ts`) runs the requestAnimationFrame loop and
moves the marker imperatively through the map handle, without a React render per
frame. It commits `playback.t` to the store at about 10Hz for the readouts and the
scrub thumb. This is deliberate: a full React render at display refresh rate to move
one dot pegs the GPU on high-refresh displays.
