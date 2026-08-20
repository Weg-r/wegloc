# Wegloc

A GPS route simulator for developers. Draw a route, tune how it should be travelled --
speed, altitude, accuracy, stops -- and export it so a device can replay the track and
believe it is moving. Nobody has to drive, walk, or bike around a city to test
geolocation code.

This repository is **phase 1, the web editor**: a Vite + React app with MapLibre,
Zustand, and IndexedDB where routes are drawn, tuned, saved, and exported. It is
local-first -- routes live in your browser, and the editor works offline apart from map
tiles. Phase 2, an Android app that reads an exported route and drives the system mock
location provider, does not exist yet.

Documentation is written in **English**.

## Running it

```
npm i
npm run dev
```

Vite prints the local URL (the port can shift if one is taken -- read it from the
output). The editor opens with a demo route.

Map tiles come from `VITE_MAP_STYLE_URL`. Copy `.env.example` to `.env` and set it; a
missing or failing style URL renders a readable error rather than a grey box. The other
variable, `VITE_GEOCODE_URL`, is optional and turns on opt-in waypoint naming -- see
[docs/internals/geocoding.md](./docs/internals/geocoding.md).

## Scripts

- `npm run dev` -- start the dev server
- `npm run build` -- typecheck and production build
- `npm run typecheck` -- types only
- `npm test` -- run the unit tests
- `npm run lint` -- oxlint

## Documentation

- **[docs/user/](./docs/user/)** -- using the editor: drawing routes, settings,
  export/import.
- **[docs/internals/](./docs/internals/)** -- architecture, the phase-2 purity
  boundary, the map adapter, storage, and geocoding.
- **[AGENT.md](./AGENT.md)** -- the guide for working in this codebase, including the
  glossary that is the single source of vocabulary.

## What's in the box

Drawing (click, insert on a leg, drag, reorder, reverse, add by coordinate, undo/redo),
a route library (save, rename, duplicate, delete, switch), realistic simulation (speed
profiles with acceleration and cornering, altitude blending, accuracy jitter, stops),
playback (rate control, tick stepping, follow, fit), versioned export/import, and
optional opt-in waypoint naming. It works on a narrow window and with touch.
