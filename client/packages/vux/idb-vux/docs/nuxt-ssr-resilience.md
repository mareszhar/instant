# Nuxt and SSR Resilience

Audience: Nuxt users evaluating what Vux can and cannot do with `ssr: true`.

## Current contract

`@mszr/idb-vux` is currently **SSR-resilient**, not full SSR-hydrated.

That means Vux hooks can be called during server rendering without starting browser-only Instant runtime work. It does **not** mean Instant query results are fetched on the server and handed to the client.

| Capability | Current Vux behavior |
| --- | --- |
| Import/init in SSR | Safe for normal Nuxt usage. |
| `useQuery` / `useQueryX` in SSR | Safe inert loading state; no live subscription. |
| `useInfiniteQuery` / `useInfiniteQueryX` in SSR | Safe inert loading state; `loadNextPage()` is a no-op. |
| `useAuth` / `useAuthX` in SSR | Safe inert loading state; no client auth lookup. |
| `useUser()` default | `clientOnly`: returns `undefined` on server, throws when missing on client. |
| Rooms/presence/topics/cursors in SSR | Safe inert/no-op state; no publish/subscribe. |
| Server-rendered Instant data | Not supported yet. |
| Cache/payload hydration handoff | Not supported yet. |
| Hydration mismatch prevention | Possible with the right loading UI, but not guaranteed by the SDK. |

## What resilience protects against

The official Vue SDK can be safe to import on the server, but common hooks still touch the client reactor/subscription path when called. In a Nuxt SSR render this can crash because browser-initialized reactor pieces such as query subscription storage are not available.

Vux guards those paths:

```ts
const query = db.useQueryX({ todos: {} })
```

On the server, this returns safe inert values:

```ts
query.isLoading.value // true
query.data.value // undefined
query.todos.value // []
```

No query subscription starts until client runtime.

Auth behaves similarly:

```ts
const auth = db.useAuthX()

auth.state.isLoading // true on server
auth.state.user // undefined on server
```

Rooms and presence become no-ops:

```ts
const room = db.room('chat', roomId)
const presence = db.rooms.usePresence(room)

presence.isLoading.value // true on server
presence.peers.value // {}
presence.publishPresence({ name: 'Ada' }) // no-op on server
```

## What resilience does not protect against

SSR resilience is not the same as SSR support.

Vux does not currently:

- resolve Instant queries during server render
- serialize query results into the Nuxt payload
- prime the client query cache before hydration
- make server auth and client auth automatically agree
- guarantee that server HTML and the client's first render will match

The safest mental model is:

1. Server render gets loading-safe placeholders.
2. Client hydrates that HTML.
3. Instant starts normal client subscriptions.
4. Data/auth/presence update after the client runtime is active.

## Hydration patterns

Hydration is sensitive to the first client render. Later async updates are normal Vue updates; they are not hydration mismatches.

This pattern is usually safe:

```vue
<script setup lang="ts">
const { isLoading, todos } = db.useQueryX({ todos: {} })
</script>

<template>
  <TodoSkeleton v-if="isLoading" />
  <TodoList v-else :todos />
</template>
```

The server renders the skeleton. The client also starts from loading state in the common case, then data arrives later.

This pattern is riskier:

```vue
<template>
  <EmptyState v-if="!todos.length" />
  <TodoList v-else :todos />
</template>
```

On the server, the `todos` ref resolves to `[]`, so this renders the empty state. If the client has data before its first hydration render, the client wants to render the list instead. That can produce a hydration warning and a misleading empty-state flash.

Prefer an explicit loading gate:

```vue
<template>
  <TodoSkeleton v-if="isLoading" />
  <EmptyState v-else-if="!todos.length" />
  <TodoList v-else :todos />
</template>
```

## Auth-dependent queries

Auth-dependent queries are the most common place to confuse "safe" with "same".

```ts
const { state: auth } = db.useAuthX()

const query = db.useQueryX(() => {
  if (!auth.user) {
    return null
  }

  return {
    todos: {
      $: {
        where: {
          'owner.id': auth.user.id,
        },
      },
    },
  }
})
```

On the server:

- `auth.user` is `undefined`
- the query returns `null`
- `query.isLoading.value` is `true`
- `query.todos.value` is `[]`

On the client:

- auth may resolve
- the query may become active
- data may arrive

That is resilient because it does not crash. It is not full SSR because the server did not render the user's todos.

Render this as loading/auth-gated UI, not as final empty data:

```vue
<script setup lang="ts">
const { state: auth } = db.useAuthX()
const { state: todosQuery } = db.useQueryX(() => {
  if (!auth.user) {
    return null
  }

  return {
    todos: {
      $: {
        where: {
          'owner.id': auth.user.id,
        },
      },
    },
  }
})
</script>

<template>
  <AuthSkeleton v-if="auth.isLoading" />
  <SignedOutPanel v-else-if="!auth.user" />
  <TodoSkeleton v-else-if="todosQuery.isLoading" />
  <TodoList v-else :todos="todosQuery.todos" />
</template>
```

## Pinia setup stores

Pinia setup stores hydrate SSR state by writing serialized server values back into returned refs/reactive objects on the client. That is expected Pinia behavior.

Vux X APIs are designed to be Pinia-friendly:

```ts
export const useAccessStore = defineStore('access', () => {
  const { state: auth } = db.useAuthX()

  return {
    auth,
    userLabel: computed(() => auth.user?.email ?? 'guest'),
  }
})
```

`x.state` is a readonly runtime projection over the underlying refs, not writable source state. Vux keeps it out of Pinia's hydratable setup-store state so Pinia does not try to assign into getter-only properties during hydration.

You can also return individual refs:

```ts
export const useTodosStore = defineStore('todos', () => {
  const { isLoading, todos } = db.useQueryX({ todos: {} })

  return {
    isLoading,
    todos,
  }
})
```

This remains Pinia-friendly because Vux returns computed refs for derived SDK state.

Pinia compatibility prevents SSR hydration crashes. It does not make mismatched UI impossible. The same loading-gate guidance still applies when store values drive templates.

## Choosing an SSR strategy

Use regular Vux SSR resilience when you need SSR, and the route can render a stable loading shell or public content while Instant starts on the client:

```ts
const query = db.useQueryX({ tasks: {} })
```

Use Nuxt client-only routing when the whole route is an authenticated, realtime, client-first app surface, or you don't need SSR:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/app/**': { ssr: false },
  },
})
```

Use `<ClientOnly>` for isolated widgets inside otherwise server-rendered pages:

```vue
<template>
  <PublicArticle />

  <ClientOnly>
    <RealtimeComments />
  </ClientOnly>
</template>
```

Wait for full Vux/Nuxt SSR support when the route needs Instant data in the server HTML for SEO, first paint, or no-flicker authenticated rendering.

## Planned direction

Full SSR query hydration support should live behind an explicit Nuxt-focused entrypoint rather than changing the client-first API in place.

The target shape is similar to Instant's React/Next SSR support:

1. server query resolution
2. JSON-safe payload serialization
3. client cache hydration before live subscriptions start
4. auth coherence through first-party cookie route integration

Maintainer context:

- `https://github.com/mareszhar/instant/tree/vux/client/packages/vux/docs/notes/ssr-feasibility.md`
