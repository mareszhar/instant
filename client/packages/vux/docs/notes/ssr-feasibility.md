updated: 2026-05-25

# Nuxt SSR Feasibility for `@mszr/idb-vux`

## Current status

`@mszr/idb-vux` is currently **SSR-resilient**, not full SSR-hydrated:

- server execution does not crash
- realtime subscriptions are disabled on server
- hooks return inert loading-safe state until client hydration

This behavior is intentional and currently implemented in:

- `src/InstantVuxDatabase.ts`
- `src/InstantVuxRoom.ts`
- `src/Cursors.ts`

Status addendum:

- `@mszr/idb-vux/nuxt` now exists for Nuxt/H3 server helpers.
- `defineInstantAuthSyncHandler` covers first-party auth sync endpoints.
- `defineServerIdb` covers composable server DB access.
- Full SSR query hydration remains future work.

## What “full SSR parity” means

Parity target is the behavior available in `@instantdb/react/nextjs`:

1. queries can resolve on server render
2. server results are serialized and sent with HTML
3. client hydrates query cache from payload
4. UI transitions into normal realtime subscriptions without duplicate/flicker
5. auth can be aligned server/client via Instant cookie route flow

Reference docs:

- [(Experimental) NextJS SSR](https://www.instantdb.com/docs/next-ssr)

## React/Next implementation model (current source)

The current Next SSR stack uses:

- `FrameworkClient` (`client/packages/core/src/framework.ts`) as a framework-agnostic query result cache + serializer boundary.
- `InstantSuspenseProvider` (`client/packages/react/src/next-ssr/InstantSuspenseProvider.tsx`) to:
  - run server query collection,
  - stream hydration entries,
  - hydrate client cache,
  - expose suspense query context.
- `InstantNextDatabase.useSuspenseQuery` (`client/packages/react/src/next-ssr/InstantNextDatabase.tsx`) for suspense-based query reads.
- cookie helpers (`getUnverifiedUserFromInstantCookie`) and route sync helper (`createInstantRouteHandler`).

Important constraints from this architecture:

- Suspense-driven SSR is central.
- Cache handoff relies on deterministic query hashing and serialized query result payloads.
- Auth handoff expects first-party cookie sync (`firstPartyPath` + route handler).

## Nuxt/Vue primitives that map well

Nuxt and Vue now provide strong equivalents for SSR data and hydration handoff:

- `useHydration` for explicit server->client payload transfer in plugins:
  - [Nuxt useHydration](https://nuxt.com/docs/4.x/api/composables/use-hydration)
- `useAsyncData` for SSR-friendly async resolution and payload sharing:
  - [Nuxt useAsyncData](https://nuxt.com/docs/4.x/api/composables/use-async-data)
- `useState` for SSR-safe shared reactive state (POJO-only payload):
  - [Nuxt useState](https://nuxt.com/docs/4.x/api/composables/use-state)
- `callOnce` for one-time render/navigation initialization:
  - [Nuxt callOnce](https://nuxt.com/docs/4.x/api/utils/call-once)
- `onPrehydrate` for pre-hydration client hooks when needed:
  - [Nuxt onPrehydrate](https://nuxt.com/docs/4.x/api/composables/on-prehydrate)
- `onServerPrefetch` in Vue for component-level server fetching:
  - [Vue onServerPrefetch](https://idb-vuxjs.org/api/composition-api-lifecycle.html#onserverprefetch)

## Recommended package strategy

Keep a single package and add a Nuxt-focused subpath:

- `@mszr/idb-vux` (existing client-first API)
- `@mszr/idb-vux/nuxt` (SSR helpers, provider/composables, cookie helpers)

Why:

- avoids package sprawl
- keeps shared types/runtime near current Vue core
- minimizes drift risk vs base Vue client API

## Proposed SSR API shape (first pass)

Potential `@mszr/idb-vux/nuxt` exports:

- `defineInstantAuthSyncHandler` (implemented)
- `defineServerIdb` (implemented)
- `createInstantNuxtPlugin(...)` or `InstantNuxtProvider` equivalent
- `useSuspenseQuery`-like composable (name TBD; could remain `useSuspenseQuery` for parity)
- `getUnverifiedUserFromInstantCookie` (Nuxt server variant)

Maintainer note: the implemented Nuxt auth path intentionally uses a token-only cookie. The canonical full-user `createInstantRouteHandler` remains available from the main Vux/core export for apps that choose that workflow. See [Feature parity audit](./feature-parity-audit.md) for the compatibility/divergence rationale.

Design goals:

- preserve existing `db.useQuery` behavior for client-first apps
- isolate SSR features behind explicit imports
- keep query object semantics identical to core/Vue usage

## Major risks

1. Hydration payload boundaries

- Nuxt payload serialization requires JSON-safe values.
- Class instances/functions cannot be serialized via `useState` payloads.
- Any framework cache state must be serialized as plain data and rebuilt client-side.

2. Double fetch / race conditions

- Without strict cache priming order, client may refetch before SSR cache is adopted.
- Requires deterministic bootstrap timing before live subscriptions attach.

3. Suspense and routing interplay

- Similar to Next, suspense placement affects blocking vs progressive render behavior.
- Need clear documented patterns for route-level suspense boundaries.

4. Auth coherence

- Server user cookie snapshot and client auth state must reconcile predictably.
- Edge cases: stale cookie, sign-out during navigation, token refresh timing.

## Feasibility assessment

Overall: **highly feasible**, with complexity concentrated in hydration orchestration.

- Core already includes `FrameworkClient`, which reduces architecture risk.
- Nuxt has mature SSR/hydration primitives that can replicate the Next approach.
- Main effort is adapter integration and edge-case hardening, not novel protocol work.

## Proposed phased implementation

### Phase 0 (already done)

- SSR resilience only (no server data hydration)

### Phase 1 (minimum useful SSR)

- Introduce Nuxt SSR entrypoint (`@mszr/idb-vux/nuxt`)
- Add server query resolution path + payload serialization
- Add client cache hydration before reactive subscription startup
- Add cookie helper and route-handler integration docs

Exit criteria:

- first render can display SSR query data
- no duplicate initial fetch for hydrated query
- no hydration mismatch warnings in baseline example

### Phase 2 (suspense parity + stronger DX)

- Suspense-first query composable equivalent to React’s SSR story
- explicit provider/plugin abstraction for easier app wiring
- richer docs for boundary placement, mixed SSR/client-only sections, and fallback strategy

Exit criteria:

- parity demo with `@instantdb/react/nextjs` behavior goals
- documented tradeoffs for blocking vs progressive render

### Phase 3 (stability + optimization)

- optimize cache eviction/cleanup and repeated navigation behavior
- add deeper test coverage for auth transitions and route changes
- production hardening for edge/runtime environments

## Testing requirements for SSR phase work

- unit tests for server/client branches in new SSR composables
- integration fixture with Nuxt SSR enabled:
  - server render returns data without crash
  - client hydrates without flicker
  - realtime updates continue after hydration
  - auth cookie sync path works for signed-in and signed-out flows

## Practical conclusion

The existing SSR-resilient foundation is still valid after rebase, and no architectural blocker emerged. Next step should be Phase 1 SSR adapter work in a dedicated Nuxt subpath, while keeping base `@mszr/idb-vux` API stable.
