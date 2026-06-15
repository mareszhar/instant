<p align="center">
  <a href="https://instantdb.com">
    <img alt="Shows the Instant logo" src="https://instantdb.com/img/icon/android-chrome-512x512.png" width="10%">
  </a>
  <h1 align="center">@mszr/idb-vux</h1>
</p>

<p align="center">
  <a href="https://discord.com/invite/VU53p7uQcE">
    <img alt="discord" height="20" src="https://img.shields.io/discord/1031957483243188235" />
  </a>
  <img alt="stars" src="https://img.shields.io/github/stars/instantdb/instant">
</p>

> **Deprecated.** `@mszr/idb-vux` has been superseded by [Dux](../../dux/idb-dux/README.md) (`client/packages/dux/idb-dux`), a framework-agnostic DX-first SDK. No further development will happen here.

**A reactive, realtime SDK for InstantDB.** Build powerful Vue applications with first-class query ergonomics, infinite paginations, and SSR resilience.

This package is a DX/UX-first Vue SDK that goes beyond the official `@instantdb/vue` surface with additive authoring and query ergonomics.

---

## Features

- 🤝 **Stable & Familiar** — High-fidelity parity with official SDKs, the usage patterns you know, adapted for seamless use in Vue.

- 💎 **Next-Level Ergonomics** — Additive features like `useQueryX/useInfiniteQueryX`, `useAuthX`, and room `X` hooks (`usePresenceX/useTypingIndicatorX`) reduce boilerplate and improve type-safety, beyond what the official SDKs offer.

- ✅ **Thoroughly Tested** — Comprehensive test coverage for core APIs and incremental improvements, validated to balance performance and accuracy.

- 👾 **Realtime Primitives** — Presence, topics, and typing indicators ready to go with specialized Vue components.

- 🧊 **SSR Resilience** — Safe inert execution in Nuxt and Vite SSR environments from day one, without forcing `ssr: false`; full SSR data hydration is planned separately.

## Relationship to `@instantdb/vue`

- `@instantdb/vue` is the official Vue SDK from InstantDB.
- `@mszr/idb-vux` keeps strong parity on core usage while adding DX/UX-first APIs such as `defineDb`, `defineQuery`, `queryOnceX`, `useQueryX`, `useInfiniteQueryX`, `useAuthX`, and room `X` hooks.
- If your app only uses parity APIs, swapping SDKs is mostly straightforward.
- If your app uses additive APIs from `@mszr/idb-vux`, migrating to the official SDK requires code changes for those API calls.
- But we hope you will find Vux more pleasant to work with and stick with it. In the long run, we're open to upstreaming useful patterns and APIs to the official SDKs.

---

## Quick start

```ts
import { id, init } from '@mszr/idb-vux'

const db = init({
  appId: import.meta.env.VITE_INSTANT_APP_ID,
})

const { todos } = db.useQueryX({
  todos: {}
})

db.transact(
  db.tx.todos[id()]!.update({
    text: 'Ship Vue SDK docs',
    done: true,
  }),
)
```

---

## Documentation

Split into focused modules so you can jump directly to what you need:

1. [Getting started](./docs/getting-started.md)
2. [Queries (`queryOnce`, `queryOnceX`, `useQuery`, `useQueryX`, `defineQuery`)](./docs/queries.md)
3. [Infinite queries (`useInfiniteQuery`, `useInfiniteQueryX`)](./docs/infinite-queries.md)
4. [Realtime rooms and components](./docs/realtime-rooms.md)
5. [DX/UX enhancements (Vux-only additions)](./docs/dx-ux-enhancements.md)
6. [Nuxt and SSR resilience](./docs/nuxt-ssr-resilience.md) - current SSR contract, hydration caveats, and Pinia setup-store guidance.
7. [API reference](./docs/api-reference.md)
8. [Examples](./examples) - quick micro-examples illustrating API usage in a real TypeScript environment.

## Demo

Check out the [local demo app](./demo) to see `@mszr/idb-vux` in action. See the [demo guide](./demo/README.md) for run instructions.

---

## Maintainers

If you are contributing to the monorepo workspace, see the [Maintainer docs index](https://github.com/mareszhar/instant/tree/dux/client/packages/vux/docs/README.md).
