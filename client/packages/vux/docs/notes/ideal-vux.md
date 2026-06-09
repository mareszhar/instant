updated: 2026-06-09
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
- Every Vux enhancement is *additional surface*, never replacement behavior. Additive APIs are explicitly named (X suffix, `define*X` utilities) so the boundary is always visible.
- Vux reimplements the baseline rather than re-exporting it. This is necessary for SSR resilience guards, tighter TypeScript, and deep integration with the X ergonomics layer.

The official Vue SDK is the behavior parity target. The React/Next SDK is the capability target (SSR hydration, streaming). Vux should eventually match or exceed both — on Vue and Nuxt's terms.

**Naming convention:** the `X` suffix marks all Vux-owned APIs, including those with no official counterpart. This provides forward collision-proofing — if IDB later ships a `defineSchema`, our `defineSchemaX` is unambiguous. The `X` means "Vux-owned, collision-proof."

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

### Schema definition

```ts
// Official IDB — terminology mismatch: docs say "namespace" but API uses "entity"
import { i } from '@instantdb/core'

const schema = i.schema({
  entities: {
    $users: i.entity({ email: i.string().unique().indexed().optional() }),
    workspaces: i.entity({ name: i.string(), inviteCode: i.string().unique().indexed() }),
  },
  links: { /* ... */ },
})
```

```ts
// Vux — terminology matches docs; singular name and ruleParams collocated with namespace
import { defineSchemaX, i } from '@mszr/idb-vux'

export const schema = defineSchemaX({
  namespaces: {
    $users: i.namespaceX({
      singular: 'user', // overrides default Singularize('$users') → '$user'
      attrs: {
        email: i.string().unique().indexed().optional(),
        name: i.string().indexed(),
      },
    }),
    workspaces: i.namespaceX({
      attrs: {
        name: i.string().indexed(),
        inviteCode: i.string().unique().indexed(),
        createdAt: i.date().indexed(),
      },
      ruleParams: { // collocated, namespace-specific, typed end-to-end
        inviteCode: i.string(),
      },
    }),
    memberships: i.namespaceX({
      attrs: { createdAt: i.date().indexed() },
      ruleParams: { inviteCode: i.string().optional() },
    }),
    tasks: i.namespaceX({
      attrs: {
        title: i.string().indexed(),
        isDone: i.boolean().indexed(),
        createdAt: i.date().indexed(),
      },
    }),
  },
  links: {
    membershipWorkspace: {
      forward: { on: 'memberships', has: 'one', label: 'workspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'memberships' },
    },
    membershipUser: {
      forward: { on: 'memberships', has: 'one', label: 'user' },
      reverse: { on: '$users', has: 'many', label: 'memberships' },
    },
    taskWorkspace: {
      forward: { on: 'tasks', has: 'one', label: 'workspace' },
      reverse: { on: 'workspaces', has: 'many', label: 'tasks' },
    },
    taskAssignee: {
      forward: { on: 'tasks', has: 'one', label: 'assignee' },
      reverse: { on: '$users', has: 'many', label: 'assignedTasks' },
    },
  },
  rooms: {
    workspace: {
      presence: i.namespaceX({ attrs: { name: i.string(), typing: i.boolean().optional() } }),
      topics: { reaction: i.namespaceX({ attrs: { emoji: i.string() } }) },
    },
  },
  options: {
    singularize: 'auto', // 'auto' | 'off' | 'explicit' — inherited by all Vux inits
  },
})

export type AppSchema = typeof schema
```

`defineSchemaX` output is structurally compatible with the IDB CLI and official SDK — it produces the same entity/link shape with Vux metadata stored non-enumerable. `i.namespaceX` is a drop-in replacement for `i.entity` that accepts `singular`, `attrs`, and `ruleParams`. The `singular` field is the source of truth for auto-singularization — no separate config in `defineDbX` or elsewhere.

Link labels also support an optional `singular` field for irregular English plurals:

```TS
// Most link labels singularize correctly by default:
// memberships → membership, tasks → task, assignedTodos → assignedTodo
// For irregular cases, declare singular on the label:
reportAnalyses: {
  forward: { on: 'reports', has: 'many', label: 'analyses', singular: 'analysis' },
  reverse: { on: 'analyses', has: 'one', label: 'report' },
},
```

**Namespace `singular` and link `singular` are independent** — they apply in different contexts:
- **Namespace `singular`** in `i.namespaceX()` — governs the output key when `$only`/`$at` is set on a top-level namespace
- **Link `singular`** on a link label — governs the output key when `$at` is applied to a nested link in `useQueryX`, or in type utilities (design under discussion)

A `$users` namespace with `singular: 'user'` and an `analyses` link label with `singular: 'analysis'` are completely independent — each applies in its own scope.

The `options` key in `defineSchemaX` holds schema-level behavioral config that all Vux inits inherit automatically — no need to repeat it on `defineDbX`, admin `init`, etc.:

- **`singularize: 'auto'`** (default) — use schema `singular` if declared, otherwise run the default English algorithm (with the typed Singularize<string> utility for inference that matches runtime behavior)
- **`singularize: 'explicit'`** — use schema `singular` if declared, otherwise leave the key as-is (no algorithm; `$as` required for unregistered plurals)
- **`singularize: 'off'`** — never singularize; `$only`/`$at` still coerce to `Entity | undefined` but the key stays as the original name; `$as` always required for a renamed key

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
// Vux — defineDbX handles the lazy-init + memoization pattern
import { defineDbX } from '@mszr/idb-vux'

export const useDb = defineDbX({
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
// Vux X — normalization and full validation built in; top-level namespaces are directly destructurable
const { workspace, todos } = db.useQueryX({
  workspaces: { $: { where: { id: workspaceId }, $only } }, // Workspace | undefined
  todos: {}, // Todo[]
})

// no need for any additional massaging!
```

Vux exports `$only` as a `true` constant. Because it shares its name with the `$:` key it enables, it works as a JavaScript property shorthand: `$: { $only }` expands to `$: { $only: true }`. This mirrors the `$skip` pattern. When `$only` or `$at` is set, Vux auto-singularizes the result key (`todos` → `todo`, `workspaces` → `workspace`) using the schema's declared `singular` or a default English pluralization algorithm. Use `$as` to override:

```ts
import { $only } from '@mszr/idb-vux'

// $only → auto-singularize using schema
const { workspace } = db.useQueryX({
  workspaces: { $: { where: { inviteCode: code }, $only } },
})
// workspace.value: Workspace | undefined

// $at → pick by position, also auto-singularizes
const { task } = db.useQueryX({
  tasks: { $: { limit: 1, orderBy: { createdAt: 'desc' }, $at: -1 } },
})
// task.value: Task | undefined

// $as → explicit rename (useful when default singular is wrong, e.g. $users → '$user')
const { user } = db.useQueryX({
  $users: { $: { where: { id: userId }, $only, $as: 'user' } },
})
// user.value: User | undefined
```

For additional projections on the same data — indexed maps, grouped collections — use `$m`. The original data is always returned alongside `$m` outputs; `$m` keys create new sibling refs:

```ts
const { todos, todosById, todosByStatus } = db.useQueryX({
  todos: {
    $: { where: { workspace: workspaceId } },
    $m: {
      todosById: { indexBy: 'id' }, // Record<string, Todo> — id must be unique attr
      todosByStatus: { groupBy: 'status' }, // Record<string, Todo[]> — status must be primitive attr
    },
  },
})
// todos.value: Todo[]
// todosById.value: Record<string, Todo>
// todosByStatus.value: Record<string, Todo[]>
```

`$m` keys cannot collide with the resolved scope label. TypeScript enforces this.

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

const q = defineQueryX<AppSchema>() // done once, shared across the codebase.

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

// In a Nuxt server route — defineServerIdbX gives you the ergonomic layer
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
  workspaces: { $: { where: { id: workspaceId }, $only } },
}))
// workspace: Workspace | undefined — key auto-singularized from 'workspaces' because $only is set
```

### `lookup` — typed at last

```ts
// Current — untyped, any string is accepted
db.tx.memberships[id()].link({ workspace: lookup('inviteCode', inviteCode) })
//                                         ↑ is inviteCode an attr of workspaces? unique? right type?

// Vux — defineLookupX pattern (same design as defineQueryX)
// shared/utils/idb.ts
export const lu = defineLookupX<AppSchema>()

// Primary use: loose form inside .link() — namespace + attr validated, value typed
db.tx.memberships[id()].link({ workspace: lu('workspaces', 'inviteCode', inviteCode) })
//                                                ↑ namespace ✓   ↑ unique attr ✓   ↑ typed ✓

// Chain form — official SDK already handles this well; lu adds nothing here:
db.tx.$users.lookup('email', 'eva@...').update({ name: 'Eva' })
```

### Permissions — schema-aware, readable

```ts
import { definePermsX } from '@mszr/idb-vux/perms'
import schema from './instant.schema'

export default definePermsX(schema)
  .defaults(d => d
    .bind(({ auth }) => ({ isSignedIn: auth.id.neq(null) }))
    .allow({ $default: false }))
  .namespaces({
    workspaces: e => e
      .bind(({ auth, dr }) => ({
        isMember: dr('memberships.user.id').contains(auth.id),
      }))
      .allow(({ b }) => ({
        view: b.isMember,
        create: b.isSignedIn,
        update: b.isMember,
        delete: b.isMember,
      })),
    // ... other namespaces
  })
  .toRules()
// Output is plain InstantRules<Schema> — no backend changes needed
// Full API: docs/notes/ideal-perms-spec-x.md
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

Admin SDK ergonomics (`queryX`, array normalization, `$only`/`$at` coercion, typed `lookup`) don't depend on H3 or Nuxt. They work in any server context — Express, Nitro, plain Node. These go in `/admin`.

The Nuxt-specific layer adds things that depend on H3 event context: request-scoped auth caching on `event.context`, and eventually the SSR hydration plugin. These go in `/nuxt`.

The current `/nuxt` utilities (`defineServerIdbX`, `defineInstantAuthSyncHandlerX`) accept user-provided resolvers — `getAppId: event => ...`, `getAdminToken: event => ...` — and store auth cache on `event.context`. They do not call `useRuntimeConfig` internally; that is the user's choice in their resolver functions. The H3 dependency is `event.context` caching and `H3Event` typing. This design correctly belongs in `/nuxt`, not `/admin`.

`/nuxt` wraps `/admin`: `defineServerIdbX` internally uses the admin ergonomics layer from `/admin` and adds H3-specific caching on top.

### Entry points

```ts
// Client
import { defineDbX, defineQueryX, defineSchemaX, init, /* ... */ } from '@mszr/idb-vux'

// Admin (wraps @instantdb/admin with X ergonomics — init is our typed init)
import { init } from '@mszr/idb-vux/admin'

// Nuxt — wraps /admin with H3 event context
import { defineInstantAuthSyncHandlerX, defineServerIdbX } from '@mszr/idb-vux/nuxt'

// Permissions — no runtime behavior, just types + CEL string emitter
import { definePermsX } from '@mszr/idb-vux/perms'

const adminDb = init({ appId, adminToken, schema })
const { workspaces } = await adminDb.queryX({ workspaces: {} })
```

`@instantdb/admin` is declared as a peer dependency of `/admin`. No more `init` injection workaround — the subpath owns its dependency.

### What we do NOT do

- No separate `@mszr/idb-vux-admin` package — admin ergonomics are a subpath
- No re-export barrel from `@instantdb/vue` — we own our implementation
- No framework-wide singletons — `defineDbX` returns a factory; global state is the app's responsibility

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
| `db.useQueryX(query, opts?)` | Namespace arrays default to `[]`; `$only`/`$at` in `$:` returns `Entity \| undefined` under auto-singularized key (or `$as` override); `$m` object for additional projections (`indexBy`/`groupBy`/`at`); inline objects get full schema-aware validation |
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
| `defineSchemaX(config)` | Schema factory. `namespaces` key (instead of `entities`); `i.namespaceX()` with `singular`, `attrs`, and `ruleParams` collocated; links support `singular` on label definitions; `options` key for behavioral config (`singularize`, etc.) inherited by all Vux inits. Schema is the source of truth for auto-singularization and ruleParams typing. |
| `defineQueryX<Schema>()` | Returns a `q()` helper for schema-aware query authoring. Inline `useQueryX({})` objects have equivalent validation built in — `q` is most valuable in factory syntax `useQueryX(() => q(...))` and for named/reusable queries. `q` is schema-scoped (not db-scoped) and works identically on client and server. |
| `defineLookupX<Schema>()` | Returns a typed lookup function `lu`. `lu('workspaces', 'inviteCode', value)` validates that `'inviteCode'` is a unique attribute of `workspaces` and that `value` matches its type. Same design pattern as `defineQueryX`. |
| `defineDbX(config)` | Memoized db factory for runtime-resolved app IDs. Handles the lazy-init singleton pattern. Reads `singular` from schema for runtime auto-singularization. |

### 5.4 Admin utilities (`@mszr/idb-vux/admin`)

```ts
import { init } from '@mszr/idb-vux/admin'

const adminDb = init({ appId, adminToken, schema })

// X ergonomics on top of the admin SDK's query method:
adminDb.query(query) // baseline — same as core admin (async, one-shot)
adminDb.queryX(query) // typed + array normalization + $only / $at / $as + $m support
adminDb.transact(/* ... */) // same as core admin
adminDb.tx // same as core admin
```

### 5.5 Nuxt utilities (`@mszr/idb-vux/nuxt`)

| Utility | Purpose |
|---|---|
| `defineServerIdbX(config)` | Wraps `/admin` with H3 event context caching. Per-request call returns `adminDb` (with X ergonomics), `userDb?`, `user?`, etc. based on mode. |
| `defineInstantAuthSyncHandlerX(config)` | H3 handler for Instant's `firstPartyPath` auth sync. Writes/clears `refresh_token` cookie. |

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
2. **`$only` / `$at` returns `Entity | undefined`.** For top-level namespaces where you expect at most one result, use these in the `$:` object to get `Entity | undefined` instead of `Entity[]`. See §6.3.

```ts
// useQuery baseline — always needs the dance
const { data } = db.useQuery({ todos: {} })
const todos = computed(() => data.value?.todos ?? [])

// useQueryX — just use it
const { todos } = db.useQueryX({ todos: {} })
// todos.value: Todo[] — always an array, never undefined

// has: 'one' linked entities are already singular — IDB handles this, Vux preserves it
const { todos } = db.useQueryX({ todos: { assignee: {} } })
// todos.value[0].assignee: User | undefined — already singular, no $only needed
```

Same for imperative reads:

```ts
const { todos } = await db.queryOnceX({ todos: {} })
// todos: Todo[] — always
```

### 6.3 Shaping query results — `$only`, `$at`, `$as`, `$m`

#### Per-scope controls in `$:`

The `$:` object accepts two layers of keys:
- **IDB-native keys** (`where`, `fields`, `limit`, `order`, etc.) — passed to IDB as-is
- **Vux-only keys** (`$only`, `$at`, `$as`) — stripped before forwarding to IDB; act on the default scope key

`$only` and `$at: number` coerce the namespace from `Entity[]` to `Entity | undefined` and trigger auto-singularization of the result key.

```ts
// Without $only — ceremony stays in userland
const { data } = db.useQuery({ workspaces: { $: { where: { inviteCode: code } } } })
const workspace = computed(() => data.value?.workspaces?.[0])

// With $only — SDK handles it; result key auto-singularized from 'workspaces' → 'workspace'
const { workspace } = db.useQueryX({
  workspaces: { $: { where: { inviteCode: code }, $only } },
})
// workspace.value: Workspace | undefined
```

`$only` is exported as a `true` constant and works as a JavaScript property shorthand: `$: { $only }` expands to `$: { $only: true }`.

```ts
import { $only } from '@mszr/idb-vux'

const { todo } = db.useQueryX({ todos: { $: { where: { id: todoId }, $only } } })
// auto-singularized: 'todos' → 'todo' (from schema's singular field or default algorithm)

const { task } = db.useQueryX({
  tasks: { $: { limit: 1, orderBy: { createdAt: 'desc' }, $at: -1 } },
})
// $at: -1 → last element; auto-singularized: 'tasks' → 'task'
```

The three singularity controls in `$:` and their semantics:
- `$only: true` — "I expect at most one result; this isn't picking from many"
- `$at: 0` — "give me the element at position 0 (first)" — same runtime behavior as `$only`
- `$at: -1` — "give me the last element"
- `$at: number` — any integer index; negative counts from the end

**Auto-singularized key names:** when `$only` or `$at` is set, the source of truth depends on depth:

- **Top-level namespace key** (`workspaces`, `tasks`, …): uses the namespace's `singular` field from `i.namespaceX()`, falling back to the default English algorithm
- **Nested link label key** (`analyses`, `memberships`, …): uses the link label's `singular` field from `defineSchemaX` links, falling back to the default English algorithm

```ts
// Irregular nested link — declare singular on the link definition:
// reportAnalyses: {
//   forward: { on: 'reports', has: 'many', label: 'analyses', singular: 'analysis' },
// }
const { report } = db.useQueryX({
  reports: {
    $: { where: { id: reportId }, $only }, // top-level: uses namespace singular
    analyses: { $: { $at: 0 } }, // nested: uses link label's singular: 'analysis'
  },
})
// report.value: Report | undefined
// report.value?.analysis: Analysis | undefined   — 'analyses' → 'analysis' from link definition
```

The TypeScript return type and runtime key always match — they derive from the same schema source.

**`$as` for explicit override:**

```ts
// $users default singularization gives '$user'; use $as to get 'user'
const { user } = db.useQueryX({
  $users: { $: { where: { id: userId }, $only, $as: 'user' } },
})

// $as works at any depth:
const { user } = db.useQueryX({
  $users: {
    $: { where: { id: userId }, $only, $as: 'user' },
    todos: { $: { $at: -1, $as: 'latestTodo' } },
  },
})
// user.value.latestTodo: Todo | undefined
```

**Why not auto-infer singularity from the query shape?** Explicit `$only`/`$at` is preferred over auto-inference because dynamic queries produce unstable types (e.g. `T[] | T | undefined` when `limit` is a computed value). Explicit signaling keeps the type predictable. Auto-inference for static patterns (filtering by `id`, unique attribute) remains a future spike — track in §11.

#### Additional projections — `$m`

`$m` creates new sibling keys in the query result without affecting the default scope key. The default data (`todos: Todo[]`) is always returned regardless of what `$m` contains.

`$m` is object-keyed: the key is the output label, the value is the transform config. This prevents duplicate labels at the TypeScript level and makes naming explicit.

```ts
const { todos, todosById, todosByStatus } = db.useQueryX({
  todos: {
    $: { where: { workspace: workspaceId } },
    $m: {
      todosById: { indexBy: 'id' }, // id is unique → Record<string, Todo>
      todosByStatus: { groupBy: 'isDone' }, // boolean attr → Record<string, Todo[]>
    },
  },
})
// todos.value: Todo[]                          — default, always present
// todosById.value: Record<string, Todo>        — O(1) lookup by id
// todosByStatus.value: Record<string, Todo[]>  — grouped by isDone value
```

`$m` also works on nested link traversals:

```ts
const { workspaces } = db.useQueryX({
  workspaces: {
    todos: {
      $m: { todosByStatus: { groupBy: 'isDone' } },
    },
  },
})
// workspaces.value[0].todos: Todo[]
// workspaces.value[0].todosByStatus: Record<string, Todo[]>
```

`$m` controls:
- `indexBy: UniqueAttrKey` — attr must be marked `.unique()` in schema; returns `Record<AttrValue, Entity>`
- `groupBy: PrimitiveAttrKey` — attr type must be `string | number | boolean`; returns `Record<AttrValue, Entity[]>`
- `at: number` — same semantics as `$at` in `$:`, but creates a new labeled key; lets you expose both the full array and a pinned position simultaneously

```ts
// Expose both the full list and the latest item
const { todos, latestTodo } = db.useQueryX({
  todos: {
    $: { where: { workspace: id } },
    $m: { latestTodo: { at: -1 } },
  },
})
// todos.value: Todo[] — full list
// latestTodo.value: Todo | undefined — last element
```

`$m` keys cannot collide with the resolved scope label. TypeScript enforces this constraint.

### 6.4 Type utilities

Three gaps in official SDK type utilities are worth closing.

**Gap 1 — Schema-bound binding.** `InstaQLEntity<AppSchema, 'tasks'>` requires passing `AppSchema` at every call site. A schema-bound alias eliminates repetition.

**Gap 2 — `fields` narrowing.** `InstaQLEntity` does not accept `$: { fields: [...] }` in its subquery param — TypeScript actively rejects it (confirmed in `official-sdk-gaps.types.ts`). Narrowing currently requires an awkward 4th positional type param:

```ts
// Works but non-obvious — 4th positional param, inconsistent with query authoring style
type NarrowTodo = InstaQLEntity<AppSchema, 'todos', {}, ['isDone']>
```

**Gap 3 — Query result types.** No official utility mirrors the output of a full `useQuery` call. There is no way to statically type a query result shape — including `$m` projections, renamed keys, or singularization — without writing the types by hand.

#### `DefineIdbEntityX` — schema-bound entity type

```ts
import type { DefineIdbEntityX } from '@mszr/idb-vux'

// Once, co-located with the schema — no AppSchema repetition elsewhere
type IdbEntity = DefineIdbEntityX<AppSchema>

// Simple entity type (like InstaQLEntity, but schema-bound)
type Todo = IdbEntity<'todos'>
// { id: string; title: string; isDone: boolean }

// With nested link traversal
type TodoWithAssignees = IdbEntity<'todos', {
  assignees: {}
}>
// { id: string; title: string; isDone: boolean; assignees: User[] }

// $: and $m work inside nested link scopes — they apply transformations on the linked entities
type TodoWithTransformedAssignees = IdbEntity<'todos', {
  assignees: {
    $: { $one: true, fields: ['email'] } // $one coerces to singular; fields narrows attrs
    $m: { assigneesById: { indexBy: 'id' } }
  }
}>
// { id: string; title: string; isDone: boolean;
//   assignee: { id: string; email: string } | undefined,  ← $one + fields + auto-singularized
//   assigneesById: Record<string, { id: string; email: string }> }  ← $m
```

`$:` and `$m` are only valid inside nested link scopes. At the top level, `IdbEntity` always returns the entity type directly — not wrapped in a namespace object. For top-level `$`/`$m` transformations, use `DefineIdbDataX`.

Singularization of nested link keys (triggered by `$one: true`) follows `options.singularize` from the schema. `$as` always takes precedence.

#### `DefineIdbDataX` — data shape type

Models the `data.value` shape that is consistent across all query X APIs (`useQueryX`, `queryOnceX`, `useInfiniteQueryX`) and is also the same shape `defineQueryX`'s `q` accepts. Every `$`/`$m` option works at any depth.

```ts
import type { DefineIdbDataX } from '@mszr/idb-vux'

type IdbData = DefineIdbDataX<AppSchema>

type MyData = IdbData<{
  todos: {
    $: { fields: ['isDone'], $as: 'minimalTodos' }
    $m: { minimalTodosById: { indexBy: 'id' } }
    assignees: { $: { $one: true } }
  }
  $users: {}
}>
// MyData['minimalTodos']: { id: string; isDone: boolean; assignee: User | undefined }[]
// MyData['minimalTodosById']: Record<string, { id: string; isDone: boolean; assignee: User | undefined }>
// MyData['$users']: User[]
```

`$one: true` is the type-level counterpart to runtime `$only`/`$at`. Position (`$at: 0` vs `$at: -1`) doesn't affect the type — it's always `Entity | undefined`. One flag, one pattern to remember.

Singularization follows `options.singularize` from the schema (see §3). `$as` always takes precedence over auto-singularize.

Both `DefineIdbEntityX` and `DefineIdbDataX` are type-only imports (`import type`) — no runtime footprint. TypeScript implementation TBD — see §11 Q2.

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

IntelliSense is currently broken in `useQuery`, `useQueryX`, and related hooks — completions do not appear on inline query objects. The `defineQueryX`/`q` path is unaffected: completions work correctly there. This regression must be diagnosed and fixed before anything else.

The approach: write selenita intellisense tests to identify exactly which cursor positions are broken, fix the regression, then lock the behavior so it cannot regress again.

### 7.5 `defineLookupX<Schema>()` — typed lookups

The official `lookup()` free function is completely untyped (`lookup(attribute: string, value: any)`). `defineLookupX` fills that gap specifically for the **loose form** — `.link()` contexts where lookup is passed as a free function value.

```ts
// shared/utils/idb.ts
export const lu = defineLookupX<AppSchema>()

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

### 7.6 `defineSchemaX` — typed schema definition

`defineSchemaX` provides the following end-to-end type safety improvements over the official `i.schema()`:

- **`ruleParams` typed in tx chain:** `db.tx.workspaces[id()].ruleParams({})` autocompletes only the params declared in `workspaces.ruleParams`; unknown keys are TS errors
- **`ruleParams` typed in perms:** `definePermsX(schema)` ctx's `rp('key')` autocompletes from the namespace's declared params; unknown param keys are TS errors
- **`singular` as source of truth:** all auto-singularization in `useQueryX` and `adminDb.queryX` derives from the schema — no `singularOverrides` config objects needed anywhere
- **`options` as behavioral config authority:** `singularize` mode declared once in the schema, inherited automatically by `defineDbX`, admin `init`, and all X APIs; no per-init repetition
- **`namespaces` terminology:** consistent with IDB docs; `i.namespaceX()` replaces `i.entity()` in Vux codebases

Confirmed gap from official SDK: `RuleParams = { [key: string]: any }` — `.ruleParams()` accepts any object with no validation. `defineSchemaX` closes this at the TypeScript level.

---

## 8. Permissions DX

The permissions layer lives in `@mszr/idb-vux/perms`. It compiles to the same `InstantRules<Schema>` the IDB dashboard and CLI accept — no backend changes.

```ts
import { definePermsX } from '@mszr/idb-vux/perms'
import schema from './instant.schema'

export default definePermsX(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({ isSignedIn: auth.id.neq(null) }))
    .allow({ $default: false }))
  .namespaces({
    workspaces: e => e
      .stage(({ rp, d }) => ({
        inviteCode: rp('inviteCode'),
        inviteMatches: rp('inviteCode').eq(d.inviteCode),
      }))
      .bind(({ auth, dr, s }) => ({
        isMember: dr('memberships.user.id').contains(auth.id),
        hasInviteCode: s.inviteCode.neq(null).and(s.inviteMatches),
      }))
      .allow(({ b }) => ({
        view: b.isMember.or(b.hasInviteCode),
        create: b.isSignedIn,
        update: b.isMember,
        delete: b.isMember,
      })),
    // ... other namespaces
  })
  .toRules()
```

Full API, expression reference, context object, build order, and validation rules: **`docs/notes/ideal-perms-spec-x.md`**.

### Subpath rationale

`@mszr/idb-vux/perms` belongs in its own subpath: no client runtime behavior (only helps author `instant.perms.ts`), should not be bundled into client JS, and its type machinery is substantial enough that it should not slow the main package's TS compilation.

---

## 9. SSR Story

### Current state

`@mszr/idb-vux` is SSR-resilient: hooks don't crash, return safe inert state on server, activate on client.

`@mszr/idb-vux/nuxt` adds auth-sync and request-scoped server DB access.

### Intentional cookie difference

Official `createInstantRouteHandler` stores full user JSON in `instant_user_<appId>`. Vux's `defineInstantAuthSyncHandlerX` stores only the `refresh_token` in `instant_token_<appId>`. This is intentional: smaller cookie, less user data. `createInstantRouteHandler` remains re-exported for apps that need the official shape.

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
- `lu('/* cursor */')` → namespace name completions; second arg narrows to unique attrs
- This layer is currently missing and would have caught the regression

**Parity tests** (could be behavior or type): verify that baseline Vux APIs produce identical reactive output to the official Vue SDK under the same scenarios.

**Fewer tests, higher confidence.** The goal is tests that fail when real regressions happen, not a high count. After the IntelliSense regression fix, audit and trim the current ~37 files: delete redundant tests, delete tests of implementation details, consolidate by concern.

---

## 11. Open Questions

| # | Question | Current lean |
|---|---|---|
| Q1 | Auto-infer singularity from static patterns (`where: { id: ... }`, unique-field filter) without explicit `$only`/`$at`? | Future spike; `$only`/`$at` lands first — dynamic queries make full auto-inference impractical |
| Q2 | `DefineIdbEntityX` + `DefineIdbDataX` TypeScript implementation — mapped types with `$as` clause for key remapping; `$one` coercion; `fields` narrowing; `$m` projection types at every depth; singularization via schema `options` | Design settled (see §6.4); TS implementation TBD |
| Q3 | Typed tx chain (`db.txX`) — `.link({ 'namespace.attr': value })` dot-path form? | Future milestone; `defineLookupX` ships first |
| Q4 | SSR query hydration Nuxt plugin? | After core SDK is stable |
| Q5 | `options` expansion — what other settings belong in `defineSchemaX` `options` beyond `singularize`? Candidates: client auth strictness (e.g. `requireUser` default), server mode defaults | Deferred; add as needs arise |

---

## 12. Tracking Decisions

| Question | Decision | Rationale | Date |
|---|---|---|---|
| Package structure | `@mszr/idb-vux` + `/admin` + `/nuxt` + `/perms` | `/admin` = framework-agnostic admin ergonomics; `/nuxt` = H3/Nuxt-specific layer wrapping `/admin`; `/perms` replaces `/permissions` for brevity | 2026-06-04 |
| X APIs as primary | Yes — X APIs are the recommended path; baseline exists for compatibility and migration | DX goal | 2026-06-04 |
| Naming convention | `X` suffix on all Vux-owned APIs, including those with no official counterpart (`defineSchemaX`, `definePermsX`, `i.namespaceX`, etc.) | Forward collision-proofing; `X` means "Vux-owned, unambiguous" | 2026-06-09 |
| Single-entity normalization | `$only: true` and `$at: number` in `$:` object; `$only` exported as `true` constant (JS property shorthand); returns `Entity \| undefined` with auto-singularized key | One explicit mechanism covers all single-entity cases; avoids unstable types from dynamic limit values; `$only` conveys semantic intent better than `first`/`last` | 2026-06-09 |
| Auto-singularize source of truth | Schema's `singular` field in `i.namespaceX()` — no `singularOverrides` in `defineDbX`; TypeScript reads schema type; runtime reads same schema object | Single declaration, zero sync issues | 2026-06-09 |
| `$m` for additional projections | Object-keyed `$m`: keys are output labels, values are `{ at?, indexBy?, groupBy? }`; original data always returned; `$m` keys cannot collide with resolved scope label | Duplicate label prevention, forced naming, TS-friendly over array form | 2026-06-09 |
| `indexBy` and `groupBy` constraints | `indexBy` requires unique attr (`.unique()` in schema); `groupBy` requires primitive attr (`string \| number \| boolean`) | `indexBy` on non-unique would silently drop records; `groupBy` on objects/JSON is non-serializable as record key | 2026-06-09 |
| `defineSchemaX` | `defineSchemaX()` top-level function; `i.namespaceX()` namespace factory; `namespaces` key (not `entities`); `singular`/`attrs`/`ruleParams` collocated; links support `singular` on label definitions; `options` key for behavioral config | Schema as single source of truth for singulars, ruleParams typing, and behavioral config; terminology matches IDB docs | 2026-06-09 |
| `namespaces` key (no X) | Config object keys inside `defineSchemaX` do not get the X suffix — `namespaces`, `links`, `rooms`, `options` stay without X | X applies to callable identifiers (functions, methods, constants), not to keys within config objects; `defineSchemaX` already signals full ownership of the input shape; X-ing `namespaces` but not `links`/`rooms` would be inconsistently asymmetric | 2026-06-09 |
| `options` in `defineSchemaX` | `options.singularize: 'auto' \| 'off' \| 'explicit'` (default `'auto'`); schema is the config authority; all Vux inits inherit automatically | Single declaration, zero repetition across `defineDbX`, admin `init`, etc.; other behavioral defaults (auth strictness, etc.) tracked in Q7 | 2026-06-09 |
| `ruleParams` typing gap | `defineSchemaX` closes: `db.tx.*.ruleParams({})` typed from schema; `definePermsX` ctx `rp()` typed from schema | `RuleParams = { [key: string]: any }` confirmed gap in official SDK | 2026-06-09 |
| `DefineIdbEntityX` | Schema-bound entity type factory; `IdbEntity<'ns'>` returns entity directly; `$`/`$m` supported only in nested link scopes (not top level); `$one: true` in nested `$:` coerces `Entity[]` → `Entity \| undefined` with auto-singularize; `fields` narrows attrs; `$m` adds sibling projections on linked entities | `InstaQLEntity` requires AppSchema at every callsite and rejects `$: { fields }` entirely | 2026-06-09 |
| `DefineIdbDataX` | Schema-bound data shape type factory; models `data.value` consistently across `useQueryX`, `queryOnceX`, `useInfiniteQueryX`, and `q`; `$`/`$m` at every depth; `$one: true` is the type-level counterpart to runtime `$only`/`$at`; singularization follows schema `options.singularize`; `$as` always wins | No official equivalent; required for statically typing full query data shapes including `$m` projections | 2026-06-09 |
| Permissions naming | `definePermsX`, subpath `/perms` | Cleaner and consistent with the file name (`instant.perms.ts`) and X convention | 2026-06-04 |
| Permissions API | Fluent expressions (method chains on expression nodes) with free-function n-ary logical ops; `.namespaces({})` object form; `.toRules()` as explicit compile point | Reads left-to-right naturally; object form consistent with `defineSchemaX`; chain syntax dropped (object literal keys provide equivalent IntelliSense) | 2026-06-09 |
| `ruleParams` in CEL | `ruleParams.<key>` (plural) — confirmed from server-side test code; `rp('key')` method renamed to `ruleParams('key')` (shorthand `rp` unchanged) | CEL uses `ruleParams.handle`, `ruleParams.inviteCode` — plural, it's a map | 2026-06-09 |
| `$isNull` restriction | Fix: any attribute, not just optional | Per official docs | 2026-06-04 |
| `$like` restriction | Fix: require indexed string, not just string | Per official docs | 2026-06-04 |
| `defineLookupX` primary use case | Loose form (`.link()` context) — the official chain `.lookup()` already validates unique attrs + value types | Official chain form confirmed typed via `ETypeChunk` in instatx.ts | 2026-06-04 |
| `defineLookupX` syntax | Generic function form: `lu('workspaces', 'attr', value)` | Generic function form is simpler to implement and handles dynamic namespaces | 2026-06-04 |
| Typed tx chain | Future milestone (`db.txX`); `defineLookupX` ships first | Non-trivial tx reimplementation; current `lu` covers the primary use case | 2026-06-04 |
| Factory validation | Structural validation (namespace + link labels) without `q()`; deep where-clause validation requires `q()` in factory return | TypeScript limitation — confirmed via experiment | 2026-06-04 |
| Suggestion depth | 3 hops; not configurable for now | Matches stated goal; YAGNI on configurability | 2026-06-04 |
