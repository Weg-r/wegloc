# The map adapter

`src/map` is the only place that imports `maplibre-gl`. Everything else treats the map
through `RouteMapHandle` (imperative methods) and GeoJSON source updates.

## Rules

- **React never owns the map.** The instance lives in a ref, never in state, never a
  key. Route geometry is a GeoJSON source updated with `setData`, never a list of React
  markers. Camera moves are imperative (`flyTo`, `easeTo`, `fitBounds`). A "controlled
  viewport" prop is a rewrite waiting to happen.
- **No IndexedDB writes mid-gesture.** A waypoint drag fires dozens of events a second.
  During the drag the map source is updated directly and the store is left alone; the
  store and the single persisted write happen on release (`beginDrag` / `endDrag`).
- **Guard every `getSource`.** `setSourceData` no-ops unless the style is loaded, so
  effects that race the map's `load` event or fire during HMR teardown are safe.

## What the handle exposes

- `flyTo` -- centre on a coordinate.
- `setMarker` -- move the playback marker imperatively (the playback engine calls this
  every frame; the React marker effect is gated off during playback so the two never
  fight).
- `follow` -- ease the camera only when the marker nears the viewport edge, so it does
  not repaint every frame or undo a user pan.
- `fitRoute` -- frame the route with padding, centre a lone waypoint, using longitudes
  unwrapped so an antimeridian route frames its short span.

## Interaction layers

The visible waypoint dots are small (7-9px). A separate transparent circle layer with a
~22px radius sits under them and carries every pointer interaction, so a fingertip can
grab a waypoint the eye sees as a small dot without the dot itself being large.

## The antimeridian

A route from longitude 179 to -179 is a short hop on the ground but ~358 degrees apart
in raw longitude. `unwrapLongitude` (in `src/routes/geo.ts`) makes a coordinate
sequence continuous so the drawn line and the fit-bounds take the short way; the marker
and waypoint circles are single points, which render on the correct world copy either
way.
