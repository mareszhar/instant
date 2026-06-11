updated: 2026-06-11
status: converged feature spec — aligned with `dux-a-blueprint-with-foresight.md` (the authority, incl. the §1.5 scope edge); to be distilled into the `dux-spec-*.md` set

# The Ideal dux — feature spec

> **Historical note.** This document began as the proposal for an ideal `@mszr/idb-vux` — a DX-first Vue SDK. The initiative outgrew Vue and was re-founded as **dux** (`@mszr/idb-dux`). [`dux-a-blueprint-with-foresight.md`](./dux-a-blueprint-with-foresight.md) is the authority on vision, architecture, naming, and roadmap; this doc is the feature spec, converged to the blueprint's decisions — no `X` suffixes, the dux naming contract (blueprint §11), entity-rooted perms context, typed `tx`, schema registration. Original section numbering is preserved so existing references stay valid. The filename keeps the historical `ideal-vux` name until the docs plan (blueprint §14) supersedes it.

---

## 1. What Is dux?

`@mszr/idb-dux` is the DX/UX-first reimagining of the InstantDB developer experience, with Vue and Nuxt as its first first-class clients.

idb's surface splits into a *framework-agnostic plane* (schema, permissions, query authoring, transactions, admin, webhooks) and a *framework-coupled plane* (reactive client bindings). The official SDKs polish the coupled plane per framework and leave the agnostic plane thin and stringly-typed. dux inverts the priority: make the agnostic plane excellent once, and let each client binding be a thin, delightful overlay on it. The edge of that ambition is drawn explicitly — every official surface is ruled in, pass-through, compatibility target, or out with a trigger (blueprint §1.5).

**Relationship with the official SDKs:**

- **dux owes behavioral compatibility to Instant's backend, not API compatibility to Instant's SDKs.** Everything dux emits — schema shapes for the CLI, perms CEL, wire queries — is something Instant already accepts. Inside that envelope, dux is free to be better.
- **The enhanced behavior is the default, unsuffixed surface.** `db.useQuery` is the good one. There is no public baseline layer: a vendored, internal mirror of `@instantdb/vue` exists purely as the parity/port anchor (blueprint §6, §8.1). A developer who wants official behavior uses the official SDK.
- **Names follow the dux naming contract** (blueprint §11): values unprefixed, types `Idb`-prefixed and domain-scoped, native keys kept verbatim, one term with one meaning everywhere.

The official Vue SDK is the behavior target for the internal baseline mirror. The React/Next SDK is the capability watch for SSR hydration — adopted when upstream marks it stable (§9).

**Primary user**: this SDK is built first for its maintainer. It is opinionated, deliberate, and optimized for delight — not for the widest possible API surface or the most conservative design choices.

---

## 2. Design Principles

When requirements conflict, earlier principles take precedence.

### 1. Delightful

The question "what would feel most delightful to use?" drives every design decision. Delightful means the API disappears — you think about your problem, not the library. What feels natural? What feels like friction? What makes someone say "oh, that's so much nicer"? When there are multiple valid solutions, choose the one that fits the mental model of someone reading and writing the code, not the one that was technically simpler to implement.

Empathy is part of delight. Design for the moment of use, not just the moment of implementation.

### 2. Boilerplate is an active harm

Every repetitive pattern in userland that the SDK could eliminate is a failure to deliver. Empty array normalization, manual `?? null` massaging, `data.value?.namespace` unwrapping — these accumulate. The SDK should eliminate ceremony, not just reduce it. If you find yourself writing the same shape of code twice, that's a signal. DRY runs both ways: the SDK erases repetition in userland *and* keeps one source of truth per concept in its own implementation, so a fix lands once and every surface inherits it (blueprint §7).

### 3. Errors at the cursor, not the console

The type system is the primary safety layer. Valid TypeScript should mean valid usage. When something is wrong, the error should appear *on the specific offending piece* — the invalid field name, the wrong operator, the missing namespace — with an actionable message that says what's wrong and what to do instead.

Not a red underline over the whole call. The specific field. The specific operator. A message you could act on without opening the docs.

### 4. Self-documenting

Reading the SDK implementation without prior context should make intent clear. Names match mental models. Structure reflects intent. Types are as narrow as they can be without becoming hard to use. `any` is a last resort, not a convenience. Comments explain *why*, not *what* — the code explains the what.

This applies equally to the API surface: an API whose name, shape, and types tell you what it does without needing to look it up is better than one that requires a mental glossary. Clarity and consistency of naming is paramount across **all** dux surfaces — one term, one meaning, learn once, use everywhere. dux serves a single mental model and protects that simplicity over conformity to the official SDKs' varying conventions; official names map to dux names at the boundary (blueprint §11), and clear, meaningful language is treated as the backbone of a sustainable implementation.

### 5. Predictable contracts

Learning one dux API teaches you all of them. One reactive pattern, applied everywhere. One result shape for all query-like APIs. If you understand `useQuery`, you understand `useAuth`. No API should surprise you if you already know another one.

### 6. SSR-resilient floor, SSR-hydrated ceiling

Hooks must not crash on server. That is the floor, non-negotiable. Safe inert state on server, full subscription on client, no configuration required.

Full SSR query hydration — server data → serialized → client hydrated without a loading flash — is the ceiling. By decision it is deferred until upstream marks SSR support stable (§9), but the architecture must leave the door open. No decisions that would require hooks to be redesigned to support it.

### 7. Additive, never divergent — at the baseline

The internal baseline mirror stays diffable against `@instantdb/vue` with only marked deltas (SSR guards, tighter types, overlay wiring). The public surface composes the baseline and is free to be better — the parity audit applies to the mirror, not to the public API. This keeps upstream porting mechanical.

### 8. Performance parity — and performance in what we add

Match all optimizations the official SDK implements. If core uses `weakHash` for query deduplication, so does dux. SSR resilience guards must not add meaningful overhead on the client path. Performance is not an afterthought.

And dux-only behaviors are optimized as first-class features, not conveniences: when a query declares multiple `$m` projections, they're computed in a single pass over the data, not one reduce per key; `defineServerKit` caches per-event work so repeated calls in one request reuse already-computed values. Fast is good UX — DX matters, but the biggest value of a great library is the quality of the user experiences it enables.

The four structural principles (blueprint §1.4) complete the canon — they rank how dux is *built*, where 1–8 rank what dux *is*:

### 9. Plane separation is load-bearing

The framework-agnostic layers never import a framework; only `/vue` may import `vue`, only `/nuxt` may import `h3`. Enforced by lint (blueprint §5.2), not discipline. The agnostic plane — authoring *and* the server surfaces — is most of the garden.

### 10. The baseline is a mirror, not a fork

Anything with an official counterpart is vendored-and-marked or wrapped-and-mapped (blueprint §6), never creatively reimplemented. Creativity lives in dux's own layer, where upstream churn can't reach it.

### 11. Sustainability is part of the design

Every surface declares how it tracks upstream before it ships: vendor tier, wrap tier, or tested compatibility target (blueprint §6.3, §6.4, §8.6). Drift is made visible by tooling, never discovered by users.

### 12. Elegance is a requirement, not a flourish

The implementation must read with the same clarity the API projects — deliberate, DRY, stable, in a constant fight against complexity, slowness, and obscurity. The greatest solutions turn entanglements into inspired simplicity; if a piece can't be explained simply, it isn't done.

---

## 3. What This Looks Like in Practice

Before architecture, here is what the ideal dux feels like to write. This is the API we want to love using.

### Schema definition

```ts
// Official IDB — terminology mismatch: docs say "namespace" but the API says "entity";
// rule params and singulars have no home at all
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
// dux — terminology matches the docs; singular name and ruleParams collocated with the namespace
import { defineSchema, i } from '@mszr/idb-dux'

export const schema = defineSchema({
  namespaces: {
    $users: i.namespace({
      singular: 'user', // overrides default Singularize('$users') → '$user'
      fields: {
        email: i.string().unique().indexed().optional(),
        name: i.string().indexed(),
      },
    }),
    workspaces: i.namespace({
      fields: {
        name: i.string().indexed(),
        inviteCode: i.string().unique().indexed(),
        createdAt: i.date().indexed(),
      },
      ruleParams: { // collocated, namespace-specific, typed end-to-end
        inviteCode: i.string(),
      },
    }),
    memberships: i.namespace({
      fields: { createdAt: i.date().indexed() },
      ruleParams: { inviteCode: i.string().optional() },
    }),
    tasks: i.namespace({
      fields: {
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
      presence: i.namespace({ fields: { name: i.string(), typing: i.boolean().optional() } }),
      topics: { reaction: i.namespace({ fields: { emoji: i.string() } }) },
    },
  },
  options: {
    singularize: 'auto', // 'auto' | 'off' | 'explicit' — inherited by every dux init
  },
})

export type AppSchema = typeof schema
```

`defineSchema` output is structurally compatible with the IDB CLI — the same entity/link shape it expects, with dux metadata stored non-enumerable. `i.namespace` replaces `i.entity` and accepts `singular`, `fields`, and `ruleParams`. The `singular` field is the single source of truth for auto-singularization — no separate config anywhere else.

A **link** relates *entities*, declared between two namespaces — which may be the same namespace (self-links such as `tasks → parentTask/subtasks` are legal). Link labels support an optional `singular` for irregular plurals:

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

- **Namespace `singular`** in `i.namespace()` — governs the output key when `$only`/`$at` is set on a top-level namespace
- **Link `singular`** on a link label — governs the output key when `$only`/`$at` is applied to a nested link

The `options` key holds schema-level behavioral config that all dux inits inherit automatically:

- **`singularize: 'auto'`** (default) — use schema `singular` if declared, otherwise the default English algorithm (the typed `Singularize<string>` utility matches runtime behavior)
- **`singularize: 'explicit'`** — use schema `singular` if declared, otherwise leave the key as-is (no algorithm; `$as` required for unregistered plurals)
- **`singularize: 'off'`** — never singularize; `$only`/`$at` still coerce to `Entity | undefined` but the key keeps its name; `$as` required to rename

### Tell dux your schema once — registration

```ts
// instant.schema.ts (continued)
declare module '@mszr/idb-dux' {
  interface IdbRegister { schema: typeof schema }
}
```

One declaration; from then on every `Idb*` type utility and the exported `q` default to your schema, project-wide (§6.4). Registration supplies **types, not values** — factories that need the schema object (`defineDb`, `init`, `definePerms(schema)`) still receive it explicitly, because runtime singularization and runtime validation cannot come from a type.

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
// dux — defineDb handles the lazy-init + memoization pattern
import { defineDb } from '@mszr/idb-dux/vue'

export const useDb = defineDb({
  schema,
  getAppId: () => useRuntimeConfig().public.instantAppId,
  firstPartyPath: '/api/idb',
})
```

### Queries — the biggest ergonomic improvement

```ts
// Official Vue SDK — query objects are validated (namespaces + basic structure),
// but the data needs ceremony before use
const { data } = db.useQuery({
  workspaces: { $: { where: { id: workspaceId } } }, // Workspace[] | undefined
  todos: {}, // Todo[] | undefined
})

const workspace = computed(() => data.value?.workspaces?.[0]) // Workspace | undefined
const todos = computed(() => data.value?.todos ?? []) // Todo[]
```

```ts
// dux — normalization and full validation built in; top-level namespaces destructure directly
const { workspace, todos } = db.useQuery({
  workspaces: { $: { where: { id: workspaceId }, $only } }, // Workspace | undefined
  todos: {}, // Todo[]
})

// no additional massaging anywhere
```

dux exports `$only` as a `true` constant. Because it shares its name with the `$:` key it enables, it works as a JavaScript property shorthand: `$: { $only }` expands to `$: { $only: true }`. dux also exports `$skip` (an `undefined` constant): an `undefined` value in a `where` clause drops that clause, so `where: { workspace: current?.id ?? $skip }` reads as intended.

```ts
import { $only } from '@mszr/idb-dux'

// $only → auto-singularize using schema
const { workspace } = db.useQuery({
  workspaces: { $: { where: { inviteCode: code }, $only } },
})
// workspace.value: Workspace | undefined

// $at → pick by position, also auto-singularizes
const { task } = db.useQuery({
  tasks: { $: { limit: 1, order: { createdAt: 'desc' }, $at: -1 } },
})
// task.value: Task | undefined

// $as → explicit rename (useful when the default singular is wrong, e.g. $users → '$user')
const { user } = db.useQuery({
  $users: { $: { where: { id: userId }, $only, $as: 'user' } },
})
// user.value: User | undefined
```

For additional projections on the same data — indexed maps, grouped collections — use `$m`. The original data is always returned alongside; `$m` keys create new sibling refs:

```ts
const { todos, todosById, todosByStatus } = db.useQuery({
  todos: {
    $: { where: { workspace: workspaceId } },
    $m: {
      todosById: { indexBy: 'id' }, // Record<string, Todo> — id must be a unique attribute
      todosByStatus: { groupBy: 'isDone' }, // Record<string, Todo[]> — must be a primitive field
    },
  },
})
```

`$m` keys cannot collide with the resolved scope label. TypeScript enforces this.

```ts
// Official Vue — validates where-clauses, but with many limitations
const query = db.useQuery({
  todos: {
    $: {
      where: {
        isDone: { $ilike: '%true%' }, // no warning, even though $ilike requires an indexed string
        title: false, // errors, but the message is "Type 'false' is not assignable to type 'undefined'."
      },
    },
  },
})
```

```ts
// dux — smarter validation with clearer error messages
const query = db.useQuery({
  todos: {
    $: {
      where: {
        isDone: { $ilike: '%true%' }, // error: Operator $ilike is only available for indexed string fields.
        title: false, // error: Type 'boolean' is not assignable to field `title` of type string
      },
    },
  },
})
```

### Dynamic queries — `q`, ready-made

```ts
import { q } from '@mszr/idb-dux' // schema known via registration — no defineQuery<AppSchema>() step

// share one query among multiple callers
function taskQuery(isDone?: boolean) {
  return q({
    tasks: { $: { where: { isDone } } },
    // a mistake here flags only the offending field
  })
}

const callerOne = db.useQuery(taskQuery(false))
const callerTwo = db.useQuery(taskQuery(true))

// factory syntax — q restores fully localized validation inside the factory body
const dynamicQuery = db.useQuery(() => {
  if (!userId)
    return null
  return q({ /* full intellisense and field-localized errors here */ })
})
```

(`defineQuery<OtherSchema>()` remains for multi-schema setups.)

**Research finding (from the vux investigation, still true):** inline objects passed to `db.useQuery({...})` get fully localized, schema-aware errors — TypeScript applies the parameter type as a contextual type to inline object literals. Factory syntax gets structural validation (namespaces, link labels, `$` structure); wrapping the factory's return in `q()` restores fully localized deep validation. Both are better than the official SDK, which reports errors at the call-site level even for inline objects.

### Pinia stores — where `state` shines

```ts
// A Pinia store that exposes auth safely:
export const useIdb = defineStore('idb', () => {
  const db = useDb()
  const { state: auth } = db.useAuth()
  // auth is a raw getter projection — Pinia won't try to hydrate it.
  // It reads as auth.user, auth.isLoading, auth.error — no .value anywhere.
  return { db, auth }
})

// Consuming store in another store — auth.user is read directly, no .value
export const useTasks = defineStore('tasks', () => {
  const { db, auth } = useIdb()
  const workspaces = useWorkspaces()

  const { isLoading, error, tasks } = db.useQuery(() => {
    if (!auth.user?.id)
      return null
    return q({ tasks: { $: { where: { workspace: workspaces.current?.id ?? $skip } } } })
  })

  const create = (title: string) =>
    db.transact(db.tx.tasks[id()].create({ title, isDone: false })
      .link({ workspace: workspaces.current!.id }))

  return { isLoading, error, tasks, create }
})
```

`state` is most useful as a renamed scope — `const { state: auth } = db.useAuth()` — so you read `auth.user`, `auth.isLoading`, `auth.error` throughout the store/composable without `.value`. It is not a general replacement for refs; for individual ref access or composable passthrough, use the top-level refs or `.refs` (§6.1).

### Server-side — the same DX, on the server

```ts
// server/utils/idb.ts — the request-kit factory
import { defineServerKit } from '@mszr/idb-dux/nuxt'
import { schema } from '~~/config/instant.schema'

export const useServerKit = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
// /nuxt wraps /admin, which owns @instantdb/admin — no init injection
```

```ts
// In a Nuxt server route — the kit's keys vary by mode
const { adminDb, user } = await useServerKit(event, 'user?')

const { workspaces } = await adminDb.query(q({
  workspaces: {
    $: { where: { 'memberships.user': user?.id ?? $skip } },
    memberships: {},
  },
}))
// workspaces: Workspace[] — never undefined

const { workspace } = await adminDb.query(q({
  workspaces: { $: { where: { id: workspaceId }, $only } },
}))
// workspace: Workspace | undefined — same shaping semantics as the client
```

### Typed `tx` — `lookup`, typed at last

```ts
// Official — link labels are typed, but a lookup() travels through as an untyped string
db.tx.memberships[id()].link({ workspace: lookup('inviteCode', inviteCode) })
//                                          ↑ any attr name, any value — nothing checked

// dux — dot-path link keys: the label completes, unique fields narrow, the value is typed;
// compiles to the official lookup() form under the hood
db.tx.memberships[id()].link({ 'workspace.inviteCode': inviteCode })

// the plain id form stays, typed per label cardinality
db.tx.tasks[id()].link({ workspace: workspaceId })

// ruleParams typed from the schema's collocated declaration — unknown keys are TS errors
db.tx.workspaces[id()].ruleParams({ inviteCode })
```

Full semantics in §7.5. The typed chain makes a standalone loose-lookup utility unnecessary — there is no `defineLookup` in dux.

### Webhooks — the same entities, delivered to your server

```ts
// Official — schema generics at every call site, helper ceremony to get typed handlers
const { typedHandlers, combineHandlers } = Webhooks.helpers<typeof schema>()
const handlers = combineHandlers(
  typedHandlers('tasks', 'create', record => notifyAssignee(record.after)),
  typedHandlers('$default', record => log(record)),
)
```

```ts
// dux — a plain object; every handler's change is fully narrowed
// (no helpers, no generics — the schema is known via registration)
import { defineWebhookHandlers } from '@mszr/idb-dux/webhooks'

export const handlers = defineWebhookHandlers({
  tasks: {
    create: ({ after }) => notifyAssignee(after), // after: IdbEntity<'tasks'>
    delete: ({ before }) => audit('task removed', before),
  },
  $default: change => log(change), // any namespace, any action
})
```

```ts
// server/api/webhooks.post.ts — one line in Nuxt
export default defineWebhookHandler(handlers)
```

```ts
// anywhere else (a worker, any Node/edge runtime) — /webhooks needs no admin token
import { init } from '@mszr/idb-dux/webhooks'

const webhooks = init()
await webhooks.process(handlers, request) // verify signature → fetch payload → dispatch
```

A change's `before`/`after` is `IdbEntity<'ns'>` — the same entity type queries and tx speak. Management hangs off admin: `adminDb.webhooks.manager.create({ url, namespaces: ['tasks'], actions: ['create'] })`. Full surface: §5.6.

### Permissions — schema-aware, readable

```ts
import { definePerms } from '@mszr/idb-dux/perms'
import { schema } from './instant.schema'

export default definePerms(schema)
  .defaults(d => d
    .bind(({ auth }) => ({ isSignedIn: auth.id.neq(null) }))
    .allow({ $default: false }))
  .namespaces({
    workspaces: ns => ns
      .bind(({ auth, er }) => ({
        isMember: er('memberships.user.id').contains(auth.id),
      }))
      .allow(({ b }) => ({
        view: b.isMember,
        create: b.isSignedIn,
        update: b.isMember,
        delete: b.isMember,
      })),
    // ... other namespaces
  })
  .compile()
// Output: IdbPerms<AppSchema> — structurally assignable to InstantRules; no backend changes
// Full API: docs/notes/ideal-perms-spec-x.md
```

---

## 4. Package Structure

The blueprint (§3–§5, §9) is the authority on structure. Summary:

```
@mszr/idb-dux           framework-agnostic foundation: defineSchema, i, q (+ defineQuery),
                        typed-tx machinery, Idb* type utilities + IdbRegister, id/lookup
@mszr/idb-dux/vue       the Vue client: init, defineDb, the enhanced db, components
@mszr/idb-dux/perms     typed CEL authoring (authoring-only, no client runtime)
@mszr/idb-dux/admin     the full admin surface; owns @instantdb/admin (optional peer)
@mszr/idb-dux/webhooks  webhook handling + management; owns @instantdb/webhooks
                        (optional peer); admin-free by design
@mszr/idb-dux/nuxt      defineServerKit, defineAuthSyncHandler, defineWebhookHandler
                        (optional peers admin + h3)
```

One published package; layered source with lint-enforced boundaries; `sideEffects: false`; subpaths tree-shake to zero for unused planes; optional peers isolate dependencies.

What we do **not** do:

- No public baseline/compat surface — the vendored mirror is internal-only
- No separate npm packages until a forcing function appears (blueprint §5.4)
- No framework-wide singletons — `defineDb` returns a factory; global state is the app's responsibility
- No `/platform` subpath yet — deferred behind a named trigger; meanwhile the official platform SDK is a *tested* compatibility target against dux apps, and dux outputs are valid platform inputs by construction (blueprint §1.5, §8.6)

---

## 5. API Surface

### 5.1 The default surface

The enhanced behavior is the only public surface. All hooks are SSR-resilient; all query-like and stateful hooks share the result pattern (§6.1).

| API | Notes |
|---|---|
| `init(config)` (`/vue`) | config typed as `IdbConfig` |
| `db.useQuery(query \| factory, opts?)` | `MaybeRefOrGetter` and factory inputs; namespace arrays default `[]`; `$only`/`$at`/`$as` singular coercion; `$m` projections; full schema-aware validation on inline objects |
| `db.useInfiniteQuery(query, opts?)` | same data plane, paginated |
| `db.queryOnce(query, opts?)` | async one-shot, same shaping |
| `db.useAuth()` | result pattern over `{ isLoading, user, error }` |
| `db.useUser(opts?)` | `requireUser` strictness policy |
| `db.useConnectionStatus()` / `db.useLocalId(name)` | result pattern; reactive inputs |
| `db.room(type, id)` / `db.rooms.*` | reactive inputs; `usePresence`, `useSyncPresence`, `useTypingIndicator`, `useTopicEffect`, `usePublishTopic` — presence/typing hooks share the result pattern |
| `db.transact(...)` | same as official |
| `db.tx` | **typed**: schema-typed `ruleParams`, dot-path `.link` (§7.5) |
| `db.auth.*` / `db.storage.*` / `db.streams` | **considered pass-throughs** (blueprint §1.5): official verbs kept verbatim — already precise — with exported types renamed per the naming contract (`IdbAuth*`, `IdbStorage*`, `IdbStream*`); the `devtool` and `apiURI` config options pass through `IdbConfig` |
| `SignedIn`, `SignedOut`, `Cursors` | `.ts` render-function components (marked build delta — official ships `.vue` SFCs) |
| `id`, `lookup`, `createInstantRouteHandler` | re-exports keep their official names |
| `i` | dux-owned: `i.namespace` + the field builders (`i.string()`, …) — no `i.entity`/`i.schema`; one authoring dialect (blueprint §10.1) |

Deprecated official type aliases (`InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantEntity`, `InstantGraph`, …) are not re-exported.

### 5.2 The internal baseline

A vendored mirror of `@instantdb/vue` lives inside `/vue` (`baseline/`), with only marked deltas: SSR-resilience guards, tighter types, overlay wiring. It is the parity-test anchor and the upstream-porting surface (blueprint §6, §8.1). It is never exported — exposing it would force a second `db` instance, since methods bind to how `init` built them.

### 5.3 Authoring utilities

| Utility | Purpose |
|---|---|
| `defineSchema(config)` | §3. `namespaces` / `fields` / `ruleParams` / `links` / `rooms` / `options`; the source of truth for singulars, ruleParams typing, and behavioral config |
| `q` | ready-made schema-aware query authoring (via registration); most valuable in factory syntax and for named/reusable queries; `defineQuery<S>()` for explicit schemas |
| `defineDb(config)` (`/vue`) | memoized lazy-init factory for runtime-resolved app IDs; reads `singular` and `options` from the schema |

### 5.4 Admin utilities (`@mszr/idb-dux/admin`)

```ts
import { init } from '@mszr/idb-dux/admin'

const adminDb = init({ appId, adminToken, schema })

await adminDb.query(q({ workspaces: {} })) // shaped exactly like the client data plane
adminDb.tx // typed like db.tx
adminDb.transact(/* ... */)
```

`/admin` owns `@instantdb/admin` as an optional peer — no init-injection workaround. The **full official admin surface** is covered, each piece a decided treatment (blueprint §1.5, D9):

| Surface | Treatment |
|---|---|
| `query(q, opts?)` | the dux data plane: `shapeResult`, `$only`/`$at`/`$as`/`$m`, typed `ruleParams` in `opts` |
| `subscribeQuery(q, cb?, opts?)` | **same shaping per emission** — a subscription and a one-shot of the same query deliver the same shape; handle typed `IdbQuerySubscription`; official callback + async-iterator contracts preserved |
| `tx` / `transact` | the typed tx chain (§7.5) |
| `debugQuery` / `debugTransact` | pass-through with typed `ruleParams`; check-result types renamed (`IdbAdminCheckResult`) |
| `asUser({ email \| token \| guest })` | returns the same dux admin db, permission-scoped — everything above stays dux-shaped by construction |
| `auth.*` | pass-through: `createToken`, `verifyToken`, the magic-code quartet (`generateMagicCode` is the custom-email hook), `deleteUser`, `signOut`, `getUserFromRequest` keep official verbs. `getUserFromRequest` reads the official full-user cookie; the dux-native server-auth path is `/nuxt`'s kit (§9) |
| `storage.*` / `streams.*` / `rooms.getPresence` | pass-through verbs, renamed types (`IdbStorage*`, `IdbStream*`, room presence via `IdbRoom*`). Official `@instantdb/resumable-stream` works with a dux `adminDb` — a tested compat target (blueprint §8.6) |
| `webhooks` | the `/webhooks` surface (§5.6), admin-token wired |

Admin returns plain shaped data — the `-Data/-State/-Refs` result pattern is a client-reactivity concept and deliberately does not apply to server one-shots (blueprint §11.2). The bare-name rule is also why admin's one-shot is `query` while the client's is `queryOnce`: the bare name goes to each surface's primary read.

### 5.5 Nuxt utilities (`@mszr/idb-dux/nuxt`)

| Utility | Purpose |
|---|---|
| `defineServerKit(config)` | per-request kit: `{ adminDb, user?, userDb?, … }` depending on mode; `event.context` caching for auth-token reads and verify promises; wraps `/admin` |
| `defineAuthSyncHandler(config)` | H3 handler for Instant's `firstPartyPath` auth sync; writes/clears the token-only cookie (§9) |
| `defineWebhookHandler(handlers, opts?)` | the one-line webhook route: reads the raw body the h3 way, delegates verify → fetch → dispatch to `/webhooks`, answers 2xx/4xx per official retry semantics |

### 5.6 Webhooks utilities (`@mszr/idb-dux/webhooks`)

| API | Notes |
|---|---|
| `init(config?)` | config is *optional*: handling needs no token — signature verification uses Instant's public JWKS, payload fetches use the token the webhook body carries. `appId` + `adminToken` unlock `manager`; `apiURI` for self-hosting. Payload/handler types flow from registration (registration supplies types, and webhooks' runtime needs no schema value) |
| `defineWebhookHandlers(...maps)` | plain-object handler authoring with full per-change narrowing (contextual typing — no helpers, no generics); passing several maps merges them; resolution per change: `namespace.action` → `namespace.$default` → `$default` (official semantics) |
| `webhooks.process(handlers, request, opts?)` | the one-liner: verify → fetch payload → dispatch (Web `Request`) |
| `webhooks.processNode(handlers, req, opts?)` | Node `IncomingMessage` adapter (official raw-body rules preserved) |
| `webhooks.verify` / `webhooks.fetchPayload` / `webhooks.dispatch` | the pipeline stepwise, for custom flows (blueprint §11.7 maps these to the official names) |
| `webhooks.manager` | subscription CRUD + delivery-event inspection — official method names verbatim; also exposed token-wired as `adminDb.webhooks.manager` |

A change's `before`/`after` is `IdbEntity<'ns'>` — the same entity type the rest of dux speaks (webhook payloads arrive as JSON, matching `IdbEntity`'s wire-format dates, §11). A failing handler rejects `process`, so the route returns non-2xx and Instant retries — official semantics preserved. A `defineWebhookHandlers` map is structurally a valid official `WebhookHandlers` (compat-tested).

---

## 6. Return Value Ergonomics

### 6.1 The result pattern

The result pattern solves the `.value` problem without losing refs where they matter. Every stateful hook returns: top-level refs for destructuring, `.refs` for composable passthrough, `.state` for `.value`-free script reads. All three views read the same underlying reactive source. The shapes are typed as `Idb<Domain>Result` with `-Data` / `-State` / `-Refs` subparts (`IdbQueryResult`, `IdbQueryResultData`, `IdbQueryResultState`, `IdbQueryResultRefs`; same pattern for `IdbAuthResult`, `IdbRoomPresenceResult`, …).

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

`state` is not useful as a direct accessor (`state.todos` vs `todos.value` are equivalent); its value is as a remapped scope name.

### 6.2 Namespace array normalization

`useQuery` delivers top-level namespaces as `Entity[]`, never `undefined`. Two notes:

1. **Nested `has: 'one'` links are already singular.** IDB natively returns linked entities with `has: 'one'` cardinality as `Entity | undefined`. dux preserves this — no massaging applied to those nested shapes.
2. **`$only` / `$at` returns `Entity | undefined`.** For top-level namespaces where you expect at most one result, use these in `$:` (§6.3).

```ts
const { todos } = db.useQuery({ todos: {} })
// todos.value: Todo[] — always an array, never undefined

const { todos } = await db.queryOnce({ todos: {} })
// todos: Todo[] — same on imperative reads

const { todos } = db.useQuery({ todos: { assignee: {} } })
// todos.value[0].assignee: User | undefined — has:'one' is already singular
```

### 6.3 Shaping query results — `$only`, `$at`, `$as`, `$m`

#### Per-scope controls in `$:`

The `$:` object accepts two layers of keys:

- **IDB-native keys** (`where`, `fields`, `limit`, `offset`, `order`, …) — passed to IDB as-is
- **dux-only keys** (`$only`, `$at`, `$as`) — `$`-prefixed by convention (blueprint §10.1), stripped before forwarding to IDB; act on the default scope key

`$only` and `$at: number` coerce the namespace from `Entity[]` to `Entity | undefined` and trigger auto-singularization of the result key:

- `$only: true` — "I expect at most one result; this isn't picking from many"
- `$at: 0` — "give me the element at position 0" — same runtime behavior as `$only`
- `$at: -1` — "give me the last element"; any integer works, negative counts from the end

**Auto-singularized key names:** the source of truth depends on depth:

- **Top-level namespace key**: the namespace's `singular` from `i.namespace()`, falling back to the default English algorithm
- **Nested link label key**: the link label's `singular` from `defineSchema` links, falling back to the algorithm

```ts
const { report } = db.useQuery({
  reports: {
    $: { where: { id: reportId }, $only }, // top-level: namespace singular
    analyses: { $: { $at: 0 } }, // nested: link label's singular: 'analysis'
  },
})
// report.value?.analysis: Analysis | undefined
```

The TypeScript return type and the runtime key always match — they derive from the same schema source. `$as` overrides at any depth and always wins.

**Why not auto-infer singularity from the query shape?** Explicit `$only`/`$at` keeps types predictable — dynamic queries (computed `limit` values) would otherwise produce unstable types like `T[] | T | undefined`. Inference from static patterns is a settled intention for a post-1.0 spike (§11), not part of the contract.

#### Additional projections — `$m`

`$m` creates new sibling keys without affecting the default scope key. The default data is always returned. `$m` is object-keyed: the key is the output label, the value is the transform config — duplicate labels are impossible and naming is forced.

```ts
const { todos, todosById, todosByStatus } = db.useQuery({
  todos: {
    $: { where: { workspace: workspaceId } },
    $m: {
      todosById: { indexBy: 'id' }, // unique attribute → Record<string, Todo>
      todosByStatus: { groupBy: 'isDone' }, // primitive field → Record<string, Todo[]>
    },
  },
})
```

`$m` also works on nested link traversals, and supports:

- `indexBy: UniqueAttrKey` — attribute must be `.unique()` in schema; `Record<AttrValue, Entity>` (non-unique would silently drop records)
- `groupBy: PrimitiveFieldKey` — field type must be `string | number | boolean`; `Record<AttrValue, Entity[]>` (objects/JSON aren't serializable as record keys)
- `at: number` — same semantics as `$at`, but as a new labeled sibling; exposes the full array *and* a pinned position simultaneously

```ts
const { todos, latestTodo } = db.useQuery({
  todos: { $: { where: { workspace: id } }, $m: { latestTodo: { at: -1 } } },
})
// todos.value: Todo[] · latestTodo.value: Todo | undefined
```

`$m` keys cannot collide with the resolved scope label; TypeScript enforces it.

### 6.4 Type utilities

Registration (§3) makes every utility schema-bound with zero repetition. They close the verified official gaps — `InstaQLEntity` needs the schema at every call site, rejects `$: { fields }` outright, and nothing models a full query's data shape:

```ts
type Todo = IdbEntity<'todos'>
// id + fields only — links live BETWEEN entities, so the plain entity has none

type FullTodo = IdbEntityWithLinks<'todos'>
// fields + every link label, one hop (cardinality-aware: Entity[] or Entity | undefined),
// fields-only inside — deeper shapes are what queries are for

type TodoCard = IdbQueryEntity<'todos', { assignee: {} }>
// shaped by query syntax; $ and $m fully supported, including $: { fields }

type Board = IdbQueryData<{
  todos: { $: { where: { isDone: false }, $only: true } }
  notes: { $m: { notesById: { indexBy: 'id' } } }
}>
// { todo: Todo | undefined; notes: Note[]; notesById: Record<string, Note> }
// — the same shape useQuery/queryOnce/adminDb.query deliver for that query

type AnyAppQuery = IdbQuery // the valid-query-object type — handy for function params
```

Type utilities accept **the same `$` keys as runtime queries** (`$only`, `$at`, `$as`, plus `fields`) with the same meaning; at the type level `$only`/`$at` coerce to `Entity | undefined` regardless of position. (An earlier draft introduced a separate type-level `$one` flag; it was dropped — one vocabulary, one meaning.) Singularization follows the schema's `options.singularize`; `$as` always wins.

All are type-only imports — zero runtime footprint. Multi-schema escape hatch: a trailing schema param (`IdbEntity<'todos', OtherSchema>`).

### 6.5 Pinia safety

`state` objects are `markRaw` plain objects with getter properties over underlying refs. Pinia does not treat them as hydratable. Writing to a `state` property fails at the property level. Vue effects track correctly through the getters because each getter reads an underlying reactive source. No user configuration needed.

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

- Keys: `id`, schema fields, and linked dot-paths up to 3 hops
- `QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks`
- `undefined` values (`$skip`) drop the clause

**Where operator restrictions (spec rules, per official docs):**

| Operator | Requirement |
|---|---|
| `$gt`, `$lt`, `$gte`, `$lte` | indexed attribute with checked type |
| `$like`, `$ilike` | indexed string attribute |
| `$isNull` | any attribute — no restriction |
| `$in`, `$not`, `$ne` | any attribute |

(The vux implementation got two of these wrong — `$isNull` over-restricted to optionals, `$like` under-restricted to non-indexed strings. dux implements from this table.)

**Order level:**

- The native `order` key; direct fields and `id` only (ordering does not support linked attributes)
- Valid directions: `'asc' | 'desc'`

### 7.2 Validation depth and scope

Default suggestion depth: **3 hops** for where dot-paths and link traversal. Beyond that, any string is accepted. Not configurable — a YAGNI decision, revisited only if real schemas demand it.

### 7.3 Inline vs factory validation

**Inline query objects** passed to `useQuery({...})` get full schema-aware validation with errors localized to the specific field — contextual typing does the work.

**Factory syntax** `useQuery(() => {...})` gets structural validation (namespace names, link labels, `$` structure). Deep where-clause validation inside a factory requires wrapping the return in `q({...})` — TypeScript can flag invalid factory returns, but the error surfaces at the call site rather than the offending field. `q` restores field-level localization. This is the verified boundary of what TypeScript can do.

### 7.4 Editor-DX locks

vux shipped an IntelliSense regression silently — completions died on inline query objects while the `q` path kept working — because no test plane covered the editor experience. dux makes that impossible by policy: every API ships with a `.dx.test.ts` suite (selenita) locking its completions *and* its diagnostic messages, per the blueprint's testing strategy (§10 here, blueprint §8). The vux regression itself is reproduced as a failing suite first, fixed in the clean codebase, then locked forever.

### 7.5 Typed `tx`

Core types the tx chain's link *labels* and id values, but two holes remain (verified in `instatx.ts` / `schemaTypes.ts`): `RuleParams` is `{ [key: string]: any }`, and a `lookup()` passes through `.link()` as an untyped string. dux closes both on the default `db.tx` / `adminDb.tx`:

- **`.ruleParams({...})`** completes and validates against the namespace's `ruleParams` declaration in `defineSchema`; unknown keys are TS errors.
- **`.link()` accepts dot-path keys**: `{ 'workspace.inviteCode': code }` completes the link label, narrows to *unique* fields of the linked namespace, types the value against the field's type, and compiles to the official `lookup()` form under the hood. The plain id form (`{ workspace: workspaceId }`) stays, typed per label cardinality.
- **One hop by design**: the dot-path targets the linked entity's unique fields; deeper traversal is a query concern, not a tx concern.

With the chain typed end-to-end, no standalone loose-lookup utility exists in dux.

### 7.6 `defineSchema` — typed schema definition

End-to-end improvements over the official `i.schema()`:

- **`ruleParams` typed in the tx chain** (§7.5) and **in perms**: `definePerms` ctx's `rp('key')` autocompletes from the namespace's declared params; unknown keys are TS errors
- **`singular` as source of truth**: all auto-singularization derives from the schema — no override configs anywhere else
- **`options` as behavioral authority**: declared once, inherited by `defineDb`, admin `init`, and every shaping API
- **`namespaces`/`fields` terminology**: consistent with IDB docs and the dux vocabulary; `i.namespace()` replaces `i.entity()`

---

## 8. Permissions DX

The permissions layer lives in `@mszr/idb-dux/perms`. It compiles to `IdbPerms<Schema>` — structurally assignable to the `InstantRules` shape the IDB dashboard and CLI accept; no backend changes.

```ts
import { definePerms } from '@mszr/idb-dux/perms'
import { schema } from './instant.schema'

export default definePerms(schema)
  .attrs(a => a.allow({ create: false }))
  .defaults(d => d
    .bind(({ auth }) => ({ isSignedIn: auth.id.neq(null) }))
    .allow({ $default: false }))
  .namespaces({
    workspaces: ns => ns
      .stage(({ rp, e }) => ({
        inviteCode: rp('inviteCode'),
        inviteMatches: rp('inviteCode').eq(e.inviteCode),
      }))
      .bind(({ auth, er, s }) => ({
        isMember: er('memberships.user.id').contains(auth.id),
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
  .compile()
```

The context is entity-rooted (`entity`/`e`, `entityUpdated`/`eu`, `entityLinked`/`el`, with `Field`/`f` and `Ref`/`r` suffixes) — CEL's `data`/`newData`/`linkedData` are compile targets only, never authoring surface. Full API, expression reference, context object, build order, and validation rules: **[`ideal-perms-spec-x.md`](./ideal-perms-spec-x.md)**.

### Subpath rationale

`/perms` is its own subpath: no client runtime behavior (it only helps author `instant.perms.ts`), it should never be bundled into client JS, and its type machinery is heavy enough that it must not slow the main package's TS experience.

---

## 9. SSR Story

### The floor (shipped behavior)

dux is SSR-resilient: hooks don't crash on server, return safe inert state, and activate on client. `@mszr/idb-dux/nuxt` adds auth-sync and request-scoped server access (`defineServerKit`).

### Intentional cookie difference

Official `createInstantRouteHandler` stores full user JSON in `instant_user_<appId>`. dux's `defineAuthSyncHandler` stores only the `refresh_token` in `instant_token_<appId>`: smaller cookie, less user data on the wire. `createInstantRouteHandler` remains re-exported for apps that want the official shape.

### The ceiling (deferred by decision)

Full hydration — server runs queries → results serialized into HTML → client hydrates the cache → renders without a loading flash → live subscriptions take over. Upstream's only full-SSR surface (`@instantdb/react` `./nextjs`) is **experimental**; dux adopts the ceiling when idb marks SSR support stable, and not before. The resilience guards are forward-compatible with hydration (inert server state simply gets replaced by hydrated state), so no API redesign will be needed — the door stays open by construction (blueprint roadmap phase 9).

---

## 10. Testing Strategy

The blueprint §8 is the authority. Summary: one runner (Vitest), three assertion planes, one fixture library —

| Plane | Suffix | Tool |
|---|---|---|
| Runtime behavior | `*.test.ts` | Vitest |
| Type shapes | `*.test-d.ts` | Vitest `--typecheck` + `expectTypeOf` |
| Editor DX (completions + diagnostic messages) | `*.dx.test.ts` | selenita on Vitest |

Tests collocate beside the APIs they exercise; the canonical app, scenarios, and cursor-bearing snippets live once in `test-support/` (`@test`); the parity harness replays shared scenarios against both the official `@instantdb/vue` devDependency and the internal baseline mirror; `check-baseline-drift` flags upstream movement; compat-target suites lock that dux outputs remain valid inputs to the official tools dux doesn't wrap — CLI push, platform push, resumable-stream (blueprint §8.6). Fewer tests, higher confidence: assert contracts, never implementation details.

---

## 11. Settled Intentions

No open questions remain. The following are decided intentions with explicit triggers:

| Intention | Decision | Trigger |
|---|---|---|
| Auto-infer singularity from static patterns (`where: { id }`, unique-field filters) | Explicit `$only`/`$at` is the contract; inference is an eventual spike | post-1.0, only if the explicit forms prove noisy in real apps |
| Full SSR hydration | Resilience floor now; hydration when upstream marks SSR stable (today: experimental, Next-only) | upstream stability (§9) |
| `options` expansion beyond `singularize` | add schema-level options only when a concrete need appears | concrete need |
| Perms `stageFor`/`bindFor` | in spec; implementation may land after common rules | perms build order (spec) |
| Dot-path `.link` depth | one hop by design — deeper traversal belongs to queries | not planned |
| Validation/suggestion depth configurability | fixed at 3 hops | only if real schemas demand it |
| `/platform` subpath (dux-typed platform API) | deferred; the official platform SDK is a tested compat target against dux apps, and dux outputs are valid platform inputs by construction (blueprint §1.5) | first external adopter with existing apps, or a dux tooling/CLI initiative — whichever lands first |
| Adoption codegen (backend schema or official `i.schema` file → `defineSchema` file + registration block) | the first brick of the platform track; until then adoption is hand-translation via the rename table (blueprint §11.4) | same trigger as `/platform` |
| Dates as `Date` objects (official `useDateObjects`) | v1 types `i.date()` fields as the wire format on every surface — client, admin, webhook payloads — matching official defaults (the flag is opt-in upstream and JSON payloads can't carry `Date`s anyway) | a schema-level `options` entry when a concrete need appears |
| Migration-authoring sugar (e.g. rename annotations in `defineSchema`) | `instant-cli push`'s plan/diff/rename flow is the supported migration UX — it works with dux files today (push evaluates the file) | platform track |
