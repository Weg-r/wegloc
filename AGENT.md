# Wegloc

Wegloc is a GPS route simulator for Android developers. The idea: draw a route, hand it to a phone, and the phone believes it is travelling that route — full control over speed, altitude, and reported accuracy — so nobody has to drive, walk, or bike around a city to test geolocation code.

We are building it in two phases. **Phase 1, this repository, is the web editor**: a Vite + React app with MapLibre, Zustand, and IndexedDB, where routes are drawn, tuned, saved, and exported. **Phase 2 is the Android app** that reads an exported route and drives the system mock location provider. The Android app does not exist yet. Do not scaffold it, do not add a monorepo for it, and do not add "for mobile later" abstractions — but do not make choices that lock it out either. See "Web first, mobile next".

## What makes Wegloc special?

Developers reach for Wegloc in the middle of debugging something else. It has to be fast, honest, and out of the way. Here's a brief list of the things we can never compromise on.

### 1. Time saved is the whole product

Every second between "I need a route" and "my device is moving" is the value we ship. No account, no onboarding, no wizard, no server round-trip before a route can be drawn. If a change adds a step to that path, it has to remove one somewhere else, and you should say which.

### 2. Realistic simulation

A location that teleports along a perfect straight line at constant speed does not exercise anyone's code. Speed profiles, altitude, accuracy jitter, tick-rate interpolation, and sane behaviour at stops and sharp turns are why a developer picks Wegloc over `adb emu geo fix`. Fidelity beats feature count every time.

### 3. Local-first

Routes live in the user's browser, in IndexedDB. The editor works offline apart from map tiles. There is no server in this repo, no telemetry, and no sync. Adding any of those is a product decision, not an implementation detail — never quietly introduce a fetch to a backend you invented.

### 4. Performance without compromise

Panning, zooming, dragging a waypoint, and scrubbing playback stay smooth with thousands of points on screen. Performance regressions here come from a small, predictable set of mistakes: React re-rendering the map, markers instead of GeoJSON sources, IndexedDB writes inside a drag, and continuously repainting animations. Audit for them on every change that touches the map.

### 5. Web first, mobile next

The web editor ships on its own and has to be useful on its own. But two decisions made now are expensive to reverse once the Android app lands, so we make them correctly from the first commit:

- **The export bundle is versioned from v1**, even though nothing reads it yet. It is the contract between the two surfaces.
- **The route model and the interpolator stay pure.** No DOM, no browser APIs, no React, no store imports in `src/routes` and `src/lib`. That code is either shared with or ported to the device app, and a `window` reference in the middle of the speed profile maths is what makes that a rewrite.

Everything else — the map layer, the store, IndexedDB, the UI — is free to be web-shaped. Do not generalize it for a platform that does not exist.

## A note from the maintainer

I like simple systems and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here.

Of note: the editor holds real user data in the browser it runs in. Be careful with anything that clears storage, bumps the DB version, or resets state — you may be doing it to a database full of routes someone spent an afternoon drawing.

## A small glossary

We need to be on the same page with terminology. When communicating, use this language:

- **you** means the agent reading this file and changing Wegloc.
- **we, us, and maintainers** mean the people building Wegloc. These are who you are talking to now.
- **user** means the Android developer using Wegloc to test their own app.
- **editor** means this web app, where routes are authored. Phase 1, and everything in this repo.
- **device app** means the Android app that will read an export bundle and drive the mock location provider. Phase 2, not built. Treat it as a consumer that exists on paper.
- **route** means an ordered list of waypoints plus its simulation settings. The durable, saved entity.
- **waypoint** means one user-placed anchor: longitude, latitude, optional altitude.
- **leg** means the segment between two consecutive waypoints, carrying its own speed override.
- **track** means the dense interpolated point stream derived from a route at a fixed tick rate. Always derived, never authored.
- **simulation settings** mean speed profile, altitude mode, accuracy jitter, and loop behaviour.
- **playback** means previewing a track in the editor. It is a preview of what the device will do, not the thing itself.
- **export bundle** means the versioned JSON that crosses from editor to device app.

## The three ways to hurt yourself

1. **Letting React own the map.** MapLibre manages its own canvas and scene graph. Never put the Map instance in React state, never key a component on it, never render route geometry as a list of React markers. The instance lives in a ref, geometry lives in a GeoJSON source updated with `setData`, and camera moves are imperative. A "controlled viewport" prop is a rewrite waiting to happen.
2. **Writing to IndexedDB mid-gesture.** A waypoint drag fires dozens of events per second. Update the map source directly during the gesture and hit the store once on release; persist on commit or on a debounce. A write storm during a drag makes the editor feel broken and can leave the DB behind the UI.
3. **Treating the export bundle as provisional.** It is tempting to reshape it freely because no device app reads it yet. Don't. The bundle is the one artifact that outlives this repo's phase: it will be parsed by shipped Android builds we cannot update in lockstep, and users will have exported files sitting on disk. Version it, keep readers for older versions, and add optional fields rather than renaming existing ones.

## Hit every surface

The most common defect in this repo is a change that works on the path you tested and is missing everywhere else. Before calling work done, walk this list and say which entries applied:

- **Entry points.** A route operation reachable by clicking the map is usually also reachable from the waypoint list, the keyboard, and the route menu. Fixing one is not fixing the feature.
- **Input modes.** Mouse, trackpad, touch, and keyboard. Waypoint editing that only works with a precise pointer is broken on a laptop trackpad and on a tablet — and a touch-hostile editor is a bad starting point for the phase where phones enter the picture.
- **Reverse states.** If you added a way in, add the way out and the way to see it. Add waypoint needs delete. Import needs export. Undo needs redo. A one-way door is a bug.
- **Route shapes.** Empty route, one waypoint, two identical waypoints, a few thousand points, a route crossing the antimeridian, a leg with zero length, altitude present on some waypoints and not others. The maths has to survive all of them.
- **Storage states.** First run with an empty DB, quota exceeded, private browsing where IndexedDB is unavailable, and a second tab blocking a version upgrade. Each needs a visible, recoverable state — never a blank screen.
- **Map states.** Style URL missing or failing to load, tiles slow, map not yet `load`ed when a source update arrives. Guard every `getSource` call; HMR will hand you a map mid-teardown.
- **The contract.** Anything crossing to the device app is typed in `src/export`. Change the schema and the serializer, the golden fixtures, and the compatibility readers all follow.
- **Purity.** If the change touched `src/routes` or `src/lib`, confirm it introduced no browser or React dependency. That's the phase-2 boundary.
- **Docs.** `docs/` splits by audience. Behaviour a user would notice belongs in `docs/user/` (shipped-product voice, no repo tooling or source paths); architecture and contributor notes in `docs/internals/`; new vocabulary in the glossary above.

## Dev server

- `npm i` installs. If module resolution looks broken in a fresh clone or worktree, that is usually all that is missing.
- The repo is scaffolded as Vite + React + TypeScript. If you are bootstrapping from empty: `npm create vite@latest . -- --template react-ts`, then `npm i maplibre-gl zustand idb` and `npm i -D tailwindcss @tailwindcss/vite`. Commit the scaffold on its own before writing features.
- **Tailwind is v4.** Register `@tailwindcss/vite` in `vite.config.ts` and put `@import "tailwindcss";` at the top of `src/index.css`. There is no `tailwind.config.js` in v4; theme tokens go in an `@theme` block. Do not generate a v3-style config from memory.
- `npm run dev` starts Vite. Read the real port from its output rather than assuming 5173; the port shifts when one is occupied.
- Map tiles come from `VITE_MAP_STYLE_URL`. Ship `.env.example`, never `.env`, and never a tile provider key in the repo. A missing or failing style URL must render a readable error, not a grey box.
- Stop only what you started, by the PID you captured at spawn. Never `pkill -f vite` or kill a PID you found by matching a path string — the developer has other dev servers running, and your own process argv contains this directory.

## Test data

An empty database is a bad test. A route with three waypoints in a straight line is barely better.

- Fixtures live in `src/db/fixtures`. There is a dev-only action to load them into the local IndexedDB, and that is how you get a realistic editor to look at.
- Fixtures deliberately include the ugly cases: a long dense route, a route with duplicate consecutive waypoints, one with partial altitude data, one crossing the antimeridian, and one with a stop in the middle.
- `src/export/__fixtures__` holds a golden bundle per format version. The serializer is tested against them so the contract cannot drift before the device app exists. Never edit a golden file to make a test pass — if it stops matching, that is the format changing under you, which is exactly what the fixture is for.
- Never point tests or a dev build at a database you did not create, and never write a migration that drops a store to "clean up". Data flows one way: fixtures in, nothing out.

## Verifying

- Smallest proof that the change works. Run the tests you touched, plus targeted lint and typecheck for the scope you changed.
- **Do not run repo-wide checks.** No full `npm run typecheck`, no whole-suite `test` unless I ask. CI owns the full suite.
- Simulation maths ships with focused tests. Interpolation, bearing, speed profiles, and altitude blending are pure functions in `src/routes` and `src/lib` — there is no excuse for testing them through the UI, and these are the tests that will still be meaningful in phase 2.
- Export changes ship with a round-trip test and a read of every older golden bundle.
- Tests wait on state, not on time. A test that needs a `setTimeout` to pass is wrong; await the transaction, the store update, or the map's `idle` event.
- Upon request, user-visible frontend changes get one integrated pass in a real browser. Ask permission before doing computer use or spinning up a browser.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Conventional commit titles, plain language: `fix(map): waypoint drag no longer thrashes IndexedDB`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- Map and UI changes need before/after images. Playback, drag behaviour, or anything with timing needs a short video.
- One concern per PR. If the description says "also", split it.
- When babysitting: poll checks and comments newer than the last push, verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new. Stop when the bots are green on the latest commit.

## How it works

The user places waypoints on the map. Those waypoints plus simulation settings form a _route_, the only thing that is ever saved. A pure _interpolator_ turns a route into a _track_: a dense point stream at a fixed tick rate, with speed, bearing, altitude, and accuracy computed per point. The editor renders the route as a GeoJSON source and animates a single position feature during _playback_. A _serializer_ turns a route into a versioned _export bundle_.

Today the bundle is downloaded as a file. In phase 2 the device app reads it and replays the track into Android's mock location provider — the same interpolator, same numbers, different runtime. That is the whole reason the maths is kept free of the browser.

Zustand holds editing state, IndexedDB holds saved routes, and the boundary between them is `src/db`. The route model and the interpolator import neither, which is what makes the simulation testable without a DOM.

## Where code lives

- `src/map` - the MapLibre instance, sources, layers, and interaction handlers. The only place that touches `maplibre-gl`.
- `src/routes` - the route model, editing operations, and the interpolator. Pure. No React, no store, no DOM, no browser APIs.
- `src/store` - Zustand slices, composed in `src/store/index.ts`. Narrow selectors only; `useShallow` when selecting objects. Actions live next to the state they own.
- `src/db` - IndexedDB schema, versioned upgrades, queries, fixtures. Thin `idb` wrapper, no ORM. Nothing outside this folder opens a transaction.
- `src/export` - bundle schema, serializer, readers for older versions, golden fixtures.
- `src/ui` - dumb presentational components. Tailwind utilities in the markup.
- `src/lib` - pure helpers. Same purity rules as `src/routes`.
- `src/app` - entry, providers, layout shell.

## Taste

- Complexity belongs at the boundaries: the map adapter and the DB layer. The route model stays pure, the UI stays dumb.
- Inferred types over annotations. `any` is the enemy, and so is a cast that exists to silence an error you did not read.
- Derived values are computed, never stored. If a value and its derivative both live in state, they will drift.
- Comments describe how a thing is used, and move when the code moves. Mostly to describe functions, not to annotate every line of behavior.
- Our users are debugging something else while looking at this app. They notice a dropped frame, a lying spinner, and a stale label immediately. No continuously repainting animations; they peg the GPU on high-refresh displays.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Additional tips

- Don't verify with browsers or computer use unless the user explicitly agrees or requests it.
- Don't add a router, a component library, a form library, or state-persistence middleware without asking. Each is its own conversation.
- Don't start on Android, React Native, Capacitor, or a monorepo restructure for phase 2 unless I ask. When phase 2 opens, we decide then whether the shared maths moves to a package or gets ported.
- Security matters, but this is a local-first dev tool with no server and no accounts. Don't over-index on it.