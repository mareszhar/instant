# Vux Maintainer Workspace

> **Deprecated.** Vux has been superseded by [Dux](../dux/README.md) (`client/packages/dux`), a framework-agnostic DX-first SDK. No further development will happen here.

Welcome to the Vux maintainer area inside **idb**.

## Quick repo context

- This repository is a fork of `instantdb/instant`.
- We usually call the repo/project **idb** for short.
- The main active area for Vux SDK work is this folder: `client/packages/vux`.
- The official Vue SDK is `@instantdb/vue`.
- Vux is our custom DX/UX-first Vue SDK, configured to be released as `@mszr/idb-vux`.

## What this folder contains

- `idb-vux/` — publishable DX/UX-first Vue SDK package + user-facing docs
- `docs/` — maintainer docs and drafts/archives (in `docs/notes/`)
- `sandbox/` — local experiments, repros, and test apps
- `scripts/` — workflow automation for maintainers
- `packs/` — local tarballs used in maintainer workflows

## Start here

- Maintainer docs index: [`docs/README.md`](./docs/README.md)
- SDK user entrypoint: [`idb-vux/README.md`](./idb-vux/README.md)
- SDK docs quick start: [`idb-vux/docs/getting-started.md`](./idb-vux/docs/getting-started.md)
- Current SSR contract: [`idb-vux/docs/nuxt-ssr-resilience.md`](./idb-vux/docs/nuxt-ssr-resilience.md)

## Top maintainer commands

Run from `client/packages/vux`:

1. `pnpm run sdk:build:all`
2. `pnpm run sdk:test`
3. `pnpm run sdk:publish-package`
4. `pnpm run sdk:demo:main:idb`
5. `pnpm run sdk:demo:main:idb:links`
6. `pnpm run sdk:demo:all:upi`
7. `pnpm run sdk:demo:all:typecheck`
8. `pnpm run sdk:demo:all:build`
9. `pnpm run sdk:demo:all:refresh`
10. `pnpm run sdk:demo:main:dev`
