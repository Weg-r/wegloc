# Road-following routes (opt-in)

By default a leg is a straight line between two waypoints. When a routing service is
configured, legs can instead follow real roads, and stations are added by address
rather than by clicking the map. Both are network features, off unless configured, so
the editor stays local-first by default.

## What the model carries

A waypoint gains an optional `path`: the routed polyline for the leg arriving at it, as
`[lng, lat]` pairs. Absent means the leg is straight.

This is derived data, but it is **stored on purpose** -- a deliberate exception to
"derived values are computed, never stored" -- because the device app must replay the
exact path, a routed route has to stay usable offline, and re-deriving it needs an
external service that may be gone later. It rides in the export bundle as an optional
field, and the interpolator samples along it (see `pointAlongPath` in `src/routes/geo.ts`);
distances and the drawn line follow it too.

## The boundary

`src/routing` is the only place that calls the router, alongside `src/geocode` for
address search. `src/routes` and `src/lib` never import either -- a routed path is handed
to the pure interpolator as data, never fetched from inside it, keeping the
[phase-2 boundary](./purity-boundary.md) intact.

- `provider.ts` is pure: the request URL and the OSRM-response-to-per-leg-polyline
  reduction, tested without a network.
- `index.ts` does the fetch. It is off unless `VITE_ROUTING_URL` is set.

## Applying paths without corrupting the route

Routed geometry is applied through the store's `applyRoutedPaths`, which:

- takes **no undo step** and does not bump `updatedAt` -- routing is not a user edit;
- persists quietly, so a reload keeps the geometry;
- is driven by `useRouting`, whose effect keys on waypoint **positions only**, so
  writing the paths back cannot retrigger it.

When a waypoint moves or the route's shape changes, the affected paths are invalidated
(dropped to straight) before re-routing, so the line never shows geometry that no longer
connects. Routing is skipped mid-drag and when there are fewer than two waypoints.

## Configuration and modes

- `VITE_ROUTING_URL` -- OSRM-compatible endpoint with `{profile}` and `{coords}`
  placeholders. Use your own server; the public OSRM demo forbids production use.
- `VITE_GEOCODE_SEARCH_URL` -- address search endpoint with `{q}`. When set, stations
  are added from the search box and map-click placement is turned off; without it, the
  map click and coordinate entry remain.
- Travel mode is **car** today. The model (`TravelMode`, `osrmProfile`) is shaped so
  walking and cycling can be added: a new profile mapping and speed/accel defaults.

## Failure

Every network failure is non-blocking. Routing failure shows Offline / No route and the
legs stay straight; address-search failure shows an offline note. The route is always
usable.
