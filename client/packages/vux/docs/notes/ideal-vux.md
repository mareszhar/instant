updated: 2026-06-04
status: draft — living document, decisions get promoted to spec as they are settled

# The Ideal idb-vux

A proposal for what `@mszr/idb-vux` should be. Written without constraint from the current implementation — decisions made here become the spec the implementation must satisfy.

---

## 1. What Is Vux?

`@mszr/idb-vux` is the DX-first Vue and Nuxt SDK for InstantDB.

The official SDK is a competent starting point. It is built around the Composition API and returns reactive refs — it is not an alien port from another framework. But it stops there. Vux is what the official SDK would be if the primary goal were developer delight: zero unnecessary ceremony, the deepest practical IntelliSense, data shaped to be used instead of massaged, and a full server-side story for Nuxt apps. Many of those improvements are not even Vue-specific — no official IDB SDK offers schema-aware where-filter validation or automatically normalized namespace arrays. Vux just happens to be built by a Vue developer, for a Vue developer.

Some improvements are Vue-specific: SSR resilience guards so hooks don't crash on server, and reactive output shapes designed to compose with Pinia stores without footguns.

**Relationship with the official SDK:**

- Vux's baseline APIs are *behaviorally identical* to `@instantdb/vue`. A developer can swap one for the other on regular APIs without changing behavior.
- Every Vux enhancement is *additional surface*, never replacement behavior. Additive APIs are explicitly named (X suffix, `define*` utilities) so the boundary is always visible.
- Vux reimplements the baseline rather than re-exporting it. This is necessary for SSR resilience guards, tighter TypeScript, and deep integration with the X ergonomics layer.

The official Vue SDK is the behavior parity target. The React/Next SDK is the capability target (SSR hydration, streaming). Vux should eventually match or exceed both — on Vue and Nuxt's terms.

**Primary user**: this SDK is built first for its maintainer. It is opinionated, deliberate, and optimized for delight — not for the widest possible API surface or the most conservative design choices.

---

## 2. Design Principles

When requirements conflict, earlier principles take precedence.

### 1. Delightful

The question "what would feel most delightful to use?" drives every design decision. Delightful means the API disappears — you think about your problem, not the library. What feels natural? What feels like friction? What makes someone say "oh, that's so much nicer"? When there are multiple valid solutions, choose the one that fits the mental model of someone reading and writing the code, not the one that was technically simpler to implement.

Empathy is part of delight. Design for the moment of use, not just the moment of implementation.

### 2. Boilerplate is an active harm

Every repetitive pattern in userland that the SDK could eliminate is a failure to deliver. Empty array normalization, manual `?? null` massaging, `data.value?.namespace` unwrapping — these accumulate. The SDK should eliminate ceremony, not just reduce it. If you find yourself writing the same shape of code twice, that's a signal.

### 3. Errors at the cursor, not the console

The type system is the primary safety layer. Valid TypeScript should mean valid usage. When something is wrong, the error should appear *on the specific offending piece* — the invalid attribute name, the wrong operator, the missing namespace — with an actionable message that says what's wrong and what to do instead.

Not a red underline over the whole call. The specific field. The specific operator. A message you could act on without opening the docs.

### 4. Self-documenting

Reading the SDK implementation without prior context should make intent clear. Names match mental models. Structure reflects intent. Types are as narrow as they can be without becoming hard to use. `any` is a last resort, not a convenience. Comments explain *why*, not *what* — the code explains the what.

This applies equally to the API surface: an API whose name, shape, and types tell you what it does without needing to look it up is better than one that requires a mental glossary.

### 5. Predictable contracts

Learning one X API teaches you all of them. One reactive pattern, applied everywhere. One ergonomic shape for all query-like results. If you understand `useQueryX`, you understand `useAuthX`. No API should surprise you if you already know another one.

### 6. SSR-resilient floor, SSR-hydrated ceiling

Hooks must not crash on server. That is the floor, non-negotiable. Safe inert state on server, full subscription on client, no configuration required.

Full SSR query hydration — server data → serialized → client hydrated without a loading flash — is the ceiling. Not yet implemented, but the architecture must leave the door open. No decisions that would require hooks to be redesigned to support it.

### 7. Additive, never divergent

Vux is a strict superset of the official Vue SDK for baseline APIs. At any time, it should be possible to diff Vux baseline behavior against the official SDK and find no functional differences, only additions. This keeps the feature parity audit alive and useful, and ensures that rebasing against upstream changes stays manageable.

### 8. Performance parity

Match all optimizations the official SDK implements. If core uses `weakHash` for query deduplication, so does Vux. SSR resilience guards must not add meaningful overhead on the client path. Performance is not an afterthought.

---

## 3. What This Looks Like in Practice

Before architecture, here is what the ideal Vux feels like to write. This is the API we want to love using.

### Setup

```ts
// Official Vue SDK — app-id must be available at module load time,
// or requires manual lazy-init boilerplate:
import { init } from '@instantdb/vue'

let db: ReturnType<typeof init<typeof schema>>

export function useDb() {
  if (!db) {
    const appId = useRuntimeConfig().public.instantAppId
    if (!appId)
      throw new Error('missing app id')
    db = init({ appId, schema, firstPartyPath: '/api/idb' })
  }
  return db
}
```

```ts
// Vux — defineDb handles the lazy-init + memoization pattern
import { defineDb } from '@mszr/idb-vux'

export const useDb = defineDb({
  schema,
  getAppId: () => useRuntimeConfig().public.instantAppId,
  firstPartyPath: '/api/idb',
})
```

### Queries — the biggest ergonomic improvement

```ts
// Official Vue SDK — query objects are validated (namespaces + basic structure), but you get data that typically needs ceremony before use
const { data } = db.useQuery({
  workspaces: {
    $: { where: { id: workspaceId } },
  }, // Workspace[] | undefined
  todos: {} // Todo[] | undefined
})

const workspace = computed(() => data.value?.workspaces?.[0]) // Workspace | undefined
const todos = computed(() => data.value?.todos ?? []) // Todo[]
```

```ts
// Vux X — normalization and full validation built into the inline object, top-level namespaces are directly destructurable
const { workspaces: workspace, todos } = db.useQuery({
  workspaces: {
    $: { where: { id: workspaceId }, pick: 'first' },
  }, // Workspace | undefined
  todos: {} // Todo[]
})

// no need for any additional massaging!
```

Vux also exports `$first` and `$last` as `true` constants. Because they share names with the `$:` object keys they enable, they work as JavaScript property shorthands: `$: { $first }` expands to `$: { $first: true }` and is equivalent to `$: { pick: 'first' }`. This mirrors the `$skip` pattern (`where: { isDone: activeView ?? $skip }`).

```ts
// Official Vue - validates where-clauses, but with many limitations
const query = db.useQuery({
  todos: {
    $: {
      where: {
        isDone: { $ilike: '%true%' }, // no linter warning even though ilike only works on indexed strings
        title: false, // warns, but message is "Type 'false' is not assignable to type 'undefined'."
      },
    },
  },
})
```

```ts
// Vux - smarter validation with clearer error messages

const query = db.useQueryX({
  todos: {
    $: {
      where: {
        isDone: { $ilike: '%true%' }, // error: Operator $ilike is only available for indexed string attributes.
        title: false, // error: Type 'boolean' is not assignable to attribute `title` of type string
      },
    },
  },
})
```

### Dynamic queries — factory syntax with structural validation

```ts
// Official Vue — no intellisense at all in factory syntax. validation and inference still work, but errors underline the call site, not the trigger line

const dynamicQuery = db.useQuery(() => {
  if (!userId)
    return null

  // no schema-aware nor query-construction intellisense available in factory syntax
  return {
    todos: {
      $: { where: { isDone: 'lol' } },
      // a mistake here flags the entire useQuery call
    },
  }
})
```

```ts
// Vux - use `q` for full deep validation and errors localized to the specific offending code. works with any query (can bring better intellisense to the regular apis and dynamic queries)

const q = defineQuery<AppSchema>() // done once, shared across the codebase.

// can help share one query among multiple callers
function query(isDone?: boolean) {
  return q({
    // schema-aware and query-construction intellisense available here
    todos: {
      $: { where: { isDone } }
      // a mistake here would flag only the offending bit of code
    }
  })
}

const callerOne = db.useQuery(query(false))
const callerTwo = db.useQuery(query(true))

// can also be used to bring vux-quality intellisense/validation to the regular apis

const regularQuery = db.useQuery(q({
  // vux-quality intellisense and validation here
}))

// or to the factory syntax

const dynamicQuery = db.useQueryX(() => {
  if (!userId)
    return null
  return q({ /* intellisense and contextual validation here! */ })
})

// x apis get q-like intellisense and validation automatically in the regular object syntax

const xQuery = db.useQueryX({ /* q-like intellisense and validation here */})
```

**Research finding:** TypeScript CAN validate factory return types with a two-overload approach, and invalid factories do produce errors that name the offending field. However, in factory syntax the error surfaces at the call site (as a "no overload matches" detail), not on the specific field. For fully localized in-context errors inside factories, wrapping in `q()` is the right path. Without `q()`, factory syntax still gets namespace and link-label validation — which is already better than the official SDK.

### Pinia stores — where `state` shines

```ts
// A Pinia store that exposes auth safely:
export const useIdb = defineStore('idb', () => {
  const db = useDb()
  const { state: auth } = db.useAuthX()
  // auth is a raw getter projection — Pinia won't try to hydrate it.
  // It reads as auth.user, auth.isLoading, auth.error — no .value anywhere.
  return { db, auth }
})

// Consuming store in another store — auth.user is read directly, no .value
export const useTasks = defineStore('tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()

  const { isLoading, error, tasks } = db.useQueryX(() => {
    if (!auth.user?.id)
      return null // auth.user, not auth.user.value ← state value
    return q({ tasks: { $: { where: { workspace: workspaces.current?.id ?? $skip } } } })
  })

  const create = (title: string) =>
    db.transact(db.tx.tasks[id()].create({ title, isDone: false })
      .link({ workspace: workspaces.current!.id }))

  return { isLoading, error, tasks, create }
})
```

`state` is most useful as a renamed scope — `const { state: auth } = db.useAuthX()` — so you read `auth.user`, `auth.isLoading`, `auth.error` throughout the store/composable without `.value`. It is not a general replacement for refs; for individual ref access or composable passthrough, use the top-level refs or `.refs`.

### Server-side — the same DX, on the server

```ts
// @mszr/idb-vux/admin — our wrapper around @instantdb/admin
import { init } from '@mszr/idb-vux/admin'

// In a Nuxt server route — defineServerIdb gives you the ergonomic layer
const { adminDb, user } = await useIdbn(event, 'user?')

// adminDb.queryX: same X ergonomics as the client
const { workspaces } = await adminDb.queryX(q({
  workspaces: {
    $: { where: { 'memberships.user': user?.id ?? $skip } },
    memberships: {},
  },
}))
// workspaces: Workspace[] — never undefined

const { workspace } = await adminDb.queryX(q({
  workspace: { $: { where: { id: workspaceId }, $first } },
}))
// workspace: Workspace | undefined
```

### `lookup` — typed at last

```ts
// Current — untyped, any string is accepted
db.tx.memberships[id()].link({ workspace: lookup('inviteCode', inviteCode) })
//                                         ↑ is inviteCode an attr of workspaces? unique? right type?

// Vux — defineLookup pattern (same design as defineQuery)
// shared/utils/idb.ts
export const lu = defineLookup<AppSchema>()

// Primary use: loose form inside .link() — namespace + attr validated, value typed
db.tx.memberships[id()].link({ workspace: lu('workspaces', 'inviteCode', inviteCode) })
//                                                ↑ namespace ✓   ↑ unique attr ✓   ↑ typed ✓

// Chain form — official SDK already handles this well; lu adds nothing here:
db.tx.$users.lookup('email', 'eva@...').update({ name: 'Eva' })
```

### Permissions — safe, schema-aware, still readable

```ts
// Current — raw CEL strings, no validation, typos silently wrong
// Vux permissions builder — fluent expressions, schema-validated paths

import { definePerms } from '@mszr/idb-vux/perms'

const p = definePerms<AppSchema>()

export default p.rules({
  workspaces: p.entity({
    bind: {
      isMember: p.auth.id.in(p.data.ref('memberships.user.id')),
      //             reads as: "auth.id in data.ref(...)"
      hasInviteCode: p.ruleParam('inviteCode').neq(null).and(p.ruleParam('inviteCode').eq(p.data.field('inviteCode'))),
    },
    allow: {
      view: p.var('isMember').or(p.var('hasInviteCode')),
      create: p.auth.id.neq(null),
      update: p.var('isMember'),
      delete: p.var('isMember'),
    },
  }),
})
// Output is still plain InstantRules<Schema> — no backend changes needed
```

---

## 4. Package Structure

```
@mszr/idb-vux              Vue client SDK
@mszr/idb-vux/admin        Admin SDK ergonomics (framework-agnostic)
@mszr/idb-vux/nuxt         H3/Nuxt: auth sync, request-scoped server DB, future SSR hydration
@mszr/idb-vux/perms        Typed CEL authoring
```

### Why `/admin` and `/nuxt` are separate

Admin SDK ergonomics (`queryX`, array normalization, `pick: 'first' | 'last'`, `$first | $last` shorthands, typed `lookup`) don't depend on H3 or Nuxt. They work in any server context — Express, Nitro, plain Node. These go in `/admin`.

The Nuxt-specific layer adds things that depend on H3 event context: request-scoped auth caching on `event.context`, and eventually the SSR hydration plugin. These go in `/nuxt`.

The current `/nuxt` utilities (`defineServerIdb`, `defineInstantAuthSyncHandler`) accept user-provided resolvers — `getAppId: event => ...`, `getAdminToken: event => ...` — and store auth cache on `event.context`. They do not call `useRuntimeConfig` internally; that is the user's choice in their resolver functions. The H3 dependency is `event.context` caching and `H3Event` typing. This design correctly belongs in `/nuxt`, not `/admin`.

`/nuxt` wraps `/admin`: `defineServerIdb` internally uses the admin ergonomics layer from `/admin` and adds H3-specific caching on top.

### Entry points

```ts
// Client
import { defineDb, defineQuery, init, /* ... */ } from '@mszr/idb-vux'

// Admin (wraps @instantdb/admin with X ergonomics — init is our typed init)
import { init } from '@mszr/idb-vux/admin'

// Nuxt — wraps /admin with H3 event context
import { defineInstantAuthSyncHandler, defineServerIdb } from '@mszr/idb-vux/nuxt'

// Permissions — no runtime behavior, just types + CEL string emitter
import { definePerms } from '@mszr/idb-vux/perms'

const adminDb = init({ appId, adminToken, schema })
const { workspaces } = await adminDb.queryX({ workspaces: {} })
```

`@instantdb/admin` is declared as a peer dependency of `/admin`. No more `init` injection workaround — the subpath owns its dependency.

### What we do NOT do

- No separate `@mszr/idb-vux-admin` package — admin ergonomics are a subpath
- No re-export barrel from `@instantdb/vue` — we own our implementation
- No framework-wide singletons — `defineDb` returns a factory; global state is the app's responsibility

---

## 5. API Surface

### 5.1 Baseline APIs (parity layer)

Functionally identical to the official Vue SDK. SSR resilience guards are present on all hooks; no other functional differences.

| API | Notes |
|---|---|
| `init(config)` | same config shape as official |
| `db.useQuery(query, opts?)` | accepts `MaybeRefOrGetter` inputs |
| `db.useInfiniteQuery(query, opts?)` | same |
| `db.queryOnce(query, opts?)` | same |
| `db.useAuth()` | destructurable `{ isLoading, user, error }` refs |
| `db.useUser(opts?)` | `requireUser` strictness policy |
| `db.useConnectionStatus()` | same |
| `db.useLocalId(name)` | reactive name input |
| `db.room(type, id)` | reactive inputs, store-friendly raw handle |
| `db.rooms.*` | `usePresence`, `useSyncPresence`, `useTypingIndicator`, `useTopicEffect`, `usePublishTopic` |
| `db.transact(...)`, `db.auth.*`, `db.storage.*`, `db.streams`, `db.tx` | same |
| `SignedIn`, `SignedOut`, `Cursors` | same + Vux additions on `Cursors` |
| `tx`, `id`, `lookup`, `i`, `createInstantRouteHandler`, etc. | re-exported from core |

Intentional differences from official Vue:
- SSR resilience guards on all hooks
- Tighter TypeScript (fewer `any`, narrower return types)
- Omission of deprecated type aliases (`InstantQuery`, `InstantQueryResult`, etc.)

### 5.2 X APIs (recommended path)

X APIs are the recommended way to use Vux. The baseline APIs exist for official-SDK compatibility. New code should default to X APIs.

Every X API returns: top-level refs for destructuring, `.refs` for composable passthrough, `.state` for `.value`-free script reads. All three access the same underlying reactive source.

| API | Improvement over baseline |
|---|---|
| `db.useQueryX(query, opts?)` | Namespace arrays default to `[]`; `pick: 'first' \| 'last'` returns `Entity \| undefined`; inline objects get full schema-aware validation |
| `db.useInfiniteQueryX(query, opts?)` | Same pattern for paginated queries |
| `db.queryOnceX(query, opts?)` | Typed + namespace array defaults; async |
| `db.useAuthX()` | `refs + state` ergonomics |
| `db.useUserX(opts?)` | Same + strictness policy |
| `db.useConnectionStatusX()` | `refs + state` on status |
| `db.useLocalIdX(name)` | `refs + state` on local id |
| `db.rooms.usePresenceX(room, opts?)` | `refs + state` on presence |
| `db.rooms.useTypingIndicatorX(room, name)` | `refs + state` on typing indicator |

### 5.3 Authoring utilities

| Utility | Purpose |
|---|---|
| `defineQuery<Schema>()` | Returns a `q()` helper for schema-aware query authoring. Inline `useQueryX({})` objects have equivalent validation built in — `q` is most valuable in factory syntax `useQueryX(() => q(...))` and for named/reusable queries. `q` is schema-scoped (not db-scoped) and works identically on client and server. |
| `defineLookup<Schema>()` | Returns a typed lookup function `lu`. `lu('workspaces', 'inviteCode', value)` validates that `'inviteCode'` is a unique attribute of `workspaces` and that `value` matches its type. Same design pattern as `defineQuery`. |
| `defineDb(config)` | Memoized db factory for runtime-resolved app IDs. Handles the lazy-init singleton pattern. |

### 5.4 Admin utilities (`@mszr/idb-vux/admin`)

```ts
import { init } from '@mszr/idb-vux/admin'

const adminDb = init({ appId, adminToken, schema })

// X ergonomics on top of the admin SDK's query method:
adminDb.query(query) // baseline — same as core admin (async, one-shot)
adminDb.queryX(query) // typed + array normalization + pick / $first / $last support
adminDb.transact(/* ... */) // same as core admin
adminDb.tx // same as core admin
```

### 5.5 Nuxt utilities (`@mszr/idb-vux/nuxt`)

| Utility | Purpose |
|---|---|
| `defineServerIdb(config)` | Wraps `/admin` with H3 event context caching. Per-request call returns `adminDb` (with X ergonomics), `userDb?`, `user?`, etc. based on mode. |
| `defineInstantAuthSyncHandler(config)` | H3 handler for Instant's `firstPartyPath` auth sync. Writes/clears `refresh_token` cookie. |

---

## 6. Return Value Ergonomics

### 6.1 The X pattern

The X pattern solves the `.value` problem without losing refs where they matter.

```ts
// state is most useful as a renamed scope:
const { state: auth } = db.useAuthX()

// Now auth.user, auth.isLoading, auth.error — clean reads anywhere in the store/composable
const create = () => executeFormAction(form, !auth.user?.id, async () => { /* ... */ })
const userLabel = computed(() => auth.user?.email ?? 'guest')

// refs for composable passthrough:
function useTodos() {
  const { todos, isLoading, error } = db.useQueryX({ todos: {} })
  return { todos, isLoading, error } // these are refs; components auto-unwrap them
}

// Or explicitly via .refs:
function useTodosX() {
  return { ...db.useQueryX({ todos: {} }).refs }
}

// top-level refs for watch sources:
const { isLoading } = db.useQueryX({ todos: {} })
watch(isLoading, loading => console.log('loading:', loading))
```

`state` is not useful as a direct accessor (`state.todos` vs `todos.value` are equivalent). Its value is as a remapped scope name: `const { state: user } = ...` and then `user.todos`, `user.isLoading` throughout — no `.value` anywhere in that scope.

### 6.2 Namespace array normalization

`useQueryX` delivers top-level namespaces as `Entity[]`, never `undefined`. Two important notes:

1. **Nested `has: 'one'` links are already singular.** IDB natively returns linked entities with `has: 'one'` cardinality as `Entity | undefined` (not an array). Vux preserves this — no additional config needed and no massaging applied to those nested shapes.
2. **`pick: 'first' | 'last'` returns `Entity | undefined`.** For top-level namespaces where you expect at most one result, use `pick` in the `$:` object (or the `$first`/`$last` shorthands) to get `Entity | undefined` instead of `Entity[]`. See §6.3.

```ts
// useQuery baseline — always needs the dance
const { data } = db.useQuery({ todos: {} })
const todos = computed(() => data.value?.todos ?? [])

// useQueryX — just use it
const { todos } = db.useQueryX({ todos: {} })
// todos.value: Todo[] — always an array, never undefined

// has: 'one' linked entities are already singular — IDB handles this, Vux preserves it
const { todos } = db.useQueryX({ todos: { assignee: {} } })
// todos.value[0].assignee: User | undefined — already singular, no pick needed
```

Same for imperative reads:

```ts
const { todos } = await db.queryOnceX({ todos: {} })
// todos: Todo[] — always
```

### 6.3 Resolving to a single entity — `pick`

Querying for a single entity is a common pattern with many causes: filtering by a unique attribute, filtering by `id`, using `limit: 1`, or a cursor position query with `first: 1` / `last: 1`. The ceremony of `data.value?.items?.[0] ?? null` should not be in userland.

`pick: 'first' | 'last'` in the `$:` object signals to the type system that this namespace returns `Entity | undefined`. At runtime, Vux normalizes the array — `pick: 'first'` returns the first element (or undefined), `pick: 'last'` returns the last (or undefined). The underlying query is passed to core unchanged.

```ts
// Without pick — the ceremony stays in userland
const { data } = db.useQuery({ workspaces: { $: { where: { inviteCode: code } } } })
const workspace = computed(() => data.value?.workspaces?.[0])

// With pick — the SDK handles it
const { workspaces: workspace } = db.useQueryX({
  workspaces: { $: { where: { inviteCode: code }, pick: 'first' } },
})
// workspace.value: Workspace | undefined

// Works for all single-entity cases — pick doesn't care why the result is singular:
const { todo } = db.useQueryX({ todo: { $: { where: { id: todoId }, pick: 'first' } } })
const { post } = db.useQueryX({ post: { $: { where: { slug: 'hello-world' }, pick: 'first' } } })
const { latest } = db.useQueryX({ latest: { $: { limit: 1, orderBy: { createdAt: 'desc' }, pick: 'first' } } })
```

**Shorthand exports:** `$first` and `$last` are exported `true` constants. Because they share names with the keys they enable, they work as JavaScript property shorthands in the `$:` object:

```ts
import { $first, $last } from '@mszr/idb-vux'

const { workspace } = db.useQueryX({
  workspace: { $: { where: { inviteCode: code }, $first } },
  // ↑ property shorthand: expands to { $first: true }, equivalent to pick: 'first'
})
```

The `$:` object supports three mutually exclusive singularity keys: `pick: 'first' | 'last'`, `$first?: boolean`, `$last?: boolean`. Setting `$first` or `$last` to `false` is a no-op — the exported constants are `true`, making `false` an unlikely accident in practice.

**Why not auto-infer singularity?** Several query shapes guarantee at most one result: filtering by `id`, filtering by a `.unique()` attribute, `limit: 1`, `first: 1`, `last: 1`. TypeScript *could* infer singularity from these. The reason to prefer explicit `pick` over auto-inference:

- **Dynamic queries are stable.** If `limit` is a computed value, the return type would have to be `T[] | T | undefined` depending on the runtime value — useless for static type checking. Explicit `pick` decouples the singularity signal from the filter shape.
- **Explicit is clear.** `pick: 'first'` documents intent at the query site. Auto-inference would make the return type depend on subtle schema annotations the reader might not remember.

Auto-inference remains a future spike for the most common static cases (filtering by `id` or a unique attribute inline). Track in §11.

### 6.4 X-compatible type utilities

`InstaQLEntity<Schema, 'tasks'>` already returns a single entity type — not an array. It already correctly infers link cardinality: `has: 'one'` links become `Entity | undefined`, `has: 'many'` links become `Entity[]`. So `InstaQLEntity` already conforms well to the X shape for most cases:

```ts
// Works as-is for typing X query results
type Todo = InstaQLEntity<AppSchema, 'todos', { assignee: {} }>
// Todo is: { id, title, isDone, ..., assignee: User | undefined }

type Todos = Todo[] // matches todos.value from useQueryX

function expectTodos(todos: Todo[]) {}
const { todos } = db.useQueryX({ todos: { assignee: {} } })
expectTodos(todos.value) // ✓
```

The two gaps worth addressing with a Vux type utility:

**Gap 1 — Schema-bound binding.** Passing `AppSchema` at every call site is repetitive. A `DefineInstaQLEntity` pattern fixes this:

```ts
// Once, co-located with the schema
type IdbEntity = DefineInstaQLEntity<AppSchema>

// Everywhere else
type Todo = IdbEntity<'todos'>
type TodoWithAssignee = IdbEntity<'todos', { assignee: {} }>
```

**Gap 2 — Singularity coercion for `pick`.** When a query uses `$one` on a namespace, the result is `Entity | undefined`, not `Entity[]`. There's no built-in type utility for this. Planned syntax (TBD. Unlike queries, it doesn't matter if the entity picked is the first or last, we only care about coercing the array into a single entity):

```ts
type UserLastTodo = IdbEntity<'users', {
  todos: {
    $one // should coerce `todos` into Todo | undefined
    notes: {} // it should still be possible to nest other valid queries, inferred as Note[] like usual
  }
}>
```

The exact API shape is TBD. The goal: type definitions and runtime returns are derivable from the same schema + query shape without duplication.

### 6.5 Pinia safety

X `state` objects are `markRaw` plain objects with getter properties over underlying refs. Pinia does not treat them as hydratable. Writing to a `state` property fails at the property level. Vue effects track correctly through the getters because each getter reads an underlying reactive source. No user configuration needed.

---

## 7. Type Safety and IntelliSense Goals

### 7.1 Query authoring validation

**Namespace level:**
- Top-level query keys limited to schema namespace names
- `QERR_QUERY_ROOT_KEY_UNKNOWN: foo is not a valid top-level namespace`

**Link traversal level (3-hop strict validation):**
- Nested query keys limited to defined link labels up to 3 hops
- Beyond 3 hops: any string accepted (avoids TSC explosion, matches core behavior)
- `QERR_QUERY_NESTED_KEY_UNKNOWN: foo is not a valid nested key on tasks`

**Where clause level:**
- Attribute keys: `id`, schema attributes, and linked dot-paths up to 3 hops
- `QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks`

**Where operator restrictions (per official docs):**

| Operator | Requirement |
|---|---|
| `$gt`, `$lt`, `$gte`, `$lte` | Indexed attribute with checked type |
| `$like` | Indexed string attribute |
| `$ilike` | Indexed string attribute |
| `$isNull` | Any attribute — no restriction |
| `$in`, `$not`, `$ne` | Any attribute |

**Known bugs in current implementation to fix:**
1. `$isNull` is restricted to optional attributes (`AttrRequired extends false`) — wrong per docs; it works on any attribute
2. `$like` is restricted to string type but not indexed — docs require indexed string

**Order level:**
- Direct attributes and `id` only (docs: ordering does not support nested/linked attributes)
- Valid directions: `'asc'` | `'desc'`

### 7.2 Validation depth and scope

Default suggestion depth: **3 hops** for where dot-paths and link traversal in query nodes. Keys beyond 3 hops accept any string — no strict validation, no focused suggestions.

Not configurable for now (YAGNI).

### 7.3 Inline vs factory validation

**Inline query objects** passed directly to `useQueryX({...})` get full schema-aware validation with errors localized to the specific field — same quality as wrapping with `q()`. This is because TypeScript applies the parameter type as a contextual type to inline object literals.

**Factory syntax** `useQueryX(() => {...})` gets structural validation (valid namespace names, valid link labels, valid `$` structure). Deep where-clause validation — the part that catches `isDon` vs `isDone` — requires wrapping the factory's return value in `q({...})`. Without `q`, TypeScript can report errors but they surface at the call site level rather than on the specific field.

This is better than the official SDK (which reports errors at the call site even for inline objects), and wrapping factories in `q()` brings them to full parity.

**Research finding:** TypeScript's two-overload approach can flag invalid factory returns as errors (the specific incompatibility appears in the error detail), but the squiggly underlines the whole call rather than the specific field. Inline validation without `q()` is fully localized. This is the honest current state of what TypeScript can do.

### 7.4 IntelliSense regression

IntelliSense is currently broken in `useQuery`, `useQueryX`, and related hooks — completions do not appear on inline query objects. The `defineQuery`/`q` path is unaffected: completions work correctly there. This regression must be diagnosed and fixed before anything else.

The approach: write selenita intellisense tests to identify exactly which cursor positions are broken, fix the regression, then lock the behavior so it cannot regress again.

### 7.5 `defineLookup<Schema>()` — typed lookups

The official `lookup()` free function is completely untyped (`lookup(attribute: string, value: any)`). `defineLookup` fills that gap specifically for the **loose form** — `.link()` contexts where lookup is passed as a free function value.

```ts
// shared/utils/idb.ts
export const lu = defineLookup<AppSchema>()

// Without lu — no validation whatsoever
db.tx.memberships[id()].link({ workspace: lookup('inviteCode', inviteCode) })
//                                         ↑ any string, any value

// With lu — namespace explicit, attr validated as unique, value typed
db.tx.memberships[id()].link({ workspace: lu('workspaces', 'inviteCode', inviteCode) })
//                                                ↑ namespace name ✓
//                                                              ↑ unique attr of workspaces ✓
//                                                                         ↑ must match attr type ✓
```

Note: the official SDK's typed tx chain (`.lookup()` on `db.tx`) already validates unique attrs and value types in chain position — `db.tx.$users.lookup('email', value)` is already fully typed. `lu` adds nothing there. Its value is exclusively in the loose form.

**Future direction — `db.txX`:**

`lu('workspaces', 'inviteCode', ...)` still requires naming `'workspaces'` even though `.link({ workspace: ... })` implies it from the schema. The long-term goal is a typed tx chain where `.link()` accepts dot-path keys directly:

```ts
// Long-term: db.txX — link() validates namespace + unique attr in one
db.txX.memberships[id()].link({
  'workspace.inviteCode': inviteCode,
  // ↑ 'workspace' → 'workspaces' per schema; 'inviteCode' validated as unique attr; value typed
})
```

Track as the `txX` future milestone.

---

## 8. Permissions DX

### 8.1 The problem

Instant permissions are powerful, but day-to-day authoring is:
- Raw CEL strings — no autocompletion, no refactoring support, typos silently wrong
- Dot-path refs (`data.ref('memberships.user.id')`) are stringly-typed
- Context availability (`newData` in a `view` rule) has no compile-time gating

### 8.2 The fluent expression API

Rather than purely functional (`p.in(a, b)`) or template literal forms, the permissions API should use **fluent expressions** — method chains where the left operand is the subject:

```ts
p.auth.id.in(p.data.ref('memberships.user.id'))
// reads: "auth.id in data.ref(...)"

p.auth.id.neq(null)
// reads: "auth.id not equal to null" — raw JS values accepted directly

p.ruleParam('inviteCode').eq(p.data.field('inviteCode'))
// reads: "ruleParam('inviteCode') equals data.field('inviteCode')"
```

For multi-operand logical combinations, both chained (binary) and free-function (n-ary) forms:

```ts
// Chain — reads left to right
p.var('isMember').or(p.var('hasInviteCode'))
p.ruleParam('code').neq(null).and(p.ruleParam('code').eq(p.data.field('inviteCode')))

// Free function — for 3+ operands or complex nesting
p.and(p.var('a'), p.var('b'), p.var('c'))
p.or(p.var('x'), p.var('y'), p.var('z'))
```

### 8.3 API comparison

**Approach A: Purely functional (not recommended)**

```ts
workspaces: p.entity({
  bind: {
    isMember: p.in(p.auth.id, p.data.ref('memberships.user.id')),
    hasInviteCode: p.and(
      p.neq(p.ruleParam('inviteCode'), null),
      p.eq(p.ruleParam('inviteCode'), p.data.field('inviteCode')),
    ),
  },
  allow: {
    view: p.or(p.var('isMember'), p.var('hasInviteCode')),
    create: p.neq(p.auth.id, null),
  },
})
```

Reads inside-out — outer operation named first, operands come later. Hard to parse in complex expressions.

**Approach B: Fluent (recommended)**

```ts
workspaces: p.entity({
  bind: {
    isMember: p.auth.id.in(p.data.ref('memberships.user.id')),
    hasInviteCode: p.ruleParam('inviteCode').neq(null).and(p.ruleParam('inviteCode').eq(p.data.field('inviteCode'))),
  },
  allow: {
    view: p.var('isMember').or(p.var('hasInviteCode')),
    create: p.auth.id.neq(null),
  },
})
```

Reads left to right, subject-first. Familiar to anyone who has used query builders or assertion libraries. Type-safe: `.in()` is only available on list-compatible expression nodes. For n-ary logical grouping, free-function forms:

```ts
hasAccess: p.and(
  p.auth.id.neq(null),
  p.var('isMember').or(p.var('hasInviteCode')),
  p.data.field('isActive').eq(true),
)
```

**Approach C: Tagged template literals (escape hatch only)**

```ts
view: cel`${p.auth.id} in ${p.data.ref('memberships.user.id')}`
```

TypeScript template literal types can't validate interpolated expressions or gate context availability. Ruled out for the core API; could be offered as an unvalidated escape hatch.

### 8.4 Helper reference

No `$` prefix — everything is cleanly scoped under `p`. Methods on expressions are valid JavaScript property names even for reserved words (`p.auth.id.in(...)` is valid syntax).

**Context values (return typed expression nodes):**

| Expression | CEL equivalent |
|---|---|
| `p.auth.id` | `auth.id` |
| `p.auth.email` | `auth.email` |
| `p.auth.ref('path')` | `auth.ref('path')` |
| `p.data.field('attr')` | `data.field('attr')` |
| `p.data.ref('link.attr')` | `data.ref('link.attr')` |
| `p.newData.field('attr')` | `newData.field('attr')` |
| `p.linkedData.id` | `linkedData.id` |
| `p.linkedData.field('attr')` | `linkedData.attr` |
| `p.ruleParam('name')` | `ruleParams.name` |
| `p.var('name')` | `name` (bind alias) |

Methods accept raw JS values (`null`, `true`, `false`, strings, numbers) directly — no wrapper expressions needed. For standalone `allow` rules that are always true or always false, pass the raw string `'true'` or `'false'` which IDB already accepts.

**Methods on expression nodes:**

| Method | CEL equivalent |
|---|---|
| `.eq(b)` | `a == b` |
| `.neq(b)` | `a != b` |
| `.gt(b)` / `.lt(b)` / `.gte(b)` / `.lte(b)` | `a > b` etc. |
| `.in(list)` | `a in list` |
| `.and(b)` | `a && b` |
| `.or(b)` | `a \|\| b` |

**Free functions for logical composition:**

| Function | CEL equivalent |
|---|---|
| `p.and(a, b, ...)` | `a && b && ...` |
| `p.or(a, b, ...)` | `a \|\| b \|\| ...` |
| `p.not(a)` | `!a` |

### 8.5 Type safety scope and honest Phase 1 limitations

**Phase 1 — what's validated:**
- Logical operators are typed: `.in()` only on list-compatible subjects, `.and()`/`.or()` only on boolean expressions
- `p.var('name')` is validated against declared bind keys
- The overall shape (`p.rules`, `p.entity`, `bind`/`allow`/`link`/`unlink` keys) is structurally typed

**Phase 1 — what is NOT validated:**
- `p.data.ref('...')` paths — unvalidated strings, same as raw CEL today
- `p.linkedData.field('...')` attribute names — unvalidated strings
- Action-context gating (`p.newData` in a `view` rule should be a TS error — not enforced in Phase 1)

**Why ref path validation is hard:** `p` is a global builder with no entity context. For `p.data.ref('memberships.user.id')` inside `workspaces` to validate the path against the workspaces schema, TypeScript needs to know the call site is inside `workspaces`. That context doesn't flow through a global `p` object.

**Path to Phase 2 — callback form:**

```ts
// Phase 2 design: p.entity<'entity'>((ctx) => ...) provides entity-scoped context
workspaces: p.entity<'workspaces'>(ctx => ({
  bind: {
    isMember: ctx.auth.id.in(ctx.data.ref('memberships.user.id')),
    // ↑ ctx.data.ref() validates against 'workspaces' schema — suggests valid link paths
  },
  allow: {
    link: {
      user: ctx.linkedData('user').id.eq(ctx.auth.id),
      // ↑ ctx.linkedData('user') knows 'user' links to '$users'; .field() suggests $users attrs
    }
  }
}))
```

**On CEL library ecosystem:** existing TypeScript CEL packages ([`@marcbachmann/cel-js`](https://www.npmjs.com/package/@marcbachmann/cel-js), [`libcel-ts`](https://github.com/libdbm/libcel-ts/)) are *evaluators* — they run CEL against runtime data. None are CEL *builders* generating typed CEL strings from TypeScript DSLs. The `definePerms` builder is novel and built from scratch.

### 8.6 Subpath rationale

`@mszr/idb-vux/perms` belongs in its own subpath: no client runtime behavior (only helps author `instant.perms.ts`), should not be bundled into client JS, and its type machinery is substantial enough that it should not slow the main package's TS compilation.

Output type remains `InstantRules<Schema>` — no backend or deploy changes needed.

---

## 9. SSR Story

### Current state

`@mszr/idb-vux` is SSR-resilient: hooks don't crash, return safe inert state on server, activate on client.

`@mszr/idb-vux/nuxt` adds auth-sync and request-scoped server DB access.

### Intentional cookie difference

Official `createInstantRouteHandler` stores full user JSON in `instant_user_<appId>`. Vux's `defineInstantAuthSyncHandler` stores only the `refresh_token` in `instant_token_<appId>`. This is intentional: smaller cookie, less user data. `createInstantRouteHandler` remains re-exported for apps that need the official shape.

### Full SSR hydration (planned ceiling)

Full hydration: server runs queries → results serialized into HTML → client hydrates query cache → renders immediately without loading flash → transitions to live subscriptions.

Requires a Nuxt plugin that collects server query results and feeds them into the core reactor on client before subscriptions start. The current SSR resilience guards are compatible with this — inert server state would be replaced by hydrated state. This is future work; the architecture must not rule it out.

---

## 10. Testing Strategy

Three distinct layers, each testing a different property.

**Layer 1: Runtime behavior tests (Vitest, `.test.ts`)**

- Reactive update flows: core event → correct ref/state output
- Error propagation, SSR inert behavior, server DB modes, auth sync cookie logic

**Layer 2: Type validation tests (`.types.ts`, `tsc --noEmit`)**

- Valid usage compiles; invalid usage produces the expected `ValidationError<...>` type
- Return type shapes match documentation
- `@ts-expect-error` with expected error message substrings

**Layer 3: IntelliSense tests (selenita, `.intellisense.ts`)**

- Completions appear at specific cursor positions with specific entries
- Inline `useQueryX({/* cursor */})` → namespace names
- `q({ todos: { $: { where: { /* cursor */ } } } })` → attribute names, dot-paths
- `p.auth.id./* cursor */` → `.eq`, `.neq`, `.in`, `.and`, `.or`
- `lu('/* cursor */')` → namespace name completions; second arg narrows to unique attrs
- This layer is currently missing and would have caught the regression

**Parity tests** (could be behavior or type): verify that baseline Vux APIs produce identical reactive output to the official Vue SDK under the same scenarios.

**Fewer tests, higher confidence.** The goal is tests that fail when real regressions happen, not a high count. After the IntelliSense regression fix, audit and trim the current ~37 files: delete redundant tests, delete tests of implementation details, consolidate by concern.

---

## 11. Open Questions

| # | Question | Current lean |
|---|---|---|
| Q1 | Auto-infer singularity from static patterns (`where: { id: ... }`, unique-field filter) without explicit `pick`? | Future spike; `pick` / `$first` / `$last` lands first — dynamic queries make full auto-inference impractical |
| Q2 | `IdbEntity` (schema-bound `InstaQLEntity`) — exact API shape, especially for singularity coercion? | TBD; likely `IdbEntity<'ns', { nested: { $one } }>` for `pick` scenarios |
| Q3 | Typed tx chain (`db.txX`) — `.link({ 'namespace.attr': value })` dot-path form? | Future milestone; `defineLookup` ships first |
| Q4 | Does the official chain `.lookup()` also suggest only unique attributes in real IDE completions (not just type-check)? | Needs IDE verification — if yes, custom chain `.lookupX` is unneeded |
| Q5 | Permissions Phase 2 — callback form `p.entity<'ns'>((ctx) => ...)` for ref path + linkedData validation? | After Phase 1 ships |
| Q6 | SSR query hydration Nuxt plugin? | After core SDK is stable |

---

## 12. Tracking Decisions

| Question | Decision | Rationale | Date |
|---|---|---|---|
| Package structure | `@mszr/idb-vux` + `/admin` + `/nuxt` + `/perms` | `/admin` = framework-agnostic admin ergonomics; `/nuxt` = H3/Nuxt-specific layer wrapping `/admin`; `/perms` replaces `/permissions` for brevity | 2026-06-04 |
| X APIs as primary | Yes — X APIs are the recommended path; baseline exists for compatibility and migration | DX goal | 2026-06-04 |
| Single-entity normalization | `pick: 'first' \| 'last'` in `$:` object; `$first`/`$last` boolean shorthand exports — not `limit: 'one'` | One explicit mechanism covers all single-entity cases; avoids unstable types from dynamic limit values | 2026-06-04 |
| Permissions naming | `definePerms` (not `definePermissions`), subpath `/perms` | Cleaner and consistent with the file name (`instant.perms.ts`) | 2026-06-04 |
| Permissions API | Fluent expressions (method chains on expression nodes) with free-function n-ary logical ops; no `$` prefix needed under `p` | Reads left-to-right naturally; type-safe method availability by expression type | 2026-06-04 |
| `$isNull` restriction | Fix: any attribute, not just optional | Per official docs | 2026-06-04 |
| `$like` restriction | Fix: require indexed string, not just string | Per official docs | 2026-06-04 |
| `defineLookup` primary use case | Loose form (`.link()` context) — the official chain `.lookup()` already validates unique attrs + value types | Official chain form confirmed typed via `ETypeChunk` in instatx.ts | 2026-06-04 |
| `defineLookup` syntax | Generic function form: `lu('workspaces', 'attr', value)` | generic function form is simpler to implement and handles dynamic namespaces | 2026-06-04 |
| Typed tx chain | Future milestone (`db.txX`); `defineLookup` ships first | Non-trivial tx reimplementation; current `lu` covers the primary use case | 2026-06-04 |
| `p.null()` / `p.true()` / `p.false()` | Removed — methods accept raw JS values directly; standalone allow rules use raw `'true'`/`'false'` strings | Cleaner API; no wrapping needed for scalars | 2026-06-04 |
| `InstaQLEntity` correctness | Already returns a single entity and correctly infers link cardinality — no `InstaQLEntityX` needed; Vux adds `DefineInstaQLEntity` (schema-bound) and singularity coercion for `pick` | Confirmed from `queryTypes.ts` | 2026-06-04 |
| `definePerms` Phase 1 scope | Typed logical operators + `p.var()` bind validation; ref paths (`p.data.ref()`, `p.linkedData.field()`) are unvalidated strings in Phase 1 | Entity context not available in global `p`; callback form needed for Phase 2 | 2026-06-04 |
| Factory validation | Structural validation (namespace + link labels) without `q()`; deep where-clause validation requires `q()` in factory return | TypeScript limitation — confirmed via experiment | 2026-06-04 |
| Suggestion depth | 3 hops; not configurable for now | Matches stated goal; YAGNI on configurability | 2026-06-04 |
