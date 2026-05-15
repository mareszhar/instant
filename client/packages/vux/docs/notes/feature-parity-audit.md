updated: 2026-05-09

# Vux SDK Feature Parity Audit

## Scope

Compared SDKs in `client/packages`:

- `@mszr/idb-vux` (`client/packages/vux/idb-vux`)
- `@instantdb/svelte`
- `@instantdb/solidjs`
- `@instantdb/react`
- `@instantdb/react-native`
- `@instantdb/core` (capability baseline)

Focus is end-user SDK behavior and surface area (hooks/composables, SSR behavior, export parity), not build tooling differences.

## Executive Summary

`@mszr/idb-vux` remains strongly aligned with official wrappers on core usage (`useQuery`, auth/status hooks, room APIs) and now includes first-class infinite query parity plus Vux-specific ergonomics (`defineQuery`, `useQueryX`, `useInfiniteQueryX`, `keepPreviousData`).

Largest remaining gaps versus the most feature-complete family (React + React Next SSR + React Native):

1. No full framework SSR data/hydration package equivalent to `@instantdb/react/nextjs`.

## Feature Matrix

Legend: `yes` = implemented, `partial` = implemented with reduced scope, `no` = missing.

| Feature | Vux | Svelte | Solid | React | React Native | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `init`, `useQuery`, `queryOnce`, `transact`, auth/status hooks | yes | yes | yes | yes | yes | Baseline wrapper parity remains strong. |
| Reactive/function query inputs (`() => query` / `() => null`) | yes | yes | yes | no | no | Vux/Svelte/Solid support query factories directly. |
| `useInfiniteQuery` | yes | no | no | yes | yes | Vux now matches React-family infinite pagination path. |
| Full framework SSR package (server query + hydration handoff) | partial | no | no | yes (`./nextjs`) | no | Vux is SSR-resilient, not SSR-hydrated today. |
| Suspense query hook (`useSuspenseQuery`) | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
| SSR cookie helper (`getUnverifiedUserFromInstantCookie`) | no | no | no | yes (`./nextjs`) | no | React Next SSR entrypoint only. |
| `SignedIn` / `SignedOut` auth-gate components | yes | yes | no | yes | yes | Solid has no equivalent shipped component. |
| `Cursors` component | yes | yes | no | yes | no | RN and Solid do not ship cursor component. |
| First-class `db.streams` property | yes | no | no | yes | yes | Vux now mirrors React-family convenience surface. |
| Stream helper type exports (`CreateReadStreamOpts`, `CreateWriteStreamOpts`, `InstantReadableStream`, `InstantWritableStream`) | yes | no | no | yes | yes | Vux now mirrors React-family stream type exports. |
| `setInstantWarningsEnabled` export | yes | no | no | yes | yes | Vux now mirrors React-family warning toggle export. |
| Deprecated helper type aliases (`InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantSchemaDatabase`, `InstantEntity`, `InstantGraph`) | no (intentional) | yes | yes | yes | yes | In core these are `@deprecated`; Vux intentionally omits them. |
| Vux-first typed query authoring (`defineQuery`, `useQueryX`, `useInfiniteQueryX`) | yes | no | no | no | no | Vux advantage; not a parity gap. |
| SSR-safe inert guards for accidental server execution | yes | no explicit wrapper guards | no explicit wrapper guards | partial (SSR snapshots + dedicated Next entrypoint) | mostly N/A | Vux advantage for resilience-first behavior. |

## Detailed Gap Findings

### 1) Full SSR query hydration parity is still missing

Evidence:

- React ships dedicated Next SSR entrypoint `./nextjs` (`client/packages/react/package.json`).
- React Next SSR surface includes `InstantSuspenseProvider`, `useSuspenseQuery`, and cookie helpers (`client/packages/react/src/next-ssr/index.tsx`, `client/packages/react/src/next-ssr/InstantNextDatabase.tsx`, `client/packages/react/src/next-ssr/getUserFromInstantCookie.ts`).
- React implementation uses `FrameworkClient` for server/client cache handoff (`client/packages/react/src/next-ssr/InstantSuspenseProvider.tsx`, `client/packages/core/src/framework.ts`).
- Vux package has no SSR subpath export and remains resilience-focused (`client/packages/vux/idb-vux/package.json`, `client/packages/vux/idb-vux/docs/nuxt-ssr-resilience.md`).

Impact:

- Vue/Nuxt apps can avoid SSR crashes, but cannot yet do first-class server data hydration with seamless handoff into realtime subscriptions.

### 2) Streams convenience + warning toggle parity: shipped in Vux

Evidence:

- Core exposes stream runtime and warning toggle (`client/packages/core/src/index.ts`).
- React-family wrappers expose `db.streams` and stream/warning exports (`client/packages/react-common/src/InstantReactAbstractDatabase.tsx`, `client/packages/react/src/index.ts`, `client/packages/react-native/src/index.ts`).
- Vux now also exposes:
  - `db.streams` passthrough in `InstantVuxDatabase`
  - stream helper type exports (`CreateReadStreamOpts`, `CreateWriteStreamOpts`, `InstantReadableStream`, `InstantWritableStream`)
  - `setInstantWarningsEnabled` export
  (`client/packages/vux/idb-vux/src/index.ts`, `client/packages/vux/idb-vux/src/InstantVuxDatabase.ts`).

Impact:

- Small migration/DX parity gaps versus React-family wrappers are now closed for streams/warnings surface.

### 3) Intentional difference: omit deprecated helper type aliases

Vux intentionally does not re-export:

- `InstantQuery`
- `InstantQueryResult`
- `InstantSchema`
- `InstantSchemaDatabase`
- `InstantEntity`
- `InstantGraph`

Evidence:

- In core source, these aliases are explicitly marked `@deprecated` with migration targets (`client/packages/core/src/helperTypes.ts`).
- `InstantGraph` is also explicitly deprecated in favor of `i.schema` (`client/packages/core/src/schemaTypes.ts`).
- Official wrappers still export them, but Vux omission aligns with a “no deprecated surface” policy.

Impact:

- This is an intentional non-parity by design, not an implementation gap.

## Non-Gaps / Vux Advantages

- Vux has additive typed query ergonomics (`defineQuery`, `useQueryX`, `useInfiniteQueryX`) with contract tests (`client/packages/vux/idb-vux/src/defineQuery.ts`, `client/packages/vux/idb-vux/src/tests/queryAuthoring.contract.types.ts`).
- Vux supports `keepPreviousData` continuity for query swaps (`client/packages/vux/idb-vux/src/InstantVuxDatabase.ts`).
- Infinite query parity is implemented and tested (`client/packages/vux/idb-vux/src/InstantVuxDatabase.ts`, `client/packages/vux/idb-vux/src/tests/InstantVuxInfiniteQuery.test.ts`).
- SSR resilience contract is documented and shipped (`client/packages/vux/idb-vux/docs/nuxt-ssr-resilience.md`).
