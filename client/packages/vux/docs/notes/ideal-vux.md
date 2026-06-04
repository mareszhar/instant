updated: 2026-06-03
status: draft — living document, decisions get promoted to spec as they are settled

# The Ideal idb-vux

A proposal for what `@mszr/idb-vux` should be. Written without constraint from the current implementation — decisions made here become the spec the implementation must satisfy.

---

## 1. What Is Vux?

`@mszr/idb-vux` is the ergonomics-first Vue and Nuxt SDK for InstantDB. It exists because the official SDK is a solid behavioral foundation but is not designed around Vue's idioms — Pinia, Composition API, SSR with Nuxt, the `.value` tax, or the full server-side story that Nuxt apps expect.

Vux makes all of that feel first-class: client query ergonomics, server data ergonomics, auth sync, realtime rooms, permissions authoring — one coherent SDK that feels like it was designed for you, not ported to you.

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

Match all optimizations the official SDK implements. If core uses `weakHash` for query deduplication, so do we. If there is a smarter diffing approach in the reactor, we should use it. SSR resilience guards must not add meaningful overhead on the client path. Performance is not an afterthought — it should be verified by benchmarking against the official SDK on representative workloads.

---

## 3. What This Looks Like in Practice

Before going into architecture, here is what the ideal Vux feels like in use. This is the API we want to love writing.

### Setup

```ts
// @mszr/idb-vux — the same as official, plus defineDb for runtime config
import { defineDb } from '@mszr/idb-vux'
import schema from '~/config/instant.schema'

export const useIdb = defineDb({
  schema,
  getAppId: () => useRuntimeConfig().public.instantAppId,
  firstPartyPath: '/api/idb',
})
```

Vs. official Vue — same `init()` config, no difference for the static case.

### Queries — the biggest ergonomic improvement

```ts
// Official Vue SDK
const { isLoading, data, error } = db.useQuery({ todos: {} })
const todos = computed(() => data.value?.todos ?? []) // boilerplate ①
const firstTodo = computed(() => todos.value[0] ?? null) // boilerplate ②

// Vux X API
const { isLoading, error, todos } = db.useQueryX({ todos: {} })
// todos.value is always Todo[] — never undefined              ① eliminated
```

And when you want a single item:

```ts
// Vux X with limit: 'one' — TypeScript knows this returns singular
const { isLoading, error, workspace } = db.useQueryX({
  workspace: { $: { where: { inviteCode: code }, limit: 'one' } },
})
// workspace.value: Workspace | null                           ② eliminated
```

### Dynamic queries — factory syntax with full validation

```ts
// Official Vue — valid but no where-clause validation
const { data } = db.useQuery(() => {
  if (!userId)
    return null
  return { todos: { $: { where: { 'owner.id': userId, 'isDon': false } } } }
  //                                                   ↑ typo — no error
})

// Vux X — inline object gets same validation as q()
const { todos } = db.useQueryX(() => {
  if (!auth.user?.id)
    return null
  return {
    todos: { $: { where: { 'owner.id': auth.user.id, 'isDon': false } } }
    //                                                ↑ TypeScript error:
    //  QERR_WHERE_KEY_UNKNOWN: isDon is not a valid where key on todos.
  }
})
```

With `q` for factory-syntax ergonomics when reuse or named queries matter:

```ts
// shared/utils/idb.ts — works on client AND server (Nuxt 4 shared/ folder)
export const q = defineQuery<AppSchema>()

// In a composable — q provides schema-aware authoring + reuse
const query = q({
  workspaces: {
    $: { where: { 'memberships.user': auth.user?.id ?? $skip } },
    memberships: {},
  },
})
const { workspaces } = db.useQueryX(() => auth.user?.id ? query : null)
```

### Pinia stores — safe by design

```ts
// Official Vue — Pinia may try to write into SDK-owned state, causing proxy errors
export const useTasksStore = defineStore('tasks', () => {
  const { data } = db.useQuery({ tasks: {} })
  return { data } // ⚠️ Pinia may hydrate this
})

// Vux X — state is a raw getter projection, Pinia-safe by design
export const useTasksStore = defineStore('tasks', () => {
  const { state } = db.useQueryX({ tasks: {} })
  return { state } // ✅ Pinia does not hydrate SDK-owned state
})

// Reading in a component — no .value needed
const store = useTasksStore()
store.state.isLoading // boolean
store.state.tasks // Task[]
```

### Auth + query composition — the pattern that makes the X family click

```ts
export const useWorkspaces = defineStore('workspaces', () => {
  const { state: auth } = db.useAuthX()

  const { isLoading, error, workspaces } = db.useQueryX(() => {
    if (!auth.user?.id)
      return null
    return {
      workspaces: {
        $: { where: { 'memberships.user': auth.user.id } },
        memberships: {},
      },
    }
  })

  // When auth.user?.id changes, the query factory reruns automatically.
  // auth.user reads the underlying ref through the raw getter — it is tracked.

  return { auth, isLoading, error, workspaces }
})
```

### Server-side ergonomics — on par with the client

```ts
// Current — raw admin SDK, manual unwrapping
const result = await adminDb.query({ workspaces: { $: { where: { id } } } })
const workspace = result.data?.workspaces?.[0] // manual, untyped

// Vux admin ergonomics (planned, @mszr/idb-vux/server)
const { workspace } = await adminDb.queryX({
  workspace: { $: { where: { id }, limit: 'one' } },
})
// workspace: Workspace | null — same DX as client
```

In Nuxt server routes with auth-aware access:

```ts
export default defineEventHandler(async (event) => {
  const { adminDb, user } = await useIdbn(event, 'user?')

  const { workspaces } = await adminDb.queryX({
    workspaces: { $: { where: { 'memberships.user': user?.id ?? $skip } } },
  })
  // workspaces: Workspace[] — never undefined, fully typed
})
```

### lookup — typed at last

```ts
// Current — untyped, runtime-only, string is a guess
db.tx.memberships[id()].link({ workspace: lookup('inviteCode', inviteCode) })
//                                                ↑ is 'inviteCode' indexed? wrong namespace? who knows

// Vux lookupX — namespace-explicit, attribute-validated, value-typed
db.tx.memberships[id()].link({ workspace: db.lookupX('workspaces', 'inviteCode', inviteCode) })
//                                         ↑ 'workspaces' → EntityName<Schema>
//                                                          ↑ indexed attr of workspaces
//                                                                       ↑ must be string

// Namespace chain form — typed from the tx chain context
db.tx.profiles.lookup('email', 'eva@...').update({ name: 'Eva' })
// If db.tx is typed, .lookup here knows it's on the profiles namespace
```

### Permissions — schema-aware, refactorable, delightful

```ts
// Current — raw CEL strings, no validation, typo-prone
// Vux permissions builder (planned, @mszr/idb-vux/permissions)
import { definePermissions } from '@mszr/idb-vux/permissions'

export default {
  workspaces: {
    bind: ['isMember', 'auth.id in data.ref(\'memberships.user.id\')'],
    allow: {
      view: 'isMember',
      create: 'auth.id != null',
    },
  },
}
const p = definePermissions<AppSchema>()

export default p.rules({
  workspaces: p.entity({
    bind: {
      isMember: p.in(p.auth.id, p.data.ref('memberships.user.id')),
      //                              ↑ path-validated against schema
    },
    allow: {
      view: p.var('isMember'),
      create: p.neq(p.auth.id, p.null()),
      update: p.var('isMember'),
    },
  }),
})
// Output is still plain InstantRules<Schema> — no backend changes needed
```

---

## 4. Package Structure

### Recommendation

```
@mszr/idb-vux              Vue client SDK
@mszr/idb-vux/server       Framework-agnostic admin SDK ergonomics
@mszr/idb-vux/nuxt         H3/Nuxt auth sync, request-scoped server DB, future SSR hydration
@mszr/idb-vux/permissions  Typed CEL authoring
```

### Why `/server` and `/nuxt` as two separate subpaths

The admin SDK ergonomics (`queryX`, array normalization, typed `lookupX`, typed `transact`) are framework-agnostic. They depend only on `@instantdb/admin` and the schema. Anyone using H3, Express, or any other server can benefit from them.

The Nuxt-specific layer adds things that depend on the H3 event: `useRuntimeConfig(event)`, the `event.context` caching slot for request-scoped auth, `defineInstantAuthSyncHandler`, and eventually the SSR hydration Nuxt plugin. These belong in `/nuxt`, not `/server`.

The layering: `/nuxt` wraps `/server` and adds H3 specifics.

```ts
import { init } from '@instantdb/admin'
// @mszr/idb-vux/nuxt — wraps /server + H3 event context caching + auth sync
import { defineServerIdb } from '@mszr/idb-vux/nuxt'

// @mszr/idb-vux/server — framework-agnostic admin ergonomics
import { createAdminDb } from '@mszr/idb-vux/server'

const adminDb = createAdminDb({ init, appId, adminToken, schema })
const { workspaces } = await adminDb.queryX({ workspaces: {} })

export const useIdbn = defineServerIdb({ schema, getAppId, getAdminToken })
// Per request: useIdbn(event) returns an admin db with all /server ergonomics
// plus request-scoped auth caching
```

Since `@instantdb/admin` is a required dependency of `/server`, there is no more need for the `init` injection pattern — the subpath declares it as a peer dependency directly.

### `/nuxt` naming

The name `/nuxt` is correct: the H3 event integration, `useRuntimeConfig`, and future Nuxt plugin for SSR hydration are Nuxt-native primitives, not just H3 primitives. Renaming to `/server` would collide with the framework-agnostic subpath above and understate the Nuxt integration scope.

### `/permissions`

Schema-aware permission authoring belongs in its own subpath because:
- It has no runtime client behavior — it only helps you write `instant.perms.ts`
- It should not be bundled into client JS
- Its type machinery is heavy and should not slow down the main package's TS compilation

### What we do NOT do

- No `@mszr/idb-vux-admin` separate package — admin ergonomics are a subpath, not a package
- No re-export barrel from `@instantdb/vue` — we own our implementation
- No global singleton management — `defineDb` returns a factory, state is the app's concern

---

## 5. API Surface

### 5.1 Baseline APIs (parity layer)

Functionally identical to the official Vue SDK. A developer who knows the official SDK uses these without reading Vux docs. SSR resilience guards are present on all hooks; no other functional differences.

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
| `db.rooms.usePresence(room, opts?)` | same |
| `db.rooms.useSyncPresence(room, presence)` | same |
| `db.rooms.useTypingIndicator(room, inputName)` | `onKeydown` compatible |
| `db.rooms.useTopicEffect(room, topic, cb)` | same |
| `db.rooms.usePublishTopic(room, topic)` | same |
| `db.transact(...)` | same |
| `db.auth.*`, `db.storage.*`, `db.streams`, `db.tx` | same |
| `SignedIn`, `SignedOut` | same |
| `Cursors` | same + `className`, `style`, `renderCursor` additions |
| `tx`, `id`, `lookup`, `i`, `createInstantRouteHandler`, etc. | re-exported from core |

Intentional differences from official Vue:
- SSR resilience guards on all hooks (inert no-op state on server)
- Tighter TypeScript throughout (fewer `any`, narrower return types)
- Omission of deprecated type aliases (`InstantQuery`, `InstantQueryResult`, etc.)

### 5.2 X APIs (recommended path)

X APIs are the *recommended* way to use Vux. The baseline APIs exist for official-SDK compatibility and migration. New code should use X APIs.

Every X API returns:
1. **Top-level refs** — direct destructuring: `const { todos, isLoading, error } = db.useQueryX(...)`
2. **`.refs`** — named ref group for composable passthrough: `return { ...query.refs }`
3. **`.state`** — raw getter projection for `.value`-free script reads: `query.state.todos`

| API | Improvement over baseline |
|---|---|
| `db.useQueryX(query, opts?)` | Namespace arrays default to `[]`; inline query objects have full `q`-style validation; `limit: 'one'` returns singular |
| `db.useInfiniteQueryX(query, opts?)` | Same pattern for infinite queries |
| `db.queryOnceX(query, opts?)` | Typed + namespace array defaults; async |
| `db.useAuthX()` | `refs + state` ergonomics on auth |
| `db.useUserX(opts?)` | Same + strictness policy |
| `db.useConnectionStatusX()` | `refs + state` on connection status |
| `db.useLocalIdX(name)` | `refs + state` on local id |
| `db.rooms.usePresenceX(room, opts?)` | `refs + state` on presence |
| `db.rooms.useTypingIndicatorX(room, name)` | `refs + state` on typing indicator |

### 5.3 Authoring utilities

| Utility | Purpose |
|---|---|
| `defineQuery<Schema>()` | Returns a `q()` helper for schema-aware query authoring. Useful for factory syntax and named/reusable queries. Not needed for direct `useQueryX({})` calls — inline objects already have the same validation built in. |
| `defineDb(config)` | Memoized db factory for runtime-resolved app IDs (e.g. Nuxt runtimeConfig). Returns a `() => db` function. |
| `db.lookupX(namespace, field, value)` | Typed `lookup` — validates namespace, field (must be indexed), and value type. Replacement for untyped `lookup()` in link and transact contexts. |

### 5.4 Server utilities (`@mszr/idb-vux/server`)

| Utility | Purpose |
|---|---|
| `createAdminDb(config)` | Creates a typed admin DB instance with X ergonomics: `queryX`, `queryOnceX`, `transact`, `tx`, namespace array normalization, `limit: 'one'` support. |

### 5.5 Nuxt utilities (`@mszr/idb-vux/nuxt`)

| Utility | Purpose |
|---|---|
| `defineServerIdb(config)` | Wraps `createAdminDb` with H3 event context caching. Per-request call returns `adminDb`, `userDb?`, `user?`, etc. based on mode. |
| `defineInstantAuthSyncHandler(config)` | H3 handler for Instant's `firstPartyPath` auth sync. Writes/clears `refresh_token` cookie. |

---

## 6. Return Value Ergonomics

### 6.1 The X pattern

The X pattern solves a real problem: `.value` is noise in script logic, but refs are required for `watch` and composable passthrough. The X pattern serves both without duplication.

```ts
const query = db.useQueryX({ todos: {} })

// In script — no .value
const count = computed(() => query.state.todos.length)
if (!query.state.isLoading && query.state.todos.length === 0) {
  showEmpty()
}

// In a composable — ref passthrough
function useTodos() {
  return { ...db.useQueryX({ todos: {} }).refs }
}

// As a watch source — ref as source
watch(query.isLoading, (loading) => { /* ... */ })

// In a Pinia store — safe to return
return { ...query.refs, todoCount: computed(() => query.state.todos.length) }
```

### 6.2 Namespace array normalization

`useQueryX` always returns namespace arrays as `Entity[]`, never `undefined`. This is the single biggest ergonomic improvement over baseline `useQuery`.

```ts
// useQuery — always needs the ?? [] dance
const { data } = db.useQuery({ todos: {} })
const todos = computed(() => data.value?.todos ?? [])

// useQueryX — normalized by default
const { todos } = db.useQueryX({ todos: {} })
// todos.value: Todo[] — always an array
```

`queryOnceX` does the same for imperative reads:

```ts
const { todos } = await db.queryOnceX({ todos: {} })
// todos: Todo[] — always an array
```

### 6.3 Singular namespace returns — `limit: 'one'`

When a query is structurally defined to return at most one item, the return type should reflect that. `limit: 'one'` (a string literal, distinct from the numeric `limit: 1`) signals to the type system that this namespace returns `Entity | null`, not `Entity[]`.

```ts
// Before — you write this yourself, every time
const { data } = db.useQuery({ workspace: { $: { where: { inviteCode: code } } } })
const workspace = computed(() => data.value?.workspace?.[0] ?? null)

// After — the SDK handles it
const { workspace } = db.useQueryX({
  workspace: { $: { where: { inviteCode: code }, limit: 'one' } },
})
// workspace.value: Workspace | null
```

At runtime, `limit: 'one'` is transformed to `limit: 1` before being passed to core. The type-level change (`Entity | null` vs `Entity[]`) is purely a Vux concern.

This applies equally to `useInfiniteQueryX`, `queryOnceX`, and server-side `adminDb.queryX`.

### 6.4 Pinia safety

X `state` objects are `markRaw` plain objects with getter properties over the underlying refs. Pinia does not treat them as hydratable setup-store state. Writing to a `state` property fails at the property level (not just a TypeScript error). Vue effects track correctly through the getters because each getter reads an underlying reactive source.

No user configuration needed. Returning `query.state` from a Pinia setup store is safe and intentional.

---

## 7. Type Safety and Intellisense Goals

### 7.1 Query authoring validation

The following should be validated and surfaced as cursor-local errors:

**Namespace level:**
- Top-level query keys are limited to schema namespace names
- `QERR_QUERY_ROOT_KEY_UNKNOWN: foo is not a valid top-level namespace`

**Link traversal level (3-hop depth for strict validation):**
- Nested query keys are limited to defined link labels
- Depths beyond 3 accept any string (matching core behavior, avoiding TSC explosion)
- `QERR_QUERY_NESTED_KEY_UNKNOWN: foo is not a valid nested key on tasks`

**Where clause level:**
- Attribute keys: `id`, schema attributes of the target namespace, and linked dot-paths up to 3 hops
- `QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks`

**Where operator restrictions (based on official docs, not invented):**

| Operator | Restriction |
|---|---|
| `$gt`, `$lt`, `$gte`, `$lte` | Attribute must be indexed with a checked type |
| `$like` | Attribute must be an indexed string attribute |
| `$ilike` | Attribute must be an indexed string attribute |
| `$isNull` | Any attribute — no restriction (works on any field, whether it has a value or not) |
| `$in`, `$not`, `$ne` | Any attribute |

Note: the current `defineQuery.ts` has two bugs here:
1. `$isNull` is restricted to optional attributes — this is wrong per the docs
2. `$like` is restricted to string type but not indexed — the docs require indexed string for `$like`

**Order level:**
- Only direct attributes and `id` are valid order fields (docs: ordering does not support nested/linked attributes)
- Valid direction values: `'asc'` | `'desc'`
- `QERR_ORDER_FIELD_UNKNOWN: createdAt is not a valid order field on workspaces`

**Return type level:**
- Return types are inferred from the query shape and schema
- Namespaces default to `Entity[]` unless `limit: 'one'` is used, in which case `Entity | null`
- Linked namespaces included in the query resolve to the linked entity type

### 7.2 Suggestion depth

The default suggestion depth for where-clause dot-path keys and query link traversal is **3 hops**. Keys beyond 3 hops still type-check (accepted as any string) but do not receive focused IntelliSense suggestions — this avoids noise without sacrificing validity.

**Open question: should suggestion depth be configurable?**

```ts
const q = defineQuery<AppSchema>() // default: 3 hops
const q = defineQuery<AppSchema>({ depth: 2 }) // fewer suggestions, less noise
```

The default of 3 is right for most cases. Configurability is low priority — YAGNI unless a real need surfaces.

### 7.3 IntelliSense regression

IntelliSense is currently broken in `useQuery`, `useQueryX`, and related hooks — completions do not appear on inline query objects. The `defineQuery`/`q` path is unaffected: completions work correctly there. This is the known regression to diagnose and fix before anything else.

The root cause is unknown. The fix requires investigation using selenita intellisense tests to:
1. Identify exactly which cursor positions have lost completions
2. Write tests capturing the broken behavior
3. Fix and confirm restoration

Hypothesis: the inference chain from the query parameter type to the TypeScript Language Service's completion list is broken somewhere in `InstantVuxDatabase.ts` for inline objects — possibly a type complexity issue causing deferred inference that stops the LSP from generating completions. This is speculation; selenita will reveal the actual cause.

### 7.4 Typed `lookupX`

`lookup(field, value)` from core is untyped — any string, any value. Vux should provide `db.lookupX(namespace, field, value)` where:
- `namespace` is constrained to `EntityName<Schema>`
- `field` is constrained to indexed attributes of that namespace
- `value` is typed to match the attribute's value type

**Use case 1: lookup in transaction chain**

```ts
// Current — untyped, no validation
db.tx.profiles.lookup('email', 'eva@...').update({ name: 'Eva' })

// With lookupX — namespace explicit, field and value typed
db.tx.profiles[db.lookupX('$users', 'email', 'eva@...')].update({ name: 'Eva' })
```

**Use case 2: lookup as link target**

```ts
// Current — 'inviteCode' could be anything, no namespace context
db.tx.memberships[id()].link({ workspace: lookup('inviteCode', inviteCode) })

// With lookupX — the target namespace is explicit
db.tx.memberships[id()].link({
  workspace: db.lookupX('workspaces', 'inviteCode', inviteCode),
  //          ↑ EntityName   ↑ indexed attr of workspaces   ↑ string
})
```

**Use case 3: chained lookup (advanced)**

```ts
// Lookup in place of an ID in a link's link
db.tx.users.lookup('email', '...').link({
  posts: db.lookupX('posts', 'number', 15),
})
```

**Ergonomic gap acknowledgment:** In use case 2, the developer already typed `.link({ workspace: ... })` — TypeScript knows that `workspace` links to `workspaces`. Ideally, `lookupX` inside `.link()` would auto-constrain to the linked namespace without requiring you to specify `'workspaces'` again. This would require typed `.link()` chains (a `db.txX` or enhanced `db.tx`), which is achievable but a significant type engineering investment. Track as a follow-up.

The pragmatic immediate improvement: `db.lookupX(namespace, field, value)` makes lookups safe with an explicit namespace. It is additive — `lookup` still exists for cases where the untyped form is acceptable.

---

## 8. Permissions DX

### 8.1 The problem

Instant permissions are powerful, but day-to-day authoring is costly:
- Rules are raw CEL strings — typo-prone, no autocomplete, no refactoring support
- Dot-path refs (`data.ref('memberships.user.id')`) are stringly-typed
- Action-context usage (`data` vs `newData` vs `linkedData`) has no compile-time gating
- No IntelliSense anywhere in the rules file

### 8.2 API design comparison

Two viable approaches. Both should be illustrated.

**Approach A: Functional builder under `p`**

```ts
import { definePermissions } from '@mszr/idb-vux/permissions'

const p = definePermissions<AppSchema>()

export default p.rules({
  $default: p.entity({ allow: { $default: p.false() } }),

  workspaces: p.entity({
    bind: {
      isMember: p.in(p.auth.id, p.data.ref('memberships.user.id')),
      hasInviteCode: p.and(
        p.neq(p.ruleParam('inviteCode'), p.null()),
        p.eq(p.ruleParam('inviteCode'), p.data.field('inviteCode')),
      ),
    },
    allow: {
      view: p.or(p.var('isMember'), p.var('hasInviteCode')),
      create: p.neq(p.auth.id, p.null()),
      update: p.var('isMember'),
      delete: p.var('isMember'),
    },
  }),

  tasks: p.entity({
    allow: {
      view: p.var('isMember'),
      create: p.and(p.var('isMember'), p.neq(p.auth.id, p.null())),
      update: p.var('isMember'),
      delete: p.var('isMember'),
    },
  }),
})
```

Pros:
- Full type safety — all paths, operators, context values are typed
- Schema-aware — `p.data.ref('...')` validates the path against the schema
- Action-aware — using `p.newData` in a `view` rule is a type error
- Discoverable — `p.` completes to all valid helpers
- Refactorable — renaming a namespace updates the path reference in the type error
- Incremental — raw strings can be mixed in: `view: 'isMember'` is still valid

Cons:
- New DSL to learn — small, but different from CEL syntax
- The mental translation from CEL docs to `p.*` calls takes a moment at first

**Approach B: Tagged template literals**

```ts
import { definePermissions } from '@mszr/idb-vux/permissions'

const { cel, auth, data, ruleParam } = definePermissions<AppSchema>()

export default {
  workspaces: {
    allow: {
      view: cel`${auth.id} in ${data.ref('memberships.user.id')}`,
      create: cel`${auth.id} != null`,
    },
  },
}
```

Pros:
- Looks like CEL — lower learning curve for developers who already know CEL syntax
- Shorter for simple expressions

Cons:
- Interpolation semantics are hard to type-check rigorously — `${...}` contents can be anything
- Compound expressions (`and`, `or`, nesting) get awkward in template literals
- Error messages from the type system are harder to localize to the specific problem
- TypeScript template literal types can parse simple patterns but not arbitrary expressions — action-context gating would be impossible to implement correctly

**Recommendation: Approach A (functional builder).**

The builder DSL is small (two dozen helpers), regular (everything composes the same way), and fully type-safe. Approach B's template literal form looks familiar but cannot deliver the same depth of validation without substantially more complexity. The `p.` prefix keeps everything neatly scoped — no `$` prefix needed since there is no ambiguity with Vue's `$refs` or JavaScript reserved words at method call sites.

### 8.3 Helper naming — no `$` prefix

Since all helpers live under `p.*`, there is no ambiguity with anything. Clean names:

| Helper | CEL output |
|---|---|
| `p.and(a, b, ...)` | `a && b && ...` |
| `p.or(a, b, ...)` | `a \|\| b \|\| ...` |
| `p.not(a)` | `!a` |
| `p.eq(a, b)` | `a == b` |
| `p.neq(a, b)` | `a != b` |
| `p.gt(a, b)` | `a > b` |
| `p.in(item, list)` | `item in list` |
| `p.null()` | `null` |
| `p.false()` | `false` |
| `p.true()` | `true` |
| `p.var('name')` | `name` (bind alias) |
| `p.val('str')` | `'str'` |
| `p.auth.id` | `auth.id` |
| `p.auth.email` | `auth.email` |
| `p.auth.ref('path')` | `auth.ref('path')` |
| `p.data.field('attr')` | `data.field('attr')` |
| `p.data.ref('link.attr')` | `data.ref('link.attr')` |
| `p.newData.field('attr')` | `newData.field('attr')` |
| `p.linkedData(label).field('attr')` | `linkedData.field('attr')` |
| `p.ruleParam('name')` | `ruleParam('name')` |

`p.in` and `p.and` as method names are valid JavaScript — reserved words are only reserved as standalone identifiers, not as property names.

### 8.4 Subpath rationale

`@mszr/idb-vux/permissions` belongs in its own subpath:
- It has no client runtime behavior — it only helps you write `instant.perms.ts`
- Its type machinery is substantial and should not burden the main package's TS compilation
- It should not be bundled into client JS

The output type is still `InstantRules<Schema>` — no backend or deploy changes needed.

---

## 9. SSR Story

### Current state

`@mszr/idb-vux` is SSR-resilient: hooks don't crash, return safe inert state on server, activate on client. This is the floor.

`@mszr/idb-vux/nuxt` adds the auth-sync endpoint and request-scoped server DB access.

### Intentional cookie difference

Official `createInstantRouteHandler` stores the full user JSON in `instant_user_<appId>`. Vux's `defineInstantAuthSyncHandler` stores only the `refresh_token` in `instant_token_<appId>`. This is intentional: smaller cookie, less user data in cookies, cleaner semantics. `createInstantRouteHandler` remains re-exported from the main package for apps that need the official shape.

### Full SSR hydration (planned ceiling)

Full SSR hydration means: server runs queries → results are serialized into the HTML payload → client hydrates the query cache → UI renders immediately without loading states → transitions to live subscriptions.

This requires a Nuxt plugin that:
1. Collects server query results during server render
2. Serializes them as payload (Nuxt's `useNuxtData` or similar mechanism)
3. Hydrates the core reactor on client before subscriptions start

The current SSR resilience guards are compatible with this model — inert server state would be replaced by hydrated state without breaking existing usage. This is future work, but the architecture must not rule it out.

---

## 10. Testing Strategy

### The three-layer model

**Layer 1: Runtime behavior tests (Vitest, `.test.ts`)**

Test that hooks produce the right reactive output given simulated core events. Focus on:
- Reactive update flows: when core emits a new query result, refs/state update correctly
- Error propagation: errors from core surface in `error` ref
- SSR inert behavior: hooks return safe state and no-ops on server
- Server DB modes: auth cookie handling, caching, 401 behavior
- Auth sync handler: cookie write/clear logic

Not in behavior tests: type shapes, IntelliSense suggestions.

**Layer 2: Type validation tests (`.types.ts`, `tsc --noEmit`)**

Test that TypeScript types are correct:
- Valid usage compiles
- Invalid usage produces the expected error type (`@ts-expect-error` + error message)
- Return types match documented shapes
- Where filter validation produces correct localized error messages

**Layer 3: IntelliSense tests (selenita, `.intellisense.ts`)**

Test that the TypeScript Language Service generates the expected completions at specific cursor positions. This is the layer currently missing — the one that would have caught the regression.

Coverage targets:
- `q({ /* cursor */ })` → all schema namespace names
- `q({ todos: { /* cursor */ } })` → link label names
- `q({ todos: { $: { where: { /* cursor */ } } } })` → `id`, attribute names, linked dot-paths
- `q({ todos: { $: { where: { isDone: /* cursor */ } } } })` → `boolean`, `true`, `false`
- `db.useQueryX({ /* cursor */ })` → same as q completion
- `query.state./* cursor */` → namespace names, `isLoading`, `error`
- `p.data.ref('/* cursor */')` → schema link paths
- `db.lookupX('/* cursor */')` → namespace names

These tests should also verify that completions are not present where they shouldn't be (e.g. `q({ todos: { $: { where: { invalidOperator: ... } } } })` underlines `invalidOperator`, not the whole block).

**Parity tests**: verify that baseline Vux APIs behave identically to the official Vue SDK under the same scenarios. Import equivalent APIs from both, run the same reactive scenario, compare output.

### Fewer tests, higher confidence

The current ~37 test files contain redundancy, tests of implementation details, and some tests that test things we no longer care about. The goal is not a high count — it is high *confidence*. Confidence means tests that fail when real regressions happen, not tests that merely exercise combinations TypeScript already guarantees.

After the IntelliSense regression fix: audit the test suite and cut anything redundant or internal.

---

## 11. Open Questions

| # | Question | Lean |
|---|---|---|
| Q1 | `limit: 'one'` implementation: is the type complexity manageable in all usage patterns? | Spike it first — prototype, run selenita, decide |
| Q2 | Configurable suggestion depth in `defineQuery`? | No for now — default 3 is right |
| Q3 | Should the `$isNull` bug and `$like` indexed restriction be fixed before or after the IntelliSense regression? | After — low blast radius fixes, sequence them so they don't interfere with regression debugging |
| Q4 | Typed `.link()` chains (so `lookupX` inside `.link()` auto-constrains the namespace)? | Future — track as follow-up after `lookupX` lands |
| Q5 | Permissions builder: Phase 1 ship when? | After IntelliSense is fixed and the test suite is stable |

---

## 12. Tracking Decisions

| Question | Decision | Rationale | Date |
|---|---|---|---|
| Package structure | `@mszr/idb-vux` + `/server` + `/nuxt` + `/permissions` | `/server` = framework-agnostic admin ergonomics; `/nuxt` = H3/Nuxt-specific; clean layering | 2026-06-03 |
| X APIs as primary | Yes — X APIs are the recommended path; baseline exists for compatibility | DX goal; non-X APIs are migration aids | 2026-06-03 |
| Permissions approach | Functional builder under `p`, no `$` prefix | Full type safety, refactorable, action-context gating possible; `p.in` etc. are valid method names | 2026-06-03 |
| `limit: 'one'` | Keep in proposal; spike TypeScript feasibility before committing | Eliminates a genuine repeated boilerplate pattern | 2026-06-03 |
| `$isNull` restriction | Fix: remove the optional-attribute restriction; `$isNull` is valid on any attribute | Per official docs | 2026-06-03 |
| `$like` indexed restriction | Fix: require indexed string, not just string type | Per official docs | 2026-06-03 |
| Suggestion depth | 3 hops; not configurable for now | Matches stated goal; YAGNI on configurability | 2026-06-03 |
