updated: 2026-06-03
status: draft — living document, decisions get promoted to spec as they are settled

# The Ideal idb-vux

A proposal for what `@mszr/idb-vux` should be, approached without constraint by the current implementation. Written as a foundation to work from — decisions made here become the spec that the implementation must satisfy.

---

## 1. What Is Vux?

`@mszr/idb-vux` is the ergonomics-first Vue SDK for InstantDB.

It exists because the official SDK is a solid baseline, but it is not designed around Vue's specific idioms: Pinia stores, the Composition API, SSR with Nuxt, and the `.value` tax. Vux is designed to make all of those feel first-class.

**The contract with the official SDK:**

- Vux's baseline APIs are _behaviorally identical_ to the official `@instantdb/vue` SDK. A developer can replace one with the other for regular APIs without changing behavior.
- Vux's additive APIs extend that baseline without changing it. They live behind explicit naming (`X` suffix, `define*` utilities) so the boundary is always clear.
- Vux does not re-export official Vue internals. It reimplements them, deliberately. This is required for SSR resilience guards, tighter TypeScript, and deep integration with the X layer.

The official SDK is the parity target for behavior. The React SDK is the parity target for capability (SSR hydration, streaming, permissions ergonomics). Vux should eventually match or exceed both, on Vue's terms.

---

## 2. Design Principles

These govern every design decision. When requirements conflict, earlier principles take precedence.

### 1. Errors at the cursor, not the console

The type system is the primary safety layer. Valid TypeScript should mean valid usage. When something is wrong, the error should appear on the specific offending piece — not underlined over the whole call — with an actionable message that says what's wrong and why.

This means:

- deep schema-aware validation in query, filter, and order authoring
- localized error types (`ValidationError<"QERR_WHERE_KEY_UNKNOWN: tags is not...">`), not broad `never` or `unknown` fallbacks
- intellisense suggests valid options at each cursor position, not just validates after the fact

### 2. Predictable contracts

Learning one X API teaches you all of them. There is one reactive pattern and it is applied everywhere. The rule is simple: refs for Vue watchers and composable passthrough, state for `.value`-free script reads, top-level refs for ergonomic destructuring.

No API should surprise you if you already know another.

### 3. Additive, never divergent

The baseline is official Vue. Every Vux enhancement is _additional surface_, not replacement behavior. This means:

- if the official SDK accepts a ref, Vux accepts the same ref (plus more)
- if the official SDK returns a shape, Vux returns that shape (plus extras)
- Vux-specific enhancements are always explicitly named

This makes the feature-parity audit a real artifact that stays useful — it remains possible to diff baseline behavior from the official SDK at any time.

### 4. Pinia-native reactivity

Vue apps use Pinia. Returning SDK state from a Pinia setup store should Just Work. No `skipHydrate`, no `markRaw` ceremony in userland, no cyclical watcher footguns.

The SDK is responsible for wrapping its own state correctly. The user is never responsible for protecting SDK-owned state from Pinia hydration. X `state` projections use the raw getter pattern precisely for this reason.

### 5. SSR-resilient by default, SSR-hydrated by opt-in

Hooks must not crash on server. This is the floor. Inert safe state on server, full subscription on client. No user configuration required.

Full SSR query hydration (server data → serialized → client hydrated without flicker) is the ceiling. It is not yet implemented but the architecture must not rule it out. Hooks should be designed so hydration can be layered in without breaking the client-only path.

### 6. Minimal footprint, maximal ergonomics

Every API Vux adds must eliminate a pattern developers write by hand in real apps. If the savings are less than the learning cost, don't add it. The demo app is the calibration device — if we see repeated boilerplate there, that's a signal. If we see over-engineering there, that's also a signal.

### 7. Progressive disclosure

The happy path is simple. Complexity is available but doesn't pollute the first example. `init`, `useQueryX`, `transact` — that's the hello world. Everything beyond is reachable but not required.

### 8. Fail safely at runtime

When things do go wrong at runtime (missing auth, network drop, SSR mismatch, bad config), errors must be:

- safe — no crash that takes down the whole page
- surfaced — not silently swallowed
- recoverable — the user can do something about them

For SSR specifically: inert safe state is always preferable to an exception.

---

## 3. Package Structure

### Main: `@mszr/idb-vux`

The client-side Vue SDK. Everything a Vue/Nuxt app needs for realtime data, auth, presence, cursors, and typed queries.

### Nuxt subpath: `@mszr/idb-vux/nuxt`

H3/Nitro server utilities for Nuxt apps:

- `defineInstantAuthSyncHandler` — first-party auth sync endpoint
- `defineServerIdb` — composable server-side admin/user DB access

This lives in `/nuxt` (not `/admin` or `/server`) because the ergonomics are H3-specific: they depend on the `H3Event` type, `useRuntimeConfig`, and Nuxt's event-context caching convention. A framework-agnostic admin wrapper would be a different abstraction.

**Open question**: if someone needs admin ergonomics outside of Nuxt (e.g. in a plain Nitro or Express server), is `/nuxt` the right subpath? One option is to eventually rename to `/server` with H3 as the only server dependency, since H3 is standalone and not Nuxt-exclusive. Not blocking now.

### Permissions subpath: `@mszr/idb-vux/permissions` (planned)

Schema-aware permission rule authoring. Not part of the client runtime, not bundled by default. See the existing permissions feasibility doc for the design direction.

### CLI entry: `@mszr/idb-vux/cli` (internal)

Already exists. Not public surface — used for version reporting.

### What we do NOT do

- No separate `@mszr/idb-vux-admin` package. The admin wrapping belongs in subpaths, not a new package, to keep the mental model simple.
- No re-export barrel from the official `@instantdb/vue`. We own our implementation.

---

## 4. API Families

### 4.1 Baseline APIs (parity layer)

These are functionally identical to the official Vue SDK. A developer who knows the official SDK can use these without reading Vux docs.

| API | Notes |
| --- | --- |
| `init(config)` | same config shape as official |
| `db.useQuery(query, opts?)` | reactive ref outputs, same input surface |
| `db.useInfiniteQuery(query, opts?)` | same |
| `db.queryOnce(query, opts?)` | same |
| `db.useAuth()` | destructurable refs `{ isLoading, user, error }` |
| `db.useUser(opts?)` | same strictness semantics |
| `db.useConnectionStatus()` | same |
| `db.useLocalId(name)` | reactive name input |
| `db.room(type, id)` | reactive inputs, store-friendly raw handle |
| `db.rooms.usePresence(room, opts?)` | same |
| `db.rooms.useSyncPresence(room, presence)` | same |
| `db.rooms.useTypingIndicator(room, inputName)` | same |
| `db.rooms.useTopicEffect(room, topic, cb)` | same |
| `db.rooms.usePublishTopic(room, topic)` | same |
| `db.transact(...)` | same |
| `db.auth.*` | same |
| `db.storage.*` | same |
| `db.streams` | same |
| `db.tx` | same |
| `SignedIn`, `SignedOut` | same components |
| `Cursors` | same + Vux enhancements |
| `tx`, `id`, `lookup`, `i`, `createInstantRouteHandler`, etc. | re-exported from core |

Differences from official Vue that are intentional:

- SSR resilience guards on all hooks (hooks don't crash on server)
- Tighter TypeScript (fewer `any`, narrower return types)
- Omission of deprecated type aliases (`InstantQuery`, `InstantQueryResult`, etc.)

### 4.2 X APIs (ergonomics layer)

X APIs wrap the baseline with a consistent ergonomics pattern. They always return:

1. **Top-level refs** — direct destructuring (e.g. `const { todos, isLoading } = db.useQueryX(...)`)
2. **`.refs`** — named ref alias group for composable passthrough (`return { ...query.refs }`)
3. **`.state`** — raw getter projection for `.value`-free script reads (`query.state.todos`)

All three access paths read the same underlying reactive source.

| API | Notes |
| --- | --- |
| `db.useQueryX(query, opts?)` | namespace defaults to `[]`, typed authoring |
| `db.useInfiniteQueryX(query, opts?)` | same pattern for infinite queries |
| `db.queryOnceX(query, opts?)` | typed + namespace defaults, async |
| `db.useAuthX()` | auth with X ergonomics |
| `db.useUserX(opts?)` | user with X ergonomics + strictness policy |
| `db.useConnectionStatusX()` | connection status with X ergonomics |
| `db.useLocalIdX(name)` | local id with X ergonomics |
| `db.rooms.usePresenceX(room, opts?)` | presence with X ergonomics |
| `db.rooms.useTypingIndicatorX(room, inputName)` | typing indicator with X ergonomics |

X APIs that were considered but rejected or deferred:

- `db.roomX(...)` — not enough benefit over regular `db.room()` (see misc-dx-ux-proposals-feasibility.md)
- `useTopicEffect`, `useSyncPresence`, `usePublishTopic` — side-effect only, no stable result to project

### 4.3 Authoring utilities

These are tools for _writing_ code rather than runtime APIs.

| Utility | Notes |
| --- | --- |
| `defineQuery<Schema>()` | typed query authoring helper; validates shape and where filters against schema |
| `defineDb(config)` | memoized db factory for runtime app-id sources |

**`defineQuery` is the primary authored surface for queries.** The pattern is:

```ts
// shared/utils/idb.ts
export const q = defineQuery<AppSchema>()

// in a composable
const { todos } = db.useQueryX(() => q({
  todos: {
    $: { where: { isDone: false } },
    assignee: {},
  },
}))
```

`q()` provides intellisense, validates namespace keys, validates where filter types, and passes through the normalized query shape to `useQueryX`. The `q` helper should feel like a transparent layer — not a different syntax.

### 4.4 Server utilities (`@mszr/idb-vux/nuxt`)

| Utility | Notes |
| --- | --- |
| `defineServerIdb(config)` | composable server DB factory with mode-based auth |
| `defineInstantAuthSyncHandler(config)` | H3 handler for Instant's `firstPartyPath` |

The `defineServerIdb` returned helper is called per-event and caches auth work (token read, `verifyToken` promise, scoped DBs) within the H3 event context. Callers compose freely without managing cache keys.

---

## 5. Return Value Ergonomics

### 5.1 The X pattern

The X pattern solves a real problem: Vue's `.value` accessor is noise in script logic, but refs are required for composition and watching. The X pattern serves both use cases from the same source without duplication.

```ts
const query = db.useQueryX({ todos: {} })

// In <script setup> — no .value needed
if (!query.state.isLoading && query.state.todos.length > 0) {
  // ...
}

// In a composable — explicit refs for forwarding
function useTodos() {
  return { ...db.useQueryX({ todos: {} }).refs }
}

// In a watcher — ref as source
watch(query.isLoading, (loading) => { /* ... */ })

// In a template — ref auto-unwraps
// <div v-if="query.isLoading.value">...</div>  ← works
```

### 5.2 Namespace array normalization

`useQueryX` returns namespace arrays defaulted to `[]`, not `undefined`. This is the single biggest ergonomic improvement over the baseline `useQuery`.

Without normalization:

```ts
const { data } = db.useQuery({ todos: {} })
const todos = computed(() => data.value?.todos ?? [])
```

With X:

```ts
const { todos } = db.useQueryX({ todos: {} })
// todos.value is always Todo[], never undefined
```

`queryOnceX` does the same for imperative reads:

```ts
const { todos } = await db.queryOnceX({ todos: {} })
// todos is always Todo[]
```

### 5.3 Singular namespace returns (open question)

The `limit: 1` → `Entity | null` idea is appealing for cases like "current user's active session" or "workspace by invite code". TypeScript can express this if the limit value is a literal in the type position.

Two options:

**Option A: literal `'one'` string in limit**

```ts
const { workspace } = db.useQueryX(q({
  workspaces: {
    $: { where: { inviteCode: code }, limit: 'one' },
  },
}))
// workspace.value: Workspace | null  (not Workspace[])
```

The string `'one'` instead of `1` is the signal that the type should change. TypeScript can discriminate this at compile time.

**Option B: separate composable (e.g. `useFirst`, `useOne`)**

```ts
const workspace = db.useFirst(q({ workspaces: { $: { where: { inviteCode: code } } } }), 'workspaces')
```

This is simpler to type but more awkward to use and harder to discover.

**Recommendation**: Option A is worth exploring if the type complexity stays manageable. It maps directly to the mental model ("I want one item"). Option B is the fallback. Neither is a blocker — the `todos.value[0] ?? null` pattern is not painful enough to justify complexity that hurts maintainability.

### 5.4 Pinia safety

X `state` uses the raw getter projection pattern (`markRaw` + `Object.defineProperty` getters). This means:

- Pinia does not try to make it reactive or hydratable
- Assigning to `state.field` fails at the property level (not just a type error)
- Watchers inside Vue effects still track through correctly because getters read the underlying refs

No user configuration is required. Returning `query.state` from a Pinia setup store is safe.

---

## 6. Type Safety and Intellisense Goals

### 6.1 What should work

**Namespace-level:**

- Top-level query keys are limited to schema namespaces
- Link traversal suggestions go at least 2 hops deep (e.g. `workspaces.memberships` when querying `workspaces` that have a `memberships` link)
- Invalid namespace keys show a localized error: `"QERR_QUERY_ROOT_KEY_UNKNOWN: foo is not a valid namespace"`

**Where filter-level:**

- Attribute keys are limited to `id`, schema attributes, and linked dot-paths (e.g. `'memberships.user.id'`)
- Operator availability is attribute-aware:
  - `$gt`, `$lt`, etc. only suggested/valid on indexed attributes
  - `$like` only suggested/valid on string attributes
  - `$ilike` only suggested/valid on indexed string attributes
  - `$isNull` only suggested/valid on optional attributes
- Invalid operators show localized errors: `"QERR_WHERE_INDEX_REQUIRED: tasks.title cannot use $gt. Mark the attribute as indexed."`
- Invalid dot-path keys show: `"QERR_WHERE_KEY_UNKNOWN: tagName is not a valid where key on tasks."`

**Order-level:**

- Only indexed attributes and `id` are valid order fields
- Valid direction values (`'asc'`, `'desc'`) are validated

**Link traversal-level:**

- Nested query keys are limited to defined link labels
- Invalid nested keys show: `"QERR_QUERY_NESTED_KEY_UNKNOWN: foo is not a valid nested key on tasks."`

**Return type-level:**

- `useQueryX` return types are derived from the query shape and schema
- `InstaQLEntity<Schema, 'tasks', { assignee: {} }>` is the return type for tasks with assignee linked
- Namespace arrays are `Entity[]`, never `undefined`

### 6.2 Intellisense regression prevention

This is a known pain point. Intellisense broke at some point without detection. The fix is treating intellisense as a testable property, not a subjective experience.

**Strategy**: Use selenita to write intellisense tests alongside type tests.

A type test verifies that `MyType extends ExpectedType` — it tests correctness of the type.

An intellisense test verifies that at a given cursor position, the expected completions appear — it tests the experience of authoring.

These are different. A type can be correct but completions can still be poor (e.g., when the inferred type becomes `string & {}` instead of a union of string literals, TypeScript stops suggesting the members). Intellisense tests catch this.

**Coverage targets:**

- `q({ /* cursor here */ })` should suggest all schema namespace names
- `q({ todos: { $: { where: { /* cursor here */ } } } })` should suggest `id`, attribute names, and linked dot-paths
- `q({ todos: { $: { where: { isDone: /* cursor here */ } } } })` should suggest `boolean` values and boolean-compatible operators
- `db.useQueryX(...)` return: `const { /* cursor here */ } = query` should suggest namespace names + `isLoading`, `error`
- `query.state./* cursor here */` should suggest same as above

Intellisense tests should be run on every build and on every change to `defineQuery.ts` or `InstantVuxDatabase.ts`.

### 6.3 The intellisense regression root cause (hypothesis)

The current `defineQuery.ts` uses deeply nested conditional types that validate queries. Deeply nested conditionals cause TypeScript to:

1. Hit distributive conditional type explosion on unions
2. Fall back to deferred inference (type becomes an opaque `infer T`)
3. Stop generating completions for properties of deferred types

The likely fix area: validation types should not be part of the _return_ type of the query authoring helper. They should only appear as _parameter_ types (constraining what you can pass in). The returned type should always be the normalized query shape, never the validation wrapper.

This means: if `defineQuery` currently returns `ValidateTypedQueryForSchema<S, Q>`, that's wrong — it's returning the validation error type which may not resolve cleanly as a concrete object. It should return `DefinedQuery<Q>` (the normalized query shape), with the validation appearing as a constraint on the parameter `Q`.

This hypothesis should be tested with a selenita intellisense suite before any refactor.

### 6.4 lookup type safety

`lookup(field, value)` in core is untyped (`any`). A typed `lookup` would validate that:

- `field` is an indexed attribute of the target namespace
- `value` matches the attribute's type

This requires knowing the namespace at call-site, which means `db.lookup('fieldName', value)` (namespace-aware) or a typed wrapper via `defineQuery`. Worth a feasibility spike — the value is real, permissions and transactions use `lookup` frequently.

---

## 7. SSR Story

### Current state

`@mszr/idb-vux` is SSR-resilient:

- hooks return safe inert state on server
- no crashes, no subscriptions on server
- realtime starts on client after hydration

`@mszr/idb-vux/nuxt` adds:

- `defineInstantAuthSyncHandler` for auth cookie sync
- `defineServerIdb` for server-side data access (admin DB, user-scoped DB)

### The intentional cookie difference

Official SDK: `createInstantRouteHandler` stores the full user JSON in `instant_user_<appId>`.
Vux: `defineInstantAuthSyncHandler` stores only the `refresh_token` in `instant_token_<appId>`.

This is intentional: smaller cookie, less user profile data, cleaner semantics. `createInstantRouteHandler` is still re-exported through the main package for apps that need the official flow.

### Full SSR hydration (planned)

Full hydration means:

1. Server runs queries and collects results
2. Results are serialized into the HTML payload
3. Client receives HTML + payload and hydrates the query cache
4. UI renders immediately without loading states, then transitions to live subscriptions

This requires:

- A server-side query runner (`FrameworkClient` in core already provides this)
- A Nuxt plugin that collects server results and serializes them as `useNuxtApp().$ssrQueryPayload`
- A client-side hydration step that feeds collected results into the core reactor before subscriptions start

The SSR hook guards already in place are compatible with this model — inert server state would be replaced by real hydrated state on client. No breaking changes to existing usage.

This is future work. It should not be designed against — it should be preserved as an open upgrade path.

### `defineServerIdb` scope

The current design is clean: the user provides `init` from `@instantdb/admin` and `defineServerIdb` wraps it. Vux does not own the admin SDK runtime. This keeps the bundle footprint small and avoids coupling.

The mode-based API (`'adminDb'`, `'userDb!'`, `'user?'`, etc.) is the right ergonomics: each route asks for exactly what it needs, and the helper internally caches and reuses resolved auth state within the same request.

**Gaps to address:**

- `adminDb.query(q({ ... }))` does not benefit from `defineQuery` typed authoring in server routes. The `q` helper exported from the client shared utils is reachable but not encouraged. Consider whether server routes should naturally receive a `q` helper from `defineServerIdb` context.
- The admin SDK `transact` does not normalize namespace arrays (the ergonomic gap felt in the demo). This is a reasonable target for server-side ergonomics in the nuxt subpath.

---

## 8. Testing Strategy

### The problem with the current test suite

The current test suite has ~37 test files. Many of them overlap in intent and were written opportunistically rather than designed. The result: high file count, unclear coverage, some tests testing things we don't care about.

A better test structure has three distinct layers:

### Layer 1: Behavior tests (Vitest, `.test.ts`)

Test that hooks produce the right output given simulated inputs. Focus on:

- reactive update flows: when core emits a new query result, does the hook emit the expected refs/state change?
- error propagation: does an error from core surface in `error` ref correctly?
- SSR inert behavior: do hooks return safe state and no-op on server?
- auth-sync handler: does cookie write/clear happen correctly?
- server idb: do mode requests cache and fail correctly?

**Not** in behavior tests: type shapes (that's type tests), intellisense suggestions (that's selenita).

### Layer 2: Type tests (`.types.ts`, `tsc --noEmit`)

Test that the TypeScript types are correct. Focus on:

- valid usage compiles
- invalid usage produces the expected error type (using `@ts-expect-error`)
- return types match expected shapes
- where filter validation produces correct error messages

Current type test files cover this reasonably well. Gaps: some files test too many things and should be split by concern.

### Layer 3: Intellisense tests (selenita, `.intellisense.ts`)

Test that the TypeScript Language Service generates the expected completions. Focus on:

- what completions appear at a given cursor position
- that the completion list is not empty when it shouldn't be
- that the completion list does not contain unexpected suggestions

This is the layer that is currently _missing entirely_. This is the layer that would have caught the intellisense regression.

### Coverage targets (not "more tests = better")

One behavior test per realistic usage scenario, not one per permutation. One type test file per API surface, covering the happy path + each known invalid case. One intellisense test per cursor position that matters.

The goal is high _confidence_, not high _count_. Confidence comes from tests that fail when real regressions happen, not tests that merely assert types that the compiler already guarantees.

---

## 9. Permissions DX (planned)

The existing feasibility doc (`permissions-dx-feasibility.md`) covers the design well. Key points preserved here:

- New subpath: `@mszr/idb-vux/permissions`
- API: `definePermissions<Schema>()` returning a builder `p` with helper families
- Helpers emit CEL strings → `InstantRules<Schema>` output (no backend changes)
- Schema-aware path checking, action-context gating, operator guardrails
- Incremental adoption: raw strings and helpers can be mixed

The helper naming convention (`$and`, `$auth`, `$data`, etc.) with `$` prefix is the right call — avoids Vue `ref` ambiguity, avoids JS reserved words, visually distinct from app code.

**Open design question**: the current proposal models permissions as a builder that produces rules at module load time. An alternative: permissions are just types (no builder object), and users author rules as plain strings but the type system validates them. This is harder to implement but more ergonomic — no builder DSL to learn. Worth a comparison spike before committing.

---

## 10. Intentional Non-Goals

Things Vux explicitly does not do, and why.

**Does not manage a global app-level db singleton.** Each call to `init` or `defineDb()` creates a scoped db. Global state is the app's responsibility.

**Does not abstract transact/tx.** Mutation ergonomics are excellent in core. Wrapping them would add indirection with no gain.

**Does not implement SSR query hydration yet.** It's planned but not current. Designing for it is required; implementing it now is not.

**Does not re-export deprecated type aliases.** `InstantQuery`, `InstantQueryResult`, `InstantSchema`, `InstantEntity`, `InstantSchemaDatabase`, `InstantGraph` are `@deprecated` in core. Omitting them from Vux is intentional.

**Does not hide the core type surface.** `InstaQLEntity`, `InstaQLParams`, `InstaQLResult`, `InstantSchemaDef`, etc. are all exported. Users who need the underlying types can access them.

**Does not guarantee forward-compatibility with arbitrary Instant server changes.** We track the official SDK and rebase. Runtime protocol changes are upstream's concern.

---

## 11. Open Questions for Brainstorming

These are unresolved and worth discussion before they become spec.

### Q1: Should X APIs be the _primary_ API rather than the additive one?

Currently: `useQuery` is the baseline; `useQueryX` is additive.

Alternative framing: `useQueryX` _is_ the recommended path, and `useQuery` is the official-SDK-compatible alias. The distinction matters for docs, discoverability, and mental model. If Vux recommends `useQueryX` first, users arriving from the official docs need to learn one more thing upfront but get better DX. If Vux recommends `useQuery` first, the upgrade path to X is always there but users may never discover it.

**Lean**: make X the recommended primary API. The baseline parity is preserved for interop, not as the primary ergonomics story. This is a documentation/framing change, not an implementation change.

### Q2: Is the `nuxt` subpath name the right home for admin server ergonomics?

Currently `@mszr/idb-vux/nuxt` holds H3-flavored server utilities. H3 is technically standalone (not exclusively Nuxt), and the ergonomics could apply to any H3 server. But in practice the primary target is Nuxt apps. The name `nuxt` is clear to the target audience and not misleading.

**Lean**: keep `nuxt` for now. If a non-Nuxt H3 use case appears, it can import from `/nuxt` or we can add a `/server` alias.

### Q3: How should the server-side `q()` helper work?

In the demo, server routes import `q` from `~~/shared/utils/idb.ts` (a client-facing shared file). This creates a subtle coupling: the server route uses a client-derived query authoring helper. In a pure server context, this works today, but it implies the schema is shared and the client shared utils are always available.

Alternative: `defineServerIdb` could accept `schema` and expose a `q` helper of its own, decoupled from the client helper. Server routes would then use `idb.q(...)` instead of importing from shared.

**Lean**: worth doing. Keeps server routes self-contained. `defineServerIdb` already takes `schema`, so it has everything needed to produce a typed `q`.

### Q4: Should `limit: 'one'` be supported in `useQueryX`?

As described in section 5.3. Worth prototyping the TypeScript first to see if it's clean before deciding.

**Lean**: spike it. If the return type inference stays clean (no complex conditional gymnastics visible to the user), ship it. If the types become opaque or hurt intellisense, skip it.

### Q5: What is the right scope for the test suite refactor?

The current 37 test files have value but are noisy. A refactor would:

- delete tests that test the same thing as other tests with different data
- delete tests that test internal implementation details the user doesn't care about
- move type tests that are really "does this compile" to a single typecheck pass rather than duplicating logic
- add selenita intellisense tests

This is a significant effort but pays off in long-term maintainability. Should it happen before or after the intellisense regression fix?

**Lean**: fix the intellisense regression first (it's blocking usability), then refactor the test suite as part of adding selenita coverage. Doing both at once is too risky.

---

## 12. Phased Action Plan

This is a rough sequence. Items within a phase can be parallelized.

### Phase 0: Stabilize (current blocker)

- [ ] Identify the exact intellisense regression: which cursor positions are broken, which hooks are affected
- [ ] Write selenita intellisense tests for the known-broken positions to capture the baseline
- [ ] Fix the regression (likely: return type of `defineQuery` should not propagate validation error types)
- [ ] Confirm fix restores completions at all tested positions
- [ ] Run full typecheck + behavior test suite to confirm no regressions

### Phase 1: Spec the X pattern formally

- [ ] Write a formal one-pager spec for the X return contract (superset of the raw-getter-state-projection note)
- [ ] Document all X APIs with their exact return types and access patterns
- [ ] Write intellisense tests for all X API cursor positions
- [ ] Make X the recommended primary API in the README and docs

### Phase 2: Permissions DX

- [ ] Prototype `definePermissions` with core bool/comparison helpers and schema path checking
- [ ] Evaluate the "typed strings" alternative (no builder object) against the builder DSL
- [ ] Ship `@mszr/idb-vux/permissions` subpath with Phase 1 helpers (as in permissions feasibility doc)
- [ ] Write type tests for validation and compiler error messages
- [ ] Add intellisense tests for path suggestions inside `$data.field(...)`, `$auth.ref(...)`, etc.

### Phase 3: Server DX improvements

- [ ] Add `q` helper to `defineServerIdb` return value
- [ ] Add namespace array normalization to `defineServerIdb` result helper (admin.queryX pattern)
- [ ] Evaluate typed `lookup` for server mutation paths
- [ ] Add intellisense tests for server route authoring patterns

### Phase 4: Test suite health

- [ ] Audit all 37 test files against the three-layer strategy
- [ ] Delete tests that are redundant or test internals
- [ ] Consolidate type tests by API surface
- [ ] Add selenita intellisense test coverage for all documented cursor positions
- [ ] Document test strategy explicitly so future test additions have clear placement guidance

### Phase 5: Full SSR hydration (future, design-now implement-later)

- [ ] Write a formal design for the Nuxt SSR hydration plugin
- [ ] Prototype `useSuspenseQuery` or equivalent for Nuxt's hydration model
- [ ] Ship as an experimental opt-in in `@mszr/idb-vux/nuxt`

---

## 13. Tracking Decisions

As we settle open questions and validate proposals, record them here.

| Question | Decision | Rationale | Date |
| --- | --- | --- | --- |
| — | — | — | — |
