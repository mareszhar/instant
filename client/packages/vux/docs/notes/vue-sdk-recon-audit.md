updated: 2026-05-15

# Vux vs Official Vue SDK Recon Audit

## Goal

Evaluate whether `@mszr/idb-vux` is a practical superset of `@instantdb/vue`, identify every meaningful difference, and classify each one as:

- expected additive behavior,
- intentional divergence,
- or parity gap.

## Method

- Read Vux workspace READMEs (excluding `sandbox`).
- Compared source surfaces in:
  - `client/packages/vue/src/*`
  - `client/packages/vux/idb-vux/src/*`
- Reviewed runtime and type tests in both packages.
- Ran package checks after parity work:
  - `pnpm --dir client/packages/vue test` (33/33 passing)
  - `pnpm --dir client/packages/vux/idb-vux test` (92/92 passing)
  - `pnpm --dir client/packages/vux/idb-vux typecheck` (passing)

## Verdict

`@mszr/idb-vux` now has high-fidelity behavioral parity with official Vue across the baseline room and database runtime contracts, while retaining Vux additive APIs.

Remaining non-superset differences are now intentional surface choices:

1. Vux intentionally omits deprecated type aliases still exported by official wrappers.
2. Vux adds extra ergonomic APIs (`X` variants) and explicit SSR inert guards.

## P0/P1/P2 Completion Summary

Completed parity changes:

1. `useTypingIndicator().inputProps` now uses `onKeydown` for Vue `v-bind` compatibility (plus regression test).
2. `useQuery` now accepts official-style reactive inputs for query and opts (`MaybeRefOrGetter`).
3. `useInfiniteQuery` now accepts official-style reactive inputs for query and opts (`MaybeRefOrGetter`).
4. `useLocalId` now accepts reactive names and reloads/resolves safely on changes.
5. `room` now accepts reactive `type`/`id` inputs (official-style contract).
6. `useSyncPresence` now accepts reactive presence input sources.
7. `usePresence` now mirrors official-style subscription `error` updates.
8. `usePresence` now mirrors official Vue’s ref-first return shape.
9. `useTypingIndicator` now mirrors official Vue’s ref-first return shape.
10. Added additive room `X` APIs (`usePresenceX`, `useTypingIndicatorX`) with shared `refs + state` ergonomics.

## Detailed Comparison

### 1) Core DB API

- Parity achieved:
  - `init`, `transact`, `getAuth`, `queryOnce`, `useQuery`, `useInfiniteQuery`, `useAuth`, `useUser`, `useConnectionStatus`, `useLocalId`, `room`, `rooms`.
- Vux additive:
  - `queryOnceX`, `useQueryX`, `useInfiniteQueryX`, `useAuthX`, `defineDb`, `defineQuery`, `keepPreviousData`.

### 2) Rooms/Presence/Topics

- Parity achieved:
  - `useTopicEffect`, `usePublishTopic`, `usePresence`, `useSyncPresence`, `useTypingIndicator` align on core behavior and baseline return shapes.
- Intentional/additive Vux behavior:
  - SSR-safe inert no-op behavior in room hooks.
  - `usePresenceX` and `useTypingIndicatorX` add Vux `refs + state` ergonomics without changing baseline parity.

### 3) Components

- `SignedIn` / `SignedOut`:
  - behavioral parity is strong.
- `Cursors`:
  - parity maintained with Vux enhancements (`className`, `style`, `renderCursor`, cursor math guards).

### 4) Exports and Type Surface

- Vux additive exports over official Vue:
  - `defineDb`, `defineQuery`
  - `setInstantWarningsEnabled`
  - stream helper types (`CreateReadStreamOpts`, `CreateWriteStreamOpts`, `InstantReadableStream`, `InstantWritableStream`)
  - `X` result/helper types (`UseQueryX*`, `UseInfiniteQueryX*`, `UseAuthX*`, `UsePresenceX*`, `UseTypingIndicatorX*`, etc.)
- Official Vue exports not present in Vux:
  - `InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantEntity`, `InstantSchemaDatabase`, `InstantGraph`
  - these are deprecated aliases in core; omission remains intentional.

### 5) SSR Behavior

- Vux keeps explicit SSR resilience guards across DB and room hooks.
- Official Vue wrapper does not ship the same explicit guard breadth.

## P2: Room API Strategy (Resolved)

Implemented outcome:

1. Baseline room hooks were aligned to official Vue’s ref-first contract.
2. Additive room `X` APIs were introduced (`usePresenceX`, `useTypingIndicatorX`) to preserve Vux ergonomics.
3. Documentation now presents baseline and X side-by-side and introduces a shared `refs + state` pattern guide.

## Bottom Line

P0/P1/P2 parity work is complete and tested. Vux now tracks official Vue behavior closely on baseline APIs for easier rebases/diffing, while preserving additive innovation through explicit `X` APIs.
