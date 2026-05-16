updated: 2026-05-15

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

Largest remaining cross-family gap is unchanged: no dedicated SSR hydration package equivalent to `@instantdb/react/nextjs`.

Remaining Vue-vs-Vux differences are now primarily intentional:

1. Vux intentionally omits deprecated helper type aliases still exported by official wrappers.
2. Vux adds additive `X` APIs (including rooms) on top of the parity baseline.

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
| Full framework SSR package (server query + hydration handoff) | partial | no | no | no | yes (`./nextjs`) | no | Vux is SSR-resilient, not SSR-hydrated today. |
| Suspense query hook (`useSuspenseQuery`) | no | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
| SSR cookie helper (`getUnverifiedUserFromInstantCookie`) | no | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
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
- Vux package has no SSR hydration subpath export and remains resilience-focused (`client/packages/vux/idb-vux/package.json`, `client/packages/vux/idb-vux/docs/nuxt-ssr-resilience.md`).

Impact:

- Vue/Nuxt apps can avoid SSR crashes, but cannot yet do first-class server data hydration handoff comparable to React Next package flow.

### 2) Intentional difference: omitted deprecated helper type aliases

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
- Additive room ergonomics (`usePresenceX`, `useTypingIndicatorX`) with the same `refs + state` contract as other X APIs.
- `keepPreviousData` continuity path for query transitions.
- SSR resilience contract with inert no-op guards and broad server-runtime tests.
- Cursors component customization surface beyond official Vue (`className`, `style`, `renderCursor`).
