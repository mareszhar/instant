updated: 2026-05-15

# Vux vs Official Vue SDK Recon Audit

## Goal

Evaluate whether `@mszr/idb-vux` is currently a strict superset of `@instantdb/vue`, identify every meaningful difference, and classify each difference as:

- expected additive behavior,
- intentional divergence,
- or parity gap.

## Method

- Read Vux workspace READMEs (excluding `sandbox`).
- Compared source surfaces in:
  - `client/packages/vue/src/*`
  - `client/packages/vux/idb-vux/src/*`
- Reviewed runtime and type tests in both packages.
- Ran test suites:
  - `pnpm --dir client/packages/vue test` (33/33 passing)
  - `pnpm --dir client/packages/vux/idb-vux test` (84/84 passing)

## Verdict

`@mszr/idb-vux` is **very close** to official Vue parity and already exceeds it in several areas, but it is **not yet a strict superset** of `@instantdb/vue`.

### Superset blockers (recommended to close)

1. `useTypingIndicator().inputProps` key casing mismatch:
   - Official uses `onKeydown` for Vue `v-bind` compatibility (`client/packages/vue/src/InstantVueRoom.ts:36`, `client/packages/vue/src/InstantVueRoom.ts:305`).
   - Vux uses `onKeyDown` (`client/packages/vux/idb-vux/src/InstantVuxRoom.ts:60`, `client/packages/vux/idb-vux/src/InstantVuxRoom.ts:327`).
2. Missing official-style reactive input coverage in several APIs:
   - Official supports `MaybeRefOrGetter` query/opts/localId/room/data inputs (`client/packages/vue/src/InstantVueDatabase.ts:160`, `client/packages/vue/src/InstantVueDatabase.ts:227`, `client/packages/vue/src/InstantVueDatabase.ts:315`, `client/packages/vue/src/InstantVueDatabase.ts:345`, `client/packages/vue/src/InstantVueRoom.ts:201`).
   - Vux narrows these to object/function/string/static signatures (`client/packages/vux/idb-vux/src/InstantVuxDatabase.ts:694`, `client/packages/vux/idb-vux/src/InstantVuxDatabase.ts:968`, `client/packages/vux/idb-vux/src/InstantVuxDatabase.ts:997`, `client/packages/vux/idb-vux/src/InstantVuxRoom.ts:195`).
3. `usePresence` error updates are not mirrored:
   - Official updates `error` if provided in subscription payload (`client/packages/vue/src/InstantVueRoom.ts:167`).
   - Vux updates `peers`/`isLoading`/`user`, but not `error` (`client/packages/vux/idb-vux/src/InstantVuxRoom.ts:171`).

## Detailed Comparison

### 1) Core DB API

- Parity achieved:
  - `init`, `transact`, `getAuth`, `queryOnce`, `useQuery`, `useInfiniteQuery`, `useAuth`, `useUser`, `useConnectionStatus`, `room`, `rooms`.
- Vux additive:
  - `queryOnceX`, `useQueryX`, `useInfiniteQueryX`, `useAuthX`, `defineDb`, `defineQuery`, `keepPreviousData`.
- Official advantages still not fully mirrored:
  - Direct ref/getter ergonomics across more APIs (see blockers above).

### 2) Rooms/Presence/Topics

- Parity achieved:
  - `useTopicEffect`, `usePublishTopic`, `usePresence`, `useSyncPresence`, `useTypingIndicator` exist and work.
- Intentional/additive Vux behavior:
  - SSR-safe inert no-op behavior in room hooks (`client/packages/vux/idb-vux/src/InstantVuxRoom.ts:79`, `client/packages/vux/idb-vux/src/tests/InstantVuxRoom.test.ts:386`).
- Gaps/divergences:
  - `inputProps` key casing (`onKeydown` vs `onKeyDown`) as above.
  - `usePresence` return ergonomics differ:
    - Official returns refs (`ShallowRef`) (`client/packages/vue/src/InstantVueRoom.ts:151`).
    - Vux returns a reactive state object (`client/packages/vux/idb-vux/src/InstantVuxRoom.ts:146`).
  - `usePresence` does not currently mirror `error` update behavior.

### 3) Components

- `SignedIn` / `SignedOut`:
  - Behavioral parity is strong.
- `Cursors`:
  - Parity with meaningful Vux enhancements (`className`, `style`, `renderCursor`, clamped percent math, safer target handling):
    - `client/packages/vux/idb-vux/src/Cursors.ts`

### 4) Exports and Type Surface

- Vux additive exports over official Vue:
  - `defineDb`, `defineQuery`
  - `setInstantWarningsEnabled`
  - stream helper types (`CreateReadStreamOpts`, `CreateWriteStreamOpts`, `InstantReadableStream`, `InstantWritableStream`)
  - `X` result/helper types (`UseQueryX*`, `UseInfiniteQueryX*`, `UseAuthX*`, etc.)
- Official Vue exports not present in Vux:
  - `InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantEntity`, `InstantSchemaDatabase`, `InstantGraph`
  - all are deprecated aliases in core; this is an intentional Vux divergence.

### 5) SSR Behavior

- Vux is explicitly SSR-resilient with inert guards for subscriptions and browser-only paths:
  - `client/packages/vux/idb-vux/src/InstantVuxDatabase.ts:700`
  - `client/packages/vux/idb-vux/src/InstantVuxDatabase.ts:888`
  - `client/packages/vux/idb-vux/src/InstantVuxDatabase.ts:953`
  - plus tests in `InstantVuxDatabase.test.ts`.
- Official Vue does not ship equivalent explicit guard scaffolding in wrapper code.

## Recommendations

### P0 (close immediately)

1. Align `useTypingIndicator.inputProps` to official Vue casing:
   - rename `onKeyDown` -> `onKeydown` in Vux room hook.
   - add a regression test matching the official Vue expectation.

### P1 (close for strict superset claim)

1. Expand Vux signatures to official-compatible reactive inputs:
   - `useQuery`, `useInfiniteQuery`: accept `MaybeRefOrGetter` for query/opts.
   - `useLocalId`: accept `MaybeRefOrGetter<string>` and resubscribe on name changes.
   - `room`: accept reactive `type`/`id` inputs.
   - `useSyncPresence`: accept `MaybeRefOrGetter` input while preserving optional `deps` ergonomics.
2. Mirror `usePresence` error propagation from official payload updates.

### P2 (DX strategy decision)

1. Decide if room hook value shape should remain a Vux-first divergence or expose an official-style compatibility path.
   - Current Vux shape is clean and ergonomic.
   - Official-style `.value` parity would improve copy-paste portability from `@instantdb/vue`.

## Bottom Line

Vux is already stronger than official Vue in SSR resilience and additive DX APIs, but it is not yet a strict superset because of a small set of compatibility mismatches. Closing P0+P1 items would make the superset claim materially true while preserving Vux’s design advantages.
