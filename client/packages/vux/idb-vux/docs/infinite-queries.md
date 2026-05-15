# Infinite Queries

Audience: app developers building paged feeds and endless lists.

Infinite query support is shipped in Vux across both baseline and X APIs, with core-aligned pagination semantics.

Like regular queries, infinite queries come in two styles:

- **Regular API**: `useInfiniteQuery`
- **X API (recommended)**: `useInfiniteQueryX`

Both are compatible with `defineQuery`.

## Baseline (`useInfiniteQuery`)

```ts
const feed = db.useInfiniteQuery({
  todos: {
    $: {
      limit: 20,
      order: { createdAt: 'desc' },
    },
  },
})

if (feed.canLoadNextPage.value) {
  feed.loadNextPage()
}
```

## Recommended (`useInfiniteQueryX`)

```ts
const feedX = db.useInfiniteQueryX({
  todos: {
    $: {
      limit: 20,
      order: { createdAt: 'desc' },
    },
  },
})

const { todos, canLoadNextPage } = feedX

if (canLoadNextPage.value) {
  feedX.loadNextPage()
}
```

## With `defineQuery`

```ts
const q = defineQuery<Schema>()

const feedX = db.useInfiniteQueryX(q({
  todos: {
    $: {
      limit: 20,
      where: {
        status: selectedStatus.value,
      },
    },
  },
}))
```

## Behavior guarantees and caveats

- Exactly one top-level namespace is expected per infinite query.
- Query changes reset loaded pages.
- `keepPreviousData` is currently not supported in `useInfiniteQuery`/`useInfiniteQueryX`.
- `loadNextPage()` only acts when another page exists.
- SSR runtime is resilient/inert (safe execution, no server-side live subscription path yet).

## When to choose X

Use `useInfiniteQueryX` when you want cleaner component code and direct namespace refs.
Use baseline `useInfiniteQuery` when you prefer parity-shaped state handling.
