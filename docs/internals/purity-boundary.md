# The phase-2 purity boundary

Wegloc ships in two phases. This repo is phase 1, the web editor. Phase 2 is an Android
app that reads an export bundle and drives the system mock location provider, replaying
the same numbers through the same interpolator in a different runtime.

For that to be possible without a rewrite, two things are kept true from the first
commit:

## The route model and interpolator stay pure

`src/routes` and `src/lib` must not import React, the store, the DOM, `maplibre-gl`,
IndexedDB, or any browser API. That code is either shared with or ported to the device
app, and a `window` reference in the middle of the speed-profile maths is what turns a
port into a rewrite.

This is easy to check:

```
grep -rE "from '(react|maplibre-gl|zustand|idb)'|window\.|document\." src/routes src/lib
```

should find nothing (test files aside). The opt-in geocoder lives behind this line on
purpose: names are an editor convenience, so `src/geocode` may touch the network and
`src/routes`/`src/lib` never import it.

## The export bundle is versioned from v1

The bundle is the contract between the two surfaces. Shipped Android builds we cannot
update in lockstep will parse it, and users will have exported files on disk. So:

- It carries a `formatVersion`, starting at 1.
- Changes are **additive**: add optional fields, never rename or repurpose existing
  ones.
- A breaking change is a new version with a new reader, and the old reader stays.
- Golden fixtures in `src/export/__fixtures__` pin the format. Regenerating them is
  allowed for an intended additive change; `v1-legacy-no-speed-profile.json` is frozen
  on purpose to prove old bundles still read.

The bundle carries the route and its settings, not the dense track: the device runs the
same interpolator, so shipping the track would ship a derived value that can disagree
with its source.
