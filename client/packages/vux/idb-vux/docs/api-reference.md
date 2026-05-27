# API Reference

Audience: developers needing a compact export map.

This page is intentionally concise. Use conceptual guides for workflow details:

- [Getting started](./getting-started.md)
- [Queries](./queries.md)
- [Infinite queries](./infinite-queries.md)
- [DX/UX enhancements](./dx-ux-enhancements.md)
- [Realtime rooms and components](./realtime-rooms.md)
- [Nuxt and SSR resilience](./nuxt-ssr-resilience.md)

## Core entrypoints

- `init`
- `defineDb`
  - memoized `useDb`-style factory for runtime-resolved `appId` sources (for example Nuxt `useRuntimeConfig`), optional missing-app-id policy, and optional `requireUserInUseUser` default.
- `id`, `tx`, `lookup`, `i`
- `createInstantRouteHandler`
  - canonical Request/Response route helper from the core SDK; stores the full user cookie used by official SSR helpers.

## Database class

- `InstantVuxDatabase`
  - delegates: `transact`, `queryOnce`, `queryOnceX`, `getAuth`, `getLocalId`
  - query hooks: `useQuery`, `useInfiniteQuery` (full parity behavior shipped)
  - ergonomic query hooks: `useQueryX`, `useInfiniteQueryX`
    - X `state` surfaces are readonly ref projections and are Pinia SSR-hydration tolerant.
  - auth/status hooks:
    - baseline: `useAuth`, `useUser({ requireUser })`, `useConnectionStatus`, `useLocalId`
    - additive X: `useAuthX`, `useUserX`, `useConnectionStatusX`, `useLocalIdX`
  - init/config ergonomics:
    - `requireUserInUseUser` sets default strictness for both `useUser` and `useUserX`
  - room entrypoint: `room(...)`

## Query authoring

- `defineQuery`
  - schema-aware typed authoring helper
  - compatible with both regular and X query hooks
  - accepts readonly query authoring arrays and normalizes them for Vux query APIs

## Nuxt subpath

Import from `@mszr/idb-vux/nuxt`:

- `defineInstantAuthSyncHandler`
  - H3/Nitro handler for Instant `firstPartyPath` auth sync.
- `defineServerIdb`
  - Nuxt/H3 server DB helper for admin, base, guest, token-scoped, and verified-user modes.
- `getDefaultServerIdbCookieName`
  - shared default cookie naming convention used by both Nuxt helpers.

See [DX/UX enhancements](./dx-ux-enhancements.md) for the workflow details and examples.

## Rooms and realtime

- `InstantVuxRoom`
- `rooms`
  - `useTopicEffect`
  - `usePublishTopic`
  - `usePresence`
  - `usePresenceX` (additive `refs + state`)
  - `useSyncPresence`
  - `useTypingIndicator`
  - `useTypingIndicatorX` (additive `refs + state`)

## Components

- `SignedIn`
- `SignedOut`
- `Cursors`

## Types

The package exports a broad set of Instant core and Vue-specific types, including query result types for regular and X APIs.

For exact type names, inspect `src/index.ts` in the package source:

- `https://github.com/mareszhar/instant/tree/vux/client/packages/vux/idb-vux/src/index.ts`
