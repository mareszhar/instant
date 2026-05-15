updated: 2026-05-04

# Nuxt SSR Entrypoint Call Investigation

Last updated: 2026-05-04 Status: reopened, with one verified local linked-dependency mitigation.

## Summary

In Nuxt dev with `ssr: true`, calls to values exported from the `@mszr/idb-vux` entrypoint can still crash when the package is consumed as a local linked dependency. Typical errors have included:

- `(0, __vite_ssr_import_X__.defineQuery) is not a function`
- `(0, __vite_ssr_import_X__.id) is not a function`
- `Cannot access '__vite_ssr_import_X__' before initialization`

This is not specific to `defineQuery` or `id`. Those are just the easiest exports to probe. The current evidence points to an interaction between top-level calls, Nuxt's `shared/` auto-import scanning, the app/schema module graph, and local linked package resolution.

The failing value also does not have to be re-exported from `@instantdb/core`. The bug was first discovered with `defineQuery`, which is defined inside the Vux package. In that case the other side of the graph still involved `i` from `instant.schema.ts`, and `i` is re-exported from core. So "wrapper re-exports a core value" is a useful repro shape, not a proven requirement.

As of 2026-05-04, this has been personally reproduced with a real page request against Nuxt dev, not just `nuxt build`:

```sh
bun run verify:dev
curl -sS -D - http://localhost:3000/
```

`verify:dev` runs:

```sh
CHOKIDAR_USEPOLLING=1 bunx nuxi dev --no-fork
```

That command still logs watcher `EMFILE` noise in this environment, but it keeps the dev server reachable long enough to verify the SSR response.

Local watcher note: `launchctl limit maxfiles` reports a soft maxfiles limit of `256` in the Codex-launched environment even though `ulimit -n` reports a much higher shell limit. That explains why normal `nuxt dev` can hit watcher `EMFILE` before the page is requested. The verification command above works around this enough for SSR page-load checks.

## Current Minimal Shape

The smallest active repro is `client/packages/vux/sandbox/demo-ssr-bug`:

1. `shared/utils/idb.ts` imports `id` from `@mszr/idb-vux`, re-exports it, and performs a top-level call: `export const MAGIC_ID = id()`.
2. `instant.schema.ts` imports `i` from `@mszr/idb-vux` and creates a schema at module scope.
3. `app/app.vue` imports `init` from `@mszr/idb-vux`, imports the schema, and calls `init({ appId, schema })` during `<script setup>` evaluation.
4. The demo consumes `@mszr/idb-vux` through a local Bun link.

Notably, `app.vue` does not need to call `id()` directly for the minimal repro to fail. The top-level `id()` in `shared/utils/idb.ts` is enough once the `init({ schema })` path is present.

## Nuxt `shared/` Finding

Nuxt auto-scans `shared/utils/idb.ts` and adds its value exports to the generated imports surface:

- `.nuxt/imports.d.ts` re-exports `MAGIC_ID` and `id` from `../shared/utils/idb`.
- `.nuxt/types/shared-imports.d.ts` records the same shared globals.

After `nuxt build`, the generated server bundle also preserves `shared/utils/idb.ts` as a side-effect import even when `app.vue` does not reference `id` directly. Production build and preview currently pass, but this confirms that the `shared` file can enter the server graph just by being auto-scanned, not only because app code explicitly imports it.

This explains why the minimal repro can fail without an app-level `id()` call: the `shared` module is still part of Nuxt's import graph and its top-level `MAGIC_ID = id()` call can still run.

## Timeline

### Phase A: Initial Investigation

1. Define `defineQuery` directly in `src/index.ts`. Result: did not crash.

2. Keep `defineQuery` in `src/defineQuery.ts`, re-export from `src/index.ts`. Result: crashed in Nuxt SSR dev.

3. Change import order in `src/index.ts`. Result: still crashed.

4. Force SSR externalization (`vite.ssr.external`) for `@mszr/idb-vux`. Result: still crashed.

5. Add a post-build helper to flatten selected entrypoint exports into `dist/esm/index.js`. Result: dev SSR stopped crashing for that tested shape.

6. Add a top-level `id()` probe. Result: same failure class (`id is not a function`).

7. Install packed tarballs for local Instant packages. Result: probes passed.

At this stage, linked dependencies looked suspicious, but the evidence was not yet strong enough to call them the root cause.

### Phase B: Control Matrix on 2026-05-02

Fresh minimal Nuxt demos were created for Bun and pnpm `file:`, `link:`, and `workspace:*` dependency modes. Each used simple top-level probes such as `defineQuery()` and `id()` in a shared utility and rendered their types in the app.

Result: all passed once pnpm demos were isolated from the parent monorepo with their own local workspace config.

This invalidated the broad claim that every linked dependency shape is broken. However, those probes were too simple: they did not include an `init({ schema })` call, and they did not include a schema module importing `i` and constructing a schema at module scope.

### Phase C: Reopened on 2026-05-04

After reverting the main demo from tarball installs back to linked dependencies for faster iteration, the SSR dev crash returned.

Additional observations:

- In `demo`, this order crashes: `const db = useDb()` before `const someId = id()`.
- In `demo`, flipping the order avoids the crash: `const someId = id()` before `const db = useDb()`.
- In `demo-ssr-bug`, the order no longer matters, and `app.vue` does not need to call `id()` at all.
- In `demo-ssr-bug`, removing the schema from the `init` path avoids the active repro shape observed so far.

The order sensitivity in `demo` is likely caused by Nuxt's auto-import injection and module evaluation order. If `useDb()` is the first unresolved auto-import, Nuxt can evaluate the `useDb -> schema -> @mszr/idb-vux` path before the `shared/utils/idb.ts -> @mszr/idb-vux` path. If `id()` is first, the shared utility path is evaluated earlier. That is a working model, not a final root cause.

### Phase D: Verified Controls on 2026-05-04

Three concrete demos now exist:

1. `demo-ssr-bug`
   - Dependency mode: Bun linked `@mszr/idb-vux`.
   - Config: no symlink-preservation override.
   - Page-load result: HTTP 500.
   - Error: `(0 , __vite_ssr_import_0__.id) is not a function`.

2. `demo-ssr-bug-tarballs`
   - Dependency mode: local tarballs for `@instantdb/version`, `@instantdb/core`, and `@mszr/idb-vux`.
   - Config: same app shape, no symlink-preservation override.
   - Page-load result: HTTP 200, rendering `type of db: object`.

3. `demo-ssr-bug-preserve-symlinks`
   - Dependency mode: Bun linked `@mszr/idb-vux`.
   - Config:

     ```ts
     export default defineNuxtConfig({
       vite: {
         resolve: {
           preserveSymlinks: true,
         },
       },
     })
     ```

   - Page-load result: HTTP 200, rendering `type of db: object`.

This makes `vite.resolve.preserveSymlinks: true` the first verified linked-dependency mitigation for the current minimal repro.

This is a standard module-identity control, not a package-specific trick. Vite documents `resolve.preserveSymlinks` as causing file identity to be determined by the original symlink path instead of the resolved real path. Node's `--preserve-symlinks` flag describes the same underlying distinction for module loading, and Rollup exposes the same concept as `preserveSymlinks`.

## Build, Pack, and Link Notes

The current package exports point linked consumers at `dist/esm/index.js`, and packed consumers also use the same built entrypoint. A dry-run pack confirms that the tarball contains `dist` and `package.json`, while excluding source, docs, demos, and nested demo `node_modules`.

That means the build script is not the leading suspect right now. The tarball does not appear to compile a fundamentally different entrypoint; it changes the package boundary. Linked demos point `node_modules/@mszr/idb-vux` back to the package root (`client/packages/vux`), and that package root also contains the demo directories. Packed installs present Nuxt/Vite with a normal package directory containing only published files.

The new `preserveSymlinks` result sharpens this: the crash is very likely tied to how Nuxt/Vite/vite-node resolves linked package identity through symlinks. If preserving the symlink path avoids the bad SSR transform/evaluation state, then the bug is probably not in `id`, `defineQuery`, or the Vue wrapper API.

Current working distinction:

- Packed dependency: pruned package boundary, no demo folders inside the installed package, no symlink back to an ancestor containing the app.
- Linked dependency: symlink to the full package root, including demos, docs, source, `dist`, and potentially nested demo dependency trees.

This does not prove every linked dependency shape is broken, but it does show that the default symlink-realpath behavior can trigger the crash and that both tarballs and `preserveSymlinks` can avoid it for the current repro.

## Current Working Model

The best current hypothesis is a Nuxt/Vite SSR dev module-graph bug triggered by this combination:

1. A linked package entrypoint re-exports runtime values.
2. Multiple app modules import different values from that same entrypoint.
3. At least one auto-scanned `shared/` module performs a top-level call to one of those re-exported values.
4. Another top-level path imports a schema module and calls another entrypoint export (`init`) with that schema.
5. The linked package target is the full package root rather than the pruned package contents that would be installed from a tarball.
6. Vite/Nuxt resolves the symlink to its real path, causing the same package graph to be evaluated under an identity/order that exposes bad re-export state during SSR dev.

This points first at Nuxt's dev SSR/import handling, with Vite SSR evaluation as the next likely layer if the issue can be reproduced without Nuxt.

`preserveSymlinks: true` should be included in the upstream report because it is a strong clue about module identity.

## Who to Report To

Start with Nuxt if a library-agnostic repro can be reduced around `shared/` auto-imports, order-sensitive `<script setup>` imports, and a locally linked package. The `shared/` scan and generated `#imports` surface are Nuxt-specific.

Escalate to Vite if the same failure can be reproduced with Vite SSR alone, without Nuxt's `shared/` auto-import layer.

Nitro is a secondary possibility because the failure appears in Nuxt dev SSR, but the current evidence is more about module transform/evaluation than route serving.

InstantDB is not the primary suspect unless a minimal package-agnostic repro fails to reproduce and the issue turns out to depend on InstantDB's internal entrypoint shape or cycles. Vue itself is the least likely owner based on the evidence so far.

## Next Experiments

1. Reduce a library-agnostic repro further only if the linked demo still fails after the expected symlink configuration is applied. The previous fake SDK attempt rendered HTTP 200 and was removed because it was not issue-ready.
2. Test whether disabling Nuxt's shared auto-import scan for the idb utility changes the result.
3. Test a linked "published-shape" directory that contains only `package.json` and `dist`, without using tarballs.
4. If a Nuxt-agnostic repro can be made stable, remove Nuxt and try Vite SSR `ssrLoadModule`.

## Operational Guidance for Now

- Keep treating this as an active investigation.
- Do not rely on the old conclusion that linked dependencies are fully safe.
- Do not conclude that linked dependencies are inherently broken either.
- Use tarballs or a pruned published-shape local package when you need the SSR demo to be stable.
- For linked local development in Nuxt, try `vite.resolve.preserveSymlinks: true`; it is verified against `demo-ssr-bug-preserve-symlinks`.
- Keep pnpm demos isolated with a local `pnpm-workspace.yaml`; that still avoids unrelated monorepo dependency resolution noise.
- Keep SSR probes representative: include a `shared/` top-level call, a schema module that imports/calls `i`, and an app/composable path that calls `init({ schema })`.
