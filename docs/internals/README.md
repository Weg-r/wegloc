# Wegloc internals

Contributor-facing notes. Product-side docs are in [`docs/user/`](../user/); shared
vocabulary is in the glossary in [`AGENT.md`](../../AGENT.md#a-small-glossary).

- [Architecture](./architecture.md) -- data flow and where code lives
- [The phase-2 purity boundary](./purity-boundary.md) -- what stays pure, and why
- [The map adapter](./map-adapter.md) -- MapLibre rules and the antimeridian
- [Storage](./storage.md) -- IndexedDB schema, versioning, failure states
- [Reverse geocoding](./geocoding.md) -- the opt-in, local-first naming feature
- [Road-following routes](./routing.md) -- opt-in routing and address search
