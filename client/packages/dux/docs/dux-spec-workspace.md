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
| W3 | Demo + CI lock | 9 | ☑ complete |
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

**selenita** ([github.com/mareszhar/selenita](https://github.com/mareszhar/selenita)) runs on Vitest and asserts both *completions* (`project.query`) and *diagnostics with their messages* (`project.check`); `queryGroup` replays one snippet against multiple entry points. The `.dx.test.ts` suffix names the plane: editor DX — completions *and* diagnostics. The handle is wired once in `test-support/` (`duxProject()`), with the package's own subpaths plus an `@baseline` alias mapped so snippets read like userland and the internal baseline stays reachable for parity. The matcher addon is imported once by the test-support handle, and `@mszr/selenita/vitest` is listed in `compilerOptions.types` so the Vitest matcher augmentations are available without a local `.d.ts` shim.

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
- **Publish via `git subtree`, always squashed** to the public `mareszhar/idb-dux` repo: the fork keeps the granular history, the public face gets one snapshot commit per release.
- npm releases build **directly from the fork**; `workspace:*` Instant deps are rewritten to concrete versions at publish time, then restored.
- Local tarball workflows (`packs/` + demo-resolution scripts) support testing the packed artifact against the demo before any release.

### 6.0 The command surface

Three publishable artifacts, three parallel verbs — each command is its own named entry, so there are **no flags to remember** and no bare `release`:

| Command | Does |
|---|---|
| `prepublish:verify` | the shared gate alone: build · lint · typecheck · test · drift |
| `publish:sdk:dry-run` | verify + packaging rehearsal (`npm publish --dry-run`), nothing published |
| `publish:sdk:patch` \| `:minor` \| `:major` | the happy path — publish to npm, then demo + subtree orchestration ([§6.2](#62-the-sdk-publish-publish-sdkmjs)) |
| `publish:demo:prev` \| `publish:demo:prod` | deploy the demo ad hoc (preview / production) ([§6.4](#64-the-demo-publish-publish-demomjs)) |
| `publish:subtree:squash` | push the squashed public-repo commit ad hoc ([§6.3](#63-the-subtree-publish-publish-subtreemjs)) |

**One shared gate, run once.** Every command verifies before it acts; the `publish:sdk:*` orchestrator runs `runPrepublishGates()` a single time up front and hands `skipVerify` to the demo + subtree steps it drives in-process, so a release is safe *and* fast — never re-running gates it just ran. The scripts are vendor-neutral (`publish-sdk`, `publish-demo`, `publish-subtree`, `prepublish-verify` + a small `scripts/lib/`); the demo deployer targets whatever platforms we support (Vercel today), never a vendor-named command.

**Skipping the gate is deliberately awkward.** There is no `--skip-checks`; the only bypass is `DUX_UNSAFE_PUBLISH_SKIP_CHECKS=1`, which prints a loud warning.

### 6.1 One-time prerequisites (maintainer)

These are external to the repo and done once:

1. **Create the public repo** `github.com/mareszhar/idb-dux` (empty; no README so the first subtree push is clean).
2. **npm scope**: ensure the `@mszr` scope exists with publish rights for the account (`@mszr/idb-dux` is published with `--access public`). Note: `npm login` itself is **not** a one-time step — npm sessions expire quickly, so re-auth before each release; `publish:sdk:*` checks `npm whoami` and stops early if you're logged out.
3. **Hosting platform**: create a project for the demo and set its env vars (`NUXT_PUBLIC_INSTANT_APP_ID`, `NUXT_INSTANT_APP_ADMIN_TOKEN`); on Vercel, link it once with `vercel link` from the demo directory. No Git integration — the fork is never auto-deployed (see [§6.4](#64-the-demo-publish-publish-demomjs)).

### 6.2 The SDK publish (`publish-sdk.mjs`)

`pnpm run publish:sdk:<patch|minor|major>` is the happy path — publish, then orchestrate the demo and the public subtree in one run. The fork's `workspace:*` twist is rewritten at publish time and restored after:

1. `prepublish:verify` — the shared gate, **once** for the whole release.
2. Read the fork's shared Instant version (`packages/version/src/version.ts`) and verify each pinned Instant dep (`core`, `version`, `admin`, `webhooks`) exists on npm at that version; check `npm whoami`.
3. Bump `@mszr/idb-dux`'s own version (`npm version <type> --no-git-tag-version`) — this persists.
4. Snapshot `package.json`; temporarily rewrite the four `workspace:*` Instant deps to the concrete shared version; `build`; `npm publish --access public`.
5. Restore the `workspace:*` deps (the version bump stays).
6. Wait until `npm view @mszr/idb-dux@<version>` resolves (registry propagation).
7. Prepare the demo: switch it to **npm** mode pinned to `@mszr/idb-dux@<version>` (the exact version, never `latest`), refresh, build as a local smoke test ([§6.4](#64-the-demo-publish-publish-demomjs)).
8. Commit (version bump **and** demo pin) `🔖 release v<version>` and tag `v<version>`. **Push is left to the maintainer** (so a release can be inspected first).
9. Deploy the demo to production, then squash-publish the public subtree with `🔖 release v<version>`.

On any failure **up to and including publish**, the original `package.json` is restored. After publish the bump is permanent; a later step failing keeps the bump and prints how to resume (`publish:demo:prod`, `publish:subtree:squash`). `publish:sdk:dry-run` runs verify + the pin/build/`npm publish --dry-run` rehearsal and restores everything — no bump, no publish, no demo, no subtree.

### 6.3 The subtree publish (`publish-subtree.mjs`)

`pnpm run publish:subtree:squash` mirrors `client/packages/dux/idb-dux/` (the package **and** its one demo — the public starter) to `mareszhar/idb-dux`'s `main` as a **single squashed commit**: the tree of the prefix at HEAD, `commit-tree`'d onto the current remote tip and pushed fast-forward. The fork keeps every granular commit; the public history stays one-commit-per-release. Sandbox demos in `dux/sandbox/` stay private to the fork. The npm tarball still ships only `dist` (the `files` allowlist), so the public repo carries source + demo while the package stays lean.

Ad hoc it runs the shared gate first and opens `$GIT_EDITOR` (via `git var GIT_EDITOR`) on a prefilled template for the squash message; pass a message to skip the editor — `pnpm run publish:subtree:squash -- --message "🔖 release v0.1.0"`. The `publish:sdk:*` orchestrator passes the release message and `skipVerify`.

### 6.4 The demo publish (`publish-demo.mjs`)

The demo lives at `idb-dux/demo` and resolves dux through the link/tarball/npm modes — only **npm** mode is buildable on a hosting platform (no global bun links or local tarballs there). Resolution-mode commits must never trigger a deploy. So: **no Git integration; deploy on demand from the fork** with `pnpm run publish:demo:prev` (preview) / `pnpm run publish:demo:prod` (production), which

1. runs the shared gate (ad hoc),
2. switches the main demo to **npm** mode pinned to a concrete published version — `@mszr/idb-dux@<version>` (defaults to the latest published; the orchestrator passes the just-released version), never a floating `latest` — and proves that version is on npm,
3. refreshes + builds the demo as a local smoke test, then deploys to every supported platform (Vercel today; the script is vendor-neutral so a second platform is a one-entry addition).

The script is the single home for vendor names — the commands are not. Deploy *after* the npm release so the pinned version resolves. Secrets live in the platform's project settings, never in the repo.

Verification beyond a release is just `pnpm run prepublish:verify`.

## 7. The demo

One Nuxt demo (phase 9) exercising **all six entrypoints** — including a webhook route and a manager call — is the proof that the garden has no missing walls. It doubles as:

- the SSR floor/ceiling verification vehicle,
- the dux starter (the `create-instant-app` of this world),
- the consumer of the pack/demo-resolution scripts (link mode ↔ tarball mode ↔ npm mode).

CI wiring lands with it: parity, dx, drift, and compat checks all gate.

### 7.1 The isolation invariant

The demo is a public, shared playground: anyone can sign in and experiment, at any time, alongside strangers. Its governing constraint is therefore **one visitor can never see or affect another visitor's experience.** Everything is scoped by *workspace* — a visitor sees and mutates only the workspaces they're a member of — and that scoping is enforced where it's load-bearing: in **perms** (the security boundary), with queries filtered to the active workspace as the ergonomic layer on top. A feature isn't "demoed well" until it preserves this invariant; a panel that exposes app-global state or lets a visitor reach into another's data is a bug, however well it shows off an API.

Most Instant features scope cleanly because their primitives are per-entity. **Webhooks are the instructive exception:** a subscription is an *app-level* primitive (`url + namespaces + actions`, no per-tenant filter), so exposing `manager.create`/`delete` as a visitor action is inherently global and breaks the invariant. The demo's resolution is the pattern to reach for whenever a primitive is coarser than a workspace:

- **provision the app-level resource once**, out of band — a maintainer setup script (`scripts/ensure-webhook.ts`) creates the single app-owned subscription pointing at the deployed receiver; the manager surface still gets demonstrated (`list`/`create`), just not as a visitor mutation,
- **fan its effects out per workspace at the edge** — the receiver attributes each delivery to a workspace and persists it (a `webhookEvents` journal linked to the workspace), so it re-enters the ordinary, perms-scoped data plane,
- **let the visitor surface read that scoped projection**, never the global resource — the panel shows the subscription read-only and a workspace-scoped delivery feed.

Where a primitive carries no link in its payload (webhook deliveries carry an entity's fields but not its links), denormalize the scope key onto the entity (`tasks.workspaceId`) and **pin it in perms** to the real linked owner, so the fanned-out attribution can't be forged to cross workspaces. The invariant survives even an adversarial visitor, because it rests on perms, not on the client.

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

- [x] the Nuxt demo exercising all six entrypoints (webhook route + manager call included)
- [x] pack + demo-resolution scripts (link/tarball/npm modes)
- [x] CI: build, lint, full suite (runtime/types/dx); parity + compat targets ride the suite; drift is its own gate (`.github/workflows/dux.yml`)
- [x] test economy held: the demo carries no unit tests (exercised by typecheck + build in CI), so phase 9 added no implementation-coupled assertions

### Phase W4 — publishing (first release)

Tooling is in place ([§6](#6-publishing)); the phase closes on the first actual release once the one-time prerequisites ([§6.1](#61-one-time-prerequisites-maintainer)) are done.

- [x] shared gate (`scripts/prepublish-verify.mjs` + `scripts/lib/run-prepublish-gates.mjs`): build · lint · typecheck · test · drift; `DUX_UNSAFE_PUBLISH_SKIP_CHECKS=1` is the only (awkward) bypass
- [x] SDK publish (`scripts/publish-sdk.mjs`): verify-once orchestration — version bump (gitmoji `🔖 release v<version>` commit + tag), `workspace:*` rewrite, build, `npm publish --access public`, snapshot/restore, npm-propagation wait, demo prepare + deploy, subtree squash; `publish:sdk:dry-run` rehearsal
- [x] squashed `git subtree` publish to `mareszhar/idb-dux` with `$GIT_EDITOR` / `--message` (`scripts/publish-subtree.mjs`)
- [x] vendor-neutral demo deploy from the fork, npm-mode + exact-version-pin guarded (`scripts/publish-demo.mjs`)
- [x] uniform command surface ([§6.0](#60-the-command-surface)): no bare `release`, no flags to remember; each variant its own named script
- [x] **maintainer prerequisites** ([§6.1](#61-one-time-prerequisites-maintainer)): create `mareszhar/idb-dux`, npm `@mszr` publish access, hosting project + env + link
- [ ] **the first release** — `pnpm run publish:sdk:minor` (or `major`), then `git push && git push --tags`
