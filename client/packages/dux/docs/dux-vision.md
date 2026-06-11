updated: 2026-06-11
status: living hub — the vision, the architecture, and the index over every dux doc

# dux — vision

> dux is a DX/UX-first reimagining of the InstantDB developer experience. It keeps Instant's backend, wire protocol, and rules engine exactly as they are, and rebuilds the authoring and client surface around a single question: *what would feel most delightful to use?*

This is the hub. It holds the philosophy, the design principles, the scope edge, the architecture, the sustainability model, and the global roadmap. Everything operational lives in the docs it indexes ([§9](#9-the-docs)).

- [1. What dux is](#1-what-dux-is)
- [2. Design principles](#2-design-principles)
- [3. The scope edge](#3-the-scope-edge)
- [4. Architecture](#4-architecture)
- [5. How dux stays alive](#5-how-dux-stays-alive)
- [6. Testing in one view](#6-testing-in-one-view)
- [7. Deferred intentions](#7-deferred-intentions)
- [8. Implementation roadmap](#8-implementation-roadmap)
- [9. The docs](#9-the-docs)

---

## 1. What dux is

`@mszr/idb-dux` is one package with six entrypoints: a framework-agnostic foundation at the root, and five thin overlays — `/vue`, `/perms`, `/admin`, `/webhooks`, `/nuxt` — each delightful on its own terms.

### 1.1 The organizing insight: two planes

InstantDB's developer surface is really two planes:

- **The framework-agnostic plane** — how you *describe* and *address* your data: the schema, the permission rules, the shape of a query, the admin/server reads, the webhooks your server receives. None of this is Vue, React, or Svelte.
- **The framework-coupled plane** — how your *components* consume live data: reactive bindings, lifecycle, SSR. This genuinely differs per framework.

The official SDKs optimize the coupled plane per framework and leave the agnostic plane thin and stringly-typed: schema lives in `core` but reads React-shaped, permissions are stringly-typed CEL with no schema awareness, the admin SDK has different ergonomics from the client, webhook types charge the schema generic at every call site. dux inverts the priority: **make the agnostic plane excellent once, and let each client binding be a thin, delightful overlay on top of it.** `defineSchema` and `definePerms` are not framework features — they are idb features that no idb SDK ships.

### 1.2 The only hard contract is the backend

> **dux owes behavioral compatibility to Instant's backend, not API compatibility to Instant's SDKs.**

Everything dux emits must be something Instant already understands: `defineSchema` compiles to the same entity/link shape the CLI pushes, `definePerms` compiles to the same `InstantRules` CEL strings, every query goes out as a wire query `instaql` accepts. **Inside** that envelope dux is free. dux is not a drop-in for the official SDKs and does not pay the tax of pretending to be: the moment an official-SDK shape is *less* delightful than what we can express, we leave it behind — as long as the *output* still satisfies the backend.

The enhanced behavior is the default, unsuffixed surface. There is no public "official-compatible" layer: a developer who wants official behavior uses the official SDK. (A vendored, internal mirror of `@instantdb/vue` exists purely as the parity/port anchor — [§5](#5-how-dux-stays-alive) — and is never exported: exposing it would force a second `db` instance, since methods bind to how `init` built them.)

### 1.3 Vue and Nuxt are the first clients, not the definition

The layered architecture means a `/react` or `/solid` could be added later as another thin overlay on the same agnostic core. We will not build those now (YAGNI), but the structure must not preclude them: the agnostic plane never imports a framework, and that rule is enforced by lint, not discipline ([§4.3](#43-boundaries-are-lint-rules)).

### 1.4 Primary user

This SDK is built first for its maintainer. It is opinionated, deliberate, and optimized for delight — not for the widest possible API surface or the most conservative design choices.

---

## 2. Design principles

The canon. When requirements conflict, earlier principles take precedence. Principles 1–8 rank what dux *is*; 9–12 rank how dux is *built*.

### 1. Delightful

The question "what would feel most delightful to use?" drives every design decision. Delightful means the API disappears — you think about your problem, not the library. What feels natural? What feels like friction? What makes someone say "oh, that's so much nicer"? When there are multiple valid solutions, choose the one that fits the mental model of someone reading and writing the code, not the one that was technically simpler to implement.

Empathy is part of delight. Design for the moment of use, not just the moment of implementation.

### 2. Boilerplate is an active harm

Every repetitive pattern in userland that the SDK could eliminate is a failure to deliver. Empty array normalization, manual `?? null` massaging, `data.value?.namespace` unwrapping — these accumulate. The SDK should eliminate ceremony, not just reduce it. If you find yourself writing the same shape of code twice, that's a signal. DRY runs both ways: the SDK erases repetition in userland *and* keeps one source of truth per concept in its own implementation, so a fix lands once and every surface inherits it ([§4.2](#42-the-dependency-graph)).

### 3. Errors at the cursor, not the console

The type system is the primary safety layer. Valid TypeScript should mean valid usage. When something is wrong, the error should appear *on the specific offending piece* — the invalid field name, the wrong operator, the missing namespace — with an actionable message that says what's wrong and what to do instead.

Not a red underline over the whole call. The specific field. The specific operator. A message you could act on without opening the docs.

### 4. Self-documenting

Reading the SDK implementation without prior context should make intent clear. Names match mental models. Structure reflects intent. Types are as narrow as they can be without becoming hard to use. `any` is a last resort, not a convenience. Comments explain *why*, not *what* — the code explains the what.

This applies equally to the API surface: an API whose name, shape, and types tell you what it does without needing to look it up is better than one that requires a mental glossary. Clarity and consistency of naming is paramount across **all** dux surfaces — one term, one meaning, learn once, use everywhere. dux serves a single mental model and protects that simplicity over conformity to the official SDKs' varying conventions; official names map to dux names at the boundary ([dux-conventions.md](./dux-conventions.md)), and clear, meaningful language is treated as the backbone of a sustainable implementation.

### 5. Predictable contracts

Learning one dux API teaches you all of them. One reactive pattern, applied everywhere. One result shape for all query-like APIs. If you understand `useQuery`, you understand `useAuth`. No API should surprise you if you already know another one.

### 6. SSR-resilient floor, SSR-hydrated ceiling

Hooks must not crash on server. That is the floor, non-negotiable. Safe inert state on server, full subscription on client, no configuration required.

Full SSR query hydration — server data → serialized → client hydrated without a loading flash — is the ceiling. By decision it is deferred until upstream marks SSR support stable ([§7](#7-deferred-intentions)), but the architecture must leave the door open. No decisions that would require hooks to be redesigned to support it.

### 7. Additive, never divergent — at the baseline

The internal baseline mirror stays diffable against `@instantdb/vue` with only marked deltas (SSR guards, tighter types, overlay wiring). The public surface composes the baseline and is free to be better — the parity audit applies to the mirror, not to the public API. This keeps upstream porting mechanical.

### 8. Performance parity — and performance in what we add

Match all optimizations the official SDK implements. If core uses `weakHash` for query deduplication, so does dux. SSR resilience guards must not add meaningful overhead on the client path. Performance is not an afterthought.

And dux-only behaviors are optimized as first-class features, not conveniences: when a query declares multiple `$m` projections, they're computed in a single pass over the data, not one reduce per key; `defineServerKit` caches per-event work so repeated calls in one request reuse already-computed values. Fast is good UX — DX matters, but the biggest value of a great library is the quality of the user experiences it enables.

### 9. Plane separation is load-bearing

The framework-agnostic layers never import a framework; only `/vue` may import `vue`, only `/nuxt` may import `h3`. Enforced by lint ([§4.3](#43-boundaries-are-lint-rules)), not discipline. The agnostic plane — authoring *and* the server surfaces — is most of the garden.

### 10. The baseline is a mirror, not a fork

Anything with an official counterpart is vendored-and-marked or wrapped-and-mapped ([§5.1](#51-two-tiers-and-a-test-category)), never creatively reimplemented. Creativity lives in dux's own layer, where upstream churn can't reach it.

### 11. Sustainability is part of the design

Every surface declares how it tracks upstream before it ships: vendor tier, wrap tier, or tested compatibility target. Drift is made visible by tooling, never discovered by users.

### 12. Elegance is a requirement, not a flourish

The implementation must read with the same clarity the API projects — deliberate, DRY, stable, in a constant fight against complexity, slowness, and obscurity. The greatest solutions turn entanglements into inspired simplicity; if a piece can't be explained simply, it isn't done.

---

## 3. The scope edge

dux is a walled garden, and a garden's wall is a promise: **opting in must never lock you out of something Instant can do.** That promise is only honest if the edge is drawn deliberately — every official surface either has a dux home, demonstrably works against dux apps as-is, or is excluded with a reason and a re-entry trigger. An *undocumented* absence is worse than either verdict. All verdicts are grounded in the vendored official sources in this fork.

**The rule that decides every row:** a surface earns a dux subpath when the schema/naming/type system can make it *meaningfully* better (the agnostic plane's leverage); it stays a **pass-through** when the official verbs are already precise and dux would only be renaming for sport; it is a **compatibility target** when it is a *tool that talks to the same backend* rather than an API the app imports; it is **out of scope** when it is coupled to a non-target framework, another language, or has no SDK surface to reimagine.

### 3.1 Package verdicts

| Official package | Verdict | Notes |
|---|---|---|
| `@instantdb/core` | **foundation** | the dependency everything wraps; never a user-facing surface in dux |
| `@instantdb/vue` | **vendored baseline** (internal) | the mirror, the parity anchor ([§5.1](#51-two-tiers-and-a-test-category)) |
| `@instantdb/admin` | **wrapped — `/admin`** (optional peer) | full official surface covered, each piece a decided treatment ([dux-spec-admin.md](./dux-spec-admin.md)) |
| `@instantdb/webhooks` | **wrapped — `/webhooks`** (optional peer) | the textbook dux fit ([§3.3](#33-why-webhooks-is-in-and-why-its-a-subpath)) |
| `@instantdb/platform` | **deferred + compatibility target** | works against dux apps today; dux outputs are valid platform inputs *by construction* (tested); [§3.4](#34-why-platform-is-deferred-and-whats-true-meanwhile) |
| `@instantdb/resumable-stream` | **compatibility target** | consumes an admin db and `db.streams`; works with dux's `adminDb` — locked by a compat test, not wrapped |
| `instant-cli` | **compatibility target** | **push evaluates** `instant.schema.ts` / `instant.perms.ts` (unconfig + jiti — verified in `cli/src/old.js`), so structural output-compat is the whole contract and dux files push today. **pull regenerates official-dialect files** — see the round-trip position ([§3.4](#34-why-platform-is-deferred-and-whats-true-meanwhile)). `auth`/`app`/`webhook`/`email`/`explorer`/`query` commands are backend operations, SDK-agnostic. |
| `@instantdb/mcp` | **compatible, noted** | manages apps through the backend/platform APIs — SDK-agnostic at runtime. Files it scaffolds are official-dialect; the adoption codegen ([§3.4](#34-why-platform-is-deferred-and-whats-true-meanwhile)) is the translation path when that matters. |
| `create-instant-app` | **out of scope** | scaffolds official templates; the dux demo is the dux starter |
| `@instantdb/components` | **out of scope** | the Explorer/devtool components are React-coupled (React peer deps). The hosted dashboard + the core devtool (config passthrough) cover the need. Trigger: upstream ships framework-agnostic or Vue builds. |
| `react`, `react-native`, `react-common`, `react-native-mmkv`, `svelte`, `solidjs` | **reference-only** | capability watch; `react`'s `./nextjs` is the SSR-ceiling watch ([§7](#7-deferred-intentions)) |
| `@instantdb/python` | **out of scope** | another language; coexists freely against the same backend |
| `@instantdb/version` | internal utility | consumed as a dependency, like official SDKs do |

### 3.2 Feature verdicts

| Instant feature | Where it lives in dux |
|---|---|
| Managing users | `/admin` auth (the magic-code quartet, tokens, `deleteUser`, `signOut`) + `$users` in schema/queries/perms |
| Presence, Cursors, Activity | `/vue` rooms + `Cursors` component; `/admin` `rooms.getPresence` |
| Instant CLI | compatibility target (push-only contract, [§3.1](#31-package-verdicts)) |
| Devtool | `init` config passthrough (`devtool` option in `IdbConfig` — it lives in core) |
| Platform API | deferred ([§3.4](#34-why-platform-is-deferred-and-whats-true-meanwhile)) |
| Self Hosting | config passthrough (`apiURI`/`websocketURI`) — supported, not specialized |
| Explorer Component | out of scope (`@instantdb/components` row) |
| Custom emails | CLI `email` commands (compat) + `/admin` `auth.generateMagicCode` pass-through for custom senders |
| App teams | dashboard feature — no client/server SDK surface exists to reimagine (`getOrgs` ships with the deferred platform track) |
| Storage | client `db.storage` + `/admin` `storage` — *considered* pass-throughs: official verbs kept, types renamed |
| Streams | client `db.streams` + `/admin` `streams` pass-through; `resumable-stream` compat-tested |
| Webhooks | **`/webhooks`** + `adminDb.webhooks` + `/nuxt` `defineWebhookHandler` |
| Stripe Payments | backend/dashboard feature; its `$`-namespaces flow through the ordinary data plane like any namespace |
| Admin HTTP API | `/admin` is its typed face; raw HTTP remains for other stacks |
| (Experimental) Next.js SSR | the SSR ceiling — gated on upstream stability ([§7](#7-deferred-intentions)) |

### 3.3 Why `/webhooks` is in (and why it's a subpath)

- **It is the textbook case for dux's thesis.** The official types are schema-aware but charge the schema generic at every call site (`WebhookEntity<Schema, NS>`, `WebhookHandlers<Schema>`) — exactly the repetition schema registration erases. And the official authoring path routes through `typedHandlers`/`combineHandlers` helpers; dux's `defineWebhookHandlers` gets full per-change narrowing on a *plain object literal* (contextual typing), so the helpers dissolve.
- **One mental model, literally one type.** A webhook change's `before`/`after` **is** `IdbEntity<'ns'>` — verified: official `WebhookEntity` resolves to id + fields with no links, exactly `IdbEntity`'s shape. A webhook handler and a query reading the same namespace see the same entity type.
- **It's a subpath, not an `/admin` feature, for dependency isolation.** *Handling* webhooks (verify signature → fetch payload → dispatch) needs no admin token and no `@instantdb/admin` — verification uses Instant's public JWKS, and payload fetches use the token the webhook body carries. A worker that only receives webhooks installs the `@instantdb/webhooks` peer and nothing else. *Management* (`webhooks.manager`) needs the token; `/admin` wires it and exposes the same surface at `adminDb.webhooks`. `/nuxt` adds only the h3 glue; all verification mechanics stay in `/webhooks`.

### 3.4 Why `/platform` is deferred (and what's true meanwhile)

The platform SDK serves *builders of tools that manage Instant apps* — dashboards, CMS builders, agents, scaffolders: N apps, schemas fetched at runtime, codegen, migration diffing. That is a different product loop from the app-developer loop dux v1 serves, and it inverts dux's central bet: a multi-app tool has no "one registered schema." The audiences are disjoint *by design* — registration serves the app loop; platform-style tools use explicit schemas (the `defineQuery<OtherSchema>()` / trailing-type-param escape hatch is the supported mode there, and it costs them nothing). Deferring is therefore a considered call, not a gap:

- **It already works.** The official `@instantdb/platform` runs against dux-managed apps unchanged (same backend), and dux outputs are valid platform inputs *by construction*: `defineSchema(...)` returns an actual `InstantSchemaDef` instance whose enumerable schema projection is the shape `schemaPush` accepts; `definePerms().compile()` is structurally what `pushPerms` accepts. This is the behavioral-compatibility principle made executable — assignability assertions, the CLI constructor invariant (`constructor.name === 'InstantSchemaDef'`), and a push fixture live in the compat-target tests.
- **The round-trip position (a correctness stance, stated once).** The backend stores less than a dux schema file expresses — `singular`, `ruleParams`, `options`, and the registration block live nowhere server-side. Therefore: **the dux schema file is canonical; the backend schema is its projection; push is the only sync direction.** `instant-cli pull` and platform codegen regenerate official-dialect files and would overwrite dux authoring — dux declares pull a *recovery/adoption* tool, never a sync mechanism. No sidecar metadata files, no lossy merge dance: a one-way contract is simpler and honest about what the backend can hold.
- **The trigger, and the first brick.** The headline value of a dux platform story is not wrapping HTTP verbs — it is codegen that emits *dux-dialect* files. That same generator is the **adoption path** for existing Instant apps: point it at an app (or an official `i.schema` file) and get a `defineSchema` file plus registration block. So the deferred track has a name and an order — (1) adoption codegen, (2) `IdbPlatform*`-typed API wrap, (3) migration-authoring sugar — triggered by the first external adopter arriving with existing apps, or a dux tooling/CLI initiative, whichever lands first. Until then, hand-translation via the rename tables in the specs is the documented adoption path, and schema migration UX is `instant-cli push`'s plan/diff/rename flow, which works with dux files today.
- **The `i` collision** (dux's `i.namespace` vs platform's re-exported `i.entity`) is the standard mixing rule ([dux-conventions.md](./dux-conventions.md)): alias at import. dux's `i` carries only the dux dialect, so the two are never half-interchangeable lookalikes.

The naming contract already reserves the domains this track will need: `IdbPlatform*`, `IdbMigration*`.

---

## 4. Architecture

### 4.1 One package, six entrypoints

```
@mszr/idb-dux           the framework-agnostic foundation: defineSchema, i (+ i.namespace),
                        q (+ defineQuery), the typed-tx machinery, the Idb* type utilities
                        + IdbRegister, id/lookup
@mszr/idb-dux/vue       the Vue client: init, defineDb, the enhanced db, components
@mszr/idb-dux/perms     typed CEL authoring (authoring-only, no client runtime)
@mszr/idb-dux/admin     the full admin surface; owns @instantdb/admin (optional peer)
@mszr/idb-dux/webhooks  webhook handling + management; owns @instantdb/webhooks
                        (optional peer); admin-free by design
@mszr/idb-dux/nuxt      defineServerKit, defineAuthSyncHandler, defineWebhookHandler
                        (optional peers admin + webhooks + h3)
```

**The root is not empty — it is the framework-agnostic plane.** The schema file, the shared `q`, the entity type utilities are framework-neutral and cross the client/server boundary: both client stores and server routes import them. They belong at the root so neither side has to reach into `/vue` or `/admin` to get them. (`/query` is deliberately not its own subpath: `q`/`defineQuery` and the type utilities are the shared authoring foundation — they live at the root with schema. Keep the subpath count minimal; every subpath is a maintenance and docs surface.)

What we do **not** do:

- No public baseline/compat surface — the vendored mirror is internal-only
- No separate npm packages until a forcing function appears ([§4.5](#45-when-to-split-into-real-packages))
- No framework-wide singletons — `defineDb` returns a factory; global state is the app's responsibility
- No `/platform` subpath yet — deferred behind a named trigger ([§3.4](#34-why-platform-is-deferred-and-whats-true-meanwhile))

### 4.2 The dependency graph

Everything flows outward from schema. Inner layers never import outer layers.

```
                       @instantdb/core  (i, reactor, instaql, wire types)
                                │
                                ▼
        ┌────────────────  schema  ─────────────────────────┐   defineSchema, i.namespace,
        │            (pure types + tiny runtime)             │   singularize ← source of truth
        ▼                          ▼                         ▼
      query · tx                 perms                    webhooks
  q / defineQuery, result    definePerms,            init, defineWebhookHandlers,
  shapers ($only/$at/$m),    CEL emitter,            IdbWebhook* types (registration-
  type utilities; typed tx   schema-aware ctx        typed; wraps @instantdb/webhooks)
        │      │                                          │
        │      └─────────────────┐          ┌─────────────┤
        ▼                        ▼          ▼             │
       vue                         admin                  │
  enhanced db (wraps the     query/subscribeQuery         │
  vendored baseline),        ergonomics over              │
  result, rooms,             @instantdb/admin (peer);     │
  components, SSR guards     typed tx; pass-throughs;     │
                             adminDb.webhooks             │
                                 │                        │
                                 ▼                        ▼
                               nuxt  ← h3/nitro glue: defineServerKit, defineAuthSyncHandler,
                                       defineWebhookHandler (peers: admin + webhooks + h3)
```

Read it as **three groups**: the *authoring plane* (schema, query·tx, perms — universal: importable anywhere, no secrets, no framework), the *server plane* (webhooks, admin — still framework-agnostic, but token/crypto-scoped and never bundled client-side), and the *framework overlays* (vue for the client, nuxt for the server — the only two places a framework may be imported). The server plane is a subdivision *within* the agnostic plane, surfaced because the boundary rules need the finer grain.

The DRY wins all come from query and schema being shared, not re-derived per surface:

- **One result-shaper, two clients.** The `$only`/`$at`/`$as`/`$m` logic and array-normalization live as a pure `shapeResult(rawData, querySpec)` + its type-level mirror in `query/`. `/vue`'s `useQuery` wraps it reactively; `/admin`'s `query` `await`s then applies the same function.
- **One schema, one source of truth.** `defineSchema` output (singulars, ruleParams, link metadata) is imported by query (for inference), perms (for ctx typing), and both clients (for runtime singularization). No per-surface override configs.
- **One validation surface.** The where-clause/operator validation types live once in `query/` and are consumed by `q`, `useQuery`, `queryOnce`, and `adminDb.query`. Write the hard type once; every entry inherits it.
- **One typed-tx surface, two runtimes.** The schema-derived `ruleParams` typing and dot-path `.link` machinery live once in `tx/` and apply to both the client `db.tx` and the admin `adminDb.tx`.
- **One refs+state primitive.** The result projection is shared by every enhanced hook in `/vue`.
- **One entity type, everywhere.** `IdbEntity<'ns'>` *is* the entity — query results, tx payload types, and webhook changes' `before`/`after` all resolve to it. A webhook handler and a query reading the same namespace see the same shape by construction, not by coincidence.

The test: if a fix to singularization or result-shaping requires editing more than one file outside `schema/` or `query/`, the layering has a leak.

### 4.3 Boundaries are lint rules

Plane separation is a *rule the linter checks*, not a habit. The workspace ESLint config restricts imports per layer — the full matrix lives in [dux-spec-workspace.md](./dux-spec-workspace.md). This is the single highest-leverage guardrail in the design: "a Vue concept leaked into query authoring" is a build error, not a code-review hope.

### 4.4 Bundle size and dependency stance

For client bundle size, subpaths are entirely sufficient — a Vue-only user pays zero bytes for admin/webhooks/nuxt, and a webhook-only worker pays zero bytes for Vue/admin/nuxt. Three mechanisms stack:

1. **Disjoint module graphs.** Separate entry points: if a client module never imports `/admin`, its code never enters the graph.
2. **`sideEffects: false`.** Lets bundlers drop any imported-but-unused module instead of conservatively keeping it. (No upstream idb package sets it today — a real, free improvement.)
3. **ESM + named exports.** Everything Rollup/Vite/esbuild need for complete dead-code elimination.

What subpaths do *not* solve, optional peers do: peer dependencies are package-level, not subpath-level. Every subpath-only dependency — `vue`, `h3`, `@instantdb/admin`, `@instantdb/webhooks` — is an optional peer (`peerDependenciesMeta.optional`). A root-only user is never asked for Vue; a webhook-only worker installs `@instantdb/webhooks` and nothing from the Vue/admin/Nuxt stack.

**The peer rule, stated once:** needed by every dux user → dependency (`@instantdb/core`, `@instantdb/version`); needed only by a subpath → optional peer.

TypeScript checking cost is `.d.ts`-graph-level: perms' heavy type machinery sits behind its own subpath, and each layer's public `.d.ts` must not transitively re-export the others' internals.

### 4.5 When to split into real packages

Hold at one package until a **forcing function** appears (the `react-common` precedent: idb split it out precisely when *two* packages needed the same engine):

| Forcing function | Action |
|---|---|
| A second client overlay ships (`/react`, `/solid`) that needs the agnostic core | Promote `schema` + `query` to an internal core package |
| Perms' TS machinery measurably slows the editor for vue-only users | Split `@mszr/idb-dux-perms` |
| `/nuxt` needs to version independently of the client | Split `@mszr/idb-dux-nuxt` |

Because the source is already layered with lint-enforced seams, each split is *move a folder + add a `package.json` + repoint imports* — mechanical, hours not weeks. That reversibility is the foresight. The deferred platform track, if it lands, is the likeliest first candidate to be *born* as its own package — it serves a different audience on a different cadence.

---

## 5. How dux stays alive

The long-term goal: porting upstream changes stays mechanical forever. Sustainability is designed in, not hoped for.

### 5.1 Two tiers, and a test category

Every surface declares its tier before it ships (principle 11):

| | **vendor-and-mark** | **wrap-and-map** |
|---|---|---|
| When | internal behavioral deltas are required | composition over the public surface suffices |
| Used by | `/vue` baseline | `/admin`, `/webhooks`, `/nuxt` |
| The official code | copied into `vue/baseline/`, deltas fenced and labelled | stays an external package (optional peer); dux instantiates and composes its objects |
| Renames live in | fenced deltas | the boundary module — type aliases + thin functions, zero forked internals |
| Drift visibility | `check-baseline-drift` + `UPSTREAM.md` vendor stamp | upstream API changes break the wrap points *loudly at typecheck* (the workspace dependency moves in place on fork rebase); parity/dx suites lock the mapped behavior |

Both tiers obey the same law: **creativity lives in dux's layer; anything official is mirrored or composed, never creatively reimplemented.** The overlay depends only on the baseline's *public surface*, so upstream can rewrite internals without moving dux's ergonomics.

A third category — **compatibility targets** — covers official tools dux doesn't wrap at all (CLI push, platform push, resumable-stream): their guarantees are tests, not code. When upstream moves one of these contracts, a suite fails before a user does.

### 5.2 The baseline, concretely

`/vue`'s `baseline/` is a near-verbatim copy of `@instantdb/vue`. The *only* permitted deltas: (1) SSR-resilience guards, (2) tighter types / dropped deprecated aliases, (3) wiring into the overlay. Every delta is fenced and labelled:

```ts
// DUX-DELTA(ssr): inert guard so the hook doesn't crash on server.
if (!isClient())
  return inertQueryState()
// END DUX-DELTA
```

The overlay never edits the baseline's internals — `useQuery` *calls* baseline `useQuery` and reshapes its result through the pure `shapeResult()`. When upstream changes, porting is: `git diff` the upstream file against `baseline/`, re-apply the marked deltas. The official source sits right beside us in this fork, which is exactly why dux develops here ([dux-spec-workspace.md](./dux-spec-workspace.md) covers the drift check and the publishing model).

---

## 6. Testing in one view

One runner (Vitest), three assertion planes, one fixture library:

| Plane | Suffix | Asserts | Tool |
|---|---|---|---|
| Runtime | `*.test.ts` | reactive flows, SSR-inert state, server-db modes | Vitest |
| Type shapes | `*.test-d.ts` | return/data shapes match the spec | Vitest `--typecheck` + `expectTypeOf` |
| Editor DX | `*.dx.test.ts` | completions appear at the intended cursor; diagnostics carry the *intended message* on the *intended field* | selenita on Vitest |

The gating discipline: **no enhanced API is "done" until it ships with a `.dx.test.ts` suite that locks its completions and diagnostics.** The editor experience is a first-class contract — it gets a test plane, because nothing else catches a silently-dead completion.

Tests collocate beside the APIs they exercise; the canonical app, scenarios, and cursor-bearing snippets live once in `test-support/` (`@test`); a parity harness replays shared scenarios against both the official `@instantdb/vue` devDependency and the internal baseline; compat-target suites lock that dux outputs remain valid inputs to the official tools dux doesn't wrap. Fewer tests, higher confidence: assert contracts, never implementation details. Full methodology: [dux-spec-workspace.md](./dux-spec-workspace.md).

---

## 7. Deferred intentions

No open questions — deferred items are decided intentions with explicit triggers:

| Intention | Decision | Trigger |
|---|---|---|
| Auto-infer singularity from static patterns (`where: { id }`, unique-field filters) | Explicit `$only`/`$at` is the contract; inference is an eventual spike | post-1.0, only if the explicit forms prove noisy in real apps |
| Full SSR hydration | Resilience floor now; hydration when upstream marks SSR stable (today: experimental, Next-only) | upstream stability |
| `options` expansion beyond `singularize` | add schema-level options only when a concrete need appears | concrete need |
| Perms `stageFor`/`bindFor` | in spec; implementation may land after common rules | perms build order ([dux-spec-perms.md](./dux-spec-perms.md)) |
| Dot-path `.link` depth | one hop by design — deeper traversal belongs to queries | not planned |
| Validation/suggestion depth configurability | fixed at 3 hops | only if real schemas demand it |
| `/platform` subpath (dux-typed platform API) | deferred; the official platform SDK is a tested compat target against dux apps | first external adopter with existing apps, or a dux tooling/CLI initiative — whichever lands first |
| Adoption codegen (backend schema or official `i.schema` file → `defineSchema` file + registration block) | the first brick of the platform track; until then adoption is hand-translation via the rename tables | same trigger as `/platform` |
| Dates as `Date` objects (official `useDateObjects`) | v1 types `i.date()` fields as the wire format on every surface — client, admin, webhook payloads — matching official defaults (the flag is opt-in upstream and JSON payloads can't carry `Date`s anyway) | a schema-level `options` entry when a concrete need appears |
| Migration-authoring sugar (e.g. rename annotations in `defineSchema`) | `instant-cli push`'s plan/diff/rename flow is the supported migration UX — it works with dux files today (push evaluates the file) | platform track |

---

## 8. Implementation roadmap

Sequenced so each step is independently testable and nothing depends on a surface that doesn't exist yet — the order follows the dependency graph inward-out. Each phase's detailed deliverables live in its spec's roadmap; this table is the global status view.

| Phase | Deliverable | Spec | Status |
|---|---|---|---|
| 0. Scaffold | workspace wiring; tshy exports; `sideEffects:false`; optional peers; boundary lint; six empty entrypoints that build | [workspace](./dux-spec-workspace.md) | ☑ complete |
| 1. Schema layer | `defineSchema`, `i.namespace`, `singularize` (runtime + type), registration | [root](./dux-spec-root.md) | ☐ |
| 2. Query + tx layer | `q`/`defineQuery`, `shapeResult`, validation types, `Idb*` utilities, typed tx | [root](./dux-spec-root.md) | ☐ |
| 3. Vue baseline | vendor `@instantdb/vue`, mark deltas, `UPSTREAM.md`, drift check, parity harness | [vue](./dux-spec-vue.md) | ☐ |
| 4. Vue overlay | `useQuery` & friends via `shapeResult`; refs+state; `defineDb`; components | [vue](./dux-spec-vue.md) | ☐ |
| 5. Webhooks | optional-config `init`, `defineWebhookHandlers`, `IdbWebhook*` types | [webhooks](./dux-spec-webhooks.md) | ☐ |
| 6. Admin | owned `init`, shaped `query`/`subscribeQuery`, typed tx/debug, `asUser`, pass-throughs, `adminDb.webhooks` | [admin](./dux-spec-admin.md) | ☐ |
| 7. Nuxt | `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` | [nuxt](./dux-spec-nuxt.md) | ☐ |
| 8. Perms | the `definePerms` pipeline | [perms](./dux-spec-perms.md) | ☐ |
| 9. Demo + lock | one Nuxt demo exercising all six entrypoints; CI wiring | [workspace](./dux-spec-workspace.md) | ☐ |
| 10. SSR hydration | server results serialized → client cache hydrated before subscriptions | [vue](./dux-spec-vue.md) | ☐ gated on upstream |

Perms (8) is sequenced late only because it's independent — it can be built in parallel any time after schema (1). Webhooks (5) likewise depends only on the schema layer's types; it sits just before admin so `adminDb.webhooks` lands assembled.

---

## 9. The docs

One hub (this doc), one cross-cutting law, one spec per entrypoint, one maintainer manual. When an entrypoint changes, exactly one spec changes with it.

| Doc | Role |
|---|---|
| [dux-vision.md](./dux-vision.md) | **the hub** — philosophy, principles, scope edge, architecture, sustainability, roadmap |
| [dux-conventions.md](./dux-conventions.md) | cross-cutting law: vocabulary, value-vs-type naming, native-key + wrapped-verb rule, `$`-prefix rule, primary-read rule, schema registration. Referenced by every spec |
| [dux-spec-root.md](./dux-spec-root.md) | `@mszr/idb-dux`: schema, query authoring + result shaping, typed tx, type utilities |
| [dux-spec-vue.md](./dux-spec-vue.md) | `/vue`: db, hooks, rooms, components, SSR, refs+state, `defineDb` |
| [dux-spec-perms.md](./dux-spec-perms.md) | `/perms`: the `definePerms` pipeline |
| [dux-spec-admin.md](./dux-spec-admin.md) | `/admin`: shaped query + subscribeQuery, typed tx + debug, `asUser`, pass-throughs, `adminDb.webhooks` |
| [dux-spec-webhooks.md](./dux-spec-webhooks.md) | `/webhooks`: init, `defineWebhookHandlers`, the pipeline verbs, manager, `IdbWebhook*` types |
| [dux-spec-nuxt.md](./dux-spec-nuxt.md) | `/nuxt`: server kit, auth sync, `defineWebhookHandler` |
| [dux-spec-workspace.md](./dux-spec-workspace.md) | maintainer manual: testing methodology, sustainability tiers, boundary rules, drift check, publishing, fork-rebase |

Every spec keeps an **implementation status** table at the top and a **phased implementation roadmap** at the end; the status table tracks phases, the roadmap tracks each phase's deliverables. Specs are **contract-driven**: they state the desired behavior and why it matters first, then propose a concrete implementation approach. The approach is a thoughtful proposal, not a requirement — if reality teaches a better way to honor the contract, the implementation moves and the spec's proposal is corrected; the contracts headlining it remain.
