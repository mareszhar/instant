updated: 2026-06-11
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — `/vue`

The Vue client: `init`, `defineDb`, the enhanced db (hooks, rooms, typed tx, pass-throughs), and the components. dux's first first-class client — a thin, delightful overlay on the agnostic plane, SSR-resilient by default.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Data-plane contracts: [dux-spec-root.md](./dux-spec-root.md)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| V1 | The internal baseline: vendor, mark deltas, parity harness | 3 | ☐ not started |
| V2 | The overlay: hooks, result pattern, components, `defineDb` | 4 | ☐ not started |
| V3 | SSR hydration ceiling | 10 | ☐ gated on upstream |

Details: [§10 Phased implementation roadmap](#10-phased-implementation-roadmap).

- [1. Scope and surface](#1-scope-and-surface)
- [2. Setup — `init` and `defineDb`](#2-setup--init-and-definedb)
- [3. The result pattern](#3-the-result-pattern)
- [4. The data plane — `useQuery`, `useInfiniteQuery`, `queryOnce`](#4-the-data-plane--usequery-useinfinitequery-queryonce)
- [5. Auth, connection, identity](#5-auth-connection-identity)
- [6. Rooms](#6-rooms)
- [7. Writes, pass-throughs, components](#7-writes-pass-throughs-components)
- [8. SSR](#8-ssr)
- [9. The internal baseline](#9-the-internal-baseline)
- [10. Phased implementation roadmap](#10-phased-implementation-roadmap)

---

## 1. Scope and surface

The enhanced behavior is the only public surface. All hooks are SSR-resilient; all query-like and stateful hooks share the result pattern ([§3](#3-the-result-pattern)).

| API | Notes |
|---|---|
| `init(config)` | config typed as `IdbConfig` |
| `db.useQuery(query \| factory, opts?)` | `MaybeRefOrGetter` and factory inputs; full shaping + validation per the [root spec](./dux-spec-root.md) |
| `db.useInfiniteQuery(query, opts?)` | same data plane, paginated |
| `db.queryOnce(query, opts?)` | async one-shot, same shaping (the marker name — the bare `query` belongs to the server's primary read, [conventions §4](./dux-conventions.md#4-the-primary-read-rule)) |
| `db.useAuth()` | result pattern over `{ isLoading, user, error }` |
| `db.useUser(opts?)` | strictness-typed projection of the authenticated user |
| `db.useConnectionStatus()` / `db.useLocalId(name)` | result pattern; reactive inputs |
| `db.room(type, id)` / `db.rooms.*` | reactive inputs; presence/typing hooks share the result pattern |
| `db.transact(...)` / `db.tx` | `tx` is **typed**: schema-typed `ruleParams`, dot-path `.link` ([root spec §5](./dux-spec-root.md#5-typed-tx)) |
| `db.auth.*` / `db.storage.*` / `db.streams` | **considered pass-throughs**: official verbs kept verbatim — already precise — with exported types renamed (`IdbAuth*`, `IdbStorage*`, `IdbStream*`) |
| `SignedIn`, `SignedOut`, `Cursors` | components ([§7.3](#73-components)) |
| `id`, `lookup`, `createInstantRouteHandler` | re-exports keep their official names |

Deprecated official type aliases are not re-exported.

---

## 2. Setup — `init` and `defineDb`

### The contract

`init(config)` builds the db eagerly, for apps whose config is available at module load. But app IDs often resolve at runtime (framework runtime config, environment indirection) — that pattern deserves first-class support instead of a hand-rolled lazy-init-and-memoize dance in every app:

```ts
import { defineDb } from '@mszr/idb-dux/vue'

export const useDb = defineDb({
  schema,
  getAppId: () => useRuntimeConfig().public.instantAppId,
  firstPartyPath: '/api/idb',
})
```

- `defineDb` returns a factory: first call resolves config and creates the db; subsequent calls return the same instance. No framework-wide singleton — global state is the app's responsibility.
- Schema-level `options` (singularization behavior) are read from the schema — never configured twice.
- `IdbConfig` passes through everything core supports, including `devtool` and `apiURI`/`websocketURI` (self-hosting) — supported, not specialized.

---

## 3. The result pattern

### The contract

Reactive results must serve three reading styles without ceremony, all views over the same underlying reactive source:

- **top-level refs** for destructuring and watch sources,
- **`.refs`** for composable passthrough,
- **`.state`** for `.value`-free script reads.

```ts
// state is most useful as a renamed scope:
const { state: auth } = db.useAuth()
const userLabel = computed(() => auth.user?.email ?? 'guest') // no .value

// refs for composable passthrough:
function useTodos() {
  const { todos, isLoading, error } = db.useQuery({ todos: {} })
  return { todos, isLoading, error } // refs; components auto-unwrap them
}

// or explicitly via .refs:
function useTodosSpread() {
  return { ...db.useQuery({ todos: {} }).refs }
}

// top-level refs as watch sources:
const { isLoading } = db.useQuery({ todos: {} })
watch(isLoading, loading => console.log('loading:', loading))
```

`state` is not useful as a direct accessor (`state.todos` and `todos.value` are equivalent); its value is as a remapped scope name — `const { state: auth } = db.useAuth()` reads as `auth.user`, `auth.isLoading` throughout a store or composable.

The shapes are typed `Idb<Domain>Result` with `-Data`/`-State`/`-Refs` subparts (`IdbQueryResult`, `IdbAuthResult`, `IdbRoomPresenceResult`, …) — learn one, know all ([conventions §3](./dux-conventions.md#3-the-result-pattern)).

### Pinia safety

`state` objects are `markRaw` plain objects with getter properties over the underlying refs. Pinia does not treat them as hydratable; writing to a `state` property fails at the property level; Vue effects track correctly through the getters because each getter reads a reactive source. No user configuration needed.

```ts
export const useIdb = defineStore('idb', () => {
  const db = useDb()
  const { state: auth } = db.useAuth()
  // auth is a raw getter projection — Pinia won't try to hydrate it.
  return { db, auth }
})
```

---

## 4. The data plane — `useQuery`, `useInfiniteQuery`, `queryOnce`

### The contract

Query results arrive ready to use — destructure top-level scopes directly, no unwrapping:

```ts
const { workspace, todos } = db.useQuery({
  workspaces: { $: { where: { id: workspaceId }, $only } }, // Ref<Workspace | undefined>
  todos: {}, // Ref<Todo[]>
})
// no additional massaging anywhere
```

All shaping (`$only`/`$at`/`$as`/`$m`, array normalization, singularization) and all authoring validation follow the [root spec](./dux-spec-root.md) — defined once, identical here and on the admin surface.

**Reactive inputs.** Queries accept plain objects, `MaybeRefOrGetter`s, and factories. A factory returning `null` pauses the subscription — combined with `$skip` for dropping individual clauses, conditional data flows read top-to-bottom:

```ts
export const useTasks = defineStore('tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()

  const { isLoading, error, tasks } = db.useQuery(() => {
    if (!auth.user?.id)
      return null // paused — inert result until signed in
    return q({ tasks: { $: { where: { workspace: workspaces.current?.id ?? $skip } } } })
  })

  const create = (title: string) =>
    db.transact(db.tx.tasks[id()].create({ title, isDone: false })
      .link({ workspace: workspaces.current!.id }))

  return { isLoading, error, tasks, create }
})
```

`useInfiniteQuery` carries the same data plane into pagination. `queryOnce` is the imperative one-shot with identical shaping (`const { todos } = await db.queryOnce({ todos: {} })` — plain shaped data, no refs).

Per-call options (`IdbQueryOptions`) carry schema-typed `ruleParams`.

---

## 5. Auth, connection, identity

- **`useAuth()`** — the result pattern over `{ isLoading, user, error }`; `user` is `IdbAuthUser | undefined`.
- **`useUser(opts?)`** — the user-centric projection. Contract: in views that exist behind an auth gate, the user should be typed *present* without repeated narrowing. Proposal: `useUser({ requireUser: true })` types `user` as `IdbAuthUser` and treats rendering without one as a development-time error; the default leaves it optional.
- **`useConnectionStatus()`** — result pattern over `IdbConnectionStatus`.
- **`useLocalId(name)`** — reactive input, result pattern.

---

## 6. Rooms

`db.room(type, id)` accepts reactive inputs (a room that follows a selected workspace re-binds automatically). The room hooks — `usePresence`, `useSyncPresence`, `useTypingIndicator`, `useTopicEffect`, `usePublishTopic` — keep their official names and semantics; the stateful ones (`usePresence`, `useTypingIndicator`) return the result pattern.

Room shapes are schema-typed from the `rooms` block in `defineSchema` ([root spec §2](./dux-spec-root.md#2-schema)); type extractors are `IdbRooms`, `IdbRoomPresence<'room'>`, `IdbRoomTopics<'room'>`.

---

## 7. Writes, pass-throughs, components

### 7.1 Writes

`db.transact(...)` matches official semantics. `db.tx` is the typed chain from the root spec — the client and admin share one tx machinery.

### 7.2 Pass-throughs

`db.auth.*` (sign-in flows), `db.storage.*`, and `db.streams` are considered pass-throughs: the official verbs are precise, so they're kept verbatim; their exported types are renamed per the naming contract (`IdbAuthUser`, `IdbStorageFileOpts`, `IdbStream*`).

### 7.3 Components

`SignedIn`, `SignedOut`, `Cursors` — official names kept. They ship as `.ts` render-function components rather than `.vue` SFCs (a marked build delta against the official package): the library then needs no SFC compile step, stays dual-format friendly, and the components remain plain TypeScript that the boundary lint can see.

### 7.4 Errors

The `IdbError` family is the one branded value-name exception ([conventions §2](./dux-conventions.md#2-values-vs-types)): `e instanceof IdbError` must read branded next to other libraries' errors.

---

## 8. SSR

### The floor (shipped behavior)

Hooks never crash on server: they return safe inert state on the server and activate full subscriptions on the client, with zero configuration. The floor is non-negotiable (principle 6) and applies to every hook in this spec. Resilience guards must not add meaningful overhead on the client path (principle 8).

### The ceiling (deferred by decision)

Full hydration — server runs queries → results serialized into the HTML payload → client hydrates the cache → renders without a loading flash → live subscriptions take over. Upstream's only full-SSR surface (`@instantdb/react` `./nextjs`) is **experimental**; dux adopts the ceiling when Instant marks SSR support stable, and not before.

The floor is forward-compatible with the ceiling by construction: inert server state simply gets replaced by hydrated state, so no hook API redesign will be needed. No decision in this spec may close that door.

---

## 9. The internal baseline

`/vue` is the one surface built on the **vendor-and-mark** tier ([dux-vision.md §5](./dux-vision.md#5-how-dux-stays-alive)): a near-verbatim copy of `@instantdb/vue` lives in `vue/baseline/`, and the public hooks are built *on top of it by composition* — `useQuery` calls baseline `useQuery` and reshapes through the pure `shapeResult()`; it never forks the baseline's internals.

- **Permitted deltas, exhaustively:** (1) SSR-resilience guards, (2) tighter types / dropped deprecated aliases, (3) overlay wiring. Every delta is fenced:

  ```ts
  // DUX-DELTA(ssr): inert guard so the hook doesn't crash on server.
  if (!isClient())
    return inertQueryState()
  // END DUX-DELTA
  ```

- **`baseline/UPSTREAM.md`** records the vendored-from commit so the drift check has a base ([dux-spec-workspace.md](./dux-spec-workspace.md)).
- **The baseline is never exported.** Exposing it would force a second `db` instance (methods bind to how `init` built them) and a permanent two-surface API. It exists as the parity-test anchor and the upstream-porting surface, nothing more.
- **The parity harness** replays canonical scenarios against both the official `@instantdb/vue` devDependency and the baseline, asserting identical reactive output — "additive, never divergent" as a failing test instead of a promise.

### Implementation approach (proposal)

```
src/vue/
  baseline/          # near-verbatim mirror of @instantdb/vue (deltas fenced)
    UPSTREAM.md      # vendored-from commit stamp
    InstantDuxDatabase.ts
    InstantDuxRoom.ts
    useInfiniteQuery.ts
    components/      # SignedIn/SignedOut/Cursors as .ts render fns (marked build delta)
  overlay/           # all dux ergonomics, BY COMPOSITION over the baseline
    useQuery.ts  useAuth.ts  useUser.ts  ...
    rooms/
    result.ts        # the refs+state primitive (markRaw getter projection)
    defineDb.ts      # memoized lazy-init factory
  index.ts           # assembles + exports the enhanced db
```

---

## 10. Phased implementation roadmap

### Phase V1 — the internal baseline (global phase 3)

Done when: parity harness green against official `@instantdb/vue`; drift check wired.

- [ ] vendor `@instantdb/vue` sources into `vue/baseline/` (db class, room class, `useInfiniteQuery`, components)
- [ ] apply + fence the SSR-resilience deltas (`DUX-DELTA(ssr)`)
- [ ] apply + fence type-tightening deltas (drop deprecated aliases)
- [ ] stamp `baseline/UPSTREAM.md` with the vendored commit
- [ ] wire `scripts/check-baseline-drift.mjs` ([workspace spec](./dux-spec-workspace.md))
- [ ] parity harness: canonical scenarios replayed against official db + baseline, identical reactive output
- [ ] parity dx: selenita `queryGroup` asserting baseline completions match official

### Phase V2 — the overlay (global phase 4)

Done when: overlay dx + type + runtime suites green; every hook SSR-floor-verified; Pinia safety locked.

- [ ] `result.ts` — the refs/state/`.refs` primitive (markRaw getter projection)
- [ ] `useQuery` composing baseline + `shapeResult`; `MaybeRefOrGetter` + factory inputs; `null` pause
- [ ] `queryOnce`, `useInfiniteQuery` on the same shaping
- [ ] `useAuth`, `useUser` (strictness typing), `useConnectionStatus`, `useLocalId`
- [ ] rooms: reactive `db.room`/`db.rooms`, presence/typing/topic hooks with the result pattern
- [ ] typed `db.tx` wiring (machinery from root R3) + `transact`
- [ ] pass-throughs: `db.auth.*`, `db.storage.*`, `db.streams` with renamed types
- [ ] components: `SignedIn`, `SignedOut`, `Cursors` as `.ts` render fns
- [ ] `defineDb` (memoized lazy-init; reads schema `options`) + `IdbConfig` (incl. `devtool`, `apiURI`)
- [ ] SSR floor: inert-state tests for every hook
- [ ] Pinia safety: hydration-skip + write-protection + reactivity-tracking tests
- [ ] `.dx.test.ts` per hook (the gating discipline) + `.test-d.ts` result shapes

### Phase V3 — SSR hydration ceiling (global phase 10)

**Gated: starts only when Instant marks SSR support stable.**

- [ ] hydration design: serialize server query results → hydrate client cache before subscriptions start
- [ ] no-loading-flash verification in the demo
- [ ] floor behavior preserved when hydration is absent
