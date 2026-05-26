updated: 2026-05-25

# Vux SDK Feature Parity Audit

## Scope

Compared SDKs in `client/packages`:

- `@mszr/idb-vux` (`client/packages/vux/idb-vux`)
- `@instantdb/vue` (official Vue SDK)
- `@instantdb/svelte`
- `@instantdb/solidjs`
- `@instantdb/react`
- `@instantdb/react-native`
- `@instantdb/core` (capability baseline)

Focus is end-user SDK behavior and surface area (hooks/composables, SSR behavior, export parity), not build tooling differences.

## Executive Summary

After the latest parity refactor, Vux now aligns closely with official Vue on baseline runtime contracts while preserving additive Vux APIs.

P0/P1 parity items are complete:

1. `onKeydown` listener compatibility in typing indicator.
2. Official-style reactive inputs (`MaybeRefOrGetter`) across query/localId/room/presence sync paths.
3. Presence error propagation alignment.
4. Room hook baseline return-shape alignment with official Vue (ref-first fields).

The latest Nuxt server initiative adds auth-sync and server-db groundwork:

1. `@mszr/idb-vux/nuxt` now exports `defineInstantAuthSyncHandler` for H3/Nitro `firstPartyPath` endpoints.
2. `@mszr/idb-vux/nuxt` now exports `defineServerIdb` for composable server-side admin/base/guest/user DB access.
3. `defineServerIdb` includes request-scoped caching for auth token reads, scoped DBs, and `verifyToken` promises.

Largest remaining cross-family gap is narrower but unchanged in kind: Vux still has no dedicated SSR query hydration package equivalent to `@instantdb/react/nextjs`.

Remaining Vue-vs-Vux differences are now primarily intentional:

1. Vux intentionally omits deprecated helper type aliases still exported by official wrappers.
2. Vux adds additive `X` APIs on top of the parity baseline.

## Feature Matrix

Legend: `yes` = implemented, `partial` = implemented with reduced scope, `no` = missing, `n/a` = not directly comparable for that SDK model.

| Feature | Vux | Vue | Svelte | Solid | React | React Native | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `init`, `useQuery`, `queryOnce`, `transact`, auth/status hooks | yes | yes | yes | yes | yes | yes | Baseline wrapper parity remains strong. |
| Reactive/function query inputs (`() => query` / `() => null`) | yes | yes | yes | yes | no | no | Vux/Vue/Svelte/Solid support function query factories directly. |
| Direct ref/getter query inputs + reactive `useLocalId` names (official Vue-style) | yes | yes | n/a | n/a | n/a | n/a | Vux now mirrors Vue-compatible reactive input breadth on core paths. |
| Reactive `room(type, id)` inputs (official Vue-style) | yes | yes | n/a | n/a | n/a | n/a | Vux now accepts reactive room type/id sources. |
| `useInfiniteQuery` | yes | yes | no | no | yes | yes | Vux matches Vue/React-family infinite pagination path. |
| Presence subscription error propagation parity | yes | yes | n/a | n/a | n/a | n/a | Vux now mirrors official error propagation behavior. |
| Typing indicator `v-bind` listener key compatibility (`onKeydown`) | yes | yes | n/a | n/a | n/a | n/a | Vux now uses lowercase listener keys for Vue event binding compatibility. |
| Room hook return shape matches official ref-first style | yes | yes | n/a | n/a | n/a | n/a | Vux baseline room hooks now mirror official Vue shape. |
| Room `X` ergonomics (`usePresenceX`, `useTypingIndicatorX`) | yes | no | no | no | no | no | Additive Vux-only room ergonomics with shared `refs + state` pattern. |
| Full framework SSR package (server query + hydration handoff) | partial | no | no | no | yes (`./nextjs`) | no | Vux is SSR-resilient and now has Nuxt auth/server-db helpers, but not query hydration. |
| Suspense query hook (`useSuspenseQuery`) | no | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
| Full-user SSR cookie helper (`getUnverifiedUserFromInstantCookie`) | no (intentional) | no | no | no | yes (`./nextjs`) | no | Vux uses a token-only Nuxt auth-sync cookie instead. |
| First-party auth sync route helper | yes | no | no | no | yes | no | Vux ships an H3/Nitro helper; React/core ship Request/Response-oriented `createInstantRouteHandler`. |
| Nuxt/H3 server DB helper | yes | no | no | no | no | no | `defineServerIdb` is Vux-only DX for server routes. |
| `SignedIn` / `SignedOut` auth-gate components | yes | yes | yes | no | yes | yes | Solid has no equivalent shipped component. |
| `Cursors` component | yes | yes | yes | no | yes | no | RN and Solid do not ship cursor component. |
| First-class `db.streams` property | yes | yes | no | no | yes | yes | Vux matches official Vue + React-family convenience surface. |
| Stream helper type exports + `setInstantWarningsEnabled` | yes | no | no | no | yes | yes | Vux intentionally tracks React-family stream/warnings export completeness. |
| Deprecated helper type aliases (`InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantSchemaDatabase`, `InstantEntity`, `InstantGraph`) | no (intentional) | yes | yes | yes | yes | yes | In core these are `@deprecated`; Vux intentionally omits them. |
| Vux-first typed query authoring (`defineQuery`, `queryOnceX`, `useQueryX`, `useInfiniteQueryX`) | yes | no | no | no | no | no | Vux advantage; not a parity gap. |
| SSR-safe inert guards for accidental server execution | yes | no explicit wrapper guards | no explicit wrapper guards | no explicit wrapper guards | partial (SSR snapshots + dedicated Next entrypoint) | mostly N/A | Vux advantage for resilience-first behavior. |

## Remaining Gap Findings

### 1) Full SSR query hydration parity is still missing

Evidence:

- React ships dedicated Next SSR entrypoint `./nextjs` (`client/packages/react/package.json`).
- React Next SSR surface includes `InstantSuspenseProvider`, `useSuspenseQuery`, and cookie helpers (`client/packages/react/src/next-ssr/*`).
- Vux package has no SSR query hydration provider/composable and remains resilience-focused (`client/packages/vux/idb-vux/package.json`, `client/packages/vux/idb-vux/docs/nuxt-ssr-resilience.md`).
- Vux's Nuxt subpath now covers first-party auth sync and server DB access, but not SSR query result collection/hydration.

Impact:

- Vue/Nuxt apps can avoid SSR crashes, but cannot yet do first-class server data hydration handoff comparable to React Next package flow.

### 2) Intentional difference: token-only Nuxt auth sync cookie

Official `createInstantRouteHandler` stores the full user JSON in an `instant_user_<appId>` cookie. Official React Next helpers and admin `getUserFromRequest` understand that cookie shape.

Vux's `defineInstantAuthSyncHandler` intentionally stores only the `refresh_token` in `instant_token_<appId>` by default, and `defineServerIdb` consumes that token for `asUser({ token })` and `verifyToken` modes.

Why:

- smaller cookie payload
- less user profile data stored in cookies
- no JSON encode/decode path for the normal server DB workflow
- clearer semantics: unverified scoped DB access is sync, verified user access is explicitly async

Compatibility:

- `createInstantRouteHandler` remains available through the core SDK surface re-exported by Vux, so the canonical full-user cookie workflow is still reachable for apps that want it.
- If Instant adds more first-party endpoint payload types beyond `sync-user`, Vux should add a broader handler (`defineInstantFirstPartyPathHandler` or similar) rather than pretending the current auth-sync helper handles unknown future messages.

Impact:

- This is a deliberate DX/safety divergence, not a missing parity item for the Nuxt auth-sync path.
- Apps that need official `getUserFromRequest` / `getUnverifiedUserFromInstantCookie` compatibility should use or adapt the canonical full-user cookie route handler.

### 3) Intentional difference: omitted deprecated helper type aliases

Vux intentionally does not re-export:

- `InstantQuery`
- `InstantQueryResult`
- `InstantSchema`
- `InstantSchemaDatabase`
- `InstantEntity`
- `InstantGraph`

Impact:

- Cleaner modern surface and less deprecated API drag.
- Still a formal export-surface difference from official wrappers.

## Non-Gaps / Vux Advantages

- Additive typed query ergonomics (`defineQuery`, `useQueryX`, `useInfiniteQueryX`, `queryOnceX`, `useAuthX`, `defineDb`) with contract tests.
- Nuxt/H3 auth-sync and server DB ergonomics (`defineInstantAuthSyncHandler`, `defineServerIdb`) with request-scoped server auth caching.
- Additive room ergonomics (`usePresenceX`, `useTypingIndicatorX`) with the same `refs + state` contract as other X APIs.
- `keepPreviousData` continuity path for query transitions.
- SSR resilience contract with inert no-op guards and broad server-runtime tests.
- Cursors component customization surface beyond official Vue (`className`, `style`, `renderCursor`).
