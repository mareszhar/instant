updated: 2026-06-11
status: final pre-spec blueprint — supersedes the "vux as a vue wrapper" framing; scope edge drawn (§1.5)

# dux — a blueprint with foresight

A proposal for `@mszr/idb-dux`: what it is, why it should be born fresh rather than refactored out of `idb-vux`, and how to structure it so it stays delightful *and* maintainable as the SDKs we track keep moving.

This note is the **authority** on vision, structure, and conventions. [`ideal-vux.md`](./ideal-vux.md) (the feature spec) and [`ideal-perms-spec-x.md`](./ideal-perms-spec-x.md) (the perms spec) have been converged to its decisions; [§10](#10-what-changed-from-the-vux-era-exploration) records what changed from their vux-era originals.

---

## 0. TL;DR — the recommendation up front

1. **Yes, start fresh in `client/packages/dux`.** Not a blank page — a clean-room re-derivation that uses `idb-vux` as a *parts bin*. The current vux is wedged precisely because it *reimplemented* the official baseline divergently (1100-line `InstantVuxDatabase.ts` vs the official 400-line one), and that divergence is the most likely cause of the IntelliSense regression. You can't reach the ideal by editing your way out of that — edits stay biased by what's already there.

2. **Reframe the vision.** dux is not "an alternative Vue wrapper." It is a **DX/UX-first reimagining of InstantDB's developer experience**, organized around one structural insight: idb's surface splits into a *framework-agnostic plane* (schema, permissions, query authoring, admin) and a *framework-coupled plane* (reactive client bindings). dux separates the planes and makes each delightful on its own terms. **Vue and Nuxt are dux's first first-class clients, not its definition.**

3. **The implementation model is "vendored baseline + additive overlay."** Copy the official Vue SDK's implementation near-verbatim into an internal baseline layer, mark every delta, and build the enhanced ergonomics *on top of it by composition* — never by forking its internals. This is the single most important correction to how vux was built, and it directly answers "should we copy the vue sdk first?": **yes, and keep it diffable against upstream forever.**

4. **Packaging: one published package, layered source, subpaths, optional peers.** Ship `@mszr/idb-dux` with subpaths `/vue`, `/perms`, `/admin`, `/webhooks`, `/nuxt`. The *root is not empty* — it exports the framework-agnostic foundation. Subpaths + `sideEffects: false` + ESM give you complete client-bundle tree-shaking; optional peerDependencies give you dependency isolation. **Do not split into separate npm packages yet** — design the internal seams so the split is mechanical, and pull the trigger only when a forcing function appears (a second client, or peer/version friction).

5. **The scope edge is drawn on purpose.** dux is ecosystem-complete by declaration, not by accident: every official Instant surface is ruled *in*, *pass-through*, *compatibility target*, or *out — with a trigger* ([§1.5](#15-the-scope-edge--every-official-surface-ruled-in-or-out-on-purpose)). Webhooks join as the sixth entrypoint; the platform SDK is deferred behind a named trigger with a tested compatibility guarantee meanwhile.

The rest of this note is the argument and the detail.

---

## 1. Vision — dux as a reimagining of idb

> dux is a DX/UX-first reimagining of the InstantDB developer experience. It keeps Instant's backend, wire protocol, and rules engine exactly as they are, and rebuilds the authoring and client surface around a single question: *what would feel most delightful to use?*

### 1.1 The organizing insight: two planes

InstantDB's developer surface is really two planes that the official SDKs entangle:

- **The framework-agnostic plane** — how you *describe* and *address* your data: the schema, the permission rules, the shape of a query, the admin/server reads, the webhooks your server receives. None of this is Vue, React, or Svelte. Yet today it's scattered: schema lives in `core` but reads React-shaped; permissions are stringly-typed CEL with no schema awareness; the admin SDK has different ergonomics from the client; webhook types are schema-aware but charge the schema generic at every call site.
- **The framework-coupled plane** — how your *components* consume live data: reactive bindings, lifecycle, SSR. This genuinely differs per framework.

The official SDKs optimize the coupled plane per framework and leave the agnostic plane thin and stringly-typed. dux's thesis is the inverse priority: **make the agnostic plane excellent once, and let each client binding be a thin, delightful overlay on top of it.** That is exactly why this initiative outgrew "vux" — `defineSchema` and `definePerms` were never Vue features. They are idb features that no idb SDK ships.

### 1.2 The only hard contract is the backend

This is the freedom the rebrand unlocked, stated as a principle:

> **dux owes behavioral compatibility to Instant's backend, not API compatibility to Instant's SDKs.**

Everything dux emits must be something Instant already understands: `defineSchema` compiles to the same entity/link shape the CLI pushes; `definePerms` compiles to the same `InstantRules` CEL strings; every query goes out as a wire query `instaql` accepts. **Inside** that envelope dux is free. `q()` from `defineQuery` does not need to be accepted by `@instantdb/vue`'s `useQuery`; `i.namespace` does not need to be accepted by `i.schema`. We are not a drop-in for the official SDKs and should stop paying the tax of pretending to be. (See [§10.1](#101-no-x-enhanced-as-default) for how this collapses the `X`-suffix question.)

This is liberating in a concrete way: the moment an official-SDK shape is *less* delightful than what we can express, we are allowed to leave it behind — as long as the *output* still satisfies the backend.

### 1.3 Vue and Nuxt are the first clients, not the definition

The layered architecture (next section) means a `@mszr/idb-dux/react` or `/solid` could be added later as another thin overlay on the same agnostic core — the way `react-common` lets `react` and `react-native` share one engine. We will not build those now (YAGNI), but the structure must not preclude them. That single fact is what turns "vux" into "dux."

### 1.4 Principles

The eight product principles in `ideal-vux` §2 stand — delightful first, boilerplate is harm, errors at the cursor, self-documenting, predictable contracts, SSR-resilient floor, additive-never-divergent, performance parity. dux adds four structural ones (`ideal-vux` §2 carries the full canon of all twelve):

9. **Plane separation is load-bearing.** The framework-agnostic layers must never import a framework. This is enforced mechanically ([§5.2](#52-enforce-the-boundaries-mechanically)), not by discipline alone. The day Vue concepts leak into query authoring is the day we've rebuilt vux's problem.
10. **The baseline is a mirror, not a fork.** Anything that has an official counterpart is *vendored and marked* or *wrapped and mapped*, never creatively reimplemented ([§6](#6-the-vendored-baseline--additive-overlay-model)). Creativity lives in dux's own layer, where upstream churn can't reach it.
11. **Sustainability is part of the design.** Every surface declares how it tracks upstream — vendor tier, wrap tier ([§6.4](#64-the-second-tier-wrap-and-map)), or tested compatibility target ([§8.6](#86-compatibility-target-tests)) — before it ships. Drift is made visible by tooling, never discovered by users.
12. **Elegance is a requirement, not a flourish.** The implementation must read with the same clarity the API projects — deliberate, DRY, stable, in a constant fight against complexity and obscurity. The greatest solutions turn entanglements into inspired simplicity; if a piece can't be explained simply, it isn't done.

### 1.5 The scope edge — every official surface, ruled in or out on purpose

dux is a walled garden, and a garden's wall is a promise: **opting in must never lock you out of something Instant can do.** That promise is only honest if the edge is drawn deliberately — every official surface either has a dux home, demonstrably works against dux apps as-is, or is excluded with a reason and a re-entry trigger. This section is that edge, swept once and completely; an earlier draft simply never examined `@instantdb/platform` or `@instantdb/webhooks`, and the review that caught it was right that an *undocumented* absence is worse than either verdict. All verdicts below are grounded in the vendored official sources in this fork.

**The rule that decides every row:** a surface earns a dux subpath when the schema/naming/type system can make it *meaningfully* better (the agnostic plane's leverage); it stays a **pass-through** when the official verbs are already precise and dux would only be renaming for sport; it is a **compatibility target** when it is a *tool that talks to the same backend* rather than an API the app imports; it is **out of scope** when it is coupled to a non-target framework, another language, or has no SDK surface to reimagine.

#### Package verdicts

| Official package | Verdict | Grounding |
|---|---|---|
| `@instantdb/core` | **foundation** | the dependency everything wraps; never a user-facing surface in dux |
| `@instantdb/vue` | **vendored baseline** (internal) | [§6](#6-the-vendored-baseline--additive-overlay-model) — the mirror, the parity anchor |
| `@instantdb/admin` | **wrapped — `/admin`** (optional peer) | full official surface covered, each piece a decided treatment (`ideal-vux` §5.4): data plane dux-shaped, precise verbs kept, types renamed |
| `@instantdb/webhooks` | **wrapped — `/webhooks`** (optional peer) — *the sixth entrypoint* | the textbook dux fit; rationale below, naming in [§11.7](#117-webhooks-naming) |
| `@instantdb/platform` | **deferred + compatibility target** | works against dux apps today; dux outputs are valid platform inputs *by construction* (tested, [§8.6](#86-compatibility-target-tests)); defended below |
| `@instantdb/resumable-stream` | **compatibility target** | consumes an admin db and `db.streams`; works with dux's `adminDb` — locked by a compat test, not wrapped |
| `instant-cli` | **compatibility target** | **push evaluates** `instant.schema.ts` / `instant.perms.ts` (unconfig + jiti — verified in `cli/src/old.js`), so structural output-compat is the whole contract and dux files push today. **pull regenerates official-dialect files** — see the round-trip position below. `auth`/`app`/`webhook`/`email`/`explorer`/`query` commands are backend operations, SDK-agnostic. |
| `@instantdb/mcp` | **compatible, noted** | manages apps through the backend/platform APIs — SDK-agnostic at runtime. Files it scaffolds are official-dialect; the adoption codegen (below) is the translation path when that matters. |
| `create-instant-app` | **out of scope** | scaffolds official templates; the dux demo is the dux starter |
| `@instantdb/components` | **out of scope** | the Explorer/devtool components are React-coupled (React peer deps). The hosted dashboard + the core devtool (config passthrough) cover the need. Trigger: upstream ships framework-agnostic or Vue builds. |
| `react`, `react-native`, `react-common`, `react-native-mmkv`, `svelte`, `solidjs` | **reference-only** | capability watch; `react`'s `./nextjs` is the SSR-ceiling watch ([§12](#12-implementation-roadmap) phase 10) |
| `@instantdb/python` | **out of scope** | another language; coexists freely against the same backend |
| `@instantdb/version` | internal utility | consumed as a dependency, like official SDKs do |

#### Feature verdicts (the official feature list, swept)

| Instant feature | Where it lives in dux |
|---|---|
| Managing users | `/admin` auth (the magic-code quartet, tokens, `deleteUser`, `signOut`) + `$users` in schema/queries/perms |
| Presence, Cursors, Activity | `/vue` rooms + `Cursors` component; `/admin` `rooms.getPresence` |
| Instant CLI | compatibility target (push-only contract, above) |
| Devtool | `init` config passthrough (`devtool` option in `IdbConfig` — it lives in core) |
| Platform API | deferred (this section) |
| Self Hosting | config passthrough (`apiURI`/`websocketURI`) — supported, not specialized |
| Explorer Component | out of scope (`@instantdb/components` row) |
| Custom emails | CLI `email` commands (compat) + `/admin` `auth.generateMagicCode` pass-through for custom senders |
| App teams | dashboard feature — no client/server SDK surface exists to reimagine (`getOrgs` ships with the deferred platform track) |
| Storage | client `db.storage` + `/admin` `storage` — *considered* pass-throughs: official verbs kept, types renamed ([§11.4](#114-the-rename-table)) |
| Streams | client `db.streams` + `/admin` `streams` pass-through; `resumable-stream` compat-tested |
| Webhooks | **`/webhooks`** + `adminDb.webhooks` + `/nuxt` `defineWebhookHandler` |
| Stripe Payments | backend/dashboard feature; its `$`-namespaces flow through the ordinary data plane like any namespace |
| Admin HTTP API | `/admin` is its typed face; raw HTTP remains for other stacks |
| (Experimental) Next.js SSR | the SSR ceiling — phase 10, gated on upstream stability (`ideal-vux` §9) |

#### Why `/webhooks` is in (and why it's a subpath)

- **It is the textbook case for dux's thesis.** The official types are schema-aware but charge the schema generic at every call site (`WebhookEntity<Schema, NS>`, `WebhookHandlers<Schema>`) — exactly the repetition registration ([§11.3](#113-schema-registration--tell-dux-your-schema-once)) erases. And the official authoring path routes through `typedHandlers`/`combineHandlers` helpers; dux's `defineWebhookHandlers` gets full per-change narrowing on a *plain object literal* (the same contextual-typing mechanism verified for inline queries), so the helpers dissolve.
- **One mental model, literally one type.** A webhook change's `before`/`after` **is** `IdbEntity<'ns'>` — verified: official `WebhookEntity` resolves to id + fields with no links, exactly `IdbEntity`'s shape. A webhook handler and a query reading the same namespace see the same entity type.
- **It's a subpath, not an `/admin` feature, for dependency isolation.** *Handling* webhooks (verify signature → fetch payload → dispatch) needs no admin token and no `@instantdb/admin` — verification uses Instant's public JWKS, and payload fetches use the token the webhook body carries. A worker that only receives webhooks installs the `@instantdb/webhooks` peer and nothing else. *Management* (`webhooks.manager`) needs the token; `/admin` wires it and exposes the same surface at `adminDb.webhooks`. `/nuxt` adds only the h3 glue (`defineWebhookHandler` — raw-body reading the h3 way); all verification mechanics stay in `/webhooks`.

#### Why `/platform` is deferred (and what's true meanwhile)

The platform SDK serves *builders of tools that manage Instant apps* — dashboards, CMS builders, agents, scaffolders: N apps, schemas fetched at runtime, codegen, migration diffing. That is a different product loop from the app-developer loop dux v1 serves, and it inverts dux's central bet: a multi-app tool has no "one registered schema." The audiences are disjoint *by design* — registration serves the app loop; platform-style tools use explicit schemas (the `defineQuery<OtherSchema>()` / trailing-type-param escape hatch is the supported mode there, and it costs them nothing). Deferring is therefore a considered call, not a gap:

- **It already works.** The official `@instantdb/platform` runs against dux-managed apps unchanged (same backend), and dux outputs are valid platform inputs *by construction*: `defineSchema(...)` output is structurally the schema `schemaPush` accepts; `definePerms().compile()` is structurally what `pushPerms` accepts. This is the behavioral-compatibility principle made executable — assignability assertions and a push fixture live in the compat-target tests ([§8.6](#86-compatibility-target-tests)).
- **The round-trip position (a correctness stance, stated once).** The backend stores less than a dux schema file expresses — `singular`, `ruleParams`, `options`, and the registration block live nowhere server-side. Therefore: **the dux schema file is canonical; the backend schema is its projection; push is the only sync direction.** `instant-cli pull` and platform codegen regenerate official-dialect files and would overwrite dux authoring — dux declares pull a *recovery/adoption* tool, never a sync mechanism. No sidecar metadata files, no lossy merge dance: a one-way contract is simpler and honest about what the backend can hold.
- **The trigger, and the first brick.** The headline value of a dux platform story is not wrapping HTTP verbs — it is codegen that emits *dux-dialect* files. That same generator is the **adoption path** for existing Instant apps: point it at an app (or an official `i.schema` file) and get a `defineSchema` file plus registration block. So the deferred track has a name and an order — (1) adoption codegen, (2) `IdbPlatform*`-typed API wrap, (3) migration-authoring sugar — triggered by the first external adopter arriving with existing apps, or a dux tooling/CLI initiative, whichever lands first. Until then, hand-translation via the rename table ([§11.4](#114-the-rename-table)) is the documented adoption path, and schema migration UX is `instant-cli push`'s plan/diff/rename flow, which works with dux files today.
- **The `i` collision** (dux's `i.namespace` vs platform's re-exported `i.entity`) is the standard mixing rule ([§10.1](#101-no-x-enhanced-as-default)): alias at import. dux's `i` carries only the dux dialect, so the two are never half-interchangeable lookalikes.

The naming contract already reserves the domains this track will need: `IdbPlatform*`, `IdbMigration*` ([§11.2](#112-values-vs-types)).

---

## 2. Why a new folder beats refactoring vux

The user's instinct is correct, and the codebase backs it up.

### 2.1 The evidence that vux is wedged

| Symptom | Evidence in repo |
|---|---|
| The baseline was reimplemented, not mirrored | `idb-vux/src/InstantVuxDatabase.ts` is **1100 lines** with bespoke generics (`QueryAuthoringInput`, `QueryAuthoringFactory`, `QueryMaybeRefOrGetterSource`, `QueryRuntimeQuery`…). The official `vue/src/InstantVueDatabase.ts` is **~400 lines**. |
| That divergence likely broke IntelliSense | the vux audit found completions dead on inline `useQuery` objects but fine via `q()`. The custom contextual-typing machinery on the db methods is the prime suspect. |
| No safety net to refactor against | `src/tests/intellisense/` exists but is **empty** — the one test layer that would catch the regression was never populated. |
| The "signal vs noise" problem is real | ~37 test files + a working Nuxt demo. Mid-refactor, a failing test could mean "expected, API not ported yet," "real break," or "shouldn't have existed" — and nothing tells them apart. |

### 2.2 Why editing can't get you there

The user named it exactly: *when code is already there, edits stay biased from it.* Refactoring vux into ideal-dux means simultaneously (a) re-architecting the layering, (b) replacing the divergent query generics, (c) keeping ~37 tests + a demo green, and (d) adding schema/perms/admin surfaces that don't exist yet. Each pulls against the others. You'd spend your budget keeping the old shape alive instead of building the new one.

### 2.3 "Fresh" means clean-room, not from-scratch

Starting in `dux` is **not** throwing work away. It's re-deriving from the specs (`ideal-vux`, `ideal-perms-spec-x`) onto a clean spine, while harvesting validated parts from vux:

- **Keep wholesale:** `xResult.ts` (the `refs + state` projection is good and self-contained), the SSR-resilience guard pattern, the room/presence logic, the auth-sync cookie handler, `defineServerIdb`'s request-scoped caching idea.
- **Re-derive clean:** the db class (mirror official first — §6), the query-authoring types (the thing that rotted).
- **Lift as spec, not code:** `defineQuery`/`q`, `defineDb`, the demo's store patterns.

vux stays exactly where it is as the reference implementation and the parts bin. Nothing is lost; the constraints are.

---

## 3. The shape the user proposed, refined

The proposed subpaths were close. Two refinements:

```
@mszr/idb-dux           ← NOT empty. The framework-agnostic foundation:
                           defineSchema, i (+ i.namespace), q (+ defineQuery),
                           the typed-tx machinery, the Idb* type utilities, id/lookup.
@mszr/idb-dux/vue       ← the Vue client (enhanced db, components, rooms, SSR-resilient)
@mszr/idb-dux/perms     ← typed CEL authoring (authoring-only, no client runtime)
@mszr/idb-dux/admin     ← admin-SDK ergonomics (framework-agnostic; optional peer @instantdb/admin)
@mszr/idb-dux/webhooks  ← webhook handling + management (framework-agnostic server;
                           optional peer @instantdb/webhooks; admin-free by design — §1.5)
@mszr/idb-dux/nuxt      ← h3/nitro/nuxt server glue (optional peers @instantdb/admin + h3;
                           wraps /admin and /webhooks)
```

**Why the root is not empty** — and this is grounded, not stylistic: the demo's `shared/utils/idb.ts` already imports `defineQuery` and `InstaQLEntity` from the *main* entry and is consumed by **both** client stores and server routes. The schema file, the shared `q`, the entity type utilities — these are framework-neutral and cross the client/server boundary. They belong at the root so neither side has to reach into `/vue` or `/admin` to get them. The root *is* the framework-agnostic plane. Your guess of "minimal exports to power schema init" undersells it: it's schema **plus** the whole authoring foundation.

**Why `/query` is not its own subpath:** `q`/`defineQuery` and the type utilities are the shared authoring foundation — they live at the root with schema, not in a separate subpath. Keep the subpath count minimal; every subpath is a maintenance and docs surface.

---

## 4. Will subpaths make it "heavy"? — the bundle-size answer

This is the question you were most unsure about, so here is the precise answer.

**For client bundle size, subpaths are entirely sufficient — a Vue-only user pays zero bytes for admin/nuxt.** Three mechanisms stack:

1. **Disjoint module graphs.** `@mszr/idb-dux/admin` and `/nuxt` are separate entry points. If a client module never imports them, their code never enters the graph. Tree-shaking doesn't even have to "remove" it — it's never pulled in.
2. **`sideEffects: false`.** Set this in `package.json`. *Neither vux nor any upstream idb package sets it today* — a real, free improvement. It lets bundlers drop any imported-but-unused module instead of conservatively keeping it.
3. **ESM + named exports.** tshy already emits ESM; named exports + (1) + (2) give Rollup/Vite/esbuild everything they need for complete dead-code elimination.

**What subpaths do *not* solve, and what does:**

- **Peer dependencies are package-level, not subpath-level.** If `/admin` needs `@instantdb/admin` and `/nuxt` needs `h3`, a single-package design makes those peers of the *whole* package. **Solution: optional `peerDependencies` + `peerDependenciesMeta.optional`.** This is already the proven pattern in `idb-vux` (it marks `@instantdb/admin` and `h3` optional). A Vue-only user simply never installs them and is never blocked.
- **TypeScript checking cost is `.d.ts`-graph-level.** Heavy type machinery (perms, query validation) that sits in the same package *can* be loaded by the editor when adjacent. **Mitigations:** keep perms behind its own subpath (its type machinery is the heaviest — `ideal-vux` §8 already argues this), and keep each layer's public `.d.ts` from transitively re-exporting the others' internals. If TS server cost ever becomes measurable, that's the forcing function to split perms into its own package ([§5.4](#54-when-to-split-into-real-packages)).

**Verdict:** subpaths + `sideEffects: false` + optional peers fully address "heavy for people who only need vue + perms." You do not need separate packages for bundle-size reasons. You might want them later for *dependency-isolation* or *independent-versioning* reasons — covered next.

---

## 5. Architecture — layered source, flexible packaging

### 5.1 The dependency graph

Everything flows outward from schema. Inner layers never import outer layers; only `/vue` may import `vue`, only `/nuxt` may import `h3`.

```
                       @instantdb/core  (i, reactor, instaql, wire types)
                                │
                                ▼
        ┌────────────────  schema  ─────────────────────────┐   defineSchema, i.namespace,
        │            (pure types + tiny runtime)             │   singularize<>  ← source of truth
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
                                       defineWebhookHandler (peers: admin + h3)
```

Read it as **three groups**: the *authoring plane* (schema, query·tx, perms — universal: importable anywhere, no secrets, no framework), the *server plane* (webhooks, admin — still framework-agnostic, but token/crypto-scoped and never bundled client-side), and the *framework overlays* (vue for the client, nuxt for the server — the only two places a framework may be imported). Schema is consumed by everything; query and tx are consumed by vue and admin; perms stands alone; webhooks is consumed by admin (which exposes it token-wired) and nuxt (which adds the route glue). The earlier two-plane vision framing ([§1.1](#11-the-organizing-insight-two-planes)) still holds — the server plane is a subdivision *within* the agnostic plane, surfaced here because the lint rules ([§5.2](#52-enforce-the-boundaries-mechanically)) need the finer grain. The DRY wins ([§7](#7-dry-in-practice)) all come from query and schema being shared, not re-derived per surface.

### 5.2 Enforce the boundaries mechanically

Plane separation must be a *rule the linter checks*, not a habit. Use ESLint `import/no-restricted-paths` (or `no-restricted-imports`) in the dux workspace:

- `src/schema/**` may import only `@instantdb/core` + `src/schema/**`.
- `src/query/**`, `src/perms/**` may import `@instantdb/core` + `src/schema/**` + themselves. **No `vue`, no `h3`, no `@instantdb/admin`, no `@instantdb/webhooks`.**
- `src/webhooks/**` may add `@instantdb/webhooks`. No `vue`, no `h3`, no `@instantdb/admin`.
- `src/admin/**` may add `@instantdb/admin` + `src/webhooks/**`. No `vue`, no `h3`.
- `src/vue/**` may add `vue`. No `h3`, no `@instantdb/admin`, no `@instantdb/webhooks`.
- `src/nuxt/**` may add `h3` + `src/admin/**` + `src/webhooks/**`.

This is the single highest-leverage guardrail in the whole proposal. It makes "a Vue concept leaked into query authoring" — the exact rot that wedged vux — a build error.

### 5.3 One package, layered source

Build with **tshy** (already the vux toolchain — dual ESM/CJS, the subpath→source map lives in `tshy.exports`). Each subpath is one `src/<layer>/index.ts`:

```jsonc
// tshy.exports in package.json
{
  "./package.json": "./package.json",
  ".": "./src/index.ts", // framework-agnostic foundation
  "./vue": "./src/vue/index.ts",
  "./perms": "./src/perms/index.ts",
  "./admin": "./src/admin/index.ts",
  "./webhooks": "./src/webhooks/index.ts",
  "./nuxt": "./src/nuxt/index.ts"
}
```

`peerDependencies`: `vue` (the only non-optional peer, since `/vue` is the headline surface). `@instantdb/admin`, `@instantdb/webhooks`, and `h3` as **optional** peers. `dependencies`: `@instantdb/core`, `@instantdb/version`. `sideEffects: false`. The peer rule, stated once: **needed by every dux user → dependency (`core`); needed only by a subpath → optional peer.**

### 5.4 When to split into real packages

Hold at one package until a **forcing function** appears. The react-common precedent is instructive: idb split it out precisely because *two* packages (`react`, `react-native`) needed the same engine — a concrete second consumer, not a hypothetical. Apply the same test:

| Forcing function | Action |
|---|---|
| A second client overlay ships (`/react`, `/solid`) that needs the agnostic core | Promote `schema` + `query` to an internal `@mszr/idb-dux-core` package (the react-common move). |
| Perms' TS machinery measurably slows the editor for vue-only users | Split `@mszr/idb-dux-perms`. |
| `/nuxt` needs to version independently of the client (server release cadence diverges) | Split `@mszr/idb-dux-nuxt`. |

Because the source is already layered with lint-enforced seams, each split is **move a folder + add a `package.json` + repoint imports** — mechanical, hours not weeks. That reversibility *is* the foresight. Building separate packages now would buy isolation you don't need yet at the cost of version-sync overhead during the phase when you're iterating fastest. Don't.

The §1.5 scope additions don't move this needle: `/webhooks` is small and shares the schema spine, so it rides the same package comfortably. The deferred platform track, if it lands, is the likeliest first candidate to be *born* as its own package — it serves a different audience on a different cadence — but that's a decision for its trigger, not for now.

---

## 6. The vendored-baseline + additive-overlay model

This is the implementation strategy, and it's the direct answer to *"should we copy the exact vue SDK implementation, then add our features?"* — **yes, with discipline.**

### 6.1 The model

```
src/vue/
  baseline/          ← a near-verbatim copy of @instantdb/vue's implementation
    InstantVueDatabase.ts   (renamed internally, deltas marked)
    InstantVueRoom.ts
    useInfiniteQuery.ts
    components/
  overlay/           ← all dux ergonomics, built BY COMPOSING the baseline
    useQuery.ts            (calls baseline useQuery, then shapeResult())
    useAuth.ts
    rooms/
  index.ts           ← assembles the public db; exports the enhanced surface
```

- **The baseline is a mirror.** It mirrors official `@instantdb/vue` as closely as possible. The *only* permitted deltas: (1) SSR-resilience guards, (2) tighter types / dropped deprecated aliases, (3) wiring into the overlay. **Every delta is fenced and labelled** so it's visible:

  ```ts
  // DUX-DELTA(ssr): inert guard so the hook doesn't crash on server.
  if (!isClient())
    return inertQueryState()
  // END DUX-DELTA
  ```

- **The overlay never edits the baseline's internals.** `useQuery` *calls* baseline `useQuery` and reshapes its result through a pure `shapeResult()` from the query layer. It does not fork `useQuery`. This is the inverse of what vux did — vux grew one giant method that tried to be both, and the seams fused.

### 6.2 Why this is the whole ballgame for sustainability

Your stated long-term goal is *"easy to port changes to the official SDKs as time passes."* This model delivers it:

- When `@instantdb/vue` changes upstream, porting is **`git diff` the upstream file against `baseline/`, re-apply the marked deltas.** Because the baseline is a mirror, the diff is small and legible. Contrast with today: vux's reimplementation means an upstream change has *no clean correspondence* to port against.
- The overlay is **insulated from upstream churn** — it depends only on the baseline's *public surface* (`useQuery`'s signature and return), not its guts. Upstream can rewrite `useQuery`'s internals; as long as the contract holds, the overlay doesn't move.
- The baseline doubles as the **parity anchor** for testing ([§8](#8-testing-for-parity-and-intellisense)) *and* the substrate the overlay is built on. One artifact, three jobs.

### 6.3 Operationalize the upstream diff

Add a maintainer check that makes drift visible instead of waiting to discover it during a rebase:

- A script (`scripts/check-baseline-drift.mjs`) that diffs `src/vue/baseline/*` against the current `client/packages/vue/src/*` (the official source is right there in the monorepo) and prints a report: "official `InstantVueDatabase.ts` changed since last vendor; review N hunks."
- Run it in the fork-rebase triage (the workflow in `workflow-fork-rebase.md` already inspects `client/packages/vue` on each rebase window — this gives that step teeth).
- Record the vendored upstream commit in a `baseline/UPSTREAM.md` stamp so the diff has a base.

### 6.4 The second tier: wrap-and-map

Vendor-and-mark exists because `/vue` needs *behavioral deltas inside* upstream code (SSR guards woven through hook bodies). No other surface does — and vendoring where composition suffices would multiply the drift surface for nothing. So dux has exactly two sustainability tiers, and every surface declares its tier before it ships (principle 11):

| | **vendor-and-mark** | **wrap-and-map** |
|---|---|---|
| When | internal behavioral deltas are required | composition over the public surface suffices |
| Used by | `/vue` baseline | `/admin`, `/webhooks`, `/nuxt` |
| The official code | copied into `baseline/`, deltas fenced | stays an external package (optional peer); dux instantiates and composes its objects |
| Renames live in | fenced deltas | the boundary module — type aliases + thin functions, zero forked internals |
| Drift visibility | `check-baseline-drift` + `UPSTREAM.md` stamp | the fork rebase moves the workspace dependency in place, so upstream API changes break the wrap points *loudly at typecheck*; the surface's parity/`.dx.test.ts` suites lock the mapped behavior |

Both tiers obey the same law: **creativity lives in dux's layer; anything official is mirrored or composed, never creatively reimplemented.** A third category — *compatibility targets* — covers official tools dux doesn't wrap at all; their guarantees are tests, not code ([§8.6](#86-compatibility-target-tests)).

---

## 7. DRY in practice

The layering isn't DRY for its own sake — here's where it concretely removes duplication that vux can't:

- **One result-shaper, two clients.** The `$only`/`$at`/`$as`/`$m` logic and array-normalization live as a **pure function** `shapeResult(rawData, querySpec)` + its type-level mirror in `src/query/`. `/vue`'s `useQuery` wraps it in `computed`; `/admin`'s `query` `await`s then applies the same function. vux can't share this today because the logic is welded into the Vue database class — which is exactly why the admin ergonomics in `ideal-vux` §5.4 are still aspirational.
- **One schema, one source of truth.** `defineSchema` output (singulars, ruleParams, link metadata) is imported by query (for inference), perms (for ctx typing), and both clients (for runtime singularization). No `singularOverrides` duplicated across `defineDb`/admin `init` — `ideal-vux` already wants this; the layering is what makes it real instead of copied.
- **One validation surface.** The where-clause/operator validation types (the `$ilike`-only-on-indexed-strings rules, the 3-hop traversal) live once in `src/query/` and are consumed by `q`, `useQuery`, `queryOnce`, and `adminDb.query`. Write the hard type once; every entry inherits it.
- **One typed-tx surface, two runtimes.** The schema-derived `ruleParams` typing and dot-path `.link` machinery ([§10.5](#105-foreground-the-buried-milestones)) live once in `src/tx/` and are applied to both the client `db.tx` and the admin `adminDb.tx` proxies.
- **One refs+state primitive.** `result.ts` (`refs + state`) is shared by every enhanced hook in `/vue`. Lifted from vux's `xResult.ts` — keep it.
- **One entity type, everywhere.** `IdbEntity<'ns'>` *is* the entity — query results, tx payload types, and webhook changes' `before`/`after` all resolve to it. A webhook handler and a query reading the same namespace see the same shape by construction, not by coincidence.

The test: if a fix to singularization or result-shaping requires editing more than one file outside `src/schema` or `src/query`, the layering has a leak.

---

## 8. Testing for parity and IntelliSense

One runner, three assertion planes, one fixture library. **selenita** ([github.com/mareszhar/selenita](https://github.com/mareszhar/selenita)) runs on Vitest and asserts both *completions* (`project.query`) and *diagnostics with their messages* (`project.check`); Vitest's `--typecheck` mode runs `expectTypeOf` assertions in `*.test-d.ts` files. So runtime behavior, type shapes, error-message quality, and editor DX are all locked from a single `vitest run` — no bespoke `tsc --noEmit` harness, no separate tooling per layer.

| Plane | File suffix | Asserts | Tool |
|---|---|---|---|
| Runtime | `*.test.ts` | reactive flows, SSR-inert state, auth-sync cookies, server-db modes | Vitest |
| Type shapes | `*.test-d.ts` | return/data shapes match the spec | Vitest `--typecheck` + `expectTypeOf` |
| Editor DX | `*.dx.test.ts` | completions appear at the intended cursor; diagnostics carry the *intended message* on the *intended field* | selenita (`query`, `check`, `queryGroup`) on Vitest |

`.dx.test.ts` rather than `.intellisense.test.ts`: the suffix names the plane (editor DX — completions *and* diagnostics), it's shorter, and it's literally the brand.

### 8.1 The parity harness (new)

`ideal-vux`'s principle #7 ("additive, never divergent") is currently audited by hand in `feature-parity-audit.md` — a prose matrix that goes stale. Make it executable:

- `@instantdb/vue` is *already a devDependency* of the package. Write one set of canonical scenarios (a fixed schema, a set of queries, auth transitions, room ops) and run them against **both** the official `@instantdb/vue` db **and** dux's internal `baseline` surface, asserting identical reactive output (same emitted values, same loading/error transitions).
- selenita's `queryGroup` covers the *editor-DX side* of parity: the same snippet asserted against multiple implementations, so "our baseline completes exactly what official completes" is also a red/green test.
- This converts "additive never divergent" from a promise into a failing test. When upstream changes behavior, the parity suite fails and tells you what to re-vendor.

### 8.2 Editor-DX suites — completions *and* diagnostics (the gap that bit you)

`src/tests/intellisense/` is empty in vux today; that's why the regression shipped silently. Make it a *gating discipline*:

> **No enhanced API is "done" until it ships with a `.dx.test.ts` suite that locks its completions and diagnostics.**

selenita's `check` also replaces the old `*.types.ts` + `@ts-expect-error` pattern for error assertions, and it's strictly better: a literal `@ts-expect-error` is pinned to one hand-written call site and can only assert *that* an error exists, while a reusable `snippet` with an embedded `cursor` asserts the exact diagnostic ("Operator $ilike is only available for indexed string attributes") at the exact position — once — and `queryGroup` replays it across `useQuery`, `queryOnce`, `useInfiniteQuery`, and `adminDb.query`. One bad-input fixture, every entry point locked.

Positions to lock first:
- `query`: `q({ todos: { $: { where: { ⌶ } } } })` → attribute names + dot-paths; the inline `useQuery({ ⌶ })` positions that regressed in vux.
- `schema`: `i.namespace({ ⌶ })` → `singular`/`fields`/`ruleParams`.
- `tx`: `db.tx.memberships[id()].link({ ⌶ })` → link labels + dot-path unique attrs; `.ruleParams({ ⌶ })` → schema-declared params.
- `perms`: ref-path strings → link-path completions; bindings scope → bound names.

Diagnose the *existing* vux regression first by writing the failing suite against vux, fix it in the clean dux codebase, then it's locked forever.

### 8.3 Fixtures — one canonical app, DRY by construction

All three planes draw from a single `test-support/` directory (aliased `@test`):

- **The canonical app**: one fixed schema, seed data, and scripted reactor scenarios (auth transitions, query emissions, presence events). Every runtime and parity test replays these scenarios; change the canonical schema once and every plane updates.
- **The snippet library**: selenita `snippet`s with embedded `cursor`s — the canonical good queries, the canonical *bad* queries (one per validation rule), schema-authoring fragments, tx fragments. DX tests compose these instead of restating code.
- **Typed expectations**: shared `expectTypeOf` helpers for the data shapes the spec promises.

The only test code that is irreducibly per-API is the one-line wrapper feeding a shared scenario or snippet into a specific entry point — exactly the duplication you *want*, because it's the thing under test.

### 8.4 Collocation policy

Tests live **next to the code they exercise** — `query/defineQuery.dx.test.ts` beside `query/defineQuery.ts`, parity suites under `vue/baseline/` — never in a top-level `tests/` mirror of `src/`. The collocated trio means an API ships with its three planes in the same folder and the same PR; the boundary lint (§5.2) applies to test files too, so a query-layer test can import `@test` and `query/**` but never `vue`. The only centralized test code is `test-support/` itself.

### 8.5 The drift check (from §6.3)

`check-baseline-drift` is itself a maintainer "test": CI (or the rebase ritual) flags when official Vue source moved, so re-vendoring is a deliberate step, not an accident discovered months later.

### 8.6 Compatibility-target tests

The [§1.5](#15-the-scope-edge--every-official-surface-ruled-in-or-out-on-purpose) matrix's "compatibility target" rows are promises, and promises here are tests, not prose. Small suites — collocated with the surface whose *output* they guard, like every other test (§8.4) — assert, type-level and (where cheap) runtime-against-fixtures:

- `defineSchema(...)` output satisfies what `instant-cli` push and `platformApi.schemaPush` consume (`schema/defineSchema` suite);
- `definePerms(...).compile()` is assignable to `InstantRules` and accepted by `pushPerms` (`perms/definePerms` suite);
- a dux `adminDb` satisfies what official `@instantdb/resumable-stream` consumes (`admin/init` suite);
- a `defineWebhookHandlers(...)` map satisfies the official `WebhookHandlers` shape (`webhooks` suite).

When upstream moves one of these contracts, the suite fails before a user does — the same job `check-baseline-drift` does for the vendored tier, expressed in the medium that fits unwrapped tools.

---

## 9. Directory structure

```
client/packages/dux/                    # orchestrator workspace (mirrors packages/vux's maintainer role; private)
  package.json                          # name: idb-dux-workspace, private; build/pack/demo scripts
  eslint.config.mjs                     # incl. import/no-restricted-paths boundary rules (§5.2)
  scripts/
    check-baseline-drift.mjs            # §6.3 — diff baseline against client/packages/vue/src
    publish-idb-dux.mjs
    (demo-resolution + pack scripts, lifted from vux/scripts)
  docs/
    architecture.md                     # this layering, kept current
    workflow-fork-rebase.md             # incl. the re-vendor step
  packs/                                 # local tarballs for demo resolution (gitignored)

  idb-dux/                              # the published package — @mszr/idb-dux
    package.json                        # tshy exports (§5.3), sideEffects:false, optional peers
    tsconfig*.json
    vitest.config.ts
    src/
      index.ts                          # ROOT: framework-agnostic foundation re-exports
      schema/                           # ── innermost, pure ──
        defineSchema.ts
        namespace.ts                   # i.namespace
        singularize.ts                  # runtime algo + Singularize<> type util
        index.ts
      query/                            # ── framework-agnostic ──
        defineQuery.ts                  # q
        shapeResult.ts                  # pure $only/$at/$as/$m + normalization (shared by vue+admin)
        validation/                     # where/operator/traversal types (the one validation surface)
        types/                          # IdbEntity, IdbEntityWithLinks, IdbQueryEntity, IdbQueryData, IdbRegister
        index.ts
      tx/                               # ── framework-agnostic ──
        typedTx.ts                      # schema-typed tx chain: ruleParams + dot-path .link → compiles to lookup()
        index.ts
      perms/                            # ── framework-agnostic, authoring-only ──
        definePerms.ts
        expr/                           # AST nodes + CEL renderer
        context/                        # ctx (auth, data, dataRef, ruleParams, ...)
        index.ts
      vue/                              # ── coupled plane ──
        baseline/                       # vendored mirror of @instantdb/vue (deltas marked)
          UPSTREAM.md                   # vendored-from commit stamp
          InstantDuxDatabase.ts
          InstantDuxRoom.ts
          useInfiniteQuery.ts
          components/                   # SignedIn/SignedOut/Cursors — .ts render fns (official ships .vue SFCs; marked build delta)
        overlay/                        # ergonomics by composition
          useQuery.ts  useAuth.ts  useUser.ts  ...
          rooms/
          result.ts                     # refs+state; lifted from vux's xResult.ts
          defineDb.ts                  # memoized lazy-init factory
        index.ts                        # assembles + exports the enhanced db
      webhooks/                         # ── server plane (framework-agnostic, admin-free) ──
        init.ts                         # optional-config init; wraps @instantdb/webhooks (optional peer)
        defineWebhookHandlers.ts        # plain-object handler authoring (registration-typed)
        types.ts                        # IdbWebhook* mappings over the official types (§11.7)
        index.ts
      admin/                            # ── server plane ──
        init.ts                         # owns @instantdb/admin (no more init injection)
        query.ts                        # uses shapeResult from ../query (one-shot + subscribeQuery)
        webhooks.ts                     # adminDb.webhooks — the /webhooks surface, token wired
        index.ts
      nuxt/                             # ── h3/nitro glue ──
        defineServerKit.ts              # request-scoped kit ({ adminDb, user?, … }) — wraps /admin + event.context caching
        defineAuthSyncHandler.ts        # firstPartyPath auth sync (token-only cookie)
        defineWebhookHandler.ts         # one-line webhook route: h3 raw body → /webhooks process
        index.ts
      test-support/                     # the @test fixture library (§8.3): canonical app, scenarios, snippets
      # tests collocate beside the APIs they exercise (§8.4): *.test.ts / *.test-d.ts / *.dx.test.ts
    demo/                               # one Nuxt demo exercising every entrypoint
```

Workspace wiring: `packages/*` already globs the orchestrator dir; add `packages/dux/idb-dux` explicitly to `client/pnpm-workspace.yaml` and the root `package.json` `workspaces` (same way `packages/vux/idb-vux` is listed). The orchestrator's pack/demo-resolution scripts are close to a straight lift from `packages/vux/scripts` — generalize them rather than fork them if you can.

---

## 10. What changed from the vux-era exploration

The vux-era spec was strong and most of it carried over unchanged. Five deliberate divergences founded dux — recorded here for the record, with `ideal-vux.md` and `ideal-perms-spec-x.md` since updated to match:

### 10.1 No X, enhanced as default

This was the big open question (D1/D2), and it's now settled: **dux drops the `X` suffix entirely.** The enhanced behavior *is* the default, unsuffixed surface; the vendored baseline is **internal-only — never exported to users**, existing purely as the test/port anchor ([§6](#6-the-vendored-baseline--additive-overlay-model), [§8.1](#81-the-parity-harness-new)).

What settled it:

- **A `db` is one coherent object.** `db` is produced by `init`, and its methods are bound to how that `init` built them. You therefore cannot offer baseline and enhanced *on the same `db`* without distinct names, nor on *separate* `db`s without forcing users to juggle two instances and lose method mix-and-match. "Keep both" costs either a permanent suffix on every recommended call site or an impractical two-db split — and the only thing that justified that cost was a mix-and-match use case that **shouldn't exist**: if dux is more ergonomic, nobody reaches for baseline; if someone truly wants the official surface, they use the official SDK. Kill the use case, kill the suffix.
- **Collisions are handled by design, not by a suffix.** Three surfaces, each covered:
  1. *Standalone exports* (`defineSchema`, `definePerms`, `q`, `init`…) sit behind the `@mszr/idb-dux` specifier — they can't collide with `@instantdb/*` imports, and a rare userland clash is one `import { init as idbInit }` away. They're single-use (`instant.schema.ts` calls `defineSchema` once), so even a hypothetical future official `defineSchema` is a trivial rename + changelog line.
  2. *Keys inside idb-native objects* (the query `$` clause, tx params) — collision-proofed by **convention**: every dux-introduced key inside an idb object is `$`-prefixed (`$only`, `$at`, `$as`, `$m`). idb uses bare keys inside `$` (`where`, `order`, `limit`, `offset`, `fields`), so the `$`-namespace is ours; a future collision is a codemod, not a redesign.
  3. *Mixing an official package alongside dux* (e.g. a tool importing both `@mszr/idb-dux` and `@instantdb/platform`, each exporting an `i`) — the standard ESM answer applies: alias at import (`import { i as pi } from '@instantdb/platform'`). dux never claims the official specifiers, so coexistence is always available; and dux's `i` carries *only* the dux dialect (`i.namespace` + the field builders — no `i.entity`, no `i.schema`), so the two same-named objects are never half-interchangeable lookalikes that invite confusion.
- **Purpose-overlap makes name-collisions mergeable, not breaking.** If idb ever ships an API whose name collides with ours, its purpose almost certainly overlaps ours (a future `defineSchema` would… define a schema). Since our default surface already reimagines those same concepts, we'd absorb the new capability into ours and keep shipping ours. Only a name-collision with *zero* purpose overlap forces a rename — rare, and a find-and-replace when it happens.

**The rule, stated once:** dux's *top-level exports are unprefixed*; dux's *keys inside an idb-native object are `$`-prefixed*; the *vendored baseline is internal-only*. That trio replaces the `X` suffix with something principled. The full vocabulary and type policy is codified in [§11](#11-the-naming-contract).

### 10.2 "Vendor-and-mark," not "reimplement"

The vux-era spec said *"Vux reimplements the baseline rather than re-exporting it."* Re-exporting is correctly rejected (you need SSR guards + tighter types). But "reimplement" is what *produced* the 1100-line divergence and the IntelliSense regression. Replace it with **vendor-and-mark** ([§6](#6-the-vendored-baseline--additive-overlay-model)): copy upstream, fence the deltas, never creatively rewrite. Same end (we own the code, with guards and tight types); opposite discipline (mirror, don't fork).

### 10.3 The root entry is the framework-agnostic plane, stated as such

The vux-era spec framed the root as the Vue client and hung `/admin`, `/nuxt`, `/perms` off it. dux inverts the center of gravity: the **root is the agnostic foundation** (schema + query + type utils + `id`/`tx`/`lookup`), and `/vue` is *a* client overlay hanging off it — peer to `/admin`. This matches how the demo actually imports (`shared/utils/idb.ts` pulls authoring from root and is consumed by both planes) and makes the "Vue is the first client, not the definition" vision structural rather than aspirational.

### 10.4 Layering and boundary-enforcement are first-class

The vux-era spec treated the agnostic-vs-coupled split as a packaging detail (subpaths). dux makes it the **primary architectural axis** ([§5.1](#51-the-dependency-graph)) and *enforces it with lint rules* ([§5.2](#52-enforce-the-boundaries-mechanically)). This is the structural antibody against vux's failure mode.

### 10.5 Foreground the buried milestones

The vux-era spec parked several of its best DX ideas as future footnotes. With no public baseline to stay compatible with, dux promotes them into the core value proposition:

- **Typed `db.tx` replaces `defineLookup`.** The vux-era Q3 deferred the typed tx chain and shipped `lu` as a stopgap for the untyped loose-lookup form. dux inverts this: `db.tx` (and `adminDb.tx`) are typed from the schema. `.ruleParams({...})` completes and validates the namespace's declared params, closing core's `RuleParams = { [key: string]: any }` hole. `.link()` accepts dot-path keys — `{ 'workspace.inviteCode': code }` — that complete on the link label, narrow to *unique* attributes of the linked namespace, type the value, and compile to the official `lookup()` form under the hood. (Verified in core: `LinkParams` types the link *labels* and id values, but a `lookup()` is smuggled through as an untyped string — the dot-path form is where all the missing safety lives.) With the chain typed end-to-end, the standalone `defineLookup`/`lu` utility is redundant and is dropped.
- **Schema registration solves the type-utility DX (the vux-era Q2).** The curried form originally sketched — `type IdbEntity = DefineIdbEntityX<AppSchema>` then `IdbEntity<'todos'>` — is not expressible in TypeScript (generic type aliases cannot be partially applied), which is *why* Q2 stayed open. The mechanism that actually delivers the no-repetition DX is module-augmentation registration (the TanStack-style `Register` pattern): declare the schema once in a `declare module` block, and every dux type utility *and* schema-generic authoring factory defaults to it. Details in [§11.3](#113-schema-registration--tell-dux-your-schema-once).
- **SSR hydration is a named milestone, not a maybe.** The floor/ceiling framing stays, but the ceiling gets a roadmap row (phase 9) instead of living only in an open-questions table.

Everything else — `$only`/`$at`/`$as`/`$m`, the `singularize` options, the type utilities, the perms builder pipeline, the SSR-resilience floor — carried over intact, and both docs now reflect the dux names and decisions. They describe *what the surface does*; this note describes *where the code lives and how it stays alive*.

---

## 11. The naming contract

The settled law — the seed of `dux-conventions.md`, recorded here so no naming question stays open. Every name must pass three questions: **which domain does it belong to** (and does the name place it there)? **Is it technically accurate** — does it describe what the thing *is*, not what an ancestor happened to call it? **Is the term reused consistently** everywhere the concept appears?

The official surface fails all three at once — three brand prefixes (`Instant*`, `Insta*`, `InstantDB*`), `InstaQLParams` naming the query object "params", `InstaQLResult` and `InstaQLResponse` naming the *same shape* twice, `User` meaning "authenticated user", and schema API vs docs disagreeing on entity-vs-namespace. dux replaces the lot.

### 11.1 Vocabulary

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

Native keys are kept verbatim wherever dux doesn't change their meaning — `where`, `order` (not `orderBy`), `limit`, `offset`, `fields` — and a key is renamed only when dux genuinely widens its semantics, always mapping back to the native key under the hood. The same restraint extends to **method names on wrapped surfaces** (admin auth/storage/streams, the webhooks manager): official verbs that are already precise are kept verbatim; a method is renamed only when the official name is inaccurate or dux changes what it means ([§11.7](#117-webhooks-naming) records the few that are).

### 11.2 Values vs types

- **Values are unprefixed:** `init`, `defineSchema`, `q`, `definePerms`, `defineDb`, `defineServerKit`, `defineAuthSyncHandler`, `id`, `lookup`. The package specifier already namespaces them; a userland clash is one `import { init as idbInit }` away. No brand words inside dux-owned value names (re-exported official values keep their official names). One exception: error classes (`IdbError`) keep the brand — `e instanceof IdbError` must read branded next to other libraries' errors.
- **Types are `Idb`-prefixed and domain-scoped:** `Idb<Domain><Thing>`, with domains `Query`, `Tx`, `Perms`, `Auth`, `Room`, `Storage`, `Webhook`, `Admin` (and `Platform`, `Migration` reserved for the deferred platform track) — and **schema as the unmarked root domain**: a type read directly off the schema goes unmarked (`IdbEntity`, `IdbSchema`); a type derived through other machinery says which (`IdbQueryEntity`, `IdbTxUpdate`). Anything unmarked = "straight from your schema."
- **Result objects follow one pattern:** every hook returns `Idb<Domain>Result` with `-Data`/`-State`/`-Refs` subparts (`IdbQueryResult`, `IdbAuthResult`, `IdbRoomPresenceResult`). Learn one, know all. The result pattern is a *client-reactivity* concept — server one-shots return plain shaped data and don't claim it.
- **The bare name goes to the surface's primary read.** On a client the subscription is primary, so it owns `useQuery` and the one-shot carries the marker (`queryOnce`); on a server db the one-shot is primary, so it owns `query` and the subscription carries the marker (`subscribeQuery`). Same law, both directions.

### 11.3 Schema registration — tell dux your schema once

Generic type aliases cannot be partially applied in TypeScript, so the curried `type IdbEntity = DefineIdbEntity<AppSchema>` form is impossible. The mechanism that delivers the no-repetition DX is module-augmentation registration (the TanStack-style `Register` pattern), declared once next to the schema:

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

The boundary rule: **registration supplies types, not values.** Everything type-only defaults to the registered schema — all `Idb*` type utilities, and the exported `q` (whose runtime is schema-independent; its validation is type-level). Anything that needs the schema *value* still receives it explicitly — `defineDb`, `init`, `definePerms(schema)` — because runtime singularization and runtime validation cannot come from a type. Multi-schema escape hatch: an explicit trailing type param (`IdbEntity<'todos', OtherSchema>`) and `defineQuery<OtherSchema>()`.

### 11.4 The rename table

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
| `InstantObject`, deprecated aliases (`InstantQuery`, `InstantEntity`, `InstantGraph`, …) | legacy | **dropped** — baseline-internal only |

Wrapped-surface types follow the same machinery mechanically (`FileOpts` → `IdbStorageFileOpts`, `DebugCheckResult` → `IdbAdminCheckResult`, the webhook set in [§11.7](#117-webhooks-naming), …); each `dux-spec-*.md` carries its surface's complete table — this one records the pattern and the non-obvious calls.

### 11.5 Perms naming

The domain term is **perms**, everywhere: `definePerms`, `/perms`, `instant.perms.ts` (CLI-fixed anyway), output type `IdbPerms`. "Rules" was CEL/dashboard leakage; the word survives only in prose for a single allow entry. The compile point is **`.compile()`** (not `.toRules()`) — it says what happens (authoring AST → CEL strings) and its return type says what you get.

The perms context is **entity-rooted with current unmarked** — the current entity is *the* entity, so it carries no marker; only the *updated* and *linked* states do: `entity`/`e`, `entityField`/`ef`, `entityRef`/`er`; `entityUpdated`/`eu`, `entityUpdatedField`/`euf` (no updated-ref — Instant doesn't support `newData.ref`); `entityLinked`/`el`, `entityLinkedField`/`elf`, `entityLinkedRef`/`elr`. Every `e*` shorthand is entity-family: the second letter says *which* entity, the suffix says *how you read it*. CEL's `data`/`newData`/`linkedData` remain compile targets and never appear in the authoring surface. Full table: [`ideal-perms-spec-x.md`](./ideal-perms-spec-x.md).

### 11.6 Value renames applied

- `defineInstantAuthSyncHandler` → **`defineAuthSyncHandler`** — no brand words inside value names.
- `defineServerIdb` → **`defineServerKit`** — *not* `defineServerDb`: unlike client-side `defineDb`, it does not return a db. It returns a request-scoped *kit* whose keys vary by mode (`{ adminDb, user?, userDb?, … }`); naming it like a db would lie about the contract, and "kit" says exactly what it is — a small bundle of related tools.

### 11.7 Webhooks naming

The domain vocabulary is §11.1's: a **webhook** delivers **payloads** of **changes**, and a change's `before`/`after` is an `IdbEntity` — official `WebhookEntity<S, NS>` is **dropped entirely** in favor of the one entity type. The surface (full spec: `dux-spec-webhooks.md`):

| Official | What it actually is (verified in `webhooks/src`) | dux |
|---|---|---|
| `new Webhooks(config)` / `db.webhooks` | the bound surface | `init(config?)` from `/webhooks` — config *optional*: handling needs no token (verification uses Instant's public JWKS; payload fetches use the token the body carries); `appId`+`adminToken` only unlock `manager`, `apiURI` only for self-hosting. Types come from registration. Also exposed token-wired as `adminDb.webhooks`. |
| `validate` / `validateRequest` | cryptographic signature verification | **`verify(request)`** (raw form: `verify({ signature, body })`) — one name, the accurate crypto term |
| `fetchPayloads` | fetches **one** payload object (the plural is a misnomer per its own return type) | **`fetchPayload`** |
| `processPayload` | dispatches each change to its handler | **`dispatch(handlers, payload)`** |
| `processRequest` / `processNodeRequest` | the verify → fetch → dispatch one-liner | **`process(handlers, request)`** / **`processNode(handlers, req)`** — the receiver (`webhooks.`) already says the domain |
| `helpers()` / `typedHandlers` / `combineHandlers` | ceremony for building typed handler maps piecemeal | **`defineWebhookHandlers(...maps)`** — a plain object literal gets full per-change narrowing via contextual typing (no helpers, no generics); passing several maps merges them, subsuming `combineHandlers` |
| `manager` (`list`, `create`, `update`, `delete`, `enable`, `disable`, `listEvents`, `getEvent`, `getPayload`, `resendEvent`) | subscription management + delivery-event inspection | `manager` — **every method name kept verbatim** (already precise) |

Types: `WebhookInfo` → **`IdbWebhook`** ("Info" was a workaround for the class name owning `Webhooks`; manager methods return *webhooks*), `WebhookEventInfo` → `IdbWebhookEvent`, `WebhookAttempt` → `IdbWebhookAttempt`, `WebhookEventsPage` → `IdbWebhookEventsPage`, `WebhookPayload` → `IdbWebhookPayload`, `WebhookPayloadRecord` / `WebhookPayloadRecordFor` → **`IdbWebhookChange<'ns'?, action?>`** (one utility, optional narrowing — the `IdbEntity` pattern), `WebhookHandlers` → `IdbWebhookHandlers`, `CreateWebhookParams` / `UpdateWebhookParams` → `IdbWebhookCreate` / `IdbWebhookUpdate` (the `IdbTxCreate`/`IdbTxUpdate` pattern), `WebhookAction` / `WebhookStatus` / `WebhookEventStatus` → `IdbWebhookAction` / `IdbWebhookStatus` / `IdbWebhookEventStatus`.

Semantics preserved exactly (behavioral compatibility): handler resolution per change is `namespace.action` → `namespace.$default` → `$default` (the `$default` keys sit happily inside dux's `$`-prefix convention); handlers run concurrently; any rejection rejects `process`, so the route returns non-2xx and Instant retries. A `defineWebhookHandlers` map is structurally a valid official `WebhookHandlers` — locked by a compat test (§8.6).

In `/nuxt`, **`defineWebhookHandler(handlers, opts?)`** returns the one-line H3 route (raw body read the h3 way, delegated to `/webhooks`). The singular/plural pair is deliberate grammar: `defineWebhookHandlers` authors the *many* handlers; `defineWebhookHandler` is the *one* route handler that receives them — `defineWebhookHandler(defineWebhookHandlers({ … }))` reads as exactly what it does.

---

## 12. Implementation roadmap

Sequenced so each step is independently testable and nothing depends on a surface that doesn't exist yet. The order follows the dependency graph inward-out, so you're always building on something already locked.

| Phase | Deliverable | Done when |
|---|---|---|
| 0. Scaffold | `packages/dux/idb-dux` in the workspace; tshy exports; `sideEffects:false`; optional peers; lint boundary rules; empty subpath entries that typecheck | `pnpm -F @mszr/idb-dux build` produces all 6 entrypoints; boundary lint passes |
| 1. Schema layer | `defineSchema`, `i.namespace`, `singularize` (runtime + type) | schema type tests + selenita suite green; `defineSchema` compat tests (§8.6) green |
| 2. Query + tx layer | `q` (ready-made via registration) + `defineQuery`, `shapeResult` (pure), validation types, the `Idb*` type utilities + `IdbRegister`, typed-tx machinery (`src/tx/`: `ruleParams`, dot-path `.link`) | the IntelliSense regression is *reproduced then fixed* under selenita; validation + tx dx tests green |
| 3. Vue baseline | vendor `@instantdb/vue` into `vue/baseline/`, mark SSR + type deltas, stamp `UPSTREAM.md`, wire `check-baseline-drift` | parity harness (§8.1) green vs official `@instantdb/vue` |
| 4. Vue overlay | `useQuery` & friends composing the baseline via `shapeResult`; `result` (refs+state); `defineDb`; components | overlay intellisense + runtime tests green; demo's client stores compile against `/vue` |
| 5. Webhooks | `/webhooks`: optional-config `init`, `defineWebhookHandlers`, the `IdbWebhook*` types via registration (wrap-and-map over `@instantdb/webhooks`) | handler-narrowing dx tests green; dispatch behavior matches official `processRequest` on shared fixtures; handlers-shape compat test green |
| 6. Admin | owned `init`, `query` + `subscribeQuery` reusing `shapeResult`, typed tx on `adminDb.tx`, `debugQuery`/`debugTransact` with typed params, `asUser`, auth/storage/streams/rooms pass-throughs, `adminDb.webhooks` | admin types + runtime tests green; demo server reads via `/admin` (no `init` injection); resumable-stream compat test green |
| 7. Nuxt | `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` wrapping `/admin` + `/webhooks` | demo server routes + auth sync + webhook route green |
| 8. Perms | the `definePerms` pipeline (its own build order is `ideal-perms-spec-x` §"Proposed Build Order") | demo `instant.perms.ts` compiles to valid `InstantRules`; perms dx + type + compat tests green |
| 9. Demo + lock | one Nuxt demo exercising all 6 entrypoints (including a webhook route and a manager call); trim tests to contract-only | demo builds + runs SSR; parity/dx/drift/compat checks wired into CI |
| 10. SSR hydration (gated on upstream) | Nuxt plugin: server query results serialized into HTML → client cache hydrated before subscriptions start | **by decision, starts only when idb marks SSR support stable** (today it's experimental, Next-only); until then the resilience floor is the contract |

Perms (8) is sequenced late only because it's independent — it can be built in parallel any time after schema (1), since nothing else depends on it. Webhooks (5) likewise depends only on the schema layer's types; it sits just before admin so `adminDb.webhooks` lands assembled.

---

## 13. Decisions (resolved in this thread)

The forks flagged earlier — identity and roadmap calls — are now settled:

| # | Decision | Resolution |
|---|---|---|
| D1 | API naming / the `X` suffix | **No `X` anywhere.** Enhanced behavior is the default, unsuffixed surface; baseline is internal-only. See [§10.1](#101-no-x-enhanced-as-default). |
| D2 | Expose a public baseline/compat surface? | **No.** The vendored baseline is purely the internal test/port anchor, never exported — exposing it would force a second `db` instance (methods bind to `init`). Fewer public promises = more freedom. |
| D3 | Repo home & publishing | **Develop in this fork forever** (ideal for the §6.3 drift check — official source sits right beside ours). Publish via **`git subtree`** to a separate public `mareszhar/idb-dux` repo, pushing only milestone/release commits; all dev stays in the fork. Adapts [`workflow-publish-idb-vux.md`](../workflow-publish-idb-vux.md). |
| D4 | Brand line in user docs | **Named at dux's creation.** dux READMEs/docs lead with "a DX/UX-first reimagining of InstantDB"; vux docs stay untouched as historical reference. |
| D5 | Naming & vocabulary conventions | **Settled** — codified as the naming contract ([§11](#11-the-naming-contract)): vocabulary, value-vs-type policy, the rename table, schema registration, perms naming and entity-rooted ctx, `defineServerKit`/`defineAuthSyncHandler`. `dux-conventions.md` will distill it without changing it. |
| D6 | Typed tx in core; `defineLookup` dropped | `db.tx`/`adminDb.tx` typed from schema (`ruleParams`, dot-path `.link`); the loose-lookup utility is redundant. See [§10.5](#105-foreground-the-buried-milestones). |
| D7 | Testing stack | **All-Vitest**: runtime (`*.test.ts`), type shapes (`*.test-d.ts` via `--typecheck`), editor DX (`*.dx.test.ts` via selenita). Tests collocate beside their APIs; one `test-support/` fixture library; vitest globals on; no auto-import codegen. See [§8](#8-testing-for-parity-and-intellisense). |
| D8 | The scope edge (platform, webhooks, and everything else) | **Drawn on purpose** in [§1.5](#15-the-scope-edge--every-official-surface-ruled-in-or-out-on-purpose): `/webhooks` joins as the sixth entrypoint; `/platform` is deferred behind a named trigger with the adoption codegen as its first brick and a *tested* compatibility guarantee meanwhile; every other official package and feature carries an explicit verdict. The schema file is canonical; push is the only sync direction. |
| D9 | Admin breadth | **Full-surface, per-method treatments** (`ideal-vux` §5.4): the data plane is dux-shaped (`query`, `subscribeQuery`, typed tx, typed debug params), precise official verbs are kept (auth/storage/streams/rooms), types are renamed throughout, `asUser` stays dux-shaped by construction, and `adminDb.webhooks` exposes the `/webhooks` surface. The `-Data/-State/-Refs` result pattern remains a client-reactivity concept ([§11.2](#112-values-vs-types)). |
| D10 | Sustainability tiers | **Two tiers + a test category**: vendor-and-mark only where internal deltas are required (`/vue`); wrap-and-map wherever composition suffices (`/admin`, `/webhooks`, `/nuxt`) ([§6.4](#64-the-second-tier-wrap-and-map)); compatibility targets are tested promises ([§8.6](#86-compatibility-target-tests)). |

No open questions remain. Where something is deliberately deferred — singularity auto-inference, SSR hydration, the platform track and its adoption codegen — it is a documented intention with an explicit trigger ([§1.5](#15-the-scope-edge--every-official-surface-ruled-in-or-out-on-purpose), `ideal-vux.md` §11), not an open decision.

---

## 14. Documentation plan

One hub, not two — a second hub splits orientation. When dux scaffolds, this set moves to `client/packages/dux/docs/` and the hub doubles as the package's front-door doc; until then, new docs are authored in `vux/docs/notes/`:

```
dux-vision.md          ← THE hub: philosophy, architecture, the scope edge (§1.5),
                          "how it stays alive" (this blueprint, renamed) + an index
                          over everything below
dux-conventions.md     ← cross-cutting law: vocabulary (namespace/entity/attribute,
                          field/link/ref, webhook/change/payload), value-vs-type naming
                          policy, native-key + wrapped-verb rule, $-prefix rule,
                          primary-read rule, schema registration. Referenced by every spec.
dux-spec-root.md       ← @mszr/idb-dux: schema, query authoring, typed tx, type utilities
dux-spec-vue.md        ← /vue: db, hooks, rooms, components, SSR, refs+state, defineDb
dux-spec-perms.md      ← /perms: the definePerms pipeline (successor to ideal-perms-spec-x)
dux-spec-admin.md      ← /admin: the full server surface — shaped query + subscribeQuery,
                          typed tx + debug, asUser, auth/storage/streams/rooms
                          pass-throughs with their rename tables, adminDb.webhooks
dux-spec-webhooks.md   ← /webhooks: init, defineWebhookHandlers, the pipeline verbs
                          (verify/fetchPayload/dispatch/process/processNode), manager,
                          IdbWebhook* types (§11.7)
dux-spec-nuxt.md       ← /nuxt: server kit, auth sync, defineWebhookHandler
dux-spec-workspace.md  ← maintainer manual: testing methodology (§8), the two
                          sustainability tiers (§6), compat-target tests (§8.6),
                          drift check, subtree publishing, fork-rebase
```

Six sub-specs mirror the six entrypoints — when an entrypoint changes, exactly one spec changes with it. Two cross-cutting docs hold what spans subpaths. `ideal-vux.md` and `ideal-perms-spec-x.md` stay where they are as historical reference; the sub-specs supersede them (the perms spec ports `ideal-perms-spec-x` largely verbatim, de-X'd and re-termed per conventions). Writing order: conventions → root → vue → workspace → webhooks → admin → nuxt → perms — matching the roadmap so each spec lands just before its implementation phase, with perms last only because its spec already exists in near-final form.

---

## 15. Direct answers to your questions

For the record, mapped one-to-one:

- **Would the subpath structure work / make it heavy?** Works; not heavy. Subpaths + `sideEffects:false` + optional peers = zero bytes and zero forced installs for vue-only users ([§4](#4-will-subpaths-make-it-heavy--the-bundle-size-answer)).
- **Better structure?** Root = agnostic foundation (not empty); `/vue` `/perms` `/admin` `/webhooks` `/nuxt` as overlays; layered source with lint-enforced boundaries ([§3](#3-the-shape-the-user-proposed-refined), [§5](#5-architecture--layered-source-flexible-packaging), [§9](#9-directory-structure)).
- **Dir structure for `client/packages/dux`?** [§9](#9-directory-structure).
- **Sustainable / easy to port upstream?** Vendored-baseline + drift check ([§6](#6-the-vendored-baseline--additive-overlay-model)); the overlay is insulated from upstream churn.
- **Easy to test parity + intellisense?** Executable parity harness vs the official devDep; selenita suites as a gating rule; the empty intellisense dir was the bug ([§8](#8-testing-for-parity-and-intellisense)).
- **Keep it DRY?** Shared `shapeResult`, shared schema source-of-truth, one validation surface ([§7](#7-dry-in-practice)).
- **Publish each subtree separately?** No — one package now, mechanical split later on a forcing function ([§5.4](#54-when-to-split-into-real-packages)).
- **Rephrase the vision?** [§1](#1-vision--dux-as-a-reimagining-of-idb) — reimagining of idb, two planes, backend is the only contract, Vue/Nuxt as first clients.
- **New folder vs refactor vux?** New folder, clean-room with vux as parts bin ([§2](#2-why-a-new-folder-beats-refactoring-vux)).
- **Copy the vue SDK first, then add features?** Yes — vendor it, mark deltas, build the overlay by composition, keep it diffable forever ([§6](#6-the-vendored-baseline--additive-overlay-model)).

---

## 16. Next step

This note is the plan, not the build. Convergence is complete — `ideal-vux.md` and `ideal-perms-spec-x.md` match this blueprint, and the final pre-spec review has been folded in: the scope edge is drawn ([§1.5](#15-the-scope-edge--every-official-surface-ruled-in-or-out-on-purpose)), webhooks is in, platform is deferred on purpose, admin is decided per-method, and the sustainability model covers every tier. Next: execute the documentation plan ([§14](#14-documentation-plan)) — distill `dux-conventions.md` and the `dux-spec-*.md` set — then **Phase 0** of the roadmap ([§12](#12-implementation-roadmap)): scaffold `client/packages/dux/idb-dux` with the six entrypoints, tshy config, `sideEffects:false`, optional peers, and the boundary lint rules.
