updated: 2026-06-11
status: spec — contracts are binding; implementation approaches are proposals in their service

# dux spec — the root (`@mszr/idb-dux`)

The framework-agnostic foundation: schema authoring, query authoring, result shaping, the typed-tx machinery, and the `Idb*` type utilities. Everything here crosses the client/server boundary freely — no framework, no secrets, no side effects.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Global roadmap: [dux-vision.md §8](./dux-vision.md#8-implementation-roadmap)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| R1 | Schema layer: `defineSchema`, `i.namespace`, singularization, registration | 1 | ☐ not started |
| R2 | Query authoring + result shaping: `q`/`defineQuery`, validation, `shapeResult`, type utilities | 2 | ☐ not started |
| R3 | Typed tx: `ruleParams`, dot-path `.link` | 2 | ☐ not started |

Details: [§9 Phased implementation roadmap](#9-phased-implementation-roadmap).

- [1. Scope](#1-scope)
- [2. Schema](#2-schema)
- [3. Query authoring](#3-query-authoring)
- [4. Result shaping](#4-result-shaping)
- [5. Typed tx](#5-typed-tx)
- [6. Type utilities](#6-type-utilities)
- [7. Rename table](#7-rename-table)
- [8. Implementation approach](#8-implementation-approach)
- [9. Phased implementation roadmap](#9-phased-implementation-roadmap)

---

## 1. Scope

The root entrypoint exports:

| Export | What it is |
|---|---|
| `defineSchema(config)` | the schema authority: namespaces, fields, links, rooms, ruleParams, options |
| `i` | dux's authoring dialect: `i.namespace` + the field builders (`i.string()`, `i.date()`, …) — there is no `i.entity`/`i.schema`; one dialect, one vocabulary |
| `q` / `defineQuery<S>()` | schema-aware query authoring — `q` is ready-made via registration |
| `$only`, `$skip` | authoring constants ([§3.2](#32-only-and-skip)) |
| `id`, `lookup` | re-exports, official names kept |
| `IdbRegister` + the `Idb*` type utilities | [§6](#6-type-utilities) |
| the typed-tx machinery | consumed by `/vue`'s `db.tx` and `/admin`'s `adminDb.tx` ([§5](#5-typed-tx)) |

These live at the root — not behind a subpath — because they are the shared spine: the schema file, the reusable `q`, and the entity types are imported by client stores and server routes alike.

---

## 2. Schema

### 2.1 The contract

A schema declaration should read in the vocabulary the rest of dux (and Instant's own documentation) speaks — **namespaces** holding **fields** — and should be the *single home* for everything that describes a namespace: its fields, its singular name, and its rule params. Nothing namespace-shaped should ever live in a second config file.

```ts
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

The binding pieces:

- **`i.namespace({ singular?, fields, ruleParams? })`** is the namespace constructor. `singular` is the single source of truth for auto-singularization — no separate config anywhere else. `ruleParams` declares the namespace's rule params once and types them end-to-end: in the tx chain ([§5](#5-typed-tx)), in query options, and in perms (`rp('key')` autocompletes; unknown keys are TS errors).
- **`options`** holds schema-level behavioral config that every dux init — client `defineDb`, admin `init` — inherits automatically. Declared once, honored everywhere.
- **`defineSchema` returns an actual official `InstantSchemaDef` instance — not merely a lookalike.** Its enumerable schema projection is exactly what the IDB CLI and the platform API's `schemaPush` consume; dux metadata (`singular`, `ruleParams`, `options`) rides along non-enumerably. This constructor invariant matters because CLI push verifies the exported schema as an `InstantSchemaDef` (`constructor.name === 'InstantSchemaDef'`), and it is locked by a compat-target test.

### 2.2 Links

A **link** relates *entities*, declared between two namespaces — which may be the same namespace (self-links such as `tasks → parentTask/subtasks` are legal).

Link labels support an optional `singular` for irregular plurals:

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

- **Namespace `singular`** (in `i.namespace()`) — governs the output key when `$only`/`$at` is set on a top-level namespace
- **Link `singular`** (on a link label) — governs the output key when `$only`/`$at` is applied to a nested link

### 2.3 `options.singularize`

- **`'auto'`** (default) — use the schema's `singular` if declared, otherwise the default English algorithm (the `Singularize<string>` type utility matches runtime behavior exactly)
- **`'explicit'`** — use the schema's `singular` if declared, otherwise leave the key as-is (no algorithm; `$as` required for unregistered plurals)
- **`'off'`** — never singularize; `$only`/`$at` still coerce to `Entity | undefined` but the key keeps its name; `$as` required to rename

### 2.4 Registration — tell dux your schema once

```ts
// instant.schema.ts (continued)
declare module '@mszr/idb-dux' {
  interface IdbRegister { schema: typeof schema }
}
```

One declaration; from then on every `Idb*` type utility and the exported `q` default to your schema, project-wide. **Registration supplies types, not values** — factories that need the schema object (`defineDb`, `init`, `definePerms(schema)`) still receive it explicitly, because runtime singularization and runtime validation cannot come from a type. Full rule: [dux-conventions.md §7](./dux-conventions.md#7-schema-registration).

### 2.5 Dates

`i.date()` fields are typed as the wire format on every surface — client, admin, webhook payloads — matching official defaults (upstream's `useDateObjects` is opt-in, and JSON payloads can't carry `Date`s anyway). A schema-level `options` entry can lift this later if a concrete need appears ([dux-vision.md §7](./dux-vision.md#7-deferred-intentions)).

---

## 3. Query authoring

### 3.1 The contract

Authoring a query should give you completions and errors *at the offending key*, whether the query is written inline at a call site, named and shared between callers, or built dynamically. The wire output is always a query `instaql` already accepts — the dux-only keys are stripped before forwarding.

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

**Where the localization boundary sits (a TypeScript fact, designed around):** inline object literals passed to a typed parameter get fully localized, schema-aware errors — the parameter type is applied as a contextual type. A factory's *return value* gets structural validation (namespaces, link labels, `$` structure), but its errors surface at the call site; wrapping the factory's return in `q()` restores fully localized deep validation. Both modes must hold, and both are locked by editor-DX suites.

### 3.2 `$only` and `$skip`

dux exports `$only` as a `true` constant. Because it shares its name with the `$:` key it enables, it works as a JavaScript property shorthand: `$: { $only }` expands to `$: { $only: true }`.

dux also exports `$skip` (an `undefined` constant): an `undefined` value in a `where` clause drops that clause, so `where: { workspace: current?.id ?? $skip }` reads as intended.

### 3.3 Validation

The contract per level, with the intended diagnostic. Diagnostics carry stable `QERR_*` codes so editor-DX tests can assert messages, not just positions.

**Namespace level** — top-level query keys are limited to schema namespace names.

> `QERR_QUERY_ROOT_KEY_UNKNOWN: foo is not a valid top-level namespace`

**Link traversal level** — nested query keys are limited to defined link labels up to **3 hops**; beyond 3 hops any string is accepted (avoids type-checker blowup, matches core behavior).

> `QERR_QUERY_NESTED_KEY_UNKNOWN: foo is not a valid nested key on tasks`

**Where clause level** — keys: `id`, schema fields, and linked dot-paths up to 3 hops. `undefined` values (`$skip`) drop the clause.

> `QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks`

**Operator restrictions** (per official docs):

| Operator | Requirement |
|---|---|
| `$gt`, `$lt`, `$gte`, `$lte` | indexed attribute with checked type |
| `$like`, `$ilike` | indexed string attribute |
| `$isNull` | any attribute — no restriction |
| `$in`, `$not`, `$ne` | any attribute |

Value types are validated against field types with errors on the value, not the call:

```ts
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

**Order level** — the native `order` key; direct fields and `id` only (ordering does not support linked attributes); directions `'asc' | 'desc'`.

**Depth policy:** suggestion/validation depth is fixed at **3 hops** for where dot-paths and link traversal — not configurable (a YAGNI decision, revisited only if real schemas demand it).

---

## 4. Result shaping

### 4.1 The contract

The data plane returns data you can use without massaging — no `?? []`, no `[0]` picking, no hand-rolled maps. The shaping semantics are defined **once** and hold identically on every consumer: `/vue`'s `useQuery`/`queryOnce`/`useInfiniteQuery` and `/admin`'s `query`/`subscribeQuery`. A subscription and a one-shot of the same query deliver the same shape.

### 4.2 Array normalization

Top-level namespaces arrive as `Entity[]`, never `undefined`:

```ts
const { todos } = db.useQuery({ todos: {} })
// todos.value: Todo[] — always an array, never undefined

const { todos } = await db.queryOnce({ todos: {} })
// todos: Todo[] — same on imperative reads
```

**Nested `has: 'one'` links are already singular** — Instant natively returns them as `Entity | undefined`; dux preserves this, no massaging applied:

```ts
const { todos } = db.useQuery({ todos: { assignee: {} } })
// todos.value[0].assignee: User | undefined
```

### 4.3 Per-scope controls — `$only`, `$at`, `$as`

The `$:` object accepts two layers of keys:

- **idb-native keys** (`where`, `fields`, `limit`, `offset`, `order`, …) — passed to Instant as-is
- **dux-only keys** (`$only`, `$at`, `$as`) — `$`-prefixed per [the convention](./dux-conventions.md#6-the--prefix-rule), stripped before forwarding; they act on the scope's output key

`$only` and `$at: number` coerce the scope from `Entity[]` to `Entity | undefined` and trigger auto-singularization of the result key:

- `$only: true` — "I expect at most one result; this isn't picking from many"
- `$at: 0` — "give me the element at position 0"
- `$at: -1` — "give me the last element"; any integer works, negative counts from the end

```ts
import { $only } from '@mszr/idb-dux'

const { workspace } = db.useQuery({
  workspaces: { $: { where: { inviteCode: code }, $only } },
})
// workspace.value: Workspace | undefined

const { task } = db.useQuery({
  tasks: { $: { limit: 1, order: { createdAt: 'desc' }, $at: -1 } },
})
// task.value: Task | undefined

const { user } = db.useQuery({
  $users: { $: { where: { id: userId }, $only, $as: 'user' } },
})
// user.value: User | undefined — $as renames explicitly (e.g. when '$user' is unwanted)
```

**Singularized key names** — the source of truth depends on depth:

- **Top-level namespace key**: the namespace's `singular` from `i.namespace()`, falling back to the default English algorithm
- **Nested link label key**: the link label's `singular` from the schema's links, falling back to the algorithm

```ts
const { report } = db.useQuery({
  reports: {
    $: { where: { id: reportId }, $only }, // top-level: namespace singular
    analyses: { $: { $at: 0 } }, // nested: link label's singular: 'analysis'
  },
})
// report.value?.analysis: Analysis | undefined
```

The TypeScript return type and the runtime key always match — they derive from the same schema source. `$as` overrides at any depth and always wins. Singularization behavior follows `options.singularize` ([§2.3](#23-optionssingularize)).

**Why not auto-infer singularity from the query shape?** Explicit `$only`/`$at` keeps types predictable — dynamic queries (computed `limit` values) would otherwise produce unstable types like `T[] | T | undefined`. Inference from static patterns is a settled intention for a post-1.0 spike, not part of the contract.

### 4.4 Additional projections — `$m`

For derived views of the same data — indexed maps, grouped collections, pinned positions — `$m` creates new **sibling keys** without affecting the default scope key. The original data is always returned alongside. `$m` is object-keyed: the key is the output label, the value is the transform config — duplicate labels are impossible and naming is forced.

```ts
const { todos, todosById, todosByStatus } = db.useQuery({
  todos: {
    $: { where: { workspace: workspaceId } },
    $m: {
      todosById: { indexBy: 'id' }, // Record<string, Todo>
      todosByStatus: { groupBy: 'isDone' }, // Record<string, Todo[]>
    },
  },
})
```

Transforms:

- `indexBy: UniqueAttrKey` — the attribute must be `.unique()` in schema; yields `Record<AttrValue, Entity>` (non-unique would silently drop records)
- `groupBy: PrimitiveFieldKey` — the field type must be `string | number | boolean`; yields `Record<AttrValue, Entity[]>` (objects/JSON aren't serializable as record keys)
- `at: number` — same semantics as `$at`, but as a new labeled sibling; exposes the full array *and* a pinned position simultaneously

```ts
const { todos, latestTodo } = db.useQuery({
  todos: { $: { where: { workspace: id } }, $m: { latestTodo: { at: -1 } } },
})
// todos.value: Todo[] · latestTodo.value: Todo | undefined
```

`$m` also works on nested link traversals. `$m` keys cannot collide with the resolved scope label — TypeScript enforces it.

**Performance is part of the contract** (principle 8): multiple `$m` projections are computed in a single pass over the data, not one reduce per key.

---

## 5. Typed tx

### 5.1 The contract

The tx chain should be typed end-to-end from the schema — including the two places the official chain goes untyped (verified in core's `instatx.ts`/`schemaTypes.ts`): `RuleParams` is `{ [key: string]: any }`, and a `lookup()` travels through `.link()` as an untyped string.

```ts
// dot-path link keys: the label completes, unique fields narrow, the value is typed;
// compiles to the official lookup() form under the hood
db.tx.memberships[id()].link({ 'workspace.inviteCode': inviteCode })

// the plain id form stays, typed per label cardinality
db.tx.tasks[id()].link({ workspace: workspaceId })

// ruleParams typed from the schema's collocated declaration — unknown keys are TS errors
db.tx.workspaces[id()].ruleParams({ inviteCode })
```

- **`.ruleParams({...})`** completes and validates against the namespace's `ruleParams` declaration in `defineSchema`.
- **`.link()` accepts dot-path keys**: `{ 'workspace.inviteCode': code }` completes the link label, narrows to *unique* fields of the linked namespace, types the value against the field's type, and compiles to the official `lookup()` form on the wire.
- **One hop by design**: the dot-path targets the linked entity's unique fields; deeper traversal is a query concern, not a tx concern.

With the chain typed end-to-end, no standalone lookup-builder utility is needed; the official `lookup` re-export remains for direct use.

The same machinery types both runtimes: the client `db.tx` and the admin `adminDb.tx` — one source, two surfaces.

---

## 6. Type utilities

### 6.1 The contract

Deriving types from the schema should cost zero repetition (registration, [§2.4](#24-registration--tell-dux-your-schema-once)) and cover the shapes apps actually need: the bare entity, the entity with its links, an entity shaped by a query, and a full query's data shape.

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

Rules:

- Type utilities accept **the same `$` keys as runtime queries** (`$only`, `$at`, `$as`, plus `fields`) with the same meaning — one vocabulary, one meaning. At the type level `$only`/`$at` coerce to `Entity | undefined` regardless of position; singularization follows the schema's `options.singularize`; `$as` always wins.
- All utilities are type-only imports — zero runtime footprint.
- Multi-schema escape hatch: a trailing schema param (`IdbEntity<'todos', OtherSchema>`).

---

## 7. Rename table

The root surface's slice (the cross-cutting pattern lives in [dux-conventions.md §8](./dux-conventions.md#8-the-rename-table)):

| Official | What it actually is (verified in core) | dux |
|---|---|---|
| `InstaQLParams<S>` | the query object shape | `IdbQuery` |
| `InstaQLOptions` | per-call options (`{ ruleParams }`) | `IdbQueryOptions` |
| `InstaQLResult` / `InstaQLResponse` | the same data shape, twice | `IdbQueryData<Q>` |
| `InstaQLEntity` | entity shaped by a subquery | `IdbQueryEntity` |
| `InstaQLEntitySubquery` | the subquery shape | `IdbQuerySubquery<'ns'>` |
| `InstaQLFields` | the `fields` array type | `IdbQueryFields<'ns'>` |
| `PageInfoResponse` | pagination cursors | `IdbQueryPageInfo` |
| — | entity, `id` + fields only | `IdbEntity<'ns'>` |
| — | entity + every link label, one hop | `IdbEntityWithLinks<'ns'>` |
| `InstantSchemaDef` | the schema type | `IdbSchema` |
| `RuleParams` | `{ [k: string]: any }` | `IdbTxRuleParams<'ns'>`, schema-typed |
| `TransactionChunk` | one tx step | `IdbTxChunk` |
| `UpdateParams` / `CreateParams` / `LinkParams` | op payload shapes | `IdbTxUpdate<'ns'>` / `IdbTxCreate<'ns'>` / `IdbTxLink<'ns'>` |

`id` and `lookup` are re-exported under their official names (values keep official names at the boundary). Deprecated official aliases (`InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantEntity`, `InstantGraph`, …) are never re-exported.

---

## 8. Implementation approach

A thoughtful proposal — details may move in service of the contracts above.

### 8.1 Source layout

```
src/
  schema/          # innermost, pure
    defineSchema.ts
    namespace.ts   # i.namespace + the i export assembly
    singularize.ts # runtime algorithm + Singularize<> type utility
    index.ts
  query/
    defineQuery.ts # q + defineQuery
    shapeResult.ts # pure $only/$at/$as/$m + normalization (shared by vue + admin)
    validation/    # where/operator/traversal types — the one validation surface
    types/         # IdbEntity, IdbQueryEntity, IdbQueryData, IdbRegister, …
    index.ts
  tx/
    typedTx.ts     # ruleParams + dot-path .link → compiles to lookup()
    index.ts
  index.ts         # the root entrypoint: re-export schema + query + tx surfaces
```

Boundary law applies ([dux-spec-workspace.md](./dux-spec-workspace.md)): `schema/` imports only `@instantdb/core`; `query/` and `tx/` import only core + `schema/`.

### 8.2 Key mechanics

- **`defineSchema`**: construct a real `InstantSchemaDef` (subclass or `Object.create` over the official prototype — whichever keeps `constructor.name === 'InstantSchemaDef'` and the enumerable projection clean), then attach dux metadata via non-enumerable properties. Push tooling sees the official shape; dux reads its own metadata.
- **`shapeResult(rawData, querySpec)`** is a pure function plus a type-level mirror that computes the same transformation in type space. The function is the *only* place shaping logic exists; consumers wrap it (reactively in `/vue`, post-`await` in `/admin`).
- **Validation types** live in `query/validation/` and are applied through the query parameter type so inline literals get contextual typing. `q` applies the same parameter type directly, which is what restores localization inside factories.
- **Singularize** ships as one runtime function and one type utility generated from the same rule set, with a shared table of irregulars — they must never disagree (locked by a type test that compares them across a word list).
- **Typed tx** wraps core's tx builders in a typed proxy layer; dot-path link keys are detected at the type level (template-literal keys over link labels × unique fields) and compiled to `lookup()` calls at runtime.

### 8.3 Editor-DX positions to lock

- `q({ todos: { $: { where: { ⌶ } } } })` → attribute names + dot-paths
- inline `useQuery({ ⌶ })` → namespace completions (the contextual-typing path)
- `i.namespace({ ⌶ })` → `singular`/`fields`/`ruleParams`
- `db.tx.memberships[id()].link({ ⌶ })` → link labels + dot-path unique attrs
- `.ruleParams({ ⌶ })` → schema-declared params
- each `QERR_*` diagnostic, asserted by message at its cursor

---

## 9. Phased implementation roadmap

### Phase R1 — schema layer (global phase 1)

Done when: schema type tests + dx suite green; `defineSchema` compat tests green.

- [ ] `i.namespace` + field builders assembly (`i` carries only the dux dialect)
- [ ] `defineSchema` runtime: namespaces/links/rooms/options, `InstantSchemaDef` constructor invariant, non-enumerable dux metadata
- [ ] `singularize` runtime + `Singularize<>` type utility (shared irregulars table; equivalence-locked)
- [ ] `IdbRegister` + registration plumbing
- [ ] `IdbSchema`, `IdbEntity`, `IdbEntityWithLinks` (schema-rooted utilities)
- [ ] compat-target suite: enumerable projection accepted by CLI push + `schemaPush` shapes; constructor invariant
- [ ] `.dx.test.ts`: `i.namespace({ ⌶ })`, `defineSchema({ ⌶ })` completions + diagnostics
- [ ] `.test-d.ts`: schema type shapes; singularize equivalence

### Phase R2 — query authoring + result shaping (global phase 2)

Done when: validation dx tests green, including inline-object completions (the contextual-typing path) and factory + `q()` localization; shaping runtime + type tests green.

- [ ] `q` (registration-bound) + `defineQuery<S>()`
- [ ] `$only` / `$skip` constants
- [ ] validation types: root keys, 3-hop traversal, where keys/dot-paths, operator table, order rules, `QERR_*` messages
- [ ] `shapeResult` pure function: normalization, `$only`/`$at`/`$as`, `$m` (`indexBy`/`groupBy`/`at`), single-pass `$m`
- [ ] type-level shaping mirror (return types match runtime keys by construction)
- [ ] `IdbQuery`, `IdbQueryOptions`, `IdbQueryData`, `IdbQueryEntity`, `IdbQuerySubquery`, `IdbQueryFields`, `IdbQueryPageInfo`
- [ ] `.dx.test.ts`: every validation level + every `QERR_*` message at its cursor; inline vs factory localization both locked
- [ ] `.test-d.ts`: shaping shapes ($only/$at/$as/$m, nested links, singularize modes)
- [ ] runtime suite: `shapeResult` against fixture data

### Phase R3 — typed tx (global phase 2)

Done when: tx dx + type tests green.

- [ ] typed tx proxy: per-label cardinality typing on `.link`
- [ ] dot-path `.link` keys → `lookup()` compilation (one hop, unique fields only)
- [ ] `.ruleParams` typing from schema declarations
- [ ] `IdbTxChunk`, `IdbTxUpdate`, `IdbTxCreate`, `IdbTxLink`, `IdbTxRuleParams`
- [ ] `id` / `lookup` re-exports
- [ ] `.dx.test.ts`: link-label + dot-path completions; ruleParams completions; wrong-value diagnostics
- [ ] runtime suite: dot-path compiles to official `lookup()` wire form
