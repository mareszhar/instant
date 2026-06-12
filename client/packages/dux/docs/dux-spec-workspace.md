updated: 2026-06-11
status: spec + maintainer manual — how dux is built, tested, kept alive, and shipped

# dux spec — the workspace

The maintainer manual: workspace mechanics, the boundary rules, the testing methodology, the sustainability operations, and the publishing model. User-facing surfaces live in the other specs; everything that keeps them honest lives here.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Sustainability model: [dux-vision.md §5](./dux-vision.md#5-how-dux-stays-alive)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| W0 | Scaffold: workspace wiring, package skeleton, boundary lint, six entrypoints | 0 | ☑ complete |
| W1 | Test foundations: `test-support/`, selenita wiring, suite conventions | 1 (alongside) | ☑ complete |
| W2 | Sustainability tooling: drift check, `UPSTREAM.md` ritual, compat-suite conventions | 3 (alongside) | ☑ complete |
| W3 | Demo + CI lock | 9 | ☐ not started |
| W4 | Publishing pipeline | first release | ☐ not started |

Details: [§8 Phased implementation roadmap](#8-phased-implementation-roadmap).

- [1. Workspace layout](#1-workspace-layout)
- [2. Package mechanics](#2-package-mechanics)
- [3. Boundary rules](#3-boundary-rules)
- [4. Testing methodology](#4-testing-methodology)
- [5. Sustainability operations](#5-sustainability-operations)
- [6. Publishing](#6-publishing)
- [7. The demo](#7-the-demo)
- [8. Phased implementation roadmap](#8-phased-implementation-roadmap)

---

## 1. Workspace layout

```
client/packages/dux/                    # orchestrator workspace (private)
  package.json                          # idb-dux-workspace: lint + sdk:* scripts
  eslint.config.mjs                     # incl. the boundary rules (§3)
  .markdownlint.json  .vscode/
  README.md                             # front door → docs/dux-vision.md
  docs/                                 # the vision + conventions + specs (this set)
  scripts/                              # maintainer automation (lands with its phases)
  packs/                                # local tarballs for demo resolution (gitignored)

  idb-dux/                              # the published package — @mszr/idb-dux
    package.json                        # tshy exports, sideEffects:false, optional peers
    tsconfig.json                       # strict dev/editor config (includes tests)
    tsconfig.build.json                 # excludes tests + test-support
    tsconfig.dev.json                   # incremental watch
    vitest.config.ts                    # globals on; @test alias; --typecheck wired
    src/
      index.ts                          # ROOT: framework-agnostic foundation
      schema/  query/  tx/  perms/      # the agnostic plane (land with phases 1–2, 8)
      webhooks/  admin/                 # the server plane (phases 5–6)
      vue/  nuxt/                       # the framework overlays (phases 3–4, 7)
      test-support/                     # the @test fixture library (§4.3)
    demo/                               # one Nuxt demo exercising every entrypoint (phase 9)
```

Wiring: the orchestrator is matched by the `packages/*` workspace glob; `packages/dux/idb-dux` is listed explicitly in `client/pnpm-workspace.yaml` and the root `client/package.json` `workspaces`. The repo's `instant.code-workspace` carries a dux folder (with `files.exclude` hiding it from the root folder view).

## 2. Package mechanics

- **Build: tshy** — dual ESM/CJS; the subpath→source map lives in `tshy.exports`; each subpath is one `src/<layer>/index.ts`. `tshy.exclude` keeps collocated tests (`src/**/*.test.ts`, `src/**/*.test-d.ts`) and `src/test-support/` out of `dist`; `tsconfig.build.json` mirrors the exclusion; the `files` allowlist is the final belt-and-braces.
- **`sideEffects: false`** — set deliberately (no upstream idb package sets it); with disjoint entry graphs and ESM named exports this is the whole bundle-size story ([dux-vision.md §4.4](./dux-vision.md#44-bundle-size-and-dependency-stance)).
- **The peer rule, stated once:** needed by every dux user → `dependency` (`@instantdb/core`, `@instantdb/version`); needed only by a subpath → **optional peer** (`vue`, `h3`, `@instantdb/admin`, `@instantdb/webhooks`, each with `peerDependenciesMeta.optional`).
- **Export integrity:** `attw --profile node16 --pack` runs as part of `build` (`check-exports`) so resolution regressions fail the build, not a user.
- **Workspace deps:** official packages are consumed as `workspace:*` so the fork's sources are always the version under test; publishing rewrites them to concrete versions.

Phase 0 is **done when** `pnpm -F @mszr/idb-dux build` emits all six entrypoints (ESM + CJS + `.d.ts`) and the boundary lint passes.

## 3. Boundary rules

Plane separation is enforced by `no-restricted-imports` patterns in the workspace `eslint.config.mjs` — one config block per layer, banning by import specifier so packages and relative paths are covered alike. **The rules apply to test files too**: a query-layer test may import `@test` and `query/**`, never `vue`.

`@instantdb/core` and `@instantdb/version` are the two foundational `dependency`-tier packages (the peer rule, [§2](#2-package-mechanics)); they are allowed in *every* layer and are elided from the per-layer "may import" column below. The compat-target suites (`*.compat.test.ts`/`-d.ts`) are exempt from the official-package bans — their whole job is feeding dux output into the official tools dux doesn't wrap.

| Layer | May import | Never |
|---|---|---|
| `schema/` | (core/version only), itself | everything else |
| `query/` | core, `schema/`, itself | frameworks, server pkgs, other layers |
| `tx/` | core, `schema/`, itself | frameworks, server pkgs, other layers |
| `perms/` | core, `schema/`, itself | frameworks, server pkgs, other layers |
| `webhooks/` | core, `@instantdb/webhooks`, `schema/`, itself | `vue`, `h3`, `@instantdb/admin`, other layers |
| `admin/` | core, `@instantdb/admin`, `schema/`, `query/`, `tx/`, `webhooks/`, itself | `vue`, `h3`, `perms/`, overlays |
| `vue/` | core, `vue`, `@vue/*`, `@instantdb/vue` (baseline source + parity anchor only), `schema/`, `query/`, `tx/`, itself | `h3`, server pkgs, `perms/`, `webhooks/`, `admin/`, `nuxt/` |
| `nuxt/` | core, `h3`, `schema/`, `query/`, `tx/`, `admin/`, `webhooks/`, itself | `vue` (package and layer), `perms/`, official admin/webhooks pkgs directly |
| `test-support/` | the agnostic plane (core, `schema/`, `query/`, `tx/`, `perms/`) | frameworks, server pkgs, overlay layers |

This is the single highest-leverage guardrail in the design: "a framework concept leaked into the agnostic plane" is a build error. Loosen a cell only by editing the matrix *and* the config together, with the reason recorded in the touching spec.

## 4. Testing methodology

### 4.1 One runner, three planes

| Plane | File suffix | Asserts | Tool |
|---|---|---|---|
| Runtime | `*.test.ts` | reactive flows, SSR-inert state, auth-sync cookies, server-db modes | Vitest |
| Type shapes | `*.test-d.ts` | return/data shapes match the spec | Vitest `--typecheck` + `expectTypeOf` |
| Editor DX | `*.dx.test.ts` | completions appear at the intended cursor; diagnostics carry the *intended message* on the *intended field* | selenita on Vitest |

One `vitest run --typecheck` locks all three planes — no bespoke `tsc --noEmit` harness, no separate tooling per layer. Vitest globals are on; the `@test` alias resolves `test-support/`.

**selenita** ([github.com/mareszhar/selenita](https://github.com/mareszhar/selenita)) runs on Vitest and asserts both *completions* (`project.query`) and *diagnostics with their messages* (`project.check`); `queryGroup` replays one snippet against multiple entry points. The `.dx.test.ts` suffix names the plane: editor DX — completions *and* diagnostics. The handle is wired once in `test-support/` (`duxProject()`), with the package's own subpaths plus an `@baseline` alias mapped so snippets read like userland and the internal baseline stays reachable for parity. (One maintainer footnote: selenita's matcher addon augments `vitest`'s `Assertion`, but Vitest 4 widened the type parameter that interface declares; a one-file `.d.ts` shim in `test-support/` re-declares the matchers on Vitest 4's `Matchers` extension point so the `.dx.test.ts` planes stay typed — drop it once selenita ships a Vitest-4 augmentation.)

### 4.2 The gating discipline

> **No enhanced API is "done" until it ships with a `.dx.test.ts` suite that locks its completions and diagnostics.**

The editor experience is a first-class contract (principle 3); without a test plane on it, a completions regression ships silently. selenita's `check` also replaces the `@ts-expect-error` pattern, and is strictly better: a reusable snippet with an embedded cursor asserts the exact diagnostic ("Operator $ilike is only available for indexed string fields") at the exact position — once — and `queryGroup` replays it across `useQuery`, `queryOnce`, `useInfiniteQuery`, and `adminDb.query`. One bad-input fixture, every entry point locked.

### 4.3 Fixtures — one canonical app

All three planes draw from a single `src/test-support/` (aliased `@test`):

- **The canonical app**: one fixed schema, seed data, scripted reactor scenarios (auth transitions, query emissions, presence events). Every runtime and parity test replays these; change the canonical schema once and every plane updates.
- **The snippet library**: selenita snippets with embedded cursors — the canonical good queries, the canonical *bad* queries (one per validation rule), schema/tx/perms authoring fragments.
- **Typed expectations**: shared `expectTypeOf` helpers for the data shapes the specs promise.

The only test code that is irreducibly per-API is the one-line wrapper feeding a shared scenario or snippet into a specific entry point — exactly the duplication you *want*, because it's the thing under test.

### 4.4 Collocation policy

Tests live **next to the code they exercise** — `query/defineQuery.dx.test.ts` beside `query/defineQuery.ts`, parity suites under `vue/baseline/` — never in a top-level mirror tree. An API ships with its three planes in the same folder and the same PR. The only centralized test code is `test-support/` itself.

### 4.5 The parity harness

"Additive, never divergent" (principle 7) as an executable check: the canonical scenarios run against **both** the official `@instantdb/vue` devDependency **and** the internal baseline, asserting identical reactive output (same emitted values, same loading/error transitions). selenita `queryGroup` covers the editor-DX side — the baseline completes exactly what official completes. When upstream changes behavior, the parity suite fails and names what to re-vendor.

### 4.6 Compatibility-target tests

The scope edge's "compatibility target" verdicts ([dux-vision.md §3](./dux-vision.md#3-the-scope-edge)) are promises, and promises are tests — collocated with the surface whose *output* they guard:

- `defineSchema(...)` output is an actual `InstantSchemaDef` and satisfies what CLI push and `platformApi.schemaPush` consume (`schema/` suite)
- `definePerms(...).compile()` is assignable to `InstantRules` and accepted by `pushPerms` (`perms/` suite)
- a dux `adminDb` satisfies what official `@instantdb/resumable-stream` consumes (`admin/` suite)
- a `defineWebhookHandlers(...)` map satisfies the official `WebhookHandlers` shape (`webhooks/` suite)

Assert type-level always, runtime-against-fixtures where cheap. When upstream moves a contract, the suite fails before a user does.

### 4.7 Test economy

Fewer tests, higher confidence: assert contracts, never implementation details. A suite that breaks on a refactor that preserves behavior is a defect in the suite.

## 5. Sustainability operations

The model is [dux-vision.md §5](./dux-vision.md#5-how-dux-stays-alive); these are the operations.

### 5.1 Vendoring procedure (`/vue` baseline)

1. Copy the official source file from `client/packages/vue/src/` into `idb-dux/src/vue/baseline/`.
2. Apply only the permitted deltas — SSR guards, type tightening, overlay wiring — each fenced:

   ```TS
   // DUX-DELTA(ssr): <one-line reason>
   ...changed lines...
   // END DUX-DELTA
   ```

3. Stamp `baseline/UPSTREAM.md` with the upstream commit hash and date.
4. Run the parity harness; it must be green before the vendor lands.

### 5.2 The drift check

`scripts/check-baseline-drift.mjs` reads the vendored commit from `baseline/UPSTREAM.md` and asks git **what changed in each mapped `client/packages/vue/src/*` source since that commit** (the official source sits right beside us in this fork — the reason dux develops here). The signal is git history, not a textual diff: the baseline is reformatted to dux's lint style and carries fenced deltas, so byte-equality with upstream is never expected and a content diff would be pure noise. It prints, per mapped baseline file, "official source for `InstantDuxDatabase.ts` changed since last vendor; review N commit(s)" with the commit list, and exits non-zero so CI gates on it. Re-vendoring is a deliberate step, never an accident discovered months later.

### 5.3 The fork-rebase ritual

On every rebase window (when the fork syncs with upstream `instantdb/instant`):

1. Rebase; workspace deps move in place automatically.
2. **Wrap tier**: typecheck — upstream API changes break `/admin`/`/webhooks`/`/nuxt` wrap points *loudly*; fix at the boundary modules.
3. **Vendor tier**: run `check-baseline-drift`; review reported upstream commits; re-vendor deliberately (§5.1).
4. Run the full suite: parity, dx, compat targets.

## 6. Publishing

- **Develop in this fork forever.** The vendored-baseline model depends on the official sources sitting beside ours; the fork is the development home, not a staging area.
- **Publish via `git subtree`** to the public `mareszhar/idb-dux` repo, pushing only milestone/release commits — day-to-day history stays in the fork.
- npm releases build from the subtree repo (or directly from the fork via the pack scripts); `workspace:*` deps are rewritten to concrete versions at pack time.
- Local tarball workflows (`packs/` + demo-resolution scripts) support testing the packed artifact against the demo before any release.

The pipeline lands as phase W4; until then `pnpm run sdk:build:all` + `pnpm run sdk:test` from the orchestrator is the whole verification loop.

## 7. The demo

One Nuxt demo (phase 9) exercising **all six entrypoints** — including a webhook route and a manager call — is the proof that the garden has no missing walls. It doubles as:

- the SSR floor/ceiling verification vehicle,
- the dux starter (the `create-instant-app` of this world),
- the consumer of the pack/demo-resolution scripts (link mode ↔ tarball mode ↔ npm mode).

CI wiring lands with it: parity, dx, drift, and compat checks all gate.

## 8. Phased implementation roadmap

### Phase W0 — scaffold (global phase 0)

Done when: `pnpm -F @mszr/idb-dux build` produces all six entrypoints; boundary lint passes.

- [x] workspace wiring: `pnpm-workspace.yaml`, root `workspaces`, `instant.code-workspace`, gitignore entries
- [x] orchestrator: `package.json` (lint + sdk scripts), `eslint.config.mjs` with the §3 boundary matrix, `.markdownlint.json`, `.vscode/`, README
- [x] `idb-dux/package.json`: tshy exports for six entrypoints, `sideEffects: false`, optional peers per the peer rule, collocated-test exclusion
- [x] `tsconfig.json` / `tsconfig.build.json` / `tsconfig.dev.json` (strict; `@test` paths; vitest globals types)
- [x] `vitest.config.ts`: globals, `@test` alias, `--typecheck` wiring
- [x] six placeholder entrypoints that typecheck
- [x] docs: vision, conventions, and the seven specs (this set)
- [x] verification: build emits six entrypoints (ESM+CJS+d.ts); `attw` clean; lint green; boundary rules probe-verified to fire

### Phase W1 — test foundations (alongside global phase 1)

- [x] add selenita as a devDependency; first `.dx.test.ts` proves the harness
- [x] `test-support/`: canonical app schema + seed data + a mock-core factory for overlay tests
- [x] snippet library conventions (embedded cursors; one bad query per validation rule); the `registration` block + the `duxProject()` selenita handle live in `test-support/`
- [x] shared `expectTypeOf` helpers (e.g. the singularize-equivalence word list, shared good/bad fixtures)
- [x] drop `passWithNoTests` from vitest config

### Phase W2 — sustainability tooling (alongside global phase 3)

- [x] `scripts/check-baseline-drift.mjs` + `UPSTREAM.md` format
- [x] document the re-vendor procedure in the script's output
- [x] compat-target suite scaffolding (assignability assertion helpers)

### Phase W3 — demo + CI lock (global phase 9)

- [ ] the Nuxt demo exercising all six entrypoints (webhook route + manager call included)
- [ ] pack + demo-resolution scripts (link/tarball/npm modes)
- [ ] CI: build, lint, full suite (runtime/types/dx), parity, drift, compat targets
- [ ] trim suites to contract-only assertions (test economy pass)

### Phase W4 — publishing (first release)

- [ ] `git subtree` publish workflow to `mareszhar/idb-dux`
- [ ] publish script (version bump, `workspace:*` rewrite, pack, npm publish)
- [ ] release checklist: parity + drift + compat green on the exact release commit
