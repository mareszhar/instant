# X APIs (`refs + state`)

Audience: app developers who want the Vux additive ergonomics layer.

Vux keeps parity-friendly baseline APIs and adds `X` variants with a shared return pattern:

1. top-level refs for direct destructuring,
2. `refs` alias for explicit ref-forwarding,
3. `state` alias for auto-unwrapped reactive value access.

## Available X APIs

- `db.useQueryX`
- `db.useInfiniteQueryX`
- `db.useAuthX`
- `db.rooms.usePresenceX`
- `db.rooms.useTypingIndicatorX`

## Common shape

```ts
const queryX = db.useQueryX({ todos: {} })

queryX.todos.value
queryX.refs.todos.value
queryX.state.todos
```

All three paths above read from the same reactive source.

## Why this exists

- `refs` is useful when forwarding values from composables:

```ts
function useTodos() {
  const todosX = db.useQueryX({ todos: {} })
  return { ...todosX.refs }
}
```

- `state` is useful in script logic when you want less `.value` noise:

```ts
const authX = db.useAuthX()
const { state: auth } = authX

if (!auth.isLoading && auth.user) {
  console.log(auth.user.email)
}
```

## Baseline + X side-by-side

- Queries: see [Queries](./queries.md)
- Infinite queries: see [Infinite queries](./infinite-queries.md)
- Rooms: see [Realtime rooms and components](./realtime-rooms.md)

Baseline hooks remain the official-compatible reference path.
`X` hooks are additive ergonomics, not replacements.
