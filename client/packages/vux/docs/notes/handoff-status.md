updated: 2026-04-29

# Handoff Status

## Delivered in this package

- Vux SDK core (`init`, database class, room hooks, auth/cursor components)
- Infinite query hook (`useInfiniteQuery`) with reactive-query support
- Public exports using modern non-deprecated core type surface
- `dist/cli` export for schema/perms-safe loading path
- Automated tests for core hooks, room hooks, and components
- Nuxt 4 demo with client SDK and server Admin SDK routes
- Demo workspace integration (`idb-vux-demo`) for local monorepo runs

## Roadmap progress

- Phase 1 (Infinite Query Parity): completed on 2026-04-29
- Phase 2 (SSR Adapter MVP): next priority
- Phase 3 (SSR Suspense/DX Parity): pending
- Phase 4 (Misc Surface Parity): pending

## Verified commands

- `pnpm --filter @mszr/idb-vux lint`
- `pnpm --filter @mszr/idb-vux typecheck`
- `pnpm --filter @mszr/idb-vux test`
- `pnpm --filter @mszr/idb-vux build`
- `pnpm --dir packages/vux/sandbox/demo-preclean lint`
- `pnpm --dir packages/vux/sandbox/demo-preclean typecheck`
- `pnpm --dir packages/vux/sandbox/demo-preclean build`

## Current limitations

- Full SSR data/hydration support for Vue/Nuxt is not implemented yet
- Server-runtime behavior is resilient/inert (safe no-crash fallback) rather than SSR-enabled
- SSR smoke test (`ssr: true`) confirms no crash for page render, but data remains client-loaded

## Internal references

- Nuxt usage and runtime notes: `client/packages/vux/idb-vux/docs/nuxt-ssr-resilience.md`
- API reference and parity-facing surface summary: `client/packages/vux/idb-vux/docs/api-reference.md`
- Infinite query usage/caveats: `client/packages/vux/idb-vux/docs/infinite-queries.md`
- Architecture and SSR resilience design notes: `client/packages/vux/docs/architecture.md`
- SSR feasibility analysis snapshot: `client/packages/vux/docs/notes/ssr-feasibility.md`
- Cross-SDK parity audit snapshot: `client/packages/vux/docs/notes/feature-parity-audit.md`
- Misc parity feasibility snapshot: `client/packages/vux/docs/notes/misc-feature-feasibility.md`
- Maintainer roadmap (active): `client/packages/vux/docs/roadmap.md`
