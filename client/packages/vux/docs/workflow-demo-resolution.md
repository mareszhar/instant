# Demo Resolution Workflow

Audience: maintainers iterating on local SDK changes.

This is the canonical workflow for keeping demos in sync with local SDK work.

## Command architecture

Commands are intentionally split by responsibility:

1. Build/pack commands
- build SDK artifacts and/or tarballs
- do not change demo resolution
- do not refresh demo runtime caches

2. Resolution commands
- rewrite InstantDB dependency resolution in demo manifests
- apply/remove Nuxt `vite.resolve.preserveSymlinks` + `vite.optimizeDeps.exclude` (`@mszr/idb-vux`) for links-mode compatibility
- do not build/pack
- do not install/refresh/prep

3. Refresh commands
- clear runtime caches, reinstall demo deps, and run `nuxt prepare`
- do not change resolution mode
- do not build/pack

4. Demo all-command runner
- run a supported script command across main demo + all sandbox demos (`upi`, `typecheck`, `build`)
- do not change resolution mode
- do not build/pack/refresh

## Build and pack

From `client/packages/vux`:

- Build all SDK surfaces: `pnpm run sdk:build:all`
- Pack only Vux SDK: `pnpm run sdk:pack:ours` (`spo`)
- Pack all InstantDB SDK tarballs: `pnpm run sdk:pack:all` (`spa`)

Rule of thumb:

- changed only `@mszr/idb-vux`: use `spo`
- rebased or touched multiple SDKs (`core/webhooks/admin/version/idb-vux`): use `spa`

## Resolution commands

From `client/packages/vux`:

- Main demo status: `pnpm run sdk:demo:main:idb`
- Sandbox demo statuses: `pnpm run sdk:demo:sandbox:idb`
- Set main demo to links: `pnpm run sdk:demo:main:idb:links` (`sdmil`)
- Set main demo to tarballs: `pnpm run sdk:demo:main:idb:tarballs` (`sdmit`)
- Set main demo to npm: `pnpm run sdk:demo:main:idb:npm` (`sdmin`)
- Pick target demo + mode: `pnpm run sdk:demo:pick:idb -- --demo <main|sandbox-demo-name> --idb <links|tarballs|npm>` (`sdpi`)

Examples:

- `pnpm run sdk:demo:pick:idb -- --demo demo-preclean --idb links`
- `pnpm run sdk:demo:pick:idb -- --demo demo-ssr-bug-tarballs --idb tarballs`

## Refresh commands

From `client/packages/vux`:

- Refresh main demo: `pnpm run sdk:demo:main:refresh` (`sdmr`)
- Refresh picked demo: `pnpm run sdk:demo:pick:refresh -- --demo <main|sandbox-demo-name>` (`sdpr`)
- Refresh all demos: `pnpm run sdk:demo:all:refresh` (`sdar`, alias `sra`)

Refresh behavior:

- clears `.nuxt`, `.output`, and Vite/Nuxt cache dirs
- runs `bun install --force` in each selected demo
- runs demo `prep` script (`nuxt prepare`)

## Demo dependency upgrades

From `client/packages/vux`:

- Upgrade dependencies across main + all sandbox demos: `pnpm run sdk:demo:all:upi` (`sdau`)

## Demo all-commands

From `client/packages/vux`:

- Typecheck all demos: `pnpm run sdk:demo:all:typecheck` (`sdat`)
- Build all demos: `pnpm run sdk:demo:all:build` (`sdab`)

## Practical workflows

1. SDK changed and you want all demos updated:
- `pnpm run sdk:pack:ours` (or `pnpm run sdk:pack:all` when needed)
- `pnpm run sdk:demo:all:refresh`

2. Switch main demo mode and test quickly:
- `pnpm run sdk:demo:main:idb:links` (or tarballs/npm)
- `pnpm run sdk:demo:main:refresh`

3. Switch one sandbox demo mode:
- `pnpm run sdk:demo:pick:idb -- --demo <sandbox-demo-name> --idb <links|tarballs|npm>`
- `pnpm run sdk:demo:pick:refresh -- --demo <sandbox-demo-name>`

## Stale runtime symptoms

Typical signals:

- typecheck passes but runtime fails with export/API mismatch
- IDE shows latest types but demo behaves like older build output

When this happens, use the matching refresh command for the demo(s) you are testing.
