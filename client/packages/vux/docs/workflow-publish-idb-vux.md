# Publish `idb-vux`

Audience: maintainers releasing from this fork to `mareszhar/idb-vux` and npm.

## Principles

- Development source of truth is this fork workspace.
- Public package history in `idb-vux` should stay clean and release-oriented.
- Maintainer-only workspace files never leave the subtree boundary.

## One-time setup

1. Create empty GitHub repo: `mareszhar/idb-vux`
2. Add remote from this repo: `git remote add idb-vux git@github.com:mareszhar/idb-vux.git`

## Publish flow

1. Merge release-ready work into your release source branch (typically `main`).
2. Push package subtree: `git subtree push --prefix=client/packages/vux/idb-vux idb-vux main --squash`
3. Tag release if needed: `git tag vX.Y.Z && git push idb-vux vX.Y.Z`
4. Publish npm package from `client/packages/vux`: `pnpm run sdk:publish-package`

### What `sdk:publish-package` does

- reads the shared local repo version from `client/packages/version/src/version.ts`
- temporarily pins local Instant dependencies in `idb-vux/package.json` to that exact version
- verifies those exact versions exist on npm registry
- rebuilds SDK (`build` clears `dist`), packs, and publishes
- restores `idb-vux/package.json` after publish (or publish failure)

This keeps publishes aligned with local repo state and prevents stale `dist` from being shipped.

## Optional speed path

For large histories, split and push from cache branch:

1. `git subtree split --prefix=client/packages/vux/idb-vux --branch idb-vux-split`
2. `git push idb-vux idb-vux-split:main`

## References

- Maintainer roadmap: [`../roadmap.md`](../roadmap.md)
- SDK user entrypoint: [`../../idb-vux/README.md`](../../idb-vux/README.md)
