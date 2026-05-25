# DX/UX Enhancements (Vux-only)

Audience: app developers who want to understand everything Vux adds beyond official baseline parity.

Vux keeps official-compatible baseline APIs and adds ergonomic layers focused on readability, composition, and SSR resilience.

## Additive surface index

### Authoring utilities

- `defineDb`
  - memoized db factory for runtime app-id sources
  - supports `missingAppId` policy and `requireUserInUseUser` default behavior

- `defineQuery`
  - schema-aware typed query authoring helper
  - compatible with both regular and X query APIs

### One-off query ergonomics

- `queryOnceX`
  - typed authoring path aligned with query X APIs
  - normalizes requested top-level namespaces to `[]` when absent

### Nuxt server utilities

- `defineServerIdb`
  - creates a Nuxt/H3-friendly server DB helper from the official admin SDK `init`
  - supports admin, base, guest, token-scoped, and verified-user modes
  - caches request-scoped auth work internally so route helpers can stay composable
- `defineInstantAuthSyncHandler`
  - creates the Nuxt/H3 endpoint used by Instant's `firstPartyPath` auth sync
  - stores only the refresh token cookie read by `defineServerIdb`
  - shares the same default cookie naming convention as `defineServerIdb`

### X API family (`refs + state`)

- `useQueryX`
- `useInfiniteQueryX`
- `useAuthX`
- `useUserX`
- `useConnectionStatusX`
- `useLocalIdX`
- `rooms.usePresenceX`
- `rooms.useTypingIndicatorX`

## Shared X pattern

Each X API returns:

1. top-level refs/computed refs for normal destructuring,
2. `refs` alias for explicit ref-forwarding,
3. `state` projection for auto-unwrapped script-friendly reads.

```ts
const query = db.useQueryX({ todos: {} })

query.todos.value
query.refs.todos.value
query.state.todos
```

All access paths read from the same underlying reactive source for that hook instance.

`state` is a readonly projection over the underlying refs. It is intentionally not writable source state and is safe to return from Pinia setup stores in SSR without manually wrapping it in `skipHydrate`.

## How `state` reactivity works

`state` exists only on X APIs, such as `useAuthX` and `useQueryX`.

The `state` object itself is stable and raw. Its properties are getter reads over the underlying refs, so read the property you care about:

```ts
const { state: auth } = db.useAuthX()

watch(() => auth, () => {
  // Not useful: `auth` is the same raw object.
})

watch(() => auth.user, (user) => {
  // Runs when the underlying user ref changes.
})

watch(() => auth.user?.id, (userId) => {
  // Runs when the tracked user/id read changes.
})
```

The same rule applies inside query factories. This reruns when auth resolves or changes because the factory reads `auth.user`:

```ts
const { state: auth } = db.useAuthX()

const query = db.useQueryX(() => {
  if (!auth.user?.id) {
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

Use `state` for reads. Use top-level refs or `refs` when you need explicit ref values:

```ts
const auth = db.useAuthX()

auth.state.user
auth.user.value
auth.refs.user.value
```

## Practical usage patterns

`refs` passthrough from composables:

```ts
function useTodos() {
  const query = db.useQueryX({ todos: {} })
  return { ...query.refs }
}
```

`state` for low-noise script logic:

```ts
const { state: auth } = db.useAuthX()
if (!auth.isLoading && auth.user) {
  console.log(auth.user.email)
}
```

Pinia setup store:

```ts
export const useAccessStore = defineStore('access', () => {
  const { state: auth } = db.useAuthX()

  return {
    auth,
    userLabel: computed(() => auth.user?.email ?? 'guest'),
  }
})
```

Pinia may hydrate returned setup-store state during SSR. Vux keeps X `state` getter-like so Pinia does not try to write into SDK-owned computed state.

Strict/optional user policy with X ergonomics:

```ts
const userX = db.useUserX({ requireUser: 'no' })
if (userX.state.user) {
  trackUser(userX.state.user.id)
}
```

## `useUser` and `useUserX` strictness strategy

`useUser` and `useUserX` share the same behavior model:

- `requireUser: 'clientOnly'` (default): throws on client when missing user, returns `undefined` on server.
- `requireUser: 'yes'`: throws on all runtimes when missing user.
- `requireUser: 'no'`: never throws; returns `undefined` when missing user.

You can set the default once at init-time via `requireUserInUseUser`:

```ts
const db = init({
  appId,
  schema,
  requireUserInUseUser: 'yes',
})
```

`useUserX` mirrors that same policy by design.

## Nuxt Server IDB Composition

`defineServerIdb` lives in the `@mszr/idb-vux/nuxt` subpath. It gives Nuxt server routes a small mode-based helper around the official `@instantdb/admin` SDK without making Vux own the admin SDK runtime import.

```ts
import { init } from '@instantdb/admin'
import { defineInstantAuthSyncHandler, defineServerIdb } from '@mszr/idb-vux/nuxt'
import schema from '~~/config/instant.schema'

export const useIdbn = defineServerIdb({
  init,
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
```

Point the client SDK's `firstPartyPath` at a server endpoint, then let `defineInstantAuthSyncHandler` handle the cookie sync:

```ts
const db = init({
  appId: useRuntimeConfig().public.instantAppId,
  schema,
  firstPartyPath: '/api/auth',
})
```

```ts
// server/api/auth.post.ts
export default defineInstantAuthSyncHandler({
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
})
```

The auth sync handler validates the incoming app ID, accepts only Instant's `sync-user` message, writes the `user.refresh_token` cookie when present, and clears the cookie when the synced user is null. It returns no JSON payload because Instant's client only awaits the request.

If you customize the cookie name or want to avoid drift, pass the same resolvers to both helpers:

```ts
// server/utils/idb.ts

const getCookieName = (appId: string) => `my_token_${appId}`
const getAppId = (event: H3Event) => useRuntimeConfig(event).public.instantAppId

export const useIdbn = defineServerIdb({
  init,
  schema,
  getAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
  getCookieName,
})

// server/api/auth.post.ts

export default defineInstantAuthSyncHandler({
  getAppId,
  getCookieName,
  cookieOptions: event => ({
    secure: getRequestProtocol(event) === 'https',
  }),
})
```

Modes let each endpoint ask for exactly what it needs:

```ts
const { adminDb } = useIdbn(event)
const { userDb } = useIdbn(event, 'userDb!')
const { user } = await useIdbn(event, 'user!')
```

The `?` auth modes return nullable auth state when the cookie is missing or invalid. The `!` auth modes throw a 401 when required auth is missing or invalid.

The helper also keeps an internal request-scoped cache on `event.context`. Users do not need to write to `event.context`, create middleware, or augment `H3EventContext`.

This is useful when endpoint logic is split across route-local helpers:

```ts
import type { H3Event } from 'h3'

export default defineEventHandler(async (event) => {
  const payload = await readBody<{ a: boolean, b: boolean, c: boolean }>(event)

  if (payload.a)
    await doAsUserTaskA(event)

  if (payload.b)
    await doAsUserTaskB(event)

  if (payload.c)
    await doForUserTaskC(event)
})

async function doAsUserTaskA(event: H3Event) {
  const { userDb } = useIdbn(event, 'userDb!')
  // ...
}

async function doForUserTaskC(event: H3Event) {
  const { user } = await useIdbn(event, 'user!')
  // ...
}
```

Within the same request, repeated helper calls reuse the resolved app ID, auth cookie token, token-scoped `userDb`, guest DB, and `verifyToken` promise. The cache is tied to the H3 event, so the same token is verified again on the next HTTP request and cannot leak across users or requests.

## Where to see baseline + additive APIs together

- Queries: [Queries](./queries.md)
- Infinite queries: [Infinite queries](./infinite-queries.md)
- Rooms: [Realtime rooms and components](./realtime-rooms.md)
- API overview: [API reference](./api-reference.md)
