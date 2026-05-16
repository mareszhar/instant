# Getting Started

Audience: app developers using `@mszr/idb-vux`.

## Install

```bash
pnpm add @mszr/idb-vux
```

## Initialize

```ts
import { init } from '@mszr/idb-vux'

export const db = init({
  appId: import.meta.env.VITE_INSTANT_APP_ID,
})
```

## Optional: reusable `useDb` helper

```ts
import { defineDb } from '@mszr/idb-vux'
import schema from './instant.schema'

export const useDb = defineDb({
  schema,
  firstPartyPath: '/api/instant',
  getAppId: () => import.meta.env.VITE_INSTANT_APP_ID,
})
```

`missingAppId` defaults to `'throw'`. To allow `null` instead:

```ts
const useDb = defineDb({
  schema,
  getAppId: () => import.meta.env.VITE_INSTANT_APP_ID,
  missingAppId: null,
  requireUserInUseUser: 'clientOnly', // default: 'clientOnly' | 'yes' | 'no'
})
```

## First query

```ts
const todos = db.useQuery({
  todos: {},
})
```

## First transaction

```ts
import { id } from '@mszr/idb-vux'

db.transact(
  db.tx.todos[id()]!.update({
    text: 'Hello Instant + Vux',
    done: false,
  }),
)
```

## Recommended next steps

1. Read [Queries](./queries.md) for `defineQuery` and `useQueryX` workflows.
2. Read [Infinite queries](./infinite-queries.md) for paged feeds.
3. Read [X APIs (`refs + state`)](./x-apis.md) for the shared additive ergonomics pattern.
4. Read [Realtime rooms](./realtime-rooms.md) for presence/topics/typing/cursors.
5. Read [Nuxt and SSR resilience](./nuxt-ssr-resilience.md) if you run with SSR.
