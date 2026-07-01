# demo-ssr-bug

This sandbox preserves the Nuxt dev SSR linked-dependency failure mode that can appear when the package is consumed through a local link instead of a packed/published package.

## Repro Shape

The smallest useful repro keeps package entrypoint calls at module-evaluation time:

- `shared/utils/idb.ts` imports `id` from `@mszr/idb-dux`, re-exports it, and calls `id()` at module scope.
- `instant.schema.ts` imports `i` from `@mszr/idb-dux` and creates the schema at module scope.
- `app/app.vue` imports `init`, imports the schema, and calls `init({ appId, schema })` during `<script setup>` evaluation.
- The app consumes `@mszr/idb-dux` through a local link with `ssr: true` enabled.

The historical symptom was an SSR 500 in Nuxt/Vite dev where an imported entrypoint value was not the expected callable export, commonly surfacing as an error shaped like:

```txt
(0 , __vite_ssr_import_0__.id) is not a function
```

## Findings

- The failure is tied to linked-package identity and Nuxt/Vite SSR module evaluation, not to the package's packed artifact shape. Tarball installs are the control because they present Nuxt with a normal published-package directory containing only package files.
- `vite.resolve.preserveSymlinks: true` can make the linked repro render successfully by keeping module identity stable across the symlink boundary.
- Adding the package to `vite.optimizeDeps.exclude` is useful for link-mode consistency, but was not by itself the root fix in the original repro.
- Forcing SSR externalization was not sufficient in the historical repro.
- Evaluation order can affect whether the bug appears. Nuxt auto-imports and module graph ordering may evaluate `useDb -> schema -> @mszr/idb-dux` before or after another import path that touches the package entrypoint. Treat order sensitivity as a signal that there are two identities or transforms of the same package in play, not as the root cause.

## Maintainer Guidance

- Keep this sandbox focused on the linked-dependency SSR bug. The main demo should validate real app behavior; this sandbox is for reproducing package-resolution edge cases.
- When validating a fix, compare link mode against a tarball/published-package control.
- Link mode may require applying the workspace's link-mode Vite patch; packed/npm modes should not need it.
- If this failure returns, first inspect package identity, symlink preservation, optimize-deps handling, and Nuxt auto-import/module-evaluation order before changing public APIs.
