# Queries

Audience: app developers building data-heavy Vue UIs.

This SDK supports two complementary query styles:

- **Regular API** (`useQuery`): parity-friendly and familiar.
- **X API** (`useQueryX`): ergonomic-first and recommended for most Vue apps.
- **One-off reads**: `queryOnce` (parity) and `queryOnceX` (ergonomic).

Both styles can share the same `defineQuery` authoring helper.

If you are standardizing on the Vux additive ergonomics surface, see [DX/UX enhancements](./dx-ux-enhancements.md) for shared X-pattern behavior and other Vux-only utilities.

## Baseline (`useQuery`)

```ts
const query = db.useQuery({
  quests: {
    assignee: {},
    $: {
      where: {
        status: selectedStatus.value,
      },
    },
  },
})

const quests = computed(() => query.data.value?.quests ?? [])
```

## Authoring helper (`defineQuery`)

`defineQuery` improves IntelliSense and type validation without changing runtime shape.

```ts
import { defineQuery } from '@mszr/idb-vux'

const q = defineQuery<Schema>()

const questsQuery = q({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.id': activeUserId.value,
      },
    },
  },
})

const query = db.useQuery(questsQuery)
```

## One-off reads (`queryOnceX`)

For imperative reads (for example before a mutation), `queryOnceX` gives you the same typed authoring shape as `useQueryX` with namespace defaults (`[]`) on the returned payload.

```ts
const result = await db.queryOnceX({
  quests: {
    assignee: {},
    $: {
      where: {
        status: selectedStatus.value,
      },
      limit: 10,
    },
  },
})

const quests = result.quests // always an array
```

Notes:

- `queryOnceX` accepts the same authoring input as `defineQuery`/`useQueryX`.
- `queryOnce` remains available when you prefer parity-shaped responses only.

## Recommended (`useQueryX`)

`useQueryX` keeps the same subscription semantics as `useQuery`, but exposes ref-friendly namespaces and state access.

```ts
const { isLoading, quests } = db.useQueryX({
  quests: {
    assignee: {},
    $: {
      where: {
        'assignee.id': activeUserId.value,
      },
    },
  },
})

const firstTitle = computed(() => quests.value[0]?.title)
```

## Smooth transitions with `keepPreviousData`

When query inputs change (for example, filter tabs), you can keep the previous
result visible while the new query loads:

```ts
const query = db.useQueryX(() => ({
  quests: {
    $: {
      where: {
        status: selectedStatus.value,
      },
    },
  },
}), {
  keepPreviousData: true,
})
```

Notes:

- `keepPreviousData` is passed as the **second argument** options object.
- Supported in `useQuery` and `useQueryX`.
- Useful for reducing list flicker during filter/query-key changes.
- If the next query already has cached data, cached data is used immediately.
- If the query resolves to `null`, the query is skipped (normal skip behavior).

## Without X vs with X

### Without X

- you manually map `state.data` to local computed values
- more repetitive null-safe extraction in components

### With X

- top-level namespace refs are exposed directly
- `state` and `refs` aliases support both object-style and ref-style consumption
- less ceremony in store and component code

## Practical guidance

- Prefer `useQueryX` for day-to-day feature work.
- Keep `useQuery` when you want the most direct parity-style shape.
- Use `defineQuery` in both paths when you want stronger authoring feedback.
- Use `keepPreviousData` in `useQuery`/`useQueryX` when continuity matters during query changes.
