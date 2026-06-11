updated: 2026-06-11
status: settled law — referenced by every spec; changes here ripple everywhere

# dux — conventions

The cross-cutting law: vocabulary, naming policy, and the handful of rules that make every dux surface feel like one library. [dux-vision.md](./dux-vision.md) principle 4 is the why — one term, one meaning, learn once, use everywhere; this doc is the what.

Every name must pass three questions:

1. **Which domain does it belong to** — and does the name place it there?
2. **Is it technically accurate** — does it describe what the thing *is*, not what an ancestor happened to call it?
3. **Is the term reused consistently** everywhere the concept appears?

dux holds itself to all three because the official surface doesn't: three brand prefixes (`Instant*`, `Insta*`, `InstantDB*`), `InstaQLParams` naming the query object "params", `InstaQLResult` and `InstaQLResponse` naming the *same shape* twice, `User` meaning "authenticated user", and the schema API disagreeing with the docs on entity-vs-namespace. dux serves a single mental model instead; official names map to dux names at the boundary.

- [1. Vocabulary](#1-vocabulary)
- [2. Values vs types](#2-values-vs-types)
- [3. The result pattern](#3-the-result-pattern)
- [4. The primary-read rule](#4-the-primary-read-rule)
- [5. Native keys and wrapped verbs](#5-native-keys-and-wrapped-verbs)
- [6. The `$`-prefix rule](#6-the--prefix-rule)
- [7. Schema registration](#7-schema-registration)
- [8. The rename table](#8-the-rename-table)
- [9. Coexisting with official packages](#9-coexisting-with-official-packages)
- [10. Perms vocabulary](#10-perms-vocabulary)

---

## 1. Vocabulary

| Term | Means |
|---|---|
| **namespace** | a named set of entities (`workspaces`, `$users`) |
| **entity** | one record in a namespace |
| **attribute** | umbrella: any property of an entity — a field or a link |
| **field** | a *local data* attribute (string, number, boolean, date, or json — including arrays and objects) — the same word in schema (`fields:`), queries (`$: { fields }`), and perms (`entityField`) |
| **link** | a relationship between **entities**, declared between two namespaces — which may be the same namespace (self-links are legal; verified against core's `LinkDef`) |
| **ref** | a traversal across links (`entityRef('memberships.user.id')`, nested query keys) |
| **webhook** | a configured delivery subscription: which namespaces' changes Instant POSTs where |
| **change** | one entity change a webhook delivers — `action` + `before`/`after` (the official SDK says "payload record"; *change* is what the thing is, and keeps **record** unclaimed so "entity = one record in a namespace" stays unambiguous) |
| **payload** | the delivered batch of changes for one webhook event |

These words appear with exactly these meanings in schema, queries, tx, perms, admin, and webhooks. Note `namespaces:`/`i.namespace()`/`fields:` in `defineSchema` — consistent with Instant's own docs vocabulary, which the official schema API (`entities:`/`i.entity()`) does not match.

## 2. Values vs types

**Values are unprefixed:** `init`, `defineSchema`, `q`, `definePerms`, `defineDb`, `defineServerKit`, `defineAuthSyncHandler`, `id`, `lookup`. The package specifier already namespaces them; a userland clash is one `import { init as idbInit }` away. No brand words inside dux-owned value names; re-exported official values keep their official names.

One exception: error classes (`IdbError`) keep the brand — `e instanceof IdbError` must read branded next to other libraries' errors.

**Types are `Idb`-prefixed and domain-scoped:** `Idb<Domain><Thing>`, with domains `Query`, `Tx`, `Perms`, `Auth`, `Room`, `Storage`, `Webhook`, `Admin` (and `Platform`, `Migration` reserved for the deferred platform track) — and **schema as the unmarked root domain**: a type read directly off the schema goes unmarked (`IdbEntity`, `IdbSchema`); a type derived through other machinery says which (`IdbQueryEntity`, `IdbTxUpdate`). Anything unmarked = "straight from your schema."

If idb ever ships an API whose name collides with a dux value, its purpose almost certainly overlaps ours (a future official `defineSchema` would… define a schema) — we absorb the new capability into ours and keep shipping ours. Only a collision with *zero* purpose overlap forces a rename: rare, and a find-and-replace when it happens.

## 3. The result pattern

Every stateful client hook returns `Idb<Domain>Result` with `-Data` / `-State` / `-Refs` subparts (`IdbQueryResult`, `IdbQueryResultData`, `IdbQueryResultState`, `IdbQueryResultRefs`; same pattern for `IdbAuthResult`, `IdbRoomPresenceResult`, …). Learn one, know all.

The result pattern is a *client-reactivity* concept. Server one-shots return plain shaped data and deliberately don't claim it ([dux-spec-admin.md](./dux-spec-admin.md)).

## 4. The primary-read rule

**The bare name goes to the surface's primary read.** On a client the subscription is primary, so it owns `useQuery` and the one-shot carries the marker (`queryOnce`); on a server db the one-shot is primary, so it owns `query` and the subscription carries the marker (`subscribeQuery`). Same law, both directions.

## 5. Native keys and wrapped verbs

Native keys are kept verbatim wherever dux doesn't change their meaning — `where`, `order` (not `orderBy`), `limit`, `offset`, `fields`. A key is renamed only when dux genuinely widens its semantics, always mapping back to the native key under the hood.

The same restraint extends to **method names on wrapped surfaces** (admin auth/storage/streams, the webhooks manager): official verbs that are already precise are kept verbatim; a method is renamed only when the official name is inaccurate or dux changes what it means. Each spec records its surface's renames with the reason ([dux-spec-webhooks.md](./dux-spec-webhooks.md) has the canonical examples).

## 6. The `$`-prefix rule

Every dux-introduced key inside an idb-native object is `$`-prefixed: `$only`, `$at`, `$as`, `$m` inside the query `$:` clause. idb uses bare keys there (`where`, `order`, `limit`, `offset`, `fields`), so the `$`-namespace is ours; a future collision is a codemod, not a redesign.

The rule, stated once: dux's *top-level exports are unprefixed*; dux's *keys inside an idb-native object are `$`-prefixed*; the *vendored baseline is internal-only*.

## 7. Schema registration

Generic type aliases cannot be partially applied in TypeScript, so a curried `type IdbEntity = DefineIdbEntity<AppSchema>` form is impossible. The mechanism that delivers the no-repetition DX is module-augmentation registration (the TanStack-style `Register` pattern), declared once next to the schema:

```ts
// instant.schema.ts
export const schema = defineSchema({ /* ... */ })

declare module '@mszr/idb-dux' {
  interface IdbRegister { schema: typeof schema }
}
```

From then on, project-wide:

```ts
import { q } from '@mszr/idb-dux' // q ships ready-made — no defineQuery<AppSchema>() step

type Todo = IdbEntity<'todos'>
type TodoCard = IdbQueryEntity<'todos', { assignee: {} }>

const query = q({ todos: { $: { where: { isDone: false } } } })
```

**The boundary rule: registration supplies types, not values.** Everything type-only defaults to the registered schema — all `Idb*` type utilities, the exported `q` (whose runtime is schema-independent; its validation is type-level), and the webhook handler types. Anything that needs the schema *value* still receives it explicitly — `defineDb`, `init`, `definePerms(schema)` — because runtime singularization and runtime validation cannot come from a type.

Multi-schema escape hatch: an explicit trailing type param (`IdbEntity<'todos', OtherSchema>`) and `defineQuery<OtherSchema>()`.

## 8. The rename table

The pattern and the non-obvious calls. Each spec carries its surface's *complete* table; wrapped-surface types follow the same machinery mechanically (`FileOpts` → `IdbStorageFileOpts`, `DebugCheckResult` → `IdbAdminCheckResult`, …).

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
| `User` | the **authenticated** user | `IdbAuthUser` |
| `AuthState` | `{ isLoading, user, error }` | `IdbAuthState` |
| `Config` / `InstantConfig` | init config, duplicated | `IdbConfig` |
| `InstantSchemaDef` | the schema type | `IdbSchema` |
| `InstantRules` | compiled permissions | `IdbPerms` (assignable to `InstantRules`) |
| `RuleParams` | `{ [k: string]: any }` | `IdbTxRuleParams<'ns'>` / `IdbPermsRuleParams<'ns'>`, schema-typed |
| `TransactionChunk` | one tx step | `IdbTxChunk` |
| `UpdateParams` / `CreateParams` / `LinkParams` | op payload shapes | `IdbTxUpdate<'ns'>` / `IdbTxCreate<'ns'>` / `IdbTxLink<'ns'>` |
| `RoomsOf` / `PresenceOf` / `TopicsOf` | room shape extractors | `IdbRooms` / `IdbRoomPresence<'room'>` / `IdbRoomTopics<'room'>` |
| `InstantAPIError` / `InstantError` / `InstantIssue` | error classes | `IdbError` family |
| `ConnectionStatus` | status union | `IdbConnectionStatus` |
| `SubscribeQueryResponse` | the admin subscription handle | `IdbQuerySubscription` |
| `InstantObject`, deprecated aliases (`InstantQuery`, `InstantEntity`, `InstantGraph`, …) | legacy | **dropped** — never re-exported |

## 9. Coexisting with official packages

dux never claims the official specifiers, so coexistence is always available. When a module imports both dux and an official package that export the same name (e.g. a tool importing `@mszr/idb-dux` and `@instantdb/platform`, each exporting an `i`), the standard ESM answer applies: alias at import (`import { i as pi } from '@instantdb/platform'`). dux's `i` carries *only* the dux dialect (`i.namespace` + the field builders — no `i.entity`, no `i.schema`), so two same-named objects are never half-interchangeable lookalikes that invite confusion.

## 10. Perms vocabulary

The domain term is **perms**, everywhere: `definePerms`, `/perms`, `instant.perms.ts` (CLI-fixed anyway), output type `IdbPerms`. "Rules" is CEL/dashboard vocabulary; the word survives only in prose for a single allow entry. The compile point is **`.compile()`** — it says what happens (authoring AST → CEL strings) and its return type says what you get.

The perms context is **entity-rooted with current unmarked** — the current entity is *the* entity, so it carries no marker; only the *updated* and *linked* states do: `entity`/`e`, `entityField`/`ef`, `entityRef`/`er`; `entityUpdated`/`eu`, `entityUpdatedField`/`euf` (no updated-ref — Instant doesn't support `newData.ref`); `entityLinked`/`el`, `entityLinkedField`/`elf`, `entityLinkedRef`/`elr`. Every `e*` shorthand is entity-family: the second letter says *which* entity (none = current, `u` = updated, `l` = linked), the suffix says *how you read it* (`f` = field by string key, `r` = ref traversal). CEL's `data`/`newData`/`linkedData` are compile targets only — they never appear in the authoring surface. Full table: [dux-spec-perms.md](./dux-spec-perms.md).
