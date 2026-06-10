updated: 2026-06-09
status: draft — exploratory blueprint, supersedes the "vux as a vue wrapper" framing

# dux — a blueprint with foresight

A proposal for `@mszr/idb-dux`: what it is, why it should be born fresh rather than refactored out of `idb-vux`, and how to structure it so it stays delightful *and* maintainable as the SDKs we track keep moving.

This note builds on [`ideal-vux.md`](./ideal-vux.md) and [`ideal-perms-spec-x.md`](./ideal-perms-spec-x.md). Where it diverges from them, it says so explicitly in [§10](#10-what-id-change-from-ideal-vux). Treat `ideal-vux` as the *feature* spec and this note as the *structural and strategic* spec.

---

## 0. TL;DR — the recommendation up front

1. **Yes, start fresh in `client/packages/dux`.** Not a blank page — a clean-room re-derivation that uses `idb-vux` as a *parts bin*. The current vux is wedged precisely because it *reimplemented* the official baseline divergently (1100-line `InstantVuxDatabase.ts` vs the official 400-line one), and that divergence is the most likely cause of the IntelliSense regression. You can't reach the ideal by editing your way out of that — edits stay biased by what's already there.

2. **Reframe the vision.** dux is not "an alternative Vue wrapper." It is a **DX/UX-first reimagining of InstantDB's developer experience**, organized around one structural insight: idb's surface splits into a *framework-agnostic plane* (schema, permissions, query authoring, admin) and a *framework-coupled plane* (reactive client bindings). dux separates the planes and makes each delightful on its own terms. **Vue and Nuxt are dux's first first-class clients, not its definition.**

3. **The implementation model is "vendored baseline + additive overlay."** Copy the official Vue SDK's implementation near-verbatim into an internal baseline layer, mark every delta, and build the enhanced ergonomics *on top of it by composition* — never by forking its internals. This is the single most important correction to how vux was built, and it directly answers "should we copy the vue sdk first?": **yes, and keep it diffable against upstream forever.**

4. **Packaging: one published package, layered source, subpaths, optional peers.** Ship `@mszr/idb-dux` with subpaths `/vue`, `/perms`, `/admin`, `/nuxt`. The *root is not empty* — it exports the framework-agnostic foundation. Subpaths + `sideEffects: false` + ESM give you complete client-bundle tree-shaking; optional peerDependencies give you dependency isolation. **Do not split into separate npm packages yet** — design the internal seams so the split is mechanical, and pull the trigger only when a forcing function appears (a second client, or peer/version friction).

The rest of this note is the argument and the detail.

---

## 1. Vision — dux as a reimagining of idb

> dux is a DX/UX-first reimagining of the InstantDB developer experience. It keeps Instant's backend, wire protocol, and rules engine exactly as they are, and rebuilds the authoring and client surface around a single question: *what would feel most delightful to use?*

### 1.1 The organizing insight: two planes

InstantDB's developer surface is really two planes that the official SDKs entangle:

- **The framework-agnostic plane** — how you *describe* and *address* your data: the schema, the permission rules, the shape of a query, the admin/server reads. None of this is Vue, React, or Svelte. Yet today it's scattered: schema lives in `core` but reads React-shaped; permissions are stringly-typed CEL with no schema awareness; the admin SDK has different ergonomics from the client.
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

The eight principles in `ideal-vux` §2 stand — delightful first, boilerplate is harm, errors at the cursor, self-documenting, predictable contracts, SSR-resilient floor, additive-never-divergent, performance parity. dux adds two structural ones:

9. **Plane separation is load-bearing.** The framework-agnostic layers must never import a framework. This is enforced mechanically ([§5.2](#52-enforce-the-boundaries-mechanically)), not by discipline alone. The day Vue concepts leak into query authoring is the day we've rebuilt vux's problem.
10. **The baseline is a mirror, not a fork.** Anything that has an official counterpart is *vendored and marked*, never creatively reimplemented ([§6](#6-the-vendored-baseline--additive-overlay-model)). Creativity lives in the overlay, where upstream churn can't reach it.

---

## 2. Why a new folder beats refactoring vux

The user's instinct is correct, and the codebase backs it up.

### 2.1 The evidence that vux is wedged

| Symptom | Evidence in repo |
|---|---|
| The baseline was reimplemented, not mirrored | `idb-vux/src/InstantVuxDatabase.ts` is **1100 lines** with bespoke generics (`QueryAuthoringInput`, `QueryAuthoringFactory`, `QueryMaybeRefOrGetterSource`, `QueryRuntimeQuery`…). The official `vue/src/InstantVueDatabase.ts` is **~400 lines**. |
| That divergence likely broke IntelliSense | `ideal-vux` §7.4 reports completions are dead on `useQuery` inline objects but fine via `q()`. The custom contextual-typing machinery on the db methods is the prime suspect. |
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
@mszr/idb-dux          ← NOT empty. The framework-agnostic foundation:
                          defineSchema, i (+ i.namespace), defineQuery/q,
                          defineLookup, the type utilities, id/tx/lookup.
@mszr/idb-dux/vue      ← the Vue client (enhanced db, components, rooms, SSR-resilient)
@mszr/idb-dux/perms    ← typed CEL authoring (authoring-only, no client runtime)
@mszr/idb-dux/admin    ← admin-SDK ergonomics (framework-agnostic; optional peer @instantdb/admin)
@mszr/idb-dux/nuxt     ← h3/nitro/nuxt server glue (optional peers @instantdb/admin + h3; wraps /admin)
```

**Why the root is not empty** — and this is grounded, not stylistic: the demo's `shared/utils/idb.ts` already imports `defineQuery` and `InstaQLEntity` from the *main* entry and is consumed by **both** client stores and server routes. The schema file, the shared `q`, the shared `lu`, the entity type utilities — these are framework-neutral and cross the client/server boundary. They belong at the root so neither side has to reach into `/vue` or `/admin` to get them. The root *is* the framework-agnostic plane. Your guess of "minimal exports to power schema init" undersells it: it's schema **plus** the whole authoring foundation.

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
        ┌────────────────  schema  ────────────────┐   defineSchema, i.namespace,
        │            (pure types + tiny runtime)     │   singularize<>  ← source of truth
        ▼                                            ▼
      query                                        perms                 ┐
  q / defineQuery,                          definePerms,               │  framework-agnostic
  result shapers ($only/$at/$m),             CEL emitter,               │  plane
  DefineIdbEntity / DefineIdbData          schema-aware ctx            ┘
        │           │
        │           └──────────────────────────┐
        ▼                                       ▼
       vue                                    admin                      ┐
  enhanced db (wraps the                query ergonomics over           │  coupled plane
  vendored baseline), result,           @instantdb/admin (peer)          │  (runtime/framework)
  rooms, components, SSR guards               │                          ┘
                                              ▼
                                            nuxt   ← h3/nitro glue, wraps admin (peers: admin + h3)
```

Read it as: **schema is consumed by everything; query is consumed by vue and admin; perms stands alone; vue and admin are sibling overlays; nuxt wraps admin.** The DRY wins ([§7](#7-dry-in-practice)) all come from query and schema being shared, not re-derived per surface.

### 5.2 Enforce the boundaries mechanically

Plane separation must be a *rule the linter checks*, not a habit. Use ESLint `import/no-restricted-paths` (or `no-restricted-imports`) in the dux workspace:

- `src/schema/**` may import only `@instantdb/core` + `src/schema/**`.
- `src/query/**`, `src/perms/**` may import `@instantdb/core` + `src/schema/**` + themselves. **No `vue`, no `h3`, no `@instantdb/admin`.**
- `src/admin/**` may add `@instantdb/admin`. No `vue`, no `h3`.
- `src/vue/**` may add `vue`. No `h3`, no `@instantdb/admin`.
- `src/nuxt/**` may add `h3` + `src/admin/**`.

This is the single highest-leverage guardrail in the whole proposal. It makes "a Vue concept leaked into query authoring" — the exact rot that wedged vux — a build error.

### 5.3 One package, layered source

Build with **tshy** (already the vux toolchain — dual ESM/CJS, the subpath→source map lives in `tshy.exports`). Each subpath is one `src/<layer>/index.ts`:

```jsonc
// tshy.exports in package.json
{
  "./package.json": "./package.json",
  ".":       "./src/index.ts",      // framework-agnostic foundation
  "./vue":   "./src/vue/index.ts",
  "./perms": "./src/perms/index.ts",
  "./admin": "./src/admin/index.ts",
  "./nuxt":  "./src/nuxt/index.ts"
}
```

`peerDependencies`: `vue` (the only non-optional peer, since `/vue` is the headline surface). `@instantdb/admin` and `h3` as **optional** peers. `dependencies`: `@instantdb/core`, `@instantdb/version`. `sideEffects: false`.

### 5.4 When to split into real packages

Hold at one package until a **forcing function** appears. The react-common precedent is instructive: idb split it out precisely because *two* packages (`react`, `react-native`) needed the same engine — a concrete second consumer, not a hypothetical. Apply the same test:

| Forcing function | Action |
|---|---|
| A second client overlay ships (`/react`, `/solid`) that needs the agnostic core | Promote `schema` + `query` to an internal `@mszr/idb-dux-core` package (the react-common move). |
| Perms' TS machinery measurably slows the editor for vue-only users | Split `@mszr/idb-dux-perms`. |
| `/nuxt` needs to version independently of the client (server release cadence diverges) | Split `@mszr/idb-dux-nuxt`. |

Because the source is already layered with lint-enforced seams, each split is **move a folder + add a `package.json` + repoint imports** — mechanical, hours not weeks. That reversibility *is* the foresight. Building separate packages now would buy isolation you don't need yet at the cost of version-sync overhead during the phase when you're iterating fastest. Don't.

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
  if (!isClient()) return inertQueryState()
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

---

## 7. DRY in practice

The layering isn't DRY for its own sake — here's where it concretely removes duplication that vux can't:

- **One result-shaper, two clients.** The `$only`/`$at`/`$as`/`$m` logic and array-normalization live as a **pure function** `shapeResult(rawData, querySpec)` + its type-level mirror in `src/query/`. `/vue`'s `useQuery` wraps it in `computed`; `/admin`'s `query` `await`s then applies the same function. vux can't share this today because the logic is welded into the Vue database class — which is exactly why the admin ergonomics in `ideal-vux` §5.4 are still aspirational.
- **One schema, one source of truth.** `defineSchema` output (singulars, ruleParams, link metadata) is imported by query (for inference), perms (for ctx typing), and both clients (for runtime singularization). No `singularOverrides` duplicated across `defineDb`/admin `init` — `ideal-vux` already wants this; the layering is what makes it real instead of copied.
- **One validation surface.** The where-clause/operator validation types (the `$ilike`-only-on-indexed-strings rules, the 3-hop traversal) live once in `src/query/` and are consumed by `q`, `useQuery`, `queryOnce`, and `adminDb.query`. Write the hard type once; every entry inherits it.
- **One refs+state primitive.** `result.ts` (`refs + state`) is shared by every enhanced hook in `/vue`. Lifted from vux's `xResult.ts` — keep it.

The test: if a fix to singularization or result-shaping requires editing more than one file outside `src/schema` or `src/query`, the layering has a leak.

---

## 8. Testing for parity and IntelliSense

Three layers, plus two new harnesses that make your two hardest goals — *feature parity* and *IntelliSense parity* — into automated checks instead of prose promises.

### 8.1 The parity harness (new)

`ideal-vux`'s principle #7 ("additive, never divergent") is currently audited by hand in `feature-parity-audit.md` — a prose matrix that goes stale. Make it executable:

- `@instantdb/vue` is *already a devDependency* of the package. Write one set of canonical scenarios (a fixed schema, a set of queries, auth transitions, room ops) and run them against **both** the official `@instantdb/vue` db **and** dux's `baseline` surface, asserting identical reactive output (same emitted values, same loading/error transitions).
- This converts "additive never divergent" from a promise into a red/green test. When upstream changes behavior, the parity test fails and tells you what to re-vendor.

### 8.2 The IntelliSense suites (new — the gap that bit you)

`src/tests/intellisense/` is empty today; that's why the regression shipped silently. Use **selenita** ([github.com/mareszhar/selenita](https://github.com/mareszhar/selenita)) and make this a *gating discipline*:

> **No enhanced API is "done" until it ships with a selenita suite that locks its completions and diagnostics.**

Co-locate `*.intellisense.ts` per layer:
- `query`: `q({ todos: { $: { where: { /*⌶*/ } } } })` → attribute names + dot-paths; the inline `useQuery({/*⌶*/})` positions that regressed.
- `schema`: `i.namespace({ /*⌶*/ })` → `singular`/`attrs`/`ruleParams`.
- `perms`: `ctx.dataRef('/*⌶*/')` → link-path completions; `b./*⌶*/` → bound names.
- `lookup`: `lu('/*⌶*/')` → namespace names; second arg narrows to unique attrs.

Diagnose the *existing* regression first by writing the failing suite, fix it in the clean codebase, then it's locked forever.

### 8.3 Type-level tests (keep, reorganize)

vux already has `*.types.ts` with `@ts-expect-error` (e.g. `queryAuthoring.contract.types.ts`, `official-sdk-gaps.types.ts`). Keep the pattern; co-locate per layer; assert the *good* error messages from `ideal-vux` §7 (the "$ilike is only available for indexed string attributes" class), not just that *an* error occurs.

### 8.4 Runtime tests (keep, trim)

Vitest for reactive flows, SSR-inert behavior, auth-sync cookie logic, server-db modes. `ideal-vux` §10's "fewer tests, higher confidence" applies — but in a *fresh* tree you get this for free by writing only the tests that assert contracts, never implementation details.

### 8.5 The drift check (from §6.3)

`check-baseline-drift` is itself a maintainer "test": CI (or the rebase ritual) flags when official Vue source moved, so re-vendoring is a deliberate step, not an accident discovered months later.

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
        defineQuery.ts                 # q
        defineLookup.ts                # lu
        shapeResult.ts                  # pure $only/$at/$as/$m + normalization (shared by vue+admin)
        validation/                     # where/operator/traversal types (the one validation surface)
        types/                          # DefineIdbEntity, DefineIdbData
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
          components/                   # SignedIn, SignedOut, Cursors
        overlay/                        # ergonomics by composition
          useQuery.ts  useAuth.ts  useUser.ts  ...
          rooms/
          result.ts                     # refs+state; lifted from vux's xResult.ts
          defineDb.ts                  # memoized lazy-init factory
        index.ts                        # assembles + exports the enhanced db
      admin/                            # ── coupled plane (server) ──
        init.ts                         # owns @instantdb/admin (no more init injection)
        query.ts                       # uses shapeResult from ../query
        index.ts
      nuxt/                             # ── h3/nitro glue ──
        defineServerIdb.ts             # wraps /admin + event.context caching
        defineInstantAuthSyncHandler.ts
        index.ts
      tests/
        parity/                         # §8.1 — vs @instantdb/vue
        intellisense/                   # §8.2 — selenita, per layer
        *.types.ts                      # §8.3
        *.test.ts                       # §8.4
    demo/                               # one Nuxt demo exercising every entrypoint
```

Workspace wiring: `packages/*` already globs the orchestrator dir; add `packages/dux/idb-dux` explicitly to `client/pnpm-workspace.yaml` and the root `package.json` `workspaces` (same way `packages/vux/idb-vux` is listed). The orchestrator's pack/demo-resolution scripts are close to a straight lift from `packages/vux/scripts` — generalize them rather than fork them if you can.

---

## 10. What I'd change from ideal-vux

`ideal-vux` is a strong feature spec and most of it carries over unchanged. Four deliberate divergences:

### 10.1 No X, enhanced as default

This was the big open question (D1/D2), and it's now settled: **dux drops the `X` suffix entirely.** The enhanced behavior *is* the default, unsuffixed surface; the vendored baseline is **internal-only — never exported to users**, existing purely as the test/port anchor ([§6](#6-the-vendored-baseline--additive-overlay-model), [§8.1](#81-the-parity-harness-new)).

What settled it:

- **A `db` is one coherent object.** `db` is produced by `init`, and its methods are bound to how that `init` built them. You therefore cannot offer baseline and enhanced *on the same `db`* without distinct names, nor on *separate* `db`s without forcing users to juggle two instances and lose method mix-and-match. "Keep both" costs either a permanent suffix on every recommended call site or an impractical two-db split — and the only thing that justified that cost was a mix-and-match use case that **shouldn't exist**: if dux is more ergonomic, nobody reaches for baseline; if someone truly wants the official surface, they use the official SDK. Kill the use case, kill the suffix.
- **Collisions are handled by design, not by a suffix.** Two surfaces, each covered:
  1. *Standalone exports* (`defineSchema`, `definePerms`, `q`, `init`…) sit behind the `@mszr/idb-dux` specifier — they can't collide with `@instantdb/*` imports, and a rare userland clash is one `import { init as idbInit }` away. They're single-use (`instant.schema.ts` calls `defineSchema` once), so even a hypothetical future official `defineSchema` is a trivial rename + changelog line.
  2. *Keys inside idb-native objects* (the query `$` clause, tx params) — collision-proofed by **convention**: every dux-introduced key inside an idb object is `$`-prefixed (`$only`, `$at`, `$as`, `$m`). idb uses bare keys inside `$` (`where`, `order`, `limit`, `offset`, `fields`), so the `$`-namespace is ours; a future collision is a codemod, not a redesign.
- **Purpose-overlap makes name-collisions mergeable, not breaking.** If idb ever ships an API whose name collides with ours, its purpose almost certainly overlaps ours (a future `defineSchema` would… define a schema). Since our default surface already reimagines those same concepts, we'd absorb the new capability into ours and keep shipping ours. Only a name-collision with *zero* purpose overlap forces a rename — rare, and a find-and-replace when it happens.

**The rule, stated once:** dux's *top-level exports are unprefixed*; dux's *keys inside an idb-native object are `$`-prefixed*; the *vendored baseline is internal-only*. That trio replaces the `X` suffix with something principled. The full vocabulary + type-prefix policy (e.g. `Idb`-prefixed type names) is being settled separately and will live in `dux-conventions.md`.

### 10.2 "Vendor-and-mark," not "reimplement"

`ideal-vux` §1 says *"Vux reimplements the baseline rather than re-exporting it."* Re-exporting is correctly rejected (you need SSR guards + tighter types). But "reimplement" is what *produced* the 1100-line divergence and the IntelliSense regression. Replace it with **vendor-and-mark** ([§6](#6-the-vendored-baseline--additive-overlay-model)): copy upstream, fence the deltas, never creatively rewrite. Same end (we own the code, with guards and tight types); opposite discipline (mirror, don't fork).

### 10.3 The root entry is the framework-agnostic plane, stated as such

`ideal-vux` §4 frames the root as the Vue client and hangs `/admin`, `/nuxt`, `/perms` off it. dux inverts the center of gravity: the **root is the agnostic foundation** (schema + query + type utils + `id`/`tx`/`lookup`), and `/vue` is *a* client overlay hanging off it — peer to `/admin`. This matches how the demo actually imports (`shared/utils/idb.ts` pulls authoring from root and is consumed by both planes) and makes the "Vue is the first client, not the definition" vision structural rather than aspirational.

### 10.4 Layering and boundary-enforcement are first-class

`ideal-vux` treats the agnostic-vs-coupled split as a packaging detail (subpaths). dux makes it the **primary architectural axis** ([§5.1](#51-the-dependency-graph)) and *enforces it with lint rules* ([§5.2](#52-enforce-the-boundaries-mechanically)). This is the structural antibody against vux's failure mode.

Everything else in `ideal-vux` and all of `ideal-perms-spec-x` — `$only`/`$at`/`$as`/`$m`, the `singularize` options, `DefineIdbEntity`/`DefineIdbData`, the perms builder pipeline, the SSR ceiling — carries over intact. Those specs describe *what the surface does*; this note describes *where the code lives and how it stays alive*.

---

## 11. Implementation roadmap

Sequenced so each step is independently testable and nothing depends on a surface that doesn't exist yet. The order follows the dependency graph inward-out, so you're always building on something already locked.

| Phase | Deliverable | Done when |
|---|---|---|
| 0. Scaffold | `packages/dux/idb-dux` in the workspace; tshy exports; `sideEffects:false`; optional peers; lint boundary rules; empty subpath entries that typecheck | `pnpm -F @mszr/idb-dux build` produces all 5 entrypoints; boundary lint passes |
| 1. Schema layer | `defineSchema`, `i.namespace`, `singularize` (runtime + type) | schema type tests + selenita suite green |
| 2. Query layer | `q`/`defineQuery`, `shapeResult` (pure), validation types, `DefineIdbEntity`/`DefineIdbData`, `defineLookup` | the IntelliSense regression is *reproduced then fixed* under selenita; validation type tests green |
| 3. Vue baseline | vendor `@instantdb/vue` into `vue/baseline/`, mark SSR + type deltas, stamp `UPSTREAM.md`, wire `check-baseline-drift` | parity harness (§8.1) green vs official `@instantdb/vue` |
| 4. Vue overlay | `useQuery` & friends composing the baseline via `shapeResult`; `result` (refs+state); `defineDb`; components | overlay intellisense + runtime tests green; demo's client stores compile against `/vue` |
| 5. Admin | owned `init`, `query` reusing `shapeResult` | admin types + runtime tests green; demo server reads via `/admin` (no `init` injection) |
| 6. Nuxt | `defineServerIdb`, auth-sync handler wrapping `/admin` | demo server routes + auth sync green |
| 7. Perms | the `definePerms` pipeline (its own build order is `ideal-perms-spec-x` §"Proposed Build Order") | demo `instant.perms.ts` compiles to valid `InstantRules`; perms intellisense + type tests green |
| 8. Demo + lock | one Nuxt demo exercising all 5 entrypoints; trim tests to contract-only | demo builds + runs SSR; parity/intellisense/drift checks wired into CI |

Perms (7) is sequenced late only because it's independent — it can actually be built in parallel any time after schema (1), since nothing else depends on it.

---

## 12. Decisions (resolved in this thread)

The forks flagged earlier — identity and roadmap calls — are now settled:

| # | Decision | Resolution |
|---|---|---|
| D1 | API naming / the `X` suffix | **No `X` anywhere.** Enhanced behavior is the default, unsuffixed surface; baseline is internal-only. See [§10.1](#101-no-x-enhanced-as-default). |
| D2 | Expose a public baseline/compat surface? | **No.** The vendored baseline is purely the internal test/port anchor, never exported — exposing it would force a second `db` instance (methods bind to `init`). Fewer public promises = more freedom. |
| D3 | Repo home & publishing | **Develop in this fork forever** (ideal for the §6.3 drift check — official source sits right beside ours). Publish via **`git subtree`** to a separate public `mareszhar/idb-dux` repo, pushing only milestone/release commits; all dev stays in the fork. Adapts [`workflow-publish-idb-vux.md`](../workflow-publish-idb-vux.md). |
| D4 | Brand line in user docs | **Named at dux's creation.** dux READMEs/docs lead with "a DX/UX-first reimagining of InstantDB"; vux docs stay untouched as historical reference. |

One cross-cutting decision remains in flight — the **naming & vocabulary conventions** (a unified `namespace`/`entity`/`attribute`/`field`/`link`/`ref` lingo; the `Idb` type-prefix policy; native-key preservation). It's being worked in chat and will land as `dux-conventions.md`; until then, API names in this note use settled-but-provisional base words.

---

## 13. Direct answers to your questions

For the record, mapped one-to-one:

- **Would the subpath structure work / make it heavy?** Works; not heavy. Subpaths + `sideEffects:false` + optional peers = zero bytes and zero forced installs for vue-only users ([§4](#4-will-subpaths-make-it-heavy--the-bundle-size-answer)).
- **Better structure?** Root = agnostic foundation (not empty); `/vue` `/perms` `/admin` `/nuxt` as overlays; layered source with lint-enforced boundaries ([§3](#3-the-shape-the-user-proposed-refined), [§5](#5-architecture--layered-source-flexible-packaging), [§9](#9-directory-structure)).
- **Dir structure for `client/packages/dux`?** [§9](#9-directory-structure).
- **Sustainable / easy to port upstream?** Vendored-baseline + drift check ([§6](#6-the-vendored-baseline--additive-overlay-model)); the overlay is insulated from upstream churn.
- **Easy to test parity + intellisense?** Executable parity harness vs the official devDep; selenita suites as a gating rule; the empty intellisense dir was the bug ([§8](#8-testing-for-parity-and-intellisense)).
- **Keep it DRY?** Shared `shapeResult`, shared schema source-of-truth, one validation surface ([§7](#7-dry-in-practice)).
- **Publish each subtree separately?** No — one package now, mechanical split later on a forcing function ([§5.4](#54-when-to-split-into-real-packages)).
- **Rephrase the vision?** [§1](#1-vision--dux-as-a-reimagining-of-idb) — reimagining of idb, two planes, backend is the only contract, Vue/Nuxt as first clients.
- **New folder vs refactor vux?** New folder, clean-room with vux as parts bin ([§2](#2-why-a-new-folder-beats-refactoring-vux)).
- **Copy the vue SDK first, then add features?** Yes — vendor it, mark deltas, build the overlay by composition, keep it diffable forever ([§6](#6-the-vendored-baseline--additive-overlay-model)).

---

## 14. Next step

This note is the plan, not the build. The natural first action is **Phase 0** ([§11](#11-implementation-roadmap)): scaffold `client/packages/dux/idb-dux` with the five entrypoints, tshy config, `sideEffects:false`, optional peers, and the boundary lint rules — an empty-but-typechecking skeleton that makes the architecture real and gives every later phase a home. Say the word and I'll scaffold it.
