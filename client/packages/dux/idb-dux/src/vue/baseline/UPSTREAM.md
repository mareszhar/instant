# Baseline vendor stamp

This directory is the **internal baseline** for `/vue` — a near-verbatim mirror
of `@instantdb/vue`, the parity anchor and the upstream-porting surface. It is
never exported; the public hooks compose it ([dux-spec-vue.md §9]).

## Vendored from

- **Package:** `@instantdb/vue` (this fork's `client/packages/vue`)
- **Commit:** `895f304a507b6796ac6222bd331ee3c08fab2710`
- **Date:** 2026-06-11

## File map

| baseline file | upstream source |
|---|---|
| `InstantDuxDatabase.ts` | `src/InstantVueDatabase.ts` |
| `InstantDuxRoom.ts` | `src/InstantVueRoom.ts` |
| `useInfiniteQuery.ts` | `src/useInfiniteQuery.ts` |
| `utils.ts` | `src/utils.ts` |
| `version.ts` | `src/version.ts` |
| `components/auth.ts` | `src/components/SignedIn.vue` + `SignedOut.vue` |
| `components/Cursors.ts` | `src/components/Cursors.vue` |
| `components/Cursor.ts` | `src/components/Cursor.vue` |

## Permitted deltas (all fenced `DUX-DELTA(...)`)

1. **`ssr`** — SSR-resilience floor: every reactive hook guards its reactor
   subscription on `isClient()`, returning inert state on the server. The
   `isClient()` helper in `utils.ts` is dux's own addition.
2. **`components`** — components ship as `.ts` render functions rather than
   `.vue` SFCs (no SFC compile step; boundary-lint-visible source).
3. Class/handle renames (`InstantVue*` → `InstantDux*`) and the framework
   version tag (`@mszr/idb-dux`).

## Re-vendoring

`scripts/check-baseline-drift.mjs` checks git history for each mapped upstream
source relative to the commit above. When it reports drift, re-copy the changed
upstream file and re-apply the fenced deltas, then bump the commit stamp here.
See [dux-spec-workspace.md §5].
