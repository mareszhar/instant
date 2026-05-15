updated: 2026-05-04

# SSR Demo Workspace Guidance

This document captures practical guidance from the Nuxt SSR entrypoint-call investigation. The investigation is open again as of 2026-05-04, but we now have one verified linked-dependency mitigation.

## Problem Class

We have observed Nuxt dev SSR crashes when several conditions overlap:

1. `ssr: true`
2. local consumption of `@mszr/idb-vux`
3. top-level calls to values exported from the SDK entrypoint
4. Nuxt `shared/` utilities that are auto-scanned and can enter the server graph
5. a schema module that imports `i` and constructs a schema at module scope
6. an app/composable path that calls `init({ schema })`

Typical errors include:

- `(0, __vite_ssr_import_X__.defineQuery) is not a function`
- `(0, __vite_ssr_import_X__.id) is not a function`
- `Cannot access '__vite_ssr_import_X__' before initialization`

The old minimal probes were too narrow. They showed that some linked dependency setups can work, but they did not include the current failing interplay between `shared/utils/idb.ts`, `instant.schema.ts`, and `init({ schema })`.

The crashing export does not have to be a core re-export. `defineQuery` is defined in the Vux package and still hit this class of failure; the graph also included `instant.schema.ts` importing `i`, which is re-exported from core.

## Current Findings

- The crash is not specific to `id` or `defineQuery`; those exports are just convenient probes.
- Linked dependencies are not proven to be the root cause.
- Linked dependencies are also not proven safe for this Nuxt SSR shape.
- Packed tarballs still work as a practical mitigation because they present Nuxt with a pruned published package instead of a symlink to the full package root.
- `vite.resolve.preserveSymlinks: true` also works for the current linked `demo-ssr-bug` shape.
- Nuxt auto-scans `shared/utils/idb.ts`, so a top-level call in that file can matter even when `app.vue` does not explicitly call that export.
- The main `demo` currently has an order-sensitive shape: calling `useDb()` before `id()` crashes, while calling `id()` before `useDb()` avoids the crash. Treat that as a symptom of module evaluation order, not as a valid workaround.

## Recommended Setup for pnpm Demos

Keep pnpm demos intentionally scoped. Add a local `pnpm-workspace.yaml` at the demo root:

```yaml
packages:
  - .
```

If the demo intentionally consumes local workspace packages directly, include those package paths explicitly in the local workspace file.

This remains necessary because a nested pnpm demo can otherwise inherit the parent monorepo workspace and try to resolve/install far more than the demo actually owns.

## Recommended SSR Probes

A useful SSR probe should include the full currently suspicious shape:

1. A `shared/utils` module that imports from `@mszr/idb-vux`, re-exports the imported value, and performs a top-level call.
2. An `instant.schema.ts` module that imports `i` from `@mszr/idb-vux` and creates a schema at module scope.
3. An app or composable path that imports/calls `init({ schema })`.
4. A render path that confirms the app can SSR without throwing.

Simple probes that only call `id()` or `defineQuery()` in isolation are no longer enough to validate linked dependency safety.

For page-load verification in environments that hit watcher `EMFILE`, use:

```sh
CHOKIDAR_USEPOLLING=1 bunx nuxi dev --no-fork
curl -sS -D - http://localhost:3000/
```

The server may still log watcher noise, but this path has been enough to verify the SSR response in Codex.

## Fast Iteration Options

Use linked dependencies for fast local iteration only with eyes open. They are still useful, but they should be tested against the full SSR probe above.

For Nuxt linked-dependency demos, prefer this config while the upstream issue is open:

```ts
export default defineNuxtConfig({
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
  },
})
```

This config is verified in `demo-ssr-bug-preserve-symlinks`, which renders HTTP 200 under the same page-load check that makes `demo-ssr-bug` render HTTP 500. It also matches Vite's documented purpose for `resolve.preserveSymlinks`: keep module identity based on the symlink path instead of resolving through to the real path.

Use packed tarballs when you need npm-install fidelity or a stable SSR demo. Tarballs are slower, but they remove the full-package-root symlink from the module graph.

A possible middle path is a local "published-shape" directory that contains only `package.json` and `dist`, then linking the demo to that directory. This has not yet been validated, but it would test whether tarball stability comes from the pruned package boundary rather than the archive/install mechanism itself.

## Notes on Bun

Bun avoids pnpm workspace inheritance issues, but it does not by itself prove that linked dependencies are safe for Nuxt SSR. The current Bun-linked demos can still hit the reopened SSR crash shape.

## Current Recommendation

For day-to-day development, prefer the fastest workflow that still runs the full SSR probe before you trust a change. For linked Nuxt demos, use `preserveSymlinks: true` first. For demos meant to be publish-fidelity evidence, use tarballs or a pruned published-shape local package.
