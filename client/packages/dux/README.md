# dux Maintainer Workspace

Welcome to the dux maintainer area inside **idb**.

**dux** (`@mszr/idb-dux`) is a DX/UX-first reimagining of the InstantDB developer experience. It keeps Instant's backend, wire protocol, and rules engine exactly as they are, and rebuilds the authoring and client surface around a single question: *what would feel most delightful to use?*

## Quick repo context

- This repository is a fork of `instantdb/instant`.
- We usually call the repo/project **idb** for short.
- The main active area for dux work is this folder: `client/packages/dux`.
- The official SDK sources live beside us in `client/packages/*` — they are dux's vendor sources, parity anchors, and compatibility targets.

## What this folder contains

- `idb-dux/` — the publishable package, `@mszr/idb-dux`
- `docs/` — the vision, conventions, and specs that drive the implementation
- `scripts/` — workflow automation for maintainers (lands with the phases that need it)
- `packs/` — local tarballs used in maintainer workflows (gitignored)

## Start here

- **The hub**: [`docs/dux-vision.md`](./docs/dux-vision.md) — philosophy, architecture, scope, roadmap, and the index over every other doc
- Cross-cutting law: [`docs/dux-conventions.md`](./docs/dux-conventions.md)
- Maintainer manual: [`docs/dux-spec-workspace.md`](./docs/dux-spec-workspace.md)
- Package front door: [`idb-dux/README.md`](./idb-dux/README.md)

## Top maintainer commands

Run from `client/packages/dux`:

1. `pnpm run sdk:build:all` — build the official workspace deps, then ours
2. `pnpm run sdk:build:ours` — build `@mszr/idb-dux` (all entrypoints)
3. `pnpm run sdk:test` — run every assertion plane (runtime, types, editor DX)
4. `pnpm run sdk:typecheck`
5. `pnpm run sdk:lint` / `pnpm run lint`
