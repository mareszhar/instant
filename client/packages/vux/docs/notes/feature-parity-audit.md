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

`@mszr/idb-vux` remains strong on core wrapper parity and is still the DX/UX leader in query authoring ergonomics and SSR resilience, but it is not yet a strict superset of official Vue behavior.

Main blockers versus `@instantdb/vue`:

1. Typing indicator listener key casing mismatch (`onKeyDown` vs official `onKeydown`).
2. Missing official-style reactive input breadth (`MaybeRefOrGetter`) across some APIs.
3. `usePresence` does not currently mirror subscription `error` updates from the official SDK.

Largest cross-family gap still unchanged: no dedicated SSR hydration package equivalent to `@instantdb/react/nextjs`.

## Feature Matrix

Legend: `yes` = implemented, `partial` = implemented with reduced scope, `no` = missing, `n/a` = not directly comparable for that SDK model.

| Feature | Vux | Vue | Svelte | Solid | React | React Native | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `init`, `useQuery`, `queryOnce`, `transact`, auth/status hooks | yes | yes | yes | yes | yes | yes | Baseline wrapper parity remains strong. |
| Reactive/function query inputs (`() => query` / `() => null`) | yes | yes | yes | yes | no | no | Vux/Vue/Svelte/Solid support function query factories directly. |
| Direct ref/getter query inputs + reactive `useLocalId` names (official Vue-style) | partial | yes | n/a | n/a | n/a | n/a | Vux supports function reactivity but does not yet mirror all Vue `MaybeRefOrGetter` pathways. |
| Reactive `room(type, id)` inputs (official Vue-style) | no | yes | n/a | n/a | n/a | n/a | Official Vue room handles can be backed by reactive type/id inputs. |
| `useInfiniteQuery` | yes | yes | no | no | yes | yes | Vux now matches Vue/React-family infinite pagination path. |
| Full framework SSR package (server query + hydration handoff) | partial | no | no | no | yes (`./nextjs`) | no | Vux is SSR-resilient, not SSR-hydrated today. |
| Suspense query hook (`useSuspenseQuery`) | no | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
| SSR cookie helper (`getUnverifiedUserFromInstantCookie`) | no | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
| `SignedIn` / `SignedOut` auth-gate components | yes | yes | yes | no | yes | yes | Solid has no equivalent shipped component. |
| `Cursors` component | yes | yes | yes | no | yes | no | RN and Solid do not ship cursor component. |
| First-class `db.streams` property | yes | yes | no | no | yes | yes | Vux now matches official Vue + React-family convenience surface. |
| Stream helper type exports + `setInstantWarningsEnabled` | yes | no | no | no | yes | yes | Vux intentionally tracks React-family stream/warnings export completeness. |
| Typing indicator `v-bind` listener key compatibility (`onKeydown`) | no | yes | n/a | n/a | n/a | n/a | Official Vue lowercases key to avoid Vue hyphenation pitfalls. |
| Deprecated helper type aliases (`InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantSchemaDatabase`, `InstantEntity`, `InstantGraph`) | no (intentional) | yes | yes | yes | yes | yes | In core these are `@deprecated`; Vux intentionally omits them. |
| Vux-first typed query authoring (`defineQuery`, `useQueryX`, `useInfiniteQueryX`) | yes | no | no | no | no | no | Vux advantage; not a parity gap. |
| SSR-safe inert guards for accidental server execution | yes | no explicit wrapper guards | no explicit wrapper guards | no explicit wrapper guards | partial (SSR snapshots + dedicated Next entrypoint) | mostly N/A | Vux advantage for resilience-first behavior. |

## Detailed Gap Findings

### 1) Strict-superset blockers vs official Vue

Evidence:

- Official Vue uses `MaybeRefOrGetter` signatures in key APIs:
  - `useQuery`, `useInfiniteQuery`, `useLocalId`, `room` (`client/packages/vue/src/InstantVueDatabase.ts`)
  - `useSyncPresence` (`client/packages/vue/src/InstantVueRoom.ts`)
- Vux narrows several of these signatures (`client/packages/vux/idb-vux/src/InstantVuxDatabase.ts`, `client/packages/vux/idb-vux/src/InstantVuxRoom.ts`).
- Official Vue lowercases typing indicator key and tests it (`client/packages/vue/src/InstantVueRoom.ts`, `client/packages/vue/src/tests/InstantVueDatabase.test.ts`); Vux currently exposes `onKeyDown`.
- Official Vue presence subscription updates `error`; Vux presence subscription currently does not assign incoming `error`.

Impact:

- Most day-to-day code ports cleanly, but some official Vue patterns will not be drop-in without minor rewrites.

### 2) Full SSR query hydration parity is still missing

Evidence:

- React ships dedicated Next SSR entrypoint `./nextjs` (`client/packages/react/package.json`).
- React Next SSR surface includes `InstantSuspenseProvider`, `useSuspenseQuery`, and cookie helpers (`client/packages/react/src/next-ssr/*`).
- Vux package has no SSR hydration subpath export and remains resilience-focused (`client/packages/vux/idb-vux/package.json`, `client/packages/vux/idb-vux/docs/nuxt-ssr-resilience.md`).

Impact:

- Vue/Nuxt apps can avoid SSR crashes, but cannot yet do first-class server data hydration handoff comparable to React Next package flow.

### 3) Streams/warnings parity: shipped in Vux, not in official Vue

Evidence:

- Vux exports stream helper types and `setInstantWarningsEnabled` (`client/packages/vux/idb-vux/src/index.ts`).
- Type checks exist for this export contract (`client/packages/vux/idb-vux/src/tests/streams-and-warnings-exports.types.ts`).
- Official Vue index does not export these stream/warning helpers (`client/packages/vue/src/index.ts`).

Impact:

- Vux has a stronger explicit stream/warning surface than official Vue today.

### 4) Intentional difference: omit deprecated helper type aliases

Vux intentionally does not re-export:

- `InstantQuery`
- `InstantQueryResult`
- `InstantSchema`
- `InstantSchemaDatabase`
- `InstantEntity`
- `InstantGraph`

Impact:

- This is intentional and aligned with a “no deprecated surface” policy, but it is still a formal export-surface divergence from official wrappers.

## Non-Gaps / Vux Advantages

- Additive typed query ergonomics (`defineQuery`, `useQueryX`, `useInfiniteQueryX`, `queryOnceX`) with contract tests.
- `keepPreviousData` continuity path for query transitions.
- SSR resilience contract with inert no-op guards and broad server-runtime tests.
- Cursors component customization surface beyond official Vue (`className`, `style`, `renderCursor`).
