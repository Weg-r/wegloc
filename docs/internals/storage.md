# Storage

`src/db` is a thin `idb` wrapper. Nothing outside it opens a transaction, and there is
no ORM.

The editor holds real user data -- routes someone spent an afternoon drawing. Be
careful with anything that clears storage, bumps the DB version, or resets state.

## Schema

Database `wegloc`, current version **2**.

- `routes` (v1) -- keyed on `id`, indexed on `updatedAt`. The saved routes.
- `geocode` (v2) -- keyed on rounded coordinates. Cached reverse-geocode results.
  Derived data, safe to lose; kept in its own store so it never risks the routes.

## Versioning policy

- Upgrades are **additive**. Each store is created only if missing, so a fresh database
  and an upgrade from an older version land in the same place. Never drop a store to
  "clean up".
- Data flows one way: fixtures in, nothing out. A dev-only action loads
  `src/db/fixtures` into the local database; it skips anything already present and can
  neither overwrite nor delete a user's route.

## Failure states

Every storage failure is surfaced, never swallowed:

- `describeStorageError` names quota and private-browsing failures.
- `blocked` / `blocking` handlers on `openDB` mean a second tab holding an older
  version reports itself instead of hanging.
- The store carries `storage: { available, pending, failure }`, and the header shows
  Saved / Saving / Not saved with the reason, pointing at Export as the escape hatch.

Writes are debounced (~400ms) and coalesced, but a discrete action like clearing or
switching routes flushes immediately, and a pending write is flushed on `pagehide` so
an edit is not lost by closing the tab.
