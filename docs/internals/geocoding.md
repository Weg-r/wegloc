# Reverse geocoding (opt-in)

Showing a street name instead of `48.8584, 2.2945` needs a network lookup per waypoint.
Wegloc is local-first -- the editor works offline apart from map tiles, and there is no
telemetry or server -- so this feature is built to preserve that promise, not to bypass
it.

## The decision

Two layers, and the network one is optional:

1. **Manual labels.** A `label` typed on a waypoint. No network, always available, and
   for a test route often more useful than a real address. This is the default way to
   get a readable list.
2. **Opt-in reverse geocoding.** Off by default, and only offered when a provider URL
   is configured (`VITE_GEOCODE_URL`). When the user turns it on, it fills names for
   waypoints they have not named themselves. A typed label always wins over a looked-up
   one.

With the toggle off, or no provider configured, the editor makes no geocoding request.

## Boundary

`src/geocode` is the only place that fetches a name or touches the geocode cache, the
same way `src/map` is the only place that touches `maplibre-gl`. `src/routes` and
`src/lib` never import it -- names are an editor convenience, not part of the route
model or the simulation, so they stay on the pure side of the
[phase-2 boundary](./purity-boundary.md).

- `provider.ts` is pure: the request URL and the response-to-name reduction, tested
  without a network.
- `index.ts` does the IO: it reads the IndexedDB cache first, queues misses one at a
  time spaced at least ~1.1s apart (the public Nominatim policy is one request/second),
  and caches every result including "no name" so a coordinate is never asked twice.
- Requests are skipped during a drag and are never fired per pointer event.

## Failure

A network failure is non-blocking: the lookup stops, the UI shows an **Offline** state
on the toggle, and the affected waypoints fall back to their coordinates. Nothing
blanks and no spinner hangs.

## The bundle

`label` is an optional field on a bundle waypoint. A geocoded name is **not** written to
the bundle -- it is derived and cached, so only the user's own labels cross to the
device app.
