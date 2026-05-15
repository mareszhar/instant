# Architecture

Audience: maintainers of the Vux workspace and `@mszr/idb-vux`.

## Goals

`@mszr/idb-vux` is a Vue 3 Composition API adapter over `@instantdb/core`.

Primary goals:

- preserve core semantics (query/auth lifecycle, presence/topics behavior)
- keep the framework runtime thin and delegation-focused
- ship strong type-safety with ergonomic Vue-first APIs

## High-level structure

- `InstantVuxDatabase`
  - core wrapper for delegates and composables
  - query/auth/connection/local-id hooks
  - room entrypoint and X ergonomics (`useQueryX`, `useInfiniteQueryX`)
- `InstantVuxRoom` + `rooms`
  - presence/topics/typing composables scoped to room handles
- Components
  - `SignedIn`, `SignedOut` for auth gates
  - `Cursors` for multiplayer cursor rendering
- `index.ts`
  - public exports and type surface

## Reactivity and lifecycle model

- `useQuery` and `useInfiniteQuery` lifecycle state is built on reactive state + `watchEffect`
- `useQueryX` and `useInfiniteQueryX` reuse baseline behavior and add ref/state ergonomics
- subscriptions are attached to Vue scopes and cleaned up on scope dispose
- server/runtime readiness guards return inert safe state when subscriptions are unavailable

## SSR contract (today)

The package is **SSR-resilient**, not full SSR-hydrated:

- hooks can run on server without crashing
- no websocket subscriptions/publishes server-side
- safe loading/empty states are returned until client runtime

See historical design research in [`notes/ssr-feasibility.md`](./notes/ssr-feasibility.md).
