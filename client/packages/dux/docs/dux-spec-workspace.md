updated: 2026-07-01
status: spec + maintainer manual — how dux is built, tested, kept alive, and shipped

# dux spec — the workspace

The maintainer manual: workspace mechanics, the boundary rules, the testing methodology, the sustainability operations, and the publishing model. User-facing surfaces live in the other specs; everything that keeps them honest lives here.

Conventions: [dux-conventions.md](./dux-conventions.md) · Principles: [dux-vision.md §2](./dux-vision.md#2-design-principles) · Sustainability model: [dux-vision.md §5](./dux-vision.md#5-how-dux-stays-alive)

## Implementation status

| Phase | Scope | Global phase | Status |
|---|---|---|---|
| W0 | Scaffold: workspace wiring, package skeleton, boundary lint, entrypoints | 0 | ☑ complete |
| W1 | Test foundations: `test-support/`, selenita wiring, suite conventions | 1 (alongside) | ☑ complete |
| W2 | Sustainability tooling: drift check, `UPSTREAM.md` ritual, compat-suite conventions | 3 (alongside) | ☑ complete |
| W3 | Demo + CI lock | 9 | ☑ complete |
| W4 | Publishing pipeline | first release | ☑ complete |

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
    package.json                        # npm-facing manifest: exports, files, peers, deps
    tsconfig.json                       # strict dev/editor config (includes tests)
    tsconfig.build.json                 # excludes tests + test-support
    tsconfig.dev.json                   # incremental watch
    vitest.config.ts                    # globals on; @test alias; --typecheck wired
    src/
      index.ts                          # ROOT: framework-agnostic foundation
      schema/  query/  tx/  perms/      # the agnostic plane (land with phases 1–2, 8)
      webhooks/  admin/                 # the server plane (phases 5–6)
      server/                           # framework-agnostic server core + adapter port (phase 7)
      h3/  hono/  elysia/                # server adapters (phase 7)
      vue/                              # the client overlay (phases 3–4)
      test-support/                     # the @test fixture library (§4.3)
    demo/                               # one Nuxt demo exercising every entrypoint (phase 9)
```

Wiring: the orchestrator is matched by the `packages/*` workspace glob; `packages/dux/idb-dux` is listed explicitly in `client/pnpm-workspace.yaml` and the root `client/package.json` `workspaces`. The repo's `instant.code-workspace` carries a dux folder (with `files.exclude` hiding it from the root folder view).

## 2. Package mechanics

- **Build: tshy** — dual ESM/CJS; the subpath→source map lives in `tshy.exports`; each subpath is one `src/<layer>/index.ts`. `tshy.exclude` keeps collocated tests (`src/**/*.test.ts`, `src/**/*.test-d.ts`) and `src/test-support/` out of `dist`; `tsconfig.build.json` mirrors the exclusion; the `files` allowlist is the final belt-and-braces.
- **`sideEffects: false`** — set deliberately (no upstream idb package sets it); with disjoint entry graphs and ESM named exports this is the whole bundle-size story ([dux-vision.md §4.4](./dux-vision.md#44-bundle-size-and-dependency-stance)).
- **The peer rule, stated once:** needed by every dux user → `dependency` (`@instantdb/core`, `@instantdb/version`); needed only by a subpath → **optional peer** (`vue`, `h3`, `hono`, `elysia`, `@instantdb/admin`, `@instantdb/webhooks`, each with `peerDependenciesMeta.optional`). The `h3` peer belongs to the shipped `/h3` adapter and targets h3 v2; Nuxt 4 / h3 v1 apps compose `/server` locally.
- **Export integrity:** `attw --profile node16 --pack` runs as part of the orchestrator build (`sdk:check-exports`) so resolution regressions fail before a user.
- **Workspace deps:** official packages are consumed as `workspace:*`/`workspace:^` so the fork's sources are always the version under test; npm and public-subtree projections rewrite every `@instantdb/*` workspace spec to the concrete shared Instant version.
- **Command ownership:** `idb-dux/package.json` is the npm manifest, not the maintainer command surface. Build, lint, typecheck, test, pack, demo-resolution, and publish commands live in the private orchestrator (`dux/package.json`).

Phase 0 is **done when** `pnpm run sdk:build:ours` emits every entrypoint (ESM + CJS + `.d.ts`) and the boundary lint passes.

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
| `vue/` | core, `vue`, `@vue/*`, `@instantdb/vue` (baseline source + parity anchor only), `schema/`, `query/`, `tx/`, itself | any server framework, server pkgs, `perms/`, `webhooks/`, `admin/`, `server/`, the adapters |
| `server/` | core, `schema/`, `query/`, `tx/`, `admin/`, `webhooks/`, itself | `vue`, any framework (`h3`/`hono`/`elysia`), `perms/`, official admin/webhooks pkgs directly |
| `h3/`, `hono/`, `elysia/` | core, its one framework (`h3`/`hono`/`elysia`), `server/`, itself | `vue`, other adapters' frameworks, the dux `admin/`·`webhooks/` layers directly (reach them via `server/`), official pkgs directly |
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

`scripts/check-baseline-drift.mjs` reads the vendored commit from `baseline/UPSTREAM.md` and asks git **what changed in each mapped `client/packages/vue/src/*` source since that commit** (the official source sits right beside us in this fork — the reason dux develops here). The signal is git history, not a textual diff: the baseline is reformatted to dux's lint style and carries fenced deltas, so byte-equality with upstream is never expected and a content diff would be pure noise. It prints, per mapped baseline file, "official source for `IdbDuxDatabase.ts` changed since last vendor; review N commit(s)" with the commit list, and exits non-zero so CI gates on it. Re-vendoring is a deliberate step, never an accident discovered months later.

### 5.3 The fork-rebase ritual

On every rebase window (when the fork syncs with upstream `instantdb/instant`):

1. Rebase; workspace deps move in place automatically.
2. **Wrap tier**: typecheck — upstream API changes break `/admin`/`/webhooks`/`/server` wrap points *loudly*; fix at the boundary modules.
3. **Vendor tier**: run `check-baseline-drift`; review reported upstream commits; re-vendor deliberately (§5.1).
4. Run the full suite: parity, dx, compat targets.

## 6. Publishing

- **Develop in this fork forever.** The vendored-baseline model depends on the official sources sitting beside ours; the fork is the development home, not a staging area.
- **Publish via `git subtree`, always squashed** to the public `mareszhar/idb-dux` repo: the fork keeps the granular history, the public face gets one snapshot commit per release.
- The public repo is a clean source/demo face, not the development workspace. Maintainers and contributors work from this fork's `client/packages/dux`.
- npm releases build **directly from the fork**; Instant workspace deps are rewritten to concrete versions at publish time, then restored.
- Local tarball workflows (`packs/` + demo-resolution scripts) support testing the packed artifact against the demo before any release.

### 6.0 The command surface

#### Local commit guardrail

The workspace versions its Git hooks in `.githooks/`. `postinstall` installs them when Git config is writable; `pnpm run git:hooks:install` does the same explicitly. The pre-commit hook runs `pnpm run lint` for staged changes under `client/packages/dux`, so local commits hit the same lint boundary as the publish gate.

Three publishable artifacts, three parallel verbs — each command is its own named entry, so there are **no flags to remember** and no bare `release`:

| Command | Does |
|---|---|
| `prepublish:verify` | the shared gate alone: build · lint · typecheck · test · drift |
| `publish:sdk:dry-run` | verify + packaging rehearsal (`npm publish --dry-run`), nothing published |
| `publish:sdk:patch` \| `:minor` \| `:major` | the happy path — publish to npm, then demo + subtree orchestration ([§6.2](#62-the-sdk-publish-publish-sdkmjs)) |
| `publish:demo:prev` \| `publish:demo:prod` | deploy the demo ad hoc (preview / production) ([§6.4](#64-the-demo-publish-publish-demomjs)) |
| `publish:subtree:squash` | push the squashed public-repo commit ad hoc ([§6.3](#63-the-subtree-publish-publish-subtreemjs)) |

**One shared gate, with a content-keyed receipt.** Every command verifies before it acts; the `publish:sdk:*` orchestrator runs `runPrepublishGates()` a single time up front and hands `skipVerify` to the demo + subtree steps it drives in-process. Beyond that single process, a *receipt* keeps verification honest **and** cheap: a green gate stamps a digest of its exact inputs (the SDK source, configs, lockfile, and the upstream sources build/drift read), and the next gate run skips when that digest still matches — so resuming a half-finished release, or running two publish paths back to back, never re-verifies what was just verified, while any real edit re-verifies automatically. The digest deliberately **masks the two things a release legitimately churns** — the `@mszr/idb-dux` version bump and the demo's resolution-mode switch — because the gate tests neither; the receipt lives in the gitignored `.dux/` scratch dir (`scripts/lib/verify-stamp.mjs`). This is the safe form of statefulness: keyed to content, never to a timer. The scripts are vendor-neutral (`publish-sdk`, `publish-demo`, `publish-subtree`, `prepublish-verify` + a small `scripts/lib/`); the demo deployer targets whatever platforms we support (Vercel today), never a vendor-named command.

**Skipping the gate is deliberately awkward.** There is no `--skip-checks`; the only bypass is `DUX_UNSAFE_PUBLISH_SKIP_CHECKS=1`, which prints a loud warning. `DUX_FORCE_VERIFY=1` does the opposite — it ignores a matching receipt and re-runs the gate unconditionally.

### 6.1 One-time prerequisites (maintainer)

These are external to the repo and done once:

1. **Create the public repo** `github.com/mareszhar/idb-dux` (empty; no README so the first subtree push is clean).
2. **npm scope**: ensure the `@mszr` scope exists with publish rights for the account (`@mszr/idb-dux` is published with `--access public`). Note: `npm login` itself is **not** a one-time step — npm sessions expire quickly, so re-auth before each release; `publish:sdk:*` checks `npm whoami` and stops early if you're logged out.
3. **Hosting platform**: create a project for the demo and set its env vars (`NUXT_PUBLIC_INSTANT_APP_ID`, `NUXT_INSTANT_APP_ADMIN_TOKEN`); on Vercel, link it once with `pnpm dlx vercel@latest link` from the demo directory. The deployer runs that exact CLI version through `pnpm dlx`, so no global installation is required. No Git integration — the fork is never auto-deployed (see [§6.4](#64-the-demo-publish-publish-demomjs)).

### 6.2 The SDK publish (`publish-sdk.mjs`)

`pnpm run publish:sdk:<patch|minor|major>` is the happy path — publish, then orchestrate the demo and the public subtree in one run. The fork's workspace deps are rewritten at publish time and restored after:

1. `prepublish:verify` — the shared gate, **once** for the whole release.
2. Read the fork's shared Instant version (`packages/version/src/version.ts`) and verify each `@instantdb/*` package pinned from `workspace:*`/`workspace:^` exists on npm at that version; check `npm whoami`.
3. Bump `@mszr/idb-dux`'s own version (`npm version <type> --no-git-tag-version`) — this persists.
4. Snapshot `package.json`; temporarily rewrite Instant workspace deps to the concrete shared version; `sdk:build:ours`; `npm publish --access public`.
5. Restore the workspace deps (the version bump stays). **Record the release** in `.dux/release-state.json` (version, type, shared version, per-step progress) so anything after this is resumable.
6. Wait until both `npm view @mszr/idb-dux@<version>` and a cacheless, dry-run Bun install of the demo's exact `npm:@mszr/idb-dux@<version>` alias resolve (registry propagation). The npm poll uses `--prefer-online`, and the Bun probe uses `--no-cache`, so neither can accept a stale packument. Demo refresh installs are cacheless for the same reason.
7. Prepare the demo: switch it to **npm** mode pinned to `@mszr/idb-dux@<version>` (the exact version, never `latest`), refresh, build as a local smoke test ([§6.4](#64-the-demo-publish-publish-demomjs)).
8. Commit (version bump **and** demo pin) `🔖 release v<version>` and tag `v<version>`, **idempotently** (a resume that already committed/tagged is a no-op, not a failure). **Push is left to the maintainer** (so a release can be inspected first).
9. Deploy the demo to production, then squash-publish the public subtree with `🔖 release v<version>`.

On any failure **up to and including publish**, the original `package.json` is restored and no release record is written — a re-run starts clean. After publish the bump is permanent, so the release is recorded and **resuming is just re-running the same `publish:sdk:<type>`**: the orchestrator sees the recorded version already on npm, skips the bump/build/publish, and continues from the first incomplete post-publish step (each step is guarded by the record and the demo-prep/commit steps are idempotent). The gate at the top of the resumed run short-circuits on the verification receipt unless something it covers actually changed. The record is cleared once the release lands. This is why a mid-way failure no longer means hand-running `publish:demo:prod` + `publish:subtree:squash` (and re-verifying each time, and tripping over the uncommitted bump + demo switch a release necessarily creates). `publish:sdk:dry-run` runs verify + the pin/build/`npm publish --dry-run` rehearsal and restores everything — no bump, no publish, no demo, no subtree, no record.

### 6.3 The subtree publish (`publish-subtree.mjs`)

`pnpm run publish:subtree:squash` mirrors `client/packages/dux/idb-dux/` (the package **and** its one demo — the public starter) to `mareszhar/idb-dux`'s `main` as a **single squashed commit**: a temporary public tree of the prefix at HEAD, `commit-tree`'d onto the current remote tip and pushed fast-forward. The fork keeps every granular commit; the public history stays one-commit-per-release. Sandbox demos in `dux/sandbox/` stay private to the fork. The npm tarball still ships only `dist` (the `files` allowlist), so the public repo carries source + demo while the package stays lean.

The public tree is a projection, not a checkout mutation: it pins every `@instantdb/*` workspace dep in `package.json` to the concrete shared Instant version, pins the demo manifest to npm specs, then pushes that tree without changing the fork worktree or index.

References from `idb-dux` to files outside `idb-dux` follow the audience. Maintainer-only code comments may name unique spec files or use fork-relative paths. User-facing docs and demo comments use public URLs. Hybrid surfaces, chiefly `idb-dux/README.md`, include both labels: `public link` and `local fork path`.

When run ad hoc, it runs the shared gate first (subject to the verification receipt, [§6.0](#60-the-command-surface)) and opens `$GIT_EDITOR` (via `git var GIT_EDITOR`) to compose the squash message — **prefilled** with the convention-following default (`🔖 release v<version>` from the package at HEAD), so keeping it is one keystroke and editing is right there. Pass `--message "…"` to skip the editor. An *automatic* version-derived message is the happy path's job, not the ad-hoc one's: the `publish:sdk:*` orchestrator always passes the release message (and `skipVerify`), so a release never opens an editor, while a maintainer pushing by hand picks the message. (Spawning an IDE editor from a script can trip the IDE's workspace-trust prompt — that's the IDE guarding external file-opens; it's harmless to allow.) After pushing the commit, the script also pushes a matching `v<version>` tag to the public remote, so GitHub releases can reference it.

### 6.4 The demo publish (`publish-demo.mjs`)

The demo lives at `idb-dux/demo` and resolves dux through the link/tarball/npm modes — only **npm** mode is buildable on a hosting platform (no global bun links or local tarballs there). Resolution-mode commits must never trigger a deploy. So: **no Git integration; deploy on demand from the fork** with `pnpm run publish:demo:prev` (preview) / `pnpm run publish:demo:prod` (production), which

1. runs the shared gate (ad hoc),
2. switches the main demo to **npm** mode pinned to a concrete published version — `@mszr/idb-dux@<version>` (defaults to the latest published; the orchestrator passes the just-released version), never a floating `latest` — and proves that version is on npm,
3. refreshes + builds the demo as a local smoke test, then deploys to every supported platform (Vercel today; the script is vendor-neutral so a second platform is a one-entry addition).

The script is the single home for vendor names — the commands are not. Deploy *after* the npm release so the pinned version resolves. Secrets live in the platform's project settings, never in the repo.

Verification beyond a release is just `pnpm run prepublish:verify`.

## 7. The demo

One Nuxt demo (phase 9) exercising the **five interactively-demoable entrypoints** — root, `/vue`, `/perms`, `/admin`, and the server plane via `/server` (`defineServerKit` + `defineAuthSyncHandler`, locally adapted for Nuxt 4) — is the proof that the garden has no missing walls a real app would hit. It doubles as:

- the SSR floor/ceiling verification vehicle,
- the dux starter (the `create-instant-app` of this world),
- the consumer of the pack/demo-resolution scripts (link mode ↔ tarball mode ↔ npm mode).

`/webhooks` (and the server plane's `defineWebhookHandler`) is deliberately **out of the demo** — its guarantee lives in the test suites instead ([§7.2](#72-webhooks-the-documented-exception)). CI wiring lands with the demo: parity, dx, drift, and compat checks all gate.

### 7.1 The isolation invariant

The demo is a public, shared playground: anyone can sign in and experiment, at any time, alongside strangers. Its governing constraint is therefore **one visitor can never see or affect another visitor's experience.** Everything is scoped by *workspace* — a visitor sees and mutates only the workspaces they're a member of — and that scoping is enforced where it's load-bearing: in **perms** (the security boundary), with queries filtered to the active workspace as the ergonomic layer on top. A feature isn't "demoed well" until it preserves this invariant; a panel that exposes app-global state or lets a visitor reach into another's data is a bug, however well it shows off an API.

A second, equal constraint keeps the demo honest as *teaching*: each panel must read like a **realistic, idiomatic** use of the feature it shows. A demo that contorts a feature into an unnatural shape just to fit the playground teaches the contortion — a failure of principles 1 and 4, however much surface it covers. When a feature can't be both realistically *and* safely exercised by an anonymous visitor in a shared browser, the right move is to leave it out and say so plainly (the scope edge's rule that *an undocumented absence is worse than either verdict* — [dux-vision.md §3](./dux-vision.md#3-the-scope-edge) — applies to the demo too), not to force it.

### 7.2 Webhooks: the documented exception

Most Instant features scope per-entity, so they land naturally in a per-workspace demo. **Webhooks don't, and this is the worked example of the rule above.** A subscription is an *app-level* primitive (`url + namespaces + actions`, no per-tenant filter), and a webhook consumer is an app *operator*, not an end-user: you provision one subscription at deploy time and your server does operator work (notify, sync, audit) on a server-to-server channel. Trying to make that a visitor-facing playground feature fails both constraints at once:

- **It can't be safe.** Exposing `manager.create`/`delete` to visitors is globally destructive — one visitor could redirect, delete, or exhaust the single app-wide subscription quota for everyone.
- **It can't be realistic.** The only isolated alternative — provision one app-owned subscription, then fan its deliveries out per workspace and show each visitor their own — is not a thing real apps build, and it forces non-idiomatic shapes (e.g. denormalizing a foreign key onto an entity *as a plain field* purely to route deliveries, because webhook payloads carry an entity's fields but not its links). That would teach a workaround as if it were the normal way to use dux.

So webhooks earn their guarantee where it is actually airtight — the suites, not a fragile live smoke that even a demo couldn't make deterministic (it depends on Instant's live delivery to a public URL):

- dispatch parity against the official pipeline, resolution order, retry semantics, and `verify` reaching the real verifier (`webhooks/webhooks.test.ts`);
- `defineWebhookHandler` driven through each adapter's real request lifecycle with 2xx/4xx retry mapping (the shared `server/` conformance suite, run per adapter);
- type, editor-DX, and official-`WebhookHandlers` compatibility planes.

The demo README states the absence and points to the specs, turning it from a gap into a reasoned verdict. (`/webhooks` remains fully in scope as a dux subpath — [dux-vision.md §3.3](./dux-vision.md#33-why-webhooks-is-in-and-why-its-a-subpath); it is the *demo vehicle*, not the feature, that webhooks don't fit.)

## 8. Phased implementation roadmap

### Phase W0 — scaffold (global phase 0)

Done when: `pnpm run sdk:build:ours` produces all entrypoints; boundary lint passes.

- [x] workspace wiring: `pnpm-workspace.yaml`, root `workspaces`, `instant.code-workspace`, gitignore entries
- [x] orchestrator: `package.json` (lint + sdk scripts), `eslint.config.mjs` with the §3 boundary matrix, `.markdownlint.json`, `.vscode/`, README
- [x] `idb-dux/package.json`: tshy exports for all entrypoints, `sideEffects: false`, optional peers per the peer rule, collocated-test exclusion, no maintainer scripts
- [x] `tsconfig.json` / `tsconfig.build.json` / `tsconfig.dev.json` (strict; `@test` paths; vitest globals types)
- [x] `vitest.config.ts`: globals, `@test` alias, `--typecheck` wiring
- [x] six placeholder entrypoints that typecheck
- [x] docs: vision, conventions, and the seven specs (this set)
- [x] verification: build emits every entrypoint (ESM+CJS+d.ts); `attw` clean; lint green; boundary rules probe-verified to fire

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

- [x] the Nuxt demo exercising the five interactively-demoable entrypoints (root, `/vue`, `/perms`, `/admin`, server plane via local `/server` adapter utilities); `/webhooks` excluded by design, guaranteed by its suites ([§7.2](#72-webhooks-the-documented-exception))
- [x] pack + demo-resolution scripts (link/tarball/npm modes)
- [x] CI: workspace lint, SDK build, full suite (runtime/types/dx); parity + compat targets ride the suite; drift is its own gate (`.github/workflows/dux.yml`)
- [x] test economy held: the demo carries no unit tests; demo typecheck/build stays local/release-only because demo manifests can be in link/tarball/npm modes

### Phase W4 — publishing (first release)

Tooling is in place ([§6](#6-publishing)) and the **first release shipped (v1.0.0)**; the phase is closed.

- [x] shared gate (`scripts/prepublish-verify.mjs` + `scripts/lib/run-prepublish-gates.mjs`): build · lint · typecheck · test · drift; content-keyed verification receipt skips a re-run when inputs are unchanged (`scripts/lib/verify-stamp.mjs`); `DUX_UNSAFE_PUBLISH_SKIP_CHECKS=1` is the only (awkward) bypass, `DUX_FORCE_VERIFY=1` forces a re-run
- [x] SDK publish (`scripts/publish-sdk.mjs`): verify-once orchestration — version bump (gitmoji `🔖 release v<version>` commit + tag), Instant workspace-dep rewrite, build, `npm publish --access public`, snapshot/restore, `--prefer-online` npm-propagation wait plus cacheless Bun npm-alias install probe, cacheless demo refresh, demo prepare + deploy, subtree squash; `publish:sdk:dry-run` rehearsal
- [x] **resumable orchestration** (`scripts/lib/release-state.mjs`): once published, a failed post-publish step is recovered by re-running the same `publish:sdk:<type>` — it resumes from the first incomplete step (idempotent commit/tag), never re-bumps or re-verifies unchanged inputs
- [x] squashed `git subtree` publish to `mareszhar/idb-dux` (`scripts/publish-subtree.mjs`); ad-hoc opens `$GIT_EDITOR` prefilled with the convention default (`🔖 release v<version>`), `--message` skips it, the orchestrator passes the message so a release never opens an editor
- [x] vendor-neutral demo deploy from the fork, npm-mode + exact-version-pin guarded (`scripts/publish-demo.mjs`)
- [x] uniform command surface ([§6.0](#60-the-command-surface)): no bare `release`, no flags to remember; each variant its own named script
- [x] **maintainer prerequisites** ([§6.1](#61-one-time-prerequisites-maintainer)): create `mareszhar/idb-dux`, npm `@mszr` publish access, hosting project + env + link
- [x] **the first release** — `pnpm run publish:sdk:major` shipped v1.0.0; resumable + receipt-aware flow refined from that run's lessons
